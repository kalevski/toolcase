package auth

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/seal"
)

// SealToken is the seal record type of a bucket token secret (spec §4.7).
const SealToken = "token"

// Credential is a usable bucket token: the raw secret (needed to verify SigV4)
// and its compiled grants.
type Credential struct {
	Token  *meta.Token
	Secret string
	Grants Grants
}

// Store looks bucket tokens up, opening their sealed secrets, with a bounded
// in-memory cache that is invalidated synchronously on revoke or edit
// (spec §4.3: "takes effect immediately").
type Store struct {
	DB   *meta.DB
	Ring *seal.Keyring
	Now  func() time.Time

	mu      sync.RWMutex
	cache   map[string]*Credential
	touched map[string]time.Time
	// epoch counts invalidations. A Lookup that read the database before an
	// Invalidate must not put its (now stale) result into the cache afterwards:
	// a revoked or narrowed token would then stay usable until a restart.
	epoch uint64
	// afterRead, when set (tests), runs between reading a token and remembering it.
	afterRead func()
}

const maxCache = 8192

// NewStore returns a token store.
func NewStore(db *meta.DB, ring *seal.Keyring) *Store {
	return &Store{DB: db, Ring: ring, Now: time.Now, cache: map[string]*Credential{}, touched: map[string]time.Time{}}
}

// SealSecret seals a token secret for storage.
func (s *Store) SealSecret(accessKeyID, secret string) ([]byte, error) {
	return s.Ring.Seal(SealToken, accessKeyID, []byte(secret))
}

// Lookup finds a live token. An unknown, revoked or expired key is
// (nil, nil): the caller answers InvalidAccessKeyId for all three alike.
func (s *Store) Lookup(ctx context.Context, accessKeyID string) (*Credential, error) {
	s.mu.RLock()
	c := s.cache[accessKeyID]
	epoch := s.epoch
	s.mu.RUnlock()
	if c == nil {
		tok, err := s.DB.Read().GetToken(ctx, accessKeyID)
		if err != nil {
			if errors.Is(err, meta.ErrNotFound) {
				return nil, nil
			}
			return nil, err
		}
		secret, err := s.Ring.Open(SealToken, tok.AccessKeyID, tok.Secret)
		if err != nil {
			return nil, err
		}
		grants, err := CompileGrants(tok.Grants)
		if err != nil {
			return nil, err
		}
		c = &Credential{Token: tok, Secret: string(secret), Grants: grants}
		if s.afterRead != nil {
			s.afterRead()
		}
		s.mu.Lock()
		if s.epoch == epoch { // nothing was invalidated while we read: safe to remember
			if len(s.cache) >= maxCache {
				s.cache = map[string]*Credential{}
			}
			s.cache[accessKeyID] = c
		}
		s.mu.Unlock()
	}
	if c.Token.ExpiresAt != nil && !s.Now().Before(*c.Token.ExpiresAt) {
		return nil, nil
	}
	return c, nil
}

// Principal builds the request principal for a credential.
func (c *Credential) Principal() *Principal {
	return &Principal{
		Kind: KindToken, AccessKey: c.Token.AccessKeyID, Name: c.Token.Name, Bucket: c.Token.Bucket,
		Grants: c.Grants, Limits: c.Token.Limits,
	}
}

// Invalidate drops a token from the cache (revoke, edit).
func (s *Store) Invalidate(accessKeyID string) {
	s.mu.Lock()
	delete(s.cache, accessKeyID)
	s.epoch++
	s.mu.Unlock()
}

// InvalidateBucket drops every cached token of a bucket (bucket deletion).
func (s *Store) InvalidateBucket(bucket string) {
	s.mu.Lock()
	s.epoch++
	for id, c := range s.cache {
		if c.Token.Bucket == bucket {
			delete(s.cache, id)
		}
	}
	s.mu.Unlock()
}

// Touch notes that a token was used; Flush persists last_used_at.
func (s *Store) Touch(accessKeyID string) {
	now := s.Now()
	s.mu.Lock()
	s.touched[accessKeyID] = now
	s.mu.Unlock()
}

// Flush writes pending last_used_at values (at most once a minute, spec §4.3).
func (s *Store) Flush(ctx context.Context) error {
	s.mu.Lock()
	batch := s.touched
	s.touched = map[string]time.Time{}
	s.mu.Unlock()
	if len(batch) == 0 {
		return nil
	}
	return s.DB.Update(ctx, func(tx *meta.Tx) error { return tx.TouchTokens(ctx, batch) })
}
