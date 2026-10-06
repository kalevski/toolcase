package store

import (
	"container/list"
	"slices"
	"sync"
	"time"
)

const (
	// DefaultSessionCacheTTL is how long GetSession may serve a session from
	// memory. It only bounds staleness against writers outside this process
	// (another process on the same file); every writer in this process drops
	// the entry itself. Shorter is safer: this is a security setting.
	DefaultSessionCacheTTL = 5 * time.Second
	// sessionCacheMax bounds the number of cached sessions.
	sessionCacheMax = 4096
)

// sessionCache is a bounded id -> Session cache with a short TTL. Values are
// stored and returned as copies so callers cannot mutate cached state.
//
// Fills are fenced by an epoch: every invalidation bumps it, and a fill whose
// database read began before the bump is discarded, so a read that raced a
// delete can never put the deleted session back.
type sessionCache struct {
	ttl time.Duration // <= 0 disables the cache
	now func() time.Time

	mu    sync.Mutex
	epoch uint64
	m     map[string]*list.Element // id -> element holding *cacheEntry
	order *list.List               // front = oldest
}

type cacheEntry struct {
	id      string
	s       Session
	fetched time.Time
}

func newSessionCache(ttl time.Duration, now func() time.Time) *sessionCache {
	return &sessionCache{ttl: ttl, now: now, m: map[string]*list.Element{}, order: list.New()}
}

func cloneSession(s *Session) *Session {
	c := *s
	c.CredSealed = slices.Clone(s.CredSealed)
	return &c
}

// get returns a copy of a fresh entry, or the epoch to pass to put on a miss.
func (c *sessionCache) get(id string) (*Session, uint64, bool) {
	if c.ttl <= 0 {
		return nil, 0, false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if el, ok := c.m[id]; ok {
		e := el.Value.(*cacheEntry)
		if age := c.now().Sub(e.fetched); age >= 0 && age < c.ttl {
			return cloneSession(&e.s), c.epoch, true
		}
		c.removeLocked(el)
	}
	return nil, c.epoch, false
}

// put stores a copy unless an invalidation happened since epoch was read.
func (c *sessionCache) put(id string, s *Session, epoch uint64) {
	if c.ttl <= 0 {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if epoch != c.epoch {
		return
	}
	if el, ok := c.m[id]; ok {
		c.removeLocked(el)
	}
	if c.order.Len() >= sessionCacheMax {
		now := c.now()
		for el := c.order.Front(); el != nil; { // drop stale entries first
			next := el.Next()
			if age := now.Sub(el.Value.(*cacheEntry).fetched); age < 0 || age >= c.ttl {
				c.removeLocked(el)
			}
			el = next
		}
		for c.order.Len() >= sessionCacheMax {
			c.removeLocked(c.order.Front())
		}
	}
	c.m[id] = c.order.PushBack(&cacheEntry{id: id, s: *cloneSession(s), fetched: c.now()})
}

// drop invalidates ids (call after the database write, even if it failed).
func (c *sessionCache) drop(ids ...string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.epoch++
	for _, id := range ids {
		if el, ok := c.m[id]; ok {
			c.removeLocked(el)
		}
	}
}

// dropAll invalidates everything.
func (c *sessionCache) dropAll() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.epoch++
	clear(c.m)
	c.order.Init()
}

func (c *sessionCache) removeLocked(el *list.Element) {
	delete(c.m, el.Value.(*cacheEntry).id)
	c.order.Remove(el)
}

func (c *sessionCache) len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.order.Len()
}
