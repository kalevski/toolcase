package forward

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/httpx"
	"github.com/kalevski/toolcase/binvault/internal/s3"
)

// Why a forwarded request was cancelled, as the cause of its context.
var (
	errUploadStalled = errors.New("forward: the upload to the home node moved no bytes for the idle timeout")
	errResponseIdle  = errors.New("forward: the home node's response moved no bytes for the idle timeout")
)

// hopByHop are the headers that describe one connection, not the request
// (RFC 9110 §7.6.1); a proxy removes them.
var hopByHop = map[string]bool{
	"connection": true, "proxy-connection": true, "keep-alive": true, "proxy-authenticate": true,
	"proxy-authorization": true, "te": true, "trailer": true, "transfer-encoding": true, "upgrade": true,
}

// connectionTokens are the header names a Connection header lists: they are
// hop-by-hop too.
func connectionTokens(h http.Header) map[string]bool {
	var out map[string]bool
	for _, v := range h.Values("Connection") {
		for _, tok := range strings.Split(v, ",") {
			if tok = strings.ToLower(strings.TrimSpace(tok)); tok != "" {
				if out == nil {
					out = map[string]bool{}
				}
				out[tok] = true
			}
		}
	}
	return out
}

// reqBody is the client's request body on its way to the home: it counts what
// was read, remembers why the client side failed, and lets the watchdog tell an
// upload that is stalled on the home's side from one that is simply waiting for
// the client. The transport does not read it directly but through the
// attemptBody of one attempt (a request whose body was never asked for can be
// sent again, §8.4).
type reqBody struct {
	src     io.Reader
	length  int64 // declared length, -1 when unknown
	none    bool  // the request has no body
	read    atomic.Int64
	last    atomic.Int64 // unix nanoseconds of the last read that returned
	reading atomic.Bool  // a Read on the client's body is in progress
	done    atomic.Bool  // the whole body has been read
	errMu   sync.Mutex
	err     error // the first failure of the client's side
}

func newReqBody(w http.ResponseWriter, r *http.Request, idle time.Duration, info *httpx.Info) *reqBody {
	b := &reqBody{length: r.ContentLength}
	if r.Body == nil || r.Body == http.NoBody || r.ContentLength == 0 {
		b.none = true
		b.done.Store(true)
		return b
	}
	b.src = httpx.NewIdleReader(w, r.Body, idle, info)
	b.last.Store(time.Now().UnixNano())
	return b
}

func (b *reqBody) Read(p []byte) (int, error) {
	b.reading.Store(true)
	n, err := b.src.Read(p)
	b.reading.Store(false)
	b.last.Store(time.Now().UnixNano())
	if n > 0 {
		if got := b.read.Add(int64(n)); b.length >= 0 && got >= b.length {
			b.done.Store(true)
		}
	}
	if err != nil {
		if err == io.EOF {
			b.done.Store(true)
		} else {
			b.errMu.Lock()
			if b.err == nil {
				b.err = err
			}
			b.errMu.Unlock()
		}
	}
	return n, err
}

// Close does nothing: the server owns the client's body and closes it.
func (b *reqBody) Close() error { return nil }

// errAttemptOver is what a Read gets from the body of an attempt that is over.
var errAttemptOver = errors.New("forward: the attempt this request body was lent to is over")

// attemptBody is the client's body as one attempt's transport sees it. The
// transport reads the body from a goroutine of its own that can outlive the
// attempt: it may sit in a Read for a client that is slow to start, or wait for a
// 100 Continue that the home answered with a 421 instead. Nothing it still does
// may reach the client's body once the request is sent to another home or served
// here, or it would take bytes of it (the new attempt would then send, and store,
// a body with a hole at the front). So the body is lent for one attempt at a
// time: seal ends the lending and says whether the borrower ever asked for a
// byte. Only a body that was never asked for can be used again (§8.4).
type attemptBody struct {
	*reqBody
	mu      sync.Mutex
	started bool // a Read was made: the client's body may be consumed, wholly or in part
	sealed  bool // the attempt is over: Reads fail without touching the client's body
}

// attempt lends the body to a new attempt.
func (b *reqBody) attempt() *attemptBody { return &attemptBody{reqBody: b} }

func (a *attemptBody) Read(p []byte) (int, error) {
	a.mu.Lock()
	if a.sealed {
		a.mu.Unlock()
		return 0, errAttemptOver
	}
	a.started = true
	a.mu.Unlock()
	return a.reqBody.Read(p)
}

// seal ends the attempt's use of the body and reports whether the body is
// untouched: no Read of the attempt has begun and none ever will. A request
// without a body is always untouched.
func (a *attemptBody) seal() (untouched bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.sealed = true
	return a.none || !a.started
}

func (b *reqBody) clientErr() error {
	b.errMu.Lock()
	defer b.errMu.Unlock()
	return b.err
}

// watch cancels the upstream request when the upload stalls on the home's side:
// bytes were read from the client, the client is not the one being waited for,
// and the transport has not come back for more within the idle timeout (the home
// stopped reading). The client's own idleness is the idle reader's business.
func (b *reqBody) watch(ctx context.Context, idle time.Duration, cancel context.CancelCauseFunc) {
	if b.none || idle <= 0 {
		return
	}
	tick := idle / 4
	if tick < 20*time.Millisecond {
		tick = 20 * time.Millisecond
	}
	t := time.NewTicker(tick)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
		if b.done.Load() {
			return // the response is what is awaited now; its timeout bounds that
		}
		if b.read.Load() > 0 && !b.reading.Load() && time.Since(time.Unix(0, b.last.Load())) > idle {
			cancel(errUploadStalled)
			return
		}
	}
}

// respBody bounds the idle time of the home's response body: a read that moves
// no bytes for the idle timeout cancels the upstream request.
type respBody struct {
	rc    io.ReadCloser
	timer *time.Timer
	idle  time.Duration
}

func newRespBody(rc io.ReadCloser, idle time.Duration, cancel context.CancelCauseFunc) *respBody {
	b := &respBody{rc: rc, idle: idle}
	if idle > 0 {
		b.timer = time.AfterFunc(time.Hour, func() { cancel(errResponseIdle) })
		b.timer.Stop()
	}
	return b
}

func (b *respBody) Read(p []byte) (int, error) {
	if b.timer != nil {
		b.timer.Reset(b.idle)
	}
	n, err := b.rc.Read(p)
	if b.timer != nil {
		b.timer.Stop()
	}
	return n, err
}

func (b *respBody) Close() error {
	if b.timer != nil {
		b.timer.Stop()
	}
	return b.rc.Close()
}

// ---- forwarding ----------------------------------------------------------------------

// forward sends the request to the bucket's home and streams the answer back. It
// returns true once it has answered; false means the bucket turned out to be
// homed here after all (a 421 taught the entry node a newer catalog), and the
// caller serves the request locally. A 421 is acted on only while the client's
// body is untouched; once the transport has asked for it, the answer is a 503.
func (f *Forwarder) forward(w http.ResponseWriter, r *http.Request, t *s3.Target, bucket, homeID string, epoch int64) bool {
	info := httpx.From(r.Context())
	if info.Bucket == "" {
		info.Bucket = bucket
	}
	body := newReqBody(w, r, f.idle, info)
	for attempt := 0; ; attempt++ {
		rt, found := f.node.Route(homeID)
		peer := rt.Name
		if peer == "" {
			peer = homeID
		}
		info.Fwd = peer
		switch {
		case !found || rt.Retired || rt.URL == "":
			f.refuse(w, r, t, peer, "missing", "The node that stores this bucket is not part of this cluster.", RetryAfterDown)
			return true
		case rt.Draining:
			f.refuse(w, r, t, peer, "draining", "The node that stores this bucket is shutting down; retry shortly.", RetryAfterDown)
			return true
		case !rt.Reachable:
			f.refuse(w, r, t, peer, "unreachable", "The node that stores this bucket is not reachable.", RetryAfterDown)
			return true
		}

		ctx, cancel := context.WithCancelCause(r.Context())
		go body.watch(ctx, f.idle, cancel)
		lent := body.attempt()
		resp, err := f.send(ctx, r, lent, rt.URL, bucket, epoch, info)
		if err != nil {
			cause := context.Cause(ctx)
			cancel(nil)
			f.sendFailed(w, r, t, homeID, peer, err, cause, body)
			return true
		}

		if resp.StatusCode == http.StatusMisdirectedRequest {
			// The attempt is over, whatever follows: take the body back first. Then close
			// the answer instead of reading it, it has nothing we need, and an end that is
			// not framed comes only when the home's linger over the unread body is done.
			untouched := lent.seal()
			resp.Body.Close()
			cancel(nil)
			if attempt == 0 && untouched {
				// no byte of the client's body was asked for (a request without a body, or
				// one that waits for the home's 100 Continue): it can go to another home, or
				// be served here
				f.sync(r.Context())
				nh, ne, ok := f.node.Home(bucket)
				switch {
				case !ok || nh == f.node.ID():
					return false // gone, or homed here now: the local handler answers
				case nh != homeID || ne != epoch:
					homeID, epoch = nh, ne
					continue
				}
			} else if !untouched {
				// the transport has read, or is reading, the client's body: it cannot be sent
				// again. Answer at once; the client's retry (Retry-After) will find the catalog
				// that this pull brings in.
				go f.syncDetached()
			}
			f.refuse(w, r, t, peer, "moved", "The bucket is moving to another node; retry.", RetryAfterMoving)
			return true
		}

		f.relay(w, r, resp, ctx, cancel, peer)
		return true
	}
}

// send builds the outgoing request and sends it. The request is the client's,
// verbatim: method, raw path and query, headers without the hop-by-hop ones, the
// original Host (SigV4 signs it) and the body, streamed. The forwarder adds the
// cluster key, the entry node's id, the request id, the client address and the
// epoch it knows.
func (f *Forwarder) send(ctx context.Context, r *http.Request, body *attemptBody, peerURL, bucket string, epoch int64, info *httpx.Info) (*http.Response, error) {
	u, err := url.Parse(peerURL)
	if err != nil {
		return nil, err
	}
	rawPath, rawQuery := httpx.SplitRequestURI(r)
	out := (&http.Request{
		Method: r.Method,
		URL:    &url.URL{Scheme: u.Scheme, Host: u.Host, RawQuery: rawQuery, ForceQuery: rawQuery == "" && strings.Contains(r.RequestURI, "?")},
		Host:   r.Host,
		Proto:  "HTTP/1.1", ProtoMajor: 1, ProtoMinor: 1,
		Header: f.headers(r),
	}).WithContext(ctx)
	if strings.HasPrefix(rawPath, "//") {
		// Opaque may not start with "//" (the transport would take the rest for an
		// authority), so the path goes in Path and RawPath, which must agree: Path is
		// the decoded form, RawPath the client's own. With the raw path in both, the
		// transport would not take RawPath for an encoding of Path and would escape
		// every '%' in it (a key "/a b", sent as //a%20b, would go out as //a%2520b),
		// and SigV4 signs the path. The request line is then the client's, byte for
		// byte, when its path holds only what RFC 3986 allows in one (every SDK's
		// does); a client that sent other bytes raw (UTF-8, a quote) gets them escaped,
		// which is the same path for the home: the same key, the same canonical URI.
		decoded, err := url.PathUnescape(rawPath)
		if err != nil {
			decoded = rawPath // not reachable: the server rejected the request line first
		}
		out.URL.Path, out.URL.RawPath = decoded, rawPath
	} else {
		out.URL.Opaque = rawPath
	}
	if body.none {
		out.Body, out.ContentLength = http.NoBody, 0
	} else {
		out.Body, out.ContentLength = body, r.ContentLength
	}
	f.node.AuthRequest(out)
	out.Header.Set(cluster.HeaderOrigin, f.node.ID())
	out.Header.Set(HeaderRequestID, info.ID)
	out.Header.Set(HeaderEpoch, strconv.FormatInt(epoch, 10))
	out.Header.Set(HeaderBucket, bucket)
	if info.Client != "" {
		out.Header.Set("X-Forwarded-For", info.Client)
	}
	return f.tr.RoundTrip(out)
}

// headers copies the client's request headers for the home: hop-by-hop headers
// go, so does every X-Binvault-* header the client sent (only the forwarder sets
// them) and the client's own X-Forwarded-For (the entry node's resolved address
// replaces it). Content-Length is the transport's to write from the body.
func (f *Forwarder) headers(r *http.Request) http.Header {
	conn := connectionTokens(r.Header)
	h := make(http.Header, len(r.Header)+8)
	for k, vs := range r.Header {
		lk := strings.ToLower(k)
		if hopByHop[lk] || conn[lk] || strings.HasPrefix(lk, "x-binvault-") || lk == "x-forwarded-for" || lk == "content-length" {
			continue
		}
		h[k] = append([]string(nil), vs...)
	}
	if _, ok := h["User-Agent"]; !ok {
		h["User-Agent"] = []string{""} // do not invent one: the client sent none
	}
	return h
}

// sendFailed answers a request that got no response from the home.
func (f *Forwarder) sendFailed(w http.ResponseWriter, r *http.Request, t *s3.Target, homeID, peer string, err, cause error, body *reqBody) {
	if cerr := body.clientErr(); cerr != nil {
		if errors.Is(cerr, httpx.ErrIdle) {
			httpx.From(r.Context()).ErrCode = "RequestTimeout"
			f.s3.WriteError(w, r, t, apierr.New("RequestTimeout", "Your socket connection to the server was not read from or written to within the timeout period."))
		}
		return // the client is gone: nobody to answer
	}
	if r.Context().Err() != nil {
		return
	}
	reason, down := failure(err, cause)
	f.log.Warn("forwarding to the home node failed", "peer", peer, "reason", reason, "error", err, "request_id", httpx.From(r.Context()).ID)
	if down {
		// the next requests for that node's buckets should not each wait for a dial of their own
		f.node.NoteUnreachable(homeID, err)
	}
	f.refuse(w, r, t, peer, reason, "The node that stores this bucket did not answer; retry shortly.", RetryAfterDown)
}

// failure sorts a request that got no response. reason names it in the log and in
// the failures metric; down says that it points at the home node itself and not at
// this one request: the node cannot be dialled, resets the connection, or closes it
// without a byte of answer. A timeout is not such a sign. One slow request (a heavy
// listing, a before-pipeline that spends its budget) or one stuck transfer (the idle
// watchdogs end those, cause says so) must not make every other client's request for
// that node's buckets fail until its next hello.
func failure(err, cause error) (reason string, down bool) {
	var ne net.Error
	var oe *net.OpError
	switch {
	case errors.Is(cause, errUploadStalled), errors.Is(cause, errResponseIdle):
		return "stalled", false
	case errors.As(err, &oe) && oe.Op == "dial":
		return "dial", true
	case errors.Is(err, syscall.ECONNRESET), errors.Is(err, syscall.EPIPE), errors.Is(err, io.EOF), errors.Is(err, io.ErrUnexpectedEOF):
		return "upstream", true
	case errors.As(err, &ne) && ne.Timeout():
		return "timeout", false
	}
	return "upstream", false
}

var copyBufs = sync.Pool{New: func() any { b := make([]byte, 64<<10); return &b }}

// relay streams the home's response to the client, unchanged: status, headers
// (the home's x-binvault-node and request id replace the entry node's) and body,
// flushed as it arrives so that the early-200 keep-alive of slow copies and
// completes (§5.4.5, §5.6) reaches the client on time. A failure after the first
// byte resets the connection, as the spec asks.
func (f *Forwarder) relay(w http.ResponseWriter, r *http.Request, resp *http.Response, ctx context.Context, cancel context.CancelCauseFunc, peer string) {
	defer cancel(nil)
	rb := newRespBody(resp.Body, f.idle, cancel)
	defer rb.Close()
	if f.forwarded != nil {
		f.forwarded.Inc(peer, strconv.Itoa(resp.StatusCode))
	}
	h := w.Header()
	for k := range resp.Header {
		delete(h, k)
	}
	conn := connectionTokens(resp.Header)
	for k, vs := range resp.Header {
		if lk := strings.ToLower(k); hopByHop[lk] || conn[lk] {
			continue
		}
		h[k] = append([]string(nil), vs...)
	}
	w.WriteHeader(resp.StatusCode)
	if r.Method == http.MethodHead || resp.StatusCode == http.StatusNoContent || resp.StatusCode == http.StatusNotModified || resp.StatusCode < 200 {
		return
	}
	rc := http.NewResponseController(w)
	flush := resp.ContentLength < 0 // no length: the body is a stream (keep-alive whitespace)
	if flush {
		_ = rc.Flush()
	}
	bp := copyBufs.Get().(*[]byte)
	defer copyBufs.Put(bp)
	buf := *bp
	for {
		n, rerr := rb.Read(buf)
		if n > 0 {
			if _, werr := w.Write(buf[:n]); werr != nil {
				return // the client went away: the deferred cancel ends the upstream request
			}
			if flush {
				_ = rc.Flush()
			}
		}
		if rerr == io.EOF {
			return
		}
		if rerr != nil {
			f.log.Warn("the home node's response broke off", "peer", peer, "error", rerr, "cause", context.Cause(ctx), "request_id", httpx.From(r.Context()).ID)
			panic(http.ErrAbortHandler) // some bytes are out: reset the connection
		}
	}
}
