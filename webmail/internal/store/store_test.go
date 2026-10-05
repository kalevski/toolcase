package store

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
	"time"
)

func TestMigrationsAndReopen(t *testing.T) {
	dir := t.TempDir()
	ctx := context.Background()
	s, err := Open(ctx, dir, Options{})
	if err != nil {
		t.Fatal(err)
	}
	if v, _ := s.Version(ctx); v != SchemaVersion() || v < 1 {
		t.Fatalf("version %d", v)
	}
	now := time.Unix(1_700_000_000, 0)
	if err := s.CreateSession(ctx, &Session{ID: "h1", PublicID: "p1", Address: "a@x.test", CreatedAt: now, LastUsedAt: now,
		IdleExpiresAt: now.Add(time.Hour), ExpiresAt: now.Add(2 * time.Hour), CredSealed: []byte{1}, CSRF: "c"}); err != nil {
		t.Fatal(err)
	}
	s.Close()
	s, err = Open(ctx, dir, Options{}) // reopen is idempotent and keeps data
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	got, err := s.GetSession(ctx, "h1")
	if err != nil || got.PublicID != "p1" {
		t.Fatalf("%v %v", got, err)
	}
	if _, err := s.GetSession(ctx, "nope"); err != ErrNotFound {
		t.Fatalf("%v", err)
	}
	if err := s.PutPrefs(ctx, "a@x.test", `{"a":1}`, now); err != nil {
		t.Fatal(err)
	}
	if j, _ := s.GetPrefs(ctx, "a@x.test"); j != `{"a":1}` {
		t.Fatal(j)
	}
}

func TestNewerSchemaRefused(t *testing.T) {
	dir := t.TempDir()
	ctx := context.Background()
	s, _ := Open(ctx, dir, Options{})
	s.Close()
	db, _ := sql.Open("sqlite", filepath.Join(dir, "webmail.db"))
	db.Exec("PRAGMA user_version = 999")
	db.Close()
	if _, err := Open(ctx, dir, Options{}); err == nil {
		t.Fatal("opened a database from the future")
	}
}

func TestTakeSessions(t *testing.T) {
	ctx := context.Background()
	s, _ := Open(ctx, t.TempDir(), Options{})
	defer s.Close()
	now := time.Unix(1_700_000_000, 0)
	mk := func(id, pid, addr string, idle, abs time.Duration) {
		s.CreateSession(ctx, &Session{ID: id, PublicID: pid, Address: addr, CreatedAt: now, LastUsedAt: now,
			IdleExpiresAt: now.Add(idle), ExpiresAt: now.Add(abs), CredSealed: []byte{1}, CSRF: "c"})
	}
	mk("1", "p1", "a@x.test", time.Hour, 2*time.Hour)
	mk("2", "p2", "a@x.test", -time.Minute, time.Hour)
	mk("3", "p3", "b@x.test", time.Hour, 2*time.Hour)
	live, _ := s.ListSessions(ctx, "a@x.test", now)
	if len(live) != 1 {
		t.Fatalf("expired session listed: %d", len(live))
	}
	if x, err := s.TakeSessionByPublicID(ctx, "b@x.test", "p1"); err == nil {
		t.Fatalf("took another mailbox's session: %v", x)
	}
	dead, _ := s.TakeExpired(ctx, now)
	if len(dead) != 1 || dead[0].ID != "2" {
		t.Fatalf("%v", dead)
	}
	all, _ := s.TakeAllSessions(ctx, "a@x.test")
	if len(all) != 1 {
		t.Fatalf("%d", len(all))
	}
	if n, _ := s.CountSessions(ctx); n != 1 {
		t.Fatalf("%d", n)
	}
}
