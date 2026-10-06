package store

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"testing"
	"time"
)

type fakeClock struct {
	mu sync.Mutex
	t  time.Time
}

func (c *fakeClock) now() time.Time { c.mu.Lock(); defer c.mu.Unlock(); return c.t }
func (c *fakeClock) add(d time.Duration) {
	c.mu.Lock()
	c.t = c.t.Add(d)
	c.mu.Unlock()
}

func cacheStore(t *testing.T, ttl time.Duration) (*Store, *fakeClock, *sql.DB) {
	t.Helper()
	ck := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	s, err := Open(context.Background(), t.TempDir(), Options{Now: ck.now, SessionCacheTTL: ttl})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	// A second handle plays "another process writing the same file".
	db, err := sql.Open("sqlite", s.Path())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return s, ck, db
}

func mkSession(ck *fakeClock, id, public, addr string) *Session {
	now := ck.now()
	return &Session{ID: id, PublicID: public, Address: addr, CreatedAt: now, LastUsedAt: now,
		IdleExpiresAt: now.Add(time.Hour), ExpiresAt: now.Add(2 * time.Hour), CredSealed: []byte{1, 2, 3}, CSRF: "c"}
}

func TestSessionCacheServesAndTTLRefetches(t *testing.T) {
	s, ck, db := cacheStore(t, 5*time.Second)
	ctx := context.Background()
	if err := s.CreateSession(ctx, mkSession(ck, "h1", "p1", "a@x.test")); err != nil {
		t.Fatal(err)
	}
	if _, err := s.GetSession(ctx, "h1"); err != nil { // fill
		t.Fatal(err)
	}
	// Out-of-band delete is invisible until the TTL passes (the documented bound).
	db.Exec(`DELETE FROM sessions WHERE id = 'h1'`)
	if _, err := s.GetSession(ctx, "h1"); err != nil {
		t.Fatalf("expected cached hit, got %v", err)
	}
	ck.add(4 * time.Second)
	if _, err := s.GetSession(ctx, "h1"); err != nil {
		t.Fatalf("still within TTL: %v", err)
	}
	ck.add(2 * time.Second)
	if _, err := s.GetSession(ctx, "h1"); err != ErrNotFound {
		t.Fatalf("TTL expiry must refetch: %v", err)
	}
}

func TestSessionCacheDisabled(t *testing.T) {
	s, ck, db := cacheStore(t, -1)
	ctx := context.Background()
	s.CreateSession(ctx, mkSession(ck, "h1", "p1", "a@x.test"))
	s.GetSession(ctx, "h1")
	db.Exec(`DELETE FROM sessions WHERE id = 'h1'`)
	if _, err := s.GetSession(ctx, "h1"); err != ErrNotFound {
		t.Fatalf("disabled cache must read through: %v", err)
	}
}

func TestSessionCacheInvalidatedByEveryWriter(t *testing.T) {
	ctx := context.Background()
	warm := func(s *Store, ck *fakeClock) {
		s.CreateSession(ctx, mkSession(ck, "h1", "p1", "a@x.test"))
		s.CreateSession(ctx, mkSession(ck, "h2", "p2", "b@x.test"))
		for _, id := range []string{"h1", "h2"} {
			if _, err := s.GetSession(ctx, id); err != nil {
				t.Fatal(err)
			}
		}
	}
	gone := func(s *Store, id string) {
		t.Helper()
		if _, err := s.GetSession(ctx, id); err != ErrNotFound {
			t.Fatalf("%s still served after invalidation: %v", id, err)
		}
	}
	t.Run("DeleteSession", func(t *testing.T) {
		s, ck, _ := cacheStore(t, time.Hour)
		warm(s, ck)
		s.DeleteSession(ctx, "h1")
		gone(s, "h1")
		if _, err := s.GetSession(ctx, "h2"); err != nil {
			t.Fatal(err)
		}
	})
	t.Run("TakeSessionByPublicID", func(t *testing.T) {
		s, ck, _ := cacheStore(t, time.Hour)
		warm(s, ck)
		if _, err := s.TakeSessionByPublicID(ctx, "a@x.test", "p1"); err != nil {
			t.Fatal(err)
		}
		gone(s, "h1")
	})
	t.Run("TakeAllSessions", func(t *testing.T) {
		s, ck, _ := cacheStore(t, time.Hour)
		warm(s, ck)
		s.TakeAllSessions(ctx, "a@x.test")
		gone(s, "h1")
		if _, err := s.GetSession(ctx, "h2"); err != nil {
			t.Fatal(err)
		}
	})
	t.Run("TakeExpired", func(t *testing.T) {
		s, ck, _ := cacheStore(t, time.Hour)
		warm(s, ck)
		s.TakeExpired(ctx, ck.now().Add(3*time.Hour))
		gone(s, "h1")
		gone(s, "h2")
	})
	t.Run("TouchSession", func(t *testing.T) {
		s, ck, _ := cacheStore(t, time.Hour)
		warm(s, ck)
		idle := ck.now().Add(30 * time.Minute)
		s.TouchSession(ctx, "h1", ck.now(), idle)
		got, _ := s.GetSession(ctx, "h1")
		if !got.IdleExpiresAt.Equal(time.Unix(idle.Unix(), 0)) {
			t.Fatalf("idle not refreshed: %v", got.IdleExpiresAt)
		}
	})
	t.Run("SetAccountID", func(t *testing.T) {
		s, ck, _ := cacheStore(t, time.Hour)
		warm(s, ck)
		s.SetAccountID(ctx, "h1", "acct")
		got, _ := s.GetSession(ctx, "h1")
		if got.AccountID != "acct" {
			t.Fatalf("account id stale: %q", got.AccountID)
		}
	})
	t.Run("CreateSession", func(t *testing.T) {
		s, ck, _ := cacheStore(t, time.Hour)
		warm(s, ck)
		s.DeleteSession(ctx, "h1")
		s.CreateSession(ctx, mkSession(ck, "h1", "p9", "a@x.test"))
		if got, err := s.GetSession(ctx, "h1"); err != nil || got.PublicID != "p9" {
			t.Fatalf("%v %v", got, err)
		}
	})
}

func TestSessionCacheReturnsCopies(t *testing.T) {
	s, ck, _ := cacheStore(t, time.Hour)
	ctx := context.Background()
	s.CreateSession(ctx, mkSession(ck, "h1", "p1", "a@x.test"))
	a, _ := s.GetSession(ctx, "h1")
	a.Address, a.CSRF = "evil@x.test", "x"
	a.CredSealed[0] = 99
	b, _ := s.GetSession(ctx, "h1") // from cache
	b.CredSealed[1] = 98
	c, _ := s.GetSession(ctx, "h1")
	if c.Address != "a@x.test" || c.CSRF != "c" || c.CredSealed[0] != 1 || c.CredSealed[1] != 2 {
		t.Fatalf("cached state was mutated: %+v", c)
	}
}

func TestSessionCacheBounded(t *testing.T) {
	ck := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	c := newSessionCache(time.Hour, ck.now)
	for i := 0; i < sessionCacheMax+500; i++ {
		id := fmt.Sprint("id", i)
		c.put(id, &Session{ID: id}, 0)
	}
	if n := c.len(); n != sessionCacheMax {
		t.Fatalf("len %d, want %d", n, sessionCacheMax)
	}
	if _, _, ok := c.get("id0"); ok {
		t.Fatal("oldest should have been evicted")
	}
	if _, _, ok := c.get(fmt.Sprint("id", sessionCacheMax+499)); !ok {
		t.Fatal("newest missing")
	}
	// Stale entries go first.
	ck.add(2 * time.Hour)
	c.put("fresh", &Session{ID: "fresh"}, 0)
	if n := c.len(); n != 1 {
		t.Fatalf("stale entries not swept, len %d", n)
	}
}

func TestSessionCacheFillRacingDeleteIsDiscarded(t *testing.T) {
	ck := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	c := newSessionCache(time.Hour, ck.now)
	_, epoch, _ := c.get("h1") // reader starts its DB read here
	c.drop("h1")               // a delete commits and invalidates
	c.put("h1", &Session{ID: "h1"}, epoch)
	if _, _, ok := c.get("h1"); ok {
		t.Fatal("stale fill resurrected a deleted session")
	}
}

func TestSessionCacheConcurrent(t *testing.T) {
	s, ck, _ := cacheStore(t, time.Hour)
	ctx := context.Background()
	for i := 0; i < 8; i++ {
		s.CreateSession(ctx, mkSession(ck, fmt.Sprint("h", i), fmt.Sprint("p", i), "a@x.test"))
	}
	var wg sync.WaitGroup
	for g := 0; g < 8; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			for i := 0; i < 200; i++ {
				id := fmt.Sprint("h", i%8)
				switch (i + g) % 5 {
				case 0:
					s.TouchSession(ctx, id, ck.now(), ck.now().Add(time.Hour))
				case 1:
					s.DeleteSession(ctx, id)
				case 2:
					s.CreateSession(ctx, mkSession(ck, id, fmt.Sprint("q", g, i), "a@x.test"))
				default:
					if x, err := s.GetSession(ctx, id); err == nil {
						x.CSRF = "mutated"
					}
				}
			}
		}(g)
	}
	wg.Wait()
	// After the dust settles the cache must agree with the table.
	for i := 0; i < 8; i++ {
		id := fmt.Sprint("h", i)
		s.DeleteSession(ctx, id)
		if _, err := s.GetSession(ctx, id); err != ErrNotFound {
			t.Fatalf("%s: %v", id, err)
		}
	}
}
