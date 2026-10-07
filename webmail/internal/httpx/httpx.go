// Package httpx is the HTTP plumbing shared by the public and admin
// listeners: request ids, the access log, response recording, panic recovery
// and client-address resolution behind trusted proxies.
package httpx

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"runtime/debug"
	"strings"
	"sync/atomic"
	"time"
)

// Info is the per-request record handlers fill in for logging and metrics.
type Info struct {
	ID        string
	Start     time.Time
	Method    string
	Path      string
	Route     string // route pattern, for metrics
	Principal string // session id prefix or "-"
	Client    string
	ErrCode   string
	Status    int
	InBytes   atomic.Int64
	OutBytes  atomic.Int64
}

type ctxKey struct{}

// From returns the request's Info (a throw-away one if the middleware did not run).
func From(ctx context.Context) *Info {
	if i, ok := ctx.Value(ctxKey{}).(*Info); ok {
		return i
	}
	return &Info{ID: "unknown"}
}

// With attaches info to ctx.
func With(ctx context.Context, i *Info) context.Context { return context.WithValue(ctx, ctxKey{}, i) }

// Options configure Wrap.
type Options struct {
	Log     *slog.Logger
	Trusted []netip.Prefix
	// OnDone is called after every request (metrics).
	OnDone func(i *Info, d time.Duration)
	// Quiet suppresses the access log line for matching requests (health checks).
	Quiet func(r *http.Request) bool
}

// NewID returns a short random request id.
func NewID() string {
	var b [8]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

// Wrap wraps h with request ids, response recording, panic recovery and the
// access log. Bodies and query strings are never logged.
func Wrap(h http.Handler, o Options) http.Handler {
	if o.Log == nil {
		o.Log = slog.Default()
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		info := &Info{ID: NewID(), Start: start, Method: r.Method, Path: r.URL.Path, Client: ClientIP(r, o.Trusted)}
		w.Header().Set("X-Request-Id", info.ID)
		rec := &recorder{ResponseWriter: w, info: info}
		r = r.WithContext(With(r.Context(), info))
		defer func() {
			if p := recover(); p != nil {
				if p == http.ErrAbortHandler {
					panic(p)
				}
				o.Log.Error("panic", "request_id", info.ID, "panic", fmt.Sprint(p), "stack", string(debug.Stack()))
				if !rec.wrote {
					rec.Header().Set("Content-Type", "application/json")
					rec.WriteHeader(http.StatusInternalServerError)
					fmt.Fprint(rec, `{"error":{"code":"internal","message":"Something went wrong."}}`)
				}
				info.ErrCode = "internal"
			}
			if info.Status == 0 {
				info.Status = http.StatusOK
			}
			d := time.Since(start)
			if o.OnDone != nil {
				o.OnDone(info, d)
			}
			if o.Quiet != nil && o.Quiet(r) && info.Status < 500 {
				return
			}
			attrs := []any{
				"request_id", info.ID, "method", info.Method, "path", info.Path, "status", info.Status,
				"bytes_in", info.InBytes.Load(), "bytes_out", info.OutBytes.Load(),
				"duration_ms", d.Milliseconds(), "client", info.Client,
			}
			if info.Principal != "" {
				attrs = append(attrs, "session", info.Principal)
			}
			if info.ErrCode != "" {
				attrs = append(attrs, "error", info.ErrCode)
			}
			lvl := slog.LevelInfo
			if info.Status >= 500 {
				lvl = slog.LevelError
			}
			o.Log.Log(r.Context(), lvl, "request", attrs...)
		}()
		h.ServeHTTP(rec, r)
	})
}

type recorder struct {
	http.ResponseWriter
	info  *Info
	wrote bool
}

func (r *recorder) WriteHeader(code int) {
	if r.wrote {
		return
	}
	if code >= 200 {
		r.wrote = true
		r.info.Status = code
	}
	r.ResponseWriter.WriteHeader(code)
}

func (r *recorder) Write(p []byte) (int, error) {
	if !r.wrote {
		r.WriteHeader(http.StatusOK)
	}
	n, err := r.ResponseWriter.Write(p)
	r.info.OutBytes.Add(int64(n))
	return n, err
}

func (r *recorder) Flush() {
	if f, ok := r.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func (r *recorder) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	return http.NewResponseController(r.ResponseWriter).Hijack()
}

// Unwrap lets http.ResponseController reach the real writer.
func (r *recorder) Unwrap() http.ResponseWriter { return r.ResponseWriter }

func inNets(ip netip.Addr, nets []netip.Prefix) bool {
	ip = ip.Unmap()
	for _, n := range nets {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

// ClientIP is the client's address: the socket peer, unless it is a trusted
// proxy, in which case the right-most X-Forwarded-For entry that is not itself
// trusted.
// RequestHost is the host name the browser asked for, without a port: X-Forwarded-Host when the request
// came through a trusted proxy (the front door that serves a domain's webmail address), else Host.
func RequestHost(r *http.Request, trusted []netip.Prefix) string {
	host := r.Host
	if remote, _, err := net.SplitHostPort(r.RemoteAddr); err == nil && len(trusted) > 0 {
		if ip, perr := netip.ParseAddr(remote); perr == nil && inNets(ip, trusted) {
			if fwd := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-Host"), ",")[0]); fwd != "" {
				host = fwd
			}
		}
	}
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	return strings.ToLower(strings.TrimSuffix(strings.Trim(host, "[]"), "."))
}

func ClientIP(r *http.Request, trusted []netip.Prefix) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	ip, perr := netip.ParseAddr(host)
	if perr != nil || len(trusted) == 0 || !inNets(ip, trusted) {
		return host
	}
	xff := r.Header.Values("X-Forwarded-For")
	if len(xff) == 0 {
		return host
	}
	parts := strings.Split(strings.Join(xff, ","), ",")
	for i := len(parts) - 1; i >= 0; i-- {
		p := strings.TrimSpace(parts[i])
		pip, err := netip.ParseAddr(p)
		if err != nil {
			return host // garbage: trust none of it
		}
		if !inNets(pip, trusted) {
			return p
		}
	}
	return host
}
