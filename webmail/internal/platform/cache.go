package platform

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"
)

// BrandingSource fetches branding; *Client satisfies it.
type BrandingSource interface {
	Branding(ctx context.Context, domain string) (*Branding, error)
}

// BrandingCache caches branding per domain for TTL (spec: 60 s), including
// "not a mail domain" answers. If the platform is down, a stale entry is
// served rather than failing the login page.
type BrandingCache struct {
	Source BrandingSource
	TTL    time.Duration
	Now    func() time.Time

	mu      sync.Mutex
	entries map[string]*brandingEntry
}

type brandingEntry struct {
	b       *Branding // nil = unknown domain
	expires time.Time
}

const maxCacheEntries = 4096

func (c *BrandingCache) now() time.Time {
	if c.Now != nil {
		return c.Now()
	}
	return time.Now()
}

// Get returns the branding of a domain, or (nil, nil) for a domain that is not
// an active mail domain.
func (c *BrandingCache) Get(ctx context.Context, domain string) (*Branding, error) {
	domain = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(domain), "."))
	if !ValidDomain(domain) {
		return nil, nil
	}
	now := c.now()
	c.mu.Lock()
	e := c.entries[domain]
	if e != nil && now.Before(e.expires) {
		c.mu.Unlock()
		return e.b, nil
	}
	c.mu.Unlock()

	b, err := c.Source.Branding(ctx, domain)
	switch {
	case err == nil:
	case errors.Is(err, ErrNotFound):
		b = nil
	default:
		if e != nil { // stale beats broken
			return e.b, nil
		}
		return nil, err
	}
	c.mu.Lock()
	if c.entries == nil || len(c.entries) >= maxCacheEntries {
		c.entries = map[string]*brandingEntry{}
	}
	c.entries[domain] = &brandingEntry{b: b, expires: now.Add(c.TTL)}
	c.mu.Unlock()
	return b, nil
}
