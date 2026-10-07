// Package mailhost picks the JMAP client for a mail domain. The platform pushes each domain's mail server address
// with its branding; a domain without one uses the configured default, so one webmail serves domains that live on
// different mail servers.
package mailhost

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/kalevski/toolcase/webmail/internal/jmap"
	"github.com/kalevski/toolcase/webmail/internal/store"
)

const (
	baseTTL    = 30 * time.Second
	maxClients = 256
)

// Router resolves a domain to its JMAP client. Clients are shared per base URL so connections are reused.
type Router struct {
	Default *jmap.Client
	Store   *store.Store
	Timeout time.Duration
	Now     func() time.Time

	mu      sync.Mutex
	clients map[string]*jmap.Client
	bases   map[string]cachedBase
}

type cachedBase struct {
	base string
	at   time.Time
}

func (r *Router) now() time.Time {
	if r.Now != nil {
		return r.Now()
	}
	return time.Now()
}

// ForBase returns the client for a base URL; an empty base or the default's own gives the default client.
func (r *Router) ForBase(base string) *jmap.Client {
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	if base == "" || base == r.Default.Base {
		return r.Default
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if c, ok := r.clients[base]; ok {
		return c
	}
	if r.clients == nil || len(r.clients) >= maxClients {
		r.clients = map[string]*jmap.Client{}
	}
	c := jmap.New(base, r.Timeout)
	r.clients[base] = c
	return c
}

// For returns the client of a mail domain: the server its branding names, else the default.
func (r *Router) For(ctx context.Context, domain string) *jmap.Client {
	domain = strings.ToLower(domain)
	r.mu.Lock()
	if c, ok := r.bases[domain]; ok && r.now().Sub(c.at) < baseTTL {
		r.mu.Unlock()
		return r.ForBase(c.base)
	}
	r.mu.Unlock()
	base := ""
	if b, err := r.Store.GetBranding(ctx, domain); err == nil {
		base = b.JMAPURL
	}
	r.mu.Lock()
	if r.bases == nil || len(r.bases) >= maxClients*16 {
		r.bases = map[string]cachedBase{}
	}
	r.bases[domain] = cachedBase{base: base, at: r.now()}
	r.mu.Unlock()
	return r.ForBase(base)
}

// Forget drops a domain's cached address: its branding was written.
func (r *Router) Forget(domain string) {
	r.mu.Lock()
	delete(r.bases, strings.ToLower(domain))
	r.mu.Unlock()
}
