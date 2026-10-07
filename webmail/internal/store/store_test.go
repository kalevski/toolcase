package store

import (
	"context"
	"database/sql"
	"errors"
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

func TestBrandings(t *testing.T) {
	ctx := context.Background()
	s, err := Open(ctx, t.TempDir(), Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	for _, d := range []string{"b.test", "a.test", "c.example", "d.test"} {
		if err := s.InsertBranding(ctx, &Branding{Domain: d, DisplayName: d, FooterLinks: []FooterLink{{Label: "x", URL: "https://x.test"}}, MailboxCount: 2}); err != nil {
			t.Fatal(err)
		}
	}
	if err := s.InsertBranding(ctx, &Branding{Domain: "a.test"}); !errors.Is(err, ErrExists) {
		t.Fatalf("duplicate: %v", err)
	}
	b, err := s.GetBranding(ctx, "a.test")
	if err != nil || b.DisplayName != "a.test" || len(b.FooterLinks) != 1 || b.MailboxCount != 2 {
		t.Fatalf("%+v %v", b, err)
	}
	if _, err := s.GetBranding(ctx, "nope.test"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing: %v", err)
	}

	page, total, err := s.ListBrandings(ctx, "", "", 3)
	if err != nil || total != 4 || len(page) != 3 || page[0].Domain != "a.test" || page[2].Domain != "c.example" {
		t.Fatalf("page 1: %v %d %v", err, total, page)
	}
	page, _, _ = s.ListBrandings(ctx, "", "c.example", 3)
	if len(page) != 1 || page[0].Domain != "d.test" {
		t.Fatalf("page 2: %v", page)
	}
	page, total, _ = s.ListBrandings(ctx, ".test", "", 10)
	if total != 3 || len(page) != 3 {
		t.Fatalf("filter: %d %v", total, page)
	}
	page, total, _ = s.ListBrandings(ctx, "100%", "", 10)
	if total != 0 || len(page) != 0 {
		t.Fatalf("wildcards are literal: %d %v", total, page)
	}

	if err := s.UpdateBranding(ctx, &Branding{Domain: "a.test", DisplayName: "renamed"}); err != nil {
		t.Fatal(err)
	}
	if b, _ = s.GetBranding(ctx, "a.test"); b.DisplayName != "renamed" || len(b.FooterLinks) != 0 {
		t.Fatalf("update must replace every editable field: %+v", b)
	}
	if err := s.UpdateBranding(ctx, &Branding{Domain: "nope.test"}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("update missing: %v", err)
	}
	if err := s.DeleteBranding(ctx, "a.test"); err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteBranding(ctx, "a.test"); err != nil {
		t.Fatalf("delete is idempotent: %v", err)
	}
	if n, _ := s.CountBrandings(ctx); n != 3 {
		t.Fatalf("count %d", n)
	}
}

func TestMigrationFourKeepsBrandingsAndDropsTheLogoColumns(t *testing.T) {
	db, err := sql.Open("sqlite", "file:"+filepath.Join(t.TempDir(), "old.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, m := range migrations[:3] {
		if _, err := db.Exec(m); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.Exec(`INSERT INTO brandings (domain, display_name, logo, logo_mime, jmap_url, updated_at) VALUES ('a.test', 'Acme', x'89504e47', 'image/png', 'http://one.test', 1)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(migrations[3]); err != nil {
		t.Fatalf("migration 4: %v", err)
	}
	var name, jmap string
	if err := db.QueryRow(`SELECT display_name, jmap_url FROM brandings WHERE domain = 'a.test'`).Scan(&name, &jmap); err != nil || name != "Acme" || jmap != "http://one.test" {
		t.Fatalf("the branding survives: %q %q %v", name, jmap, err)
	}
	if _, err := db.Exec(`SELECT logo FROM brandings`); err == nil {
		t.Fatal("the logo column must be gone")
	}
}
