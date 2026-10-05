// Package forward is the cluster's request forwarder (spec §8.4). The node that
// receives an S3 request resolves its bucket — from Host, the first path
// segment or the access key id of the credential — and, when the catalog homes
// the bucket on another node, sends the request there verbatim over the peer
// listener and streams the response back. The home serves it exactly as its
// public listener would, verifying the client's own signature.
//
// Two halves share this package:
//
//   - Route is the s3.Server.Router of the public listener: it decides
//     local / forward / unknown and does the forwarding;
//   - Handle (with Check as s3.Server.Forwarded) serves the requests that
//     arrive over the peer listener, marked by X-Binvault-Origin.
//
// A request that arrived over the peer link is never forwarded again: at most
// one hop, so catalogs that disagree give a 503, never a loop.
package forward

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/auth"
	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/httpx"
	"github.com/kalevski/toolcase/binvault/internal/obs"
	"github.com/kalevski/toolcase/binvault/internal/s3"
	"github.com/kalevski/toolcase/binvault/internal/sigv4"
)

// Headers of the forwarding protocol, besides the ones package cluster names
// (X-Binvault-Peer-Key, X-Binvault-Origin).
const (
	// HeaderEpoch carries the bucket's epoch as the entry node knows it; a node
	// that is not the home at that epoch answers 421 (§8.4).
	HeaderEpoch = "X-Binvault-Epoch"
	// HeaderHome names the node that is the home, in a 421 answer.
	HeaderHome = "X-Binvault-Home"
	// HeaderRequestID carries the entry node's request id, which becomes the id at
	// the home, so one id traces both hops.
	HeaderRequestID = "X-Binvault-Request-Id"
	// HeaderBucket names the bucket a bucket-less request (ListBuckets) was routed
	// by, so the home can check the epoch.
	HeaderBucket = "X-Binvault-Bucket"
)

// RetryAfterDown is the Retry-After of a 503 for a home that is down, draining or
// unknown; RetryAfterMoving is the one for a bucket that is moving (§8.4).
const (
	RetryAfterDown   = 5
	RetryAfterMoving = 1
)

// Options configure New.
type Options struct {
	Node *cluster.Node
	S3   *s3.Server
	Cfg  *config.Config
	Log  *slog.Logger
	// Registry receives binvault_cluster_forwarded_requests_total and
	// binvault_cluster_forward_failures_total (§9.2).
	Registry *obs.Registry
	// Ready reports whether this node serves buckets: the start-up fence has ended
	// and the node has caught up with its own catalog entries.
	Ready func() bool
	// SyncWait bounds the catalog pull that precedes NoSuchBucket (default 3s).
	SyncWait time.Duration
}

// Forwarder forwards requests for remote buckets and serves the ones peers
// forward here.
type Forwarder struct {
	node  *cluster.Node
	s3    *s3.Server
	cfg   *config.Config
	log   *slog.Logger
	ready func() bool
	wait  time.Duration

	tr        *http.Transport
	idle      time.Duration
	forwarded *obs.CounterVec
	failures  *obs.CounterVec
}

// New builds the forwarder.
func New(o Options) *Forwarder {
	if o.Log == nil {
		o.Log = slog.Default()
	}
	f := &Forwarder{node: o.Node, s3: o.S3, cfg: o.Cfg, log: o.Log, ready: o.Ready, wait: o.SyncWait, idle: o.Cfg.BodyIdleTimeout}
	if f.wait <= 0 {
		f.wait = 3 * time.Second
	}
	if f.ready == nil {
		f.ready = o.Node.Ready
	}
	f.tr = newTransport(o.Node.ForwardTransport(), o.Cfg)
	if o.Registry != nil {
		f.forwarded = o.Registry.Counter("binvault_cluster_forwarded_requests_total", "S3 requests forwarded to a bucket's home node, by peer and response status.", "peer", "status")
		f.failures = o.Registry.Counter("binvault_cluster_forward_failures_total", "Forwarded requests that failed before a response, by peer and reason.", "peer", "reason")
	}
	return f
}

// Close drops the idle peer connections of the forwarder.
func (f *Forwarder) Close() { f.tr.CloseIdleConnections() }

// newTransport derives the forwarding transport from the cluster's: the same TLS
// and dial settings, no proxy, and the three things a verbatim forwarder needs —
// no transparent decompression, a wait for the home's 100 Continue, and a bound
// on the wait for the response (what the home may legitimately take: the
// `before` budget plus 15 seconds, §8.4).
func newTransport(base http.RoundTripper, cfg *config.Config) *http.Transport {
	tr, ok := base.(*http.Transport)
	if !ok {
		tr = &http.Transport{}
	} else {
		tr = tr.Clone()
	}
	tr.Proxy = nil
	tr.DisableCompression = true
	tr.MaxIdleConns = 256
	tr.MaxIdleConnsPerHost = 64
	tr.IdleConnTimeout = 90 * time.Second
	tr.ExpectContinueTimeout = 10 * time.Second
	tr.ResponseHeaderTimeout = cfg.PipelineBeforeTotalTimeout + 15*time.Second
	return tr
}

// ---- the entry node ---------------------------------------------------------------

// Route is the s3.Server.Router of the public listener (spec §8.4). It returns
// false when the request is to be served by this node — the catalog says the
// bucket is homed here, or does not know it, in which case the local handler
// answers exactly as a single node would — and true once it answered.
func (f *Forwarder) Route(w http.ResponseWriter, r *http.Request, t *s3.Target) bool {
	if !f.ready() {
		f.refuse(w, r, t, "", "starting", "This node is starting; try again shortly.", RetryAfterDown)
		return true
	}
	bucket := t.Bucket
	if t.Service {
		if bucket = f.bucketOfKey(r); bucket == "" {
			return false // no usable credential: the local handler answers as a single node would
		}
	}
	home, epoch, ok := f.node.Home(bucket)
	if !ok {
		// a bucket created a moment ago may not have replicated yet (§8.4)
		f.sync(r.Context())
		if home, epoch, ok = f.node.Home(bucket); !ok {
			// still nothing: answer as a single node does for a bucket it does not have,
			// whichever node the client happened to ask (the credential may belong to a
			// bucket homed elsewhere, so this node cannot judge it)
			httpx.From(r.Context()).ErrCode = "NoSuchBucket"
			f.s3.WriteError(w, r, t, apierr.New("NoSuchBucket", "The specified bucket does not exist.").WithExtra("BucketName", bucket))
			return true
		}
	}
	if home == f.node.ID() {
		return false
	}
	if f.node.Draining() {
		// this node is shutting down: forwards in flight finish, new ones are not started (§9.4)
		f.refuse(w, r, t, f.node.NodeName(home), "shutting_down", "This node is shutting down; retry shortly.", RetryAfterDown)
		return true
	}
	return f.forward(w, r, t, bucket, home, epoch)
}

// sync pulls the catalog from every reachable peer (at most once a second; the
// cluster package rate-limits it) and waits for the pulls, bounded. When another
// request pulled within the last second, this one has nothing to ask for: it
// gives the replication that is probably under way a moment to land instead.
func (f *Forwarder) sync(ctx context.Context) {
	ctx, cancel := context.WithTimeout(ctx, f.wait)
	defer cancel()
	if !f.node.SyncNow(ctx) {
		select {
		case <-time.After(150 * time.Millisecond):
		case <-ctx.Done():
		}
	}
}

// syncDetached pulls the catalog after a request that could not wait for it was
// answered: the client's retry is what gains. It is bounded like sync, and does
// not belong to any request.
func (f *Forwarder) syncDetached() {
	ctx, cancel := context.WithTimeout(context.Background(), f.wait)
	defer cancel()
	f.node.SyncNow(ctx)
}

// bucketOfKey finds the bucket of a bucket-less request (GET /, ListBuckets) by
// the access key id of its credential, from the access-key index. Pipeline
// tokens are not indexed: a service makes bucket-less calls against the endpoint
// it was given, which is the home (§8.4).
func (f *Forwarder) bucketOfKey(r *http.Request) string {
	akid, err := sigv4.PeekAccessKey(r)
	if err != nil || akid == "" || auth.IsPipelineKey(akid) {
		return ""
	}
	if b, ok := f.node.LookupKey(akid); ok {
		return b
	}
	f.sync(r.Context())
	b, _ := f.node.LookupKey(akid)
	return b
}

// refuse answers 503 ServiceUnavailable as an S3 error and counts the failure.
func (f *Forwarder) refuse(w http.ResponseWriter, r *http.Request, t *s3.Target, peer, reason, msg string, retryAfter int) {
	if f.failures != nil && peer != "" {
		f.failures.Inc(peer, reason)
	}
	info := httpx.From(r.Context())
	info.ErrCode = "ServiceUnavailable"
	err := apierr.New("ServiceUnavailable", msg).WithHeader("Retry-After", strconv.Itoa(retryAfter))
	f.s3.WriteError(w, r, t, err)
}

// ---- the home -----------------------------------------------------------------------

// Handle is the handler of requests that carry X-Binvault-Origin on the peer
// listener (cluster.Mux.SetForward): a client request an entry node forwarded.
// The mux has checked the cluster key; the wrapper in front has taken the request
// id and the client address from the peer's headers.
func (f *Forwarder) Handle(w http.ResponseWriter, r *http.Request) {
	info := httpx.From(r.Context())
	origin := r.Header.Get(cluster.HeaderOrigin)
	info.Via = origin
	if n := f.node.NodeName(origin); n != "" {
		info.Via = n
	}
	if !f.ready() {
		f.refuse(w, r, nil, "", "starting", "This node is starting; try again shortly.", RetryAfterDown)
		return
	}
	f.s3.ServeForwarded(w, r)
}

// Check is the s3.Server.Forwarded hook: before it serves a forwarded request the
// home confirms that the catalog still gives it the bucket at the epoch the
// entry node knew. Otherwise it answers 421 with X-Binvault-Home, and the entry
// node pulls the catalog and tries once more, if it has not started on the
// request's body, or answers 503 with Retry-After: 1 (§8.4, §8.8).
func (f *Forwarder) Check(w http.ResponseWriter, r *http.Request, t *s3.Target) bool {
	bucket := t.Bucket
	if t.Service || bucket == "" {
		bucket = r.Header.Get(HeaderBucket)
	}
	home, current, ok := f.node.Home(bucket)
	epoch, err := strconv.ParseInt(r.Header.Get(HeaderEpoch), 10, 64)
	switch {
	case !ok:
		f.misdirected(w, r, "")
		return true
	case home != f.node.ID() || (err == nil && current != epoch):
		f.misdirected(w, r, f.node.NodeName(home))
		return true
	}
	return false
}

// misdirectedBody is the text of a 421 answer.
const misdirectedBody = "this node is not the home of the bucket at that epoch\n"

// misdirected answers 421: this node is not the home of the bucket at the
// epoch the request carries. The answer is framed with a Content-Length: a
// chunked one is not finished until the handler returns, and the request's body
// is usually still unread, so the home's linger over it (httpx) would hold the
// end of the answer back for seconds. The entry node does not wait for it either
// (see forward), but a framed answer is complete the moment it is flushed.
func (f *Forwarder) misdirected(w http.ResponseWriter, r *http.Request, home string) {
	httpx.From(r.Context()).ErrCode = "Misdirected"
	if home != "" {
		w.Header().Set(HeaderHome, home)
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Content-Length", strconv.Itoa(len(misdirectedBody)))
	w.WriteHeader(http.StatusMisdirectedRequest)
	_, _ = w.Write([]byte(misdirectedBody))
}

// ---- the peer listener's wrapper -------------------------------------------------------

// PeerRequestID is httpx.Options.RequestID for the peer listener: an authenticated
// peer's X-Binvault-Request-Id becomes the request id, so one id traces both
// hops. Anything without a valid cluster key, or with an odd id, gets a fresh one.
func PeerRequestID(n *cluster.Node) func(r *http.Request) string {
	return func(r *http.Request) string {
		id := r.Header.Get(HeaderRequestID)
		if id == "" || !validRequestID(id) || !n.CheckPeerKey(r.Header.Get(cluster.HeaderPeerKey)) {
			return ""
		}
		return id
	}
}

// PeerClientAddr is httpx.Options.ClientAddr for the peer listener: the client
// address a forwarding peer reports in X-Forwarded-For, honoured only with a valid
// cluster key (the public listener ignores the header unless a trusted proxy sent
// it, §8.4, §10).
func PeerClientAddr(n *cluster.Node) func(r *http.Request) string {
	return func(r *http.Request) string {
		if _, forwarded := r.Header[cluster.HeaderOrigin]; !forwarded {
			return ""
		}
		xff := r.Header.Get("X-Forwarded-For")
		if xff == "" || !n.CheckPeerKey(r.Header.Get(cluster.HeaderPeerKey)) {
			return ""
		}
		if i := strings.IndexByte(xff, ','); i >= 0 {
			xff = xff[:i]
		}
		xff = strings.TrimSpace(xff)
		if net.ParseIP(xff) == nil {
			return ""
		}
		return xff
	}
}

func validRequestID(s string) bool {
	if len(s) == 0 || len(s) > 64 {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c >= 'a' && c <= 'z', c >= 'A' && c <= 'Z', c >= '0' && c <= '9', c == '-', c == '_', c == '.':
		default:
			return false
		}
	}
	return true
}
