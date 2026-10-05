package sigv4

import (
	"container/list"
	"crypto/subtle"
	"sync"
)

// DefaultKeyCacheSize is the capacity NewKeyCache uses when given max <= 0.
const DefaultKeyCacheSize = 1024

// maxCachedRegion keeps unusually long regions out of the cache: they are
// still accepted, just derived each time.
const maxCachedRegion = 64

// KeyCache is a bounded LRU cache of derived signing keys, keyed by access
// key id, scope date and region (spec §4.5). Any region string is accepted,
// so the bound is what keeps the cache from growing without limit. Verify,
// VerifyPostPolicy and friends insert a key only after a signature made with
// it has verified, never for a failure. Each entry remembers the secret it
// was derived from and is used only when the looked-up secret still matches,
// so a changed secret can never be served a stale key. A nil *KeyCache is a
// valid, always-empty cache. It is safe for concurrent use.
type KeyCache struct {
	mu  sync.Mutex
	max int
	ll  *list.List // of *cacheEntry, most recent first
	m   map[cacheKey]*list.Element
}

type cacheKey struct{ accessKeyID, date, region string }

type cacheEntry struct {
	k      cacheKey
	secret string
	key    []byte
}

// NewKeyCache returns a cache of at most max signing keys
// (DefaultKeyCacheSize when max <= 0).
func NewKeyCache(max int) *KeyCache {
	if max <= 0 {
		max = DefaultKeyCacheSize
	}
	return &KeyCache{max: max, ll: list.New(), m: make(map[cacheKey]*list.Element)}
}

// get returns the cached key for (accessKeyID, date, region) when it was
// derived from secret.
func (c *KeyCache) get(accessKeyID, secret, date, region string) ([]byte, bool) {
	if c == nil {
		return nil, false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	el, ok := c.m[cacheKey{accessKeyID, date, region}]
	if !ok {
		return nil, false
	}
	e := el.Value.(*cacheEntry)
	if subtle.ConstantTimeCompare([]byte(e.secret), []byte(secret)) != 1 {
		return nil, false
	}
	c.ll.MoveToFront(el)
	return e.key, true
}

// add stores a verified key, evicting the least recently used entry when full.
func (c *KeyCache) add(accessKeyID, secret, date, region string, key []byte) {
	if c == nil || len(region) > maxCachedRegion {
		return
	}
	k := cacheKey{accessKeyID, date, region}
	c.mu.Lock()
	defer c.mu.Unlock()
	if el, ok := c.m[k]; ok {
		e := el.Value.(*cacheEntry)
		e.secret, e.key = secret, append([]byte(nil), key...)
		c.ll.MoveToFront(el)
		return
	}
	c.m[k] = c.ll.PushFront(&cacheEntry{k: k, secret: secret, key: append([]byte(nil), key...)})
	for c.ll.Len() > c.max {
		last := c.ll.Back()
		c.ll.Remove(last)
		delete(c.m, last.Value.(*cacheEntry).k)
	}
}

// Invalidate drops every key derived for accessKeyID, for use when a token is
// revoked (verification consults the SecretLookup first, so this is hygiene,
// not a correctness requirement).
func (c *KeyCache) Invalidate(accessKeyID string) {
	if c == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	for k, el := range c.m {
		if k.accessKeyID == accessKeyID {
			c.ll.Remove(el)
			delete(c.m, k)
		}
	}
}

// Len is the number of cached keys.
func (c *KeyCache) Len() int {
	if c == nil {
		return 0
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.ll.Len()
}
