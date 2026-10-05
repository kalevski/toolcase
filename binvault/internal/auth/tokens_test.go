package auth

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/seal"
)

func testStore(t *testing.T) (*Store, *meta.DB) {
	t.Helper()
	ctx := context.Background()
	db, err := meta.Open(ctx, filepath.Join(t.TempDir(), "meta.db"), meta.Options{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	ring, err := seal.New(key)
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Update(ctx, func(tx *meta.Tx) error {
		return tx.CreateBucket(ctx, &meta.Bucket{Name: "photos", Versioning: meta.VersioningOff, Encryption: meta.EncryptionNone, AnonymousRead: meta.AnonOff})
	}); err != nil {
		t.Fatal(err)
	}
	return NewStore(db, ring), db
}

func TestStoreLookupExpiryRevoke(t *testing.T) {
	ctx := context.Background()
	s, db := testStore(t)
	id, secret := NewAccessKeyID(BucketKeyPrefix), NewSecret()
	sealed, err := s.SealSecret(id, secret)
	if err != nil {
		t.Fatal(err)
	}
	exp := time.Now().Add(time.Hour)
	tok := &meta.Token{AccessKeyID: id, Bucket: "photos", Name: "web", Secret: sealed,
		Grants: []meta.Grant{{Actions: []string{"read"}}}, ExpiresAt: &exp}
	if err := db.Update(ctx, func(tx *meta.Tx) error { return tx.CreateToken(ctx, tok) }); err != nil {
		t.Fatal(err)
	}

	c, err := s.Lookup(ctx, id)
	if err != nil || c == nil || c.Secret != secret || !c.Grants.Can(Read, "x") {
		t.Fatalf("lookup %v %v", c, err)
	}
	if c.Principal().Label() != "token:"+id {
		t.Fatal("label")
	}
	if got, _ := s.Lookup(ctx, "BVKNOSUCHKEYNOSUCHKE"); got != nil {
		t.Fatal("unknown key found")
	}

	// expiry is checked on every lookup, cached or not
	s.Now = func() time.Time { return time.Now().Add(2 * time.Hour) }
	if got, _ := s.Lookup(ctx, id); got != nil {
		t.Fatal("expired token accepted")
	}
	s.Now = time.Now

	// revocation takes effect once the cache entry is dropped
	if err := db.Update(ctx, func(tx *meta.Tx) error { return tx.DeleteToken(ctx, id) }); err != nil {
		t.Fatal(err)
	}
	s.Invalidate(id)
	if got, _ := s.Lookup(ctx, id); got != nil {
		t.Fatal("revoked token accepted")
	}
}

func TestTouchFlush(t *testing.T) {
	ctx := context.Background()
	s, db := testStore(t)
	id := NewAccessKeyID(BucketKeyPrefix)
	sealed, _ := s.SealSecret(id, NewSecret())
	if err := db.Update(ctx, func(tx *meta.Tx) error {
		return tx.CreateToken(ctx, &meta.Token{AccessKeyID: id, Bucket: "photos", Name: "n", Secret: sealed,
			Grants: []meta.Grant{{Actions: []string{"read"}}}})
	}); err != nil {
		t.Fatal(err)
	}
	s.Touch(id)
	if err := s.Flush(ctx); err != nil {
		t.Fatal(err)
	}
	tok, err := db.Read().GetToken(ctx, id)
	if err != nil || tok.LastUsedAt == nil {
		t.Fatalf("last_used_at not stored: %+v %v", tok, err)
	}
}

// A Lookup that read a token before it was revoked must not put it into the
// cache afterwards: the revoked token would stay usable until a restart.
func TestStaleLookupDoesNotRepopulateTheCache(t *testing.T) {
	ctx := context.Background()
	for name, invalidate := range map[string]func(s *Store, id string){
		"token":  func(s *Store, id string) { s.Invalidate(id) },
		"bucket": func(s *Store, _ string) { s.InvalidateBucket("photos") },
	} {
		t.Run(name, func(t *testing.T) {
			s, db := testStore(t)
			id, secret := NewAccessKeyID(BucketKeyPrefix), NewSecret()
			sealed, err := s.SealSecret(id, secret)
			if err != nil {
				t.Fatal(err)
			}
			tok := &meta.Token{AccessKeyID: id, Bucket: "photos", Name: "web", Secret: sealed, Grants: []meta.Grant{{Actions: []string{"read"}}}}
			if err := db.Update(ctx, func(tx *meta.Tx) error { return tx.CreateToken(ctx, tok) }); err != nil {
				t.Fatal(err)
			}
			// the revocation lands while the lookup is between its read and its cache insert
			s.afterRead = func() {
				if err := db.Update(ctx, func(tx *meta.Tx) error { return tx.DeleteToken(ctx, id) }); err != nil {
					t.Error(err)
				}
				invalidate(s, id)
			}
			if c, err := s.Lookup(ctx, id); err != nil || c == nil {
				t.Fatalf("the lookup that began before the revocation answers with what it read: %v %v", c, err)
			}
			s.afterRead = nil
			if c, err := s.Lookup(ctx, id); err != nil || c != nil {
				t.Fatalf("a revoked token was served from the cache: %v %v", c, err)
			}
		})
	}
}
