package admin

import (
	"net"
	"net/http"
	"sync"
	"time"
)

const (
	authFailLimit  = 20
	authFailWindow = time.Minute
	authBlockFor   = time.Minute
	authMaxClients = 4096
)

// authLimiter throttles brute-force guessing of the bearer token: after
// authFailLimit failed attempts from one client within authFailWindow, that
// client is answered 429 for authBlockFor, whatever it sends.
type authLimiter struct {
	mu      sync.Mutex
	clients map[string]*authClient
	now     func() time.Time
}

type authClient struct {
	fails        int
	windowStart  time.Time
	blockedUntil time.Time
}

func newAuthLimiter() *authLimiter {
	return &authLimiter{clients: map[string]*authClient{}, now: time.Now}
}

func clientKey(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// blocked reports whether key is currently locked out, and for how many more
// seconds.
func (l *authLimiter) blocked(key string) (bool, int) {
	l.mu.Lock()
	defer l.mu.Unlock()
	c := l.clients[key]
	if c == nil {
		return false, 0
	}
	now := l.now()
	if now.Before(c.blockedUntil) {
		return true, int(c.blockedUntil.Sub(now).Seconds()) + 1
	}
	return false, 0
}

// fail records one failed attempt.
func (l *authLimiter) fail(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	if len(l.clients) >= authMaxClients {
		for k, c := range l.clients {
			if now.After(c.blockedUntil) && now.Sub(c.windowStart) > authFailWindow {
				delete(l.clients, k)
			}
		}
	}
	c := l.clients[key]
	if c == nil {
		if len(l.clients) >= authMaxClients {
			return
		}
		c = &authClient{windowStart: now}
		l.clients[key] = c
	}
	if now.Sub(c.windowStart) > authFailWindow {
		c.fails, c.windowStart = 0, now
	}
	c.fails++
	if c.fails >= authFailLimit {
		c.blockedUntil = now.Add(authBlockFor)
		c.fails, c.windowStart = 0, now
	}
}

// succeed clears a client's failure count after a good token.
func (l *authLimiter) succeed(key string) {
	l.mu.Lock()
	delete(l.clients, key)
	l.mu.Unlock()
}
