package s3

import (
	"context"
	"io"
	"sync"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/auth"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/ratelimit"
)

// Limiters keeps one limiter per token and per bucket and applies the rate
// limits of spec §4.9. State is in memory and resets on restart. A request
// must pass both its token's and its bucket's limits; anonymous reads count
// against the bucket's only.
type Limiters struct {
	mu       sync.Mutex
	byToken  map[string]*ratelimit.Limiter
	byBucket map[string]*ratelimit.Limiter
}

// NewLimiters returns an empty set.
func NewLimiters() *Limiters {
	return &Limiters{byToken: map[string]*ratelimit.Limiter{}, byBucket: map[string]*ratelimit.Limiter{}}
}

func toRL(l meta.Limits) ratelimit.Limits {
	return ratelimit.Limits{RequestsPerSecond: l.RequestsPerSecond, Burst: l.Burst, BytesInPerSecond: l.BytesInPerSecond, BytesOutPerSecond: l.BytesOutPerSecond}
}

// set returns the token's then the bucket's limiter, brought up to date with
// the current settings (Update with unchanged limits is cheap).
func (l *Limiters) set(p *auth.Principal, b *meta.Bucket) ratelimit.Set {
	l.mu.Lock()
	defer l.mu.Unlock()
	var s ratelimit.Set
	if p != nil && p.Kind == auth.KindToken {
		if tl := toRL(p.Limits); !tl.IsZero() {
			lim := l.byToken[p.AccessKey]
			if lim == nil {
				lim = ratelimit.New(tl)
				l.byToken[p.AccessKey] = lim
			} else {
				lim.Update(tl)
			}
			s = append(s, lim)
		} else {
			delete(l.byToken, p.AccessKey)
		}
	}
	if bl := toRL(b.Limits); !bl.IsZero() {
		lim := l.byBucket[b.Name]
		if lim == nil {
			lim = ratelimit.New(bl)
			l.byBucket[b.Name] = lim
		} else {
			lim.Update(bl)
		}
		s = append(s, lim)
	} else {
		delete(l.byBucket, b.Name)
	}
	return s
}

// Allow implements Limiter.
func (l *Limiters) Allow(p *auth.Principal, b *meta.Bucket, now time.Time) (bool, time.Duration) {
	return l.set(p, b).AllowRequest(now)
}

// WrapReader implements Limiter.
func (l *Limiters) WrapReader(ctx context.Context, p *auth.Principal, b *meta.Bucket, r io.Reader) io.Reader {
	return l.set(p, b).WrapReader(ctx, r)
}

// WrapWriter implements Limiter.
func (l *Limiters) WrapWriter(ctx context.Context, p *auth.Principal, b *meta.Bucket, w io.Writer) io.Writer {
	return l.set(p, b).WrapWriter(ctx, w)
}

// ForgetBucket drops a deleted bucket's limiter.
func (l *Limiters) ForgetBucket(name string) {
	l.mu.Lock()
	delete(l.byBucket, name)
	l.mu.Unlock()
}

// ForgetToken drops a revoked token's limiter.
func (l *Limiters) ForgetToken(id string) {
	l.mu.Lock()
	delete(l.byToken, id)
	l.mu.Unlock()
}
