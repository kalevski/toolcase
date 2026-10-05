// Package httpx is the HTTP plumbing shared by the public, admin and peer
// listeners: per-request info and request ids, the access log, response
// recording, idle-timeout readers/writers and client-address resolution
// (spec §2.4, §4.8, §9.1).
package httpx

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"runtime/debug"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/ulid"
)

// Info is the per-request record handlers fill in for logging and metrics.
type Info struct {
	ID        string
	Start     time.Time
	Method    string
	Path      string
	Query     string
	Op        string // S3 or admin operation name, for metrics
	Bucket    string
	Key       string
	Principal string // admin | token:<id> | pipeline:<name>/<run> | anonymous
	Client    string
	ErrCode   string
	Status    int
	Via       string // forwarding peer, cluster only
	Fwd       string // node this request was forwarded to, cluster only
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
	Node    string // x-binvault-node value (cluster mode), "" = none
	Trusted []netip.Prefix
	// IdleTimeout aborts transfers that move no bytes for this long.
	IdleTimeout time.Duration
	// OnDone is called after every request (metrics).
	OnDone func(i *Info, d time.Duration)
	// Quiet suppresses the access log line for matching requests (health checks).
	Quiet func(r *http.Request) bool
	// RequestID overrides id allocation (a forwarded request keeps its id).
	RequestID func(r *http.Request) string
	// ClientAddr, when set, overrides the client address resolved from the socket
	// and Trusted: the peer listener takes the address a forwarding peer reports
	// (spec §8.4). It returns "" to keep the resolved address.
	ClientAddr func(r *http.Request) string
}

var ids ulid.Generator

// Wrap wraps h with request ids, common headers, response recording, panic
// recovery and the access log.
func Wrap(h http.Handler, o Options) http.Handler {
	if o.Log == nil {
		o.Log = slog.Default()
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		info := &Info{Start: start, Method: r.Method, Client: ClientIP(r, o.Trusted)}
		if o.ClientAddr != nil {
			if c := o.ClientAddr(r); c != "" {
				info.Client = c
			}
		}
		if o.RequestID != nil {
			info.ID = o.RequestID(r)
		}
		if info.ID == "" {
			info.ID = ids.NewAt(start)
		}
		info.Path, info.Query = SplitRequestURI(r)
		hd := w.Header()
		hd.Set("x-amz-request-id", info.ID)
		hd.Set("x-amz-id-2", info.ID)
		hd.Set("Server", "binvault")
		if o.Node != "" {
			hd.Set("x-binvault-node", o.Node)
		}
		rec := &recorder{ResponseWriter: w, info: info, idle: o.IdleTimeout, http1: r.ProtoMajor == 1}
		rec.rc = http.NewResponseController(w)
		if r.Body != nil && r.Body != http.NoBody && r.ContentLength != 0 {
			rec.body = &bodyTracker{ReadCloser: r.Body}
			r.Body = rec.body
			rec.expect = strings.EqualFold(strings.TrimSpace(r.Header.Get("Expect")), "100-continue")
		}
		r = r.WithContext(With(r.Context(), info))
		defer rec.lingerClose() // registered first, so it runs after the access log below
		defer func() {
			if p := recover(); p != nil {
				if p == http.ErrAbortHandler {
					rec.linger = false // the connection is being cut on purpose
					panic(p)
				}
				o.Log.Error("panic", "request_id", info.ID, "panic", fmt.Sprint(p), "stack", string(debug.Stack()))
				if !rec.wrote {
					rec.Header().Set("Content-Type", "application/xml")
					rec.WriteHeader(http.StatusInternalServerError)
					fmt.Fprintf(rec, `<?xml version="1.0" encoding="UTF-8"?><Error><Code>InternalError</Code><Message>We encountered an internal error. Please try again.</Message><RequestId>%s</RequestId></Error>`, info.ID)
				}
				info.ErrCode = "InternalError"
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
				"request_id", info.ID, "method", info.Method, "path", info.Path,
				"status", info.Status, "bytes_in", info.InBytes.Load(), "bytes_out", info.OutBytes.Load(),
				"duration_ms", d.Milliseconds(), "principal", orDash(info.Principal), "client", info.Client,
			}
			if info.Op != "" {
				attrs = append(attrs, "op", info.Op)
			}
			if info.Bucket != "" {
				attrs = append(attrs, "bucket", info.Bucket)
			}
			if info.Key != "" {
				attrs = append(attrs, "key", info.Key)
			}
			if q := SafeQuery(info.Query); q != "" {
				attrs = append(attrs, "query", q)
			}
			if info.ErrCode != "" {
				attrs = append(attrs, "error", info.ErrCode)
			}
			if o.Node != "" {
				attrs = append(attrs, "node", o.Node)
			}
			if info.Via != "" {
				attrs = append(attrs, "via", info.Via)
			}
			if info.Fwd != "" {
				attrs = append(attrs, "forwarded_to", info.Fwd)
			}
			lvl := slog.LevelInfo
			switch {
			case info.ErrCode == "SlowDown":
				lvl = slog.LevelWarn // throttling is the limits working, not a server fault, though it is a 503
			case info.Status >= 500:
				lvl = slog.LevelError
			}
			o.Log.Log(r.Context(), lvl, "request", attrs...)
		}()
		h.ServeHTTP(rec, r)
	})
}

func orDash(s string) string {
	if s == "" {
		return "-"
	}
	return s
}

// recorder records status and byte counts, applies the write idle timeout and
// keeps sendfile (io.ReaderFrom) working.
type recorder struct {
	http.ResponseWriter
	info   *Info
	rc     *http.ResponseController
	idle   time.Duration
	wrote  bool
	body   *bodyTracker // nil when the request has no body
	http1  bool
	expect bool // the client asked for 100-continue: it holds the body back until told
	linger bool // answered with the body unread: see lingerClose
}

// bodyTracker notes when the handler has read a request body to its end (or
// failed): nothing is then left for net/http to discard. started says the
// handler asked for body bytes at all (which, for a 100-continue request, is
// what makes net/http invite the client to send them).
type bodyTracker struct {
	io.ReadCloser
	done    atomic.Bool
	started atomic.Bool
}

func (b *bodyTracker) Read(p []byte) (int, error) {
	b.started.Store(true)
	n, err := b.ReadCloser.Read(p)
	if err != nil {
		b.done.Store(true)
	}
	return n, err
}

func (r *recorder) WriteHeader(code int) {
	if r.wrote {
		return
	}
	if code >= 200 || code == http.StatusSwitchingProtocols {
		r.wrote = true
		r.info.Status = code
		// A handler that answers without reading the body (authentication failed,
		// admission refused) must not make net/http wait for it: before sending
		// the response the server would discard up to 256 KiB of the unread body,
		// which a client that stalls mid-body turns into a pinned connection.
		// Close the connection after the reply instead, but not before the client
		// has had the chance to finish sending (lingerClose; spec §2.3, §3.5, §10).
		if r.http1 && r.body != nil && !r.body.done.Load() && r.ResponseWriter.Header().Get("Connection") == "" {
			r.ResponseWriter.Header().Set("Connection", "close")
			r.linger = true
		}
	}
	r.ResponseWriter.WriteHeader(code)
}

func (r *recorder) Write(p []byte) (int, error) {
	if !r.wrote {
		r.WriteHeader(http.StatusOK)
	}
	r.touch()
	n, err := r.ResponseWriter.Write(p)
	r.info.OutBytes.Add(int64(n))
	return n, err
}

func (r *recorder) touch() {
	if r.idle > 0 {
		_ = r.rc.SetWriteDeadline(time.Now().Add(r.idle))
	}
}

// ReadFrom delegates to the underlying writer so *os.File bodies use sendfile.
func (r *recorder) ReadFrom(src io.Reader) (int64, error) {
	if !r.wrote {
		r.WriteHeader(http.StatusOK)
	}
	r.touch()
	var n int64
	var err error
	if rf, ok := r.ResponseWriter.(io.ReaderFrom); ok {
		n, err = rf.ReadFrom(src)
	} else {
		n, err = io.Copy(struct{ io.Writer }{r.ResponseWriter}, src)
	}
	r.info.OutBytes.Add(n)
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

// What a refused request's unread body costs after the answer (lingerClose).
// They are variables so tests can shrink them.
var (
	// lingerMaxBytes is the most of an unread request body that is read and
	// discarded after the answer (spec §3.5).
	lingerMaxBytes int64 = 64 << 20
	// lingerMaxTime is the longest the connection is kept for that.
	lingerMaxTime = 30 * time.Second
	// lingerIdleMax is the longest wait for the next piece of the body (the
	// body idle timeout, when that is shorter).
	lingerIdleMax = 5 * time.Second
)

var lingerBufs = sync.Pool{New: func() any { b := make([]byte, 32<<10); return &b }}

// lingerClose ends a request that was answered with its body unread. Closing
// the connection right away would reset it (the kernel answers data that is
// still arriving with an RST), and a client that keeps streaming a large body
// (rclone, the Node SDK, anything that does not wait for 100-continue) then
// sees "broken pipe" instead of the S3 error: the answer is sent first, then the
// rest of the body is read and thrown away, so the connection ends in an
// orderly close. It is bounded by lingerMaxBytes, lingerMaxTime and the wait
// for each read (lingerIdleMax, the body idle timeout when shorter), so a body
// that stalls or never arrives cannot pin the connection; what is still unread
// afterwards is never waited for. A client that asked for 100-continue and was
// refused has sent no body and is not waited for either.
func (r *recorder) lingerClose() {
	if !r.linger || r.body == nil {
		return
	}
	// net/http would discard up to 256 KiB of whatever is left when the handler
	// returns, without any deadline; make that fail at once
	defer func() { _ = r.rc.SetReadDeadline(time.Now()) }()
	if r.body.done.Load() || (r.expect && !r.body.started.Load()) {
		return
	}
	_ = r.rc.Flush() // the answer goes out before the wait
	idle := lingerIdleMax
	if r.idle > 0 && r.idle < idle {
		idle = r.idle
	}
	end := time.Now().Add(lingerMaxTime)
	bp := lingerBufs.Get().(*[]byte)
	defer lingerBufs.Put(bp)
	var n int64
	for n < lingerMaxBytes {
		d := time.Now().Add(idle)
		if d.After(end) {
			d = end
		}
		_ = r.rc.SetReadDeadline(d)
		m, err := r.body.Read(*bp)
		n += int64(m)
		if err != nil { // io.EOF: the client is done; otherwise it stalled, left or sent too much
			return
		}
	}
}

// Wrote reports whether headers were sent.
func (r *recorder) Wrote() bool { return r.wrote }

// HeaderWritten reports whether w (or a writer it wraps) already sent headers.
func HeaderWritten(w http.ResponseWriter) bool {
	for {
		if r, ok := w.(*recorder); ok {
			return r.wrote
		}
		u, ok := w.(interface{ Unwrap() http.ResponseWriter })
		if !ok {
			return false
		}
		w = u.Unwrap()
	}
}

// CopyChunked copies n bytes from src to w in chunks, extending the write
// deadline before each chunk so a long transfer is bounded by idleness, not
// by its total time, while each chunk can still use sendfile.
func CopyChunked(w http.ResponseWriter, src io.Reader, n int64, idle time.Duration) (int64, error) {
	const chunk = 4 << 20
	rc := http.NewResponseController(w)
	var total int64
	for n > 0 {
		c := int64(chunk)
		if n < c {
			c = n
		}
		if idle > 0 {
			_ = rc.SetWriteDeadline(time.Now().Add(idle))
		}
		m, err := io.CopyN(w, src, c)
		total += m
		n -= m
		if err != nil {
			return total, err
		}
	}
	return total, nil
}

// ---- request bodies -----------------------------------------------------------

// ErrIdle is returned by a body reader that saw no bytes within the idle window.
var ErrIdle = errors.New("httpx: idle timeout")

// IdleReader wraps a request body: before every read it extends the read
// deadline, so a transfer that stalls for `idle` fails (RequestTimeout) while
// a slow but steady one never does (spec §2.3 BINVAULT_BODY_IDLE_TIMEOUT).
type IdleReader struct {
	r    io.Reader
	rc   *http.ResponseController
	idle time.Duration
	info *Info
}

// NewIdleReader wraps body. w is the response writer of the request.
func NewIdleReader(w http.ResponseWriter, r io.Reader, idle time.Duration, info *Info) *IdleReader {
	return &IdleReader{r: r, rc: http.NewResponseController(w), idle: idle, info: info}
}

func (i *IdleReader) Read(p []byte) (int, error) {
	if i.idle > 0 {
		_ = i.rc.SetReadDeadline(time.Now().Add(i.idle))
	}
	n, err := i.r.Read(p)
	if n > 0 && i.info != nil {
		i.info.InBytes.Add(int64(n))
	}
	if err != nil && errors.Is(err, os.ErrDeadlineExceeded) {
		return n, ErrIdle
	}
	return n, err
}

// ---- addresses and paths ------------------------------------------------------

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
// trusted (spec §4.8).
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
			return host // garbage: do not trust any of it
		}
		if !inNets(pip, trusted) {
			return p
		}
	}
	return host
}

// SplitRequestURI returns the raw (still percent-encoded) path and raw query of
// a request, from the request line as received (spec §2.4: route on the raw
// path, no cleaning).
func SplitRequestURI(r *http.Request) (path, query string) {
	uri := r.RequestURI
	if uri == "" {
		uri = r.URL.EscapedPath()
		if r.URL.RawQuery != "" {
			uri += "?" + r.URL.RawQuery
		}
	}
	if !strings.HasPrefix(uri, "/") && uri != "*" {
		// absolute-form request target: http://host/path?query
		if u, err := url.ParseRequestURI(uri); err == nil {
			path = u.EscapedPath()
			if path == "" {
				path = "/"
			}
			return path, u.RawQuery
		}
	}
	if i := strings.IndexByte(uri, '?'); i >= 0 {
		return uri[:i], uri[i+1:]
	}
	return uri, ""
}

// SafeQuery removes signature material from a query for logging.
func SafeQuery(q string) string {
	if q == "" {
		return ""
	}
	var out []string
	for _, kv := range strings.Split(q, "&") {
		k := kv
		if i := strings.IndexByte(kv, '='); i >= 0 {
			k = kv[:i]
		}
		switch strings.ToLower(k) {
		case "x-amz-signature", "x-amz-security-token", "x-amz-credential", "signature", "awsaccesskeyid":
			continue
		}
		out = append(out, kv)
	}
	return strings.Join(out, "&")
}
