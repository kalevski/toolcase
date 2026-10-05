// Package s3 is the S3-compatible data plane (spec §5): request routing,
// authentication and authorisation, and one handler per supported operation on
// top of package engine.
package s3

import (
	"context"
	"crypto/subtle"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/netip"
	"runtime"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/auth"
	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/httpx"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/obs"
	"github.com/kalevski/toolcase/binvault/internal/s3xml"
	"github.com/kalevski/toolcase/binvault/internal/sigv4"
)

// PipelineTokens resolves pipeline-token credentials (spec §7.8). The pipeline
// package implements it; nil means pipelines are not wired.
type PipelineTokens interface {
	// Lookup returns the principal and secret of a live pipeline token.
	Lookup(accessKeyID string) (p *auth.Principal, secret string, ok bool)
}

// Limiter applies the rate limits of spec §4.9; nil means unlimited.
type Limiter interface {
	// Allow charges one request against the token's and the bucket's limits.
	Allow(p *auth.Principal, b *meta.Bucket, now time.Time) (ok bool, retryAfter time.Duration)
	WrapReader(ctx context.Context, p *auth.Principal, b *meta.Bucket, r io.Reader) io.Reader
	WrapWriter(ctx context.Context, p *auth.Principal, b *meta.Bucket, w io.Writer) io.Writer
}

// Server is the public (S3) listener's handler.
type Server struct {
	Eng      *engine.Engine
	Tokens   *auth.Store
	Cfg      *config.Config
	Log      *slog.Logger
	Throttle *auth.Throttle
	KeyCache *sigv4.KeyCache
	Pipes    PipelineTokens
	Limits   Limiter
	Metrics  *Metrics

	Version string
	Commit  string
	// Health reports readiness for /_healthz ("" = ok, otherwise the failing check).
	Health func(ctx context.Context) string
	// Draining is set during shutdown (/_healthz answers 503 draining).
	Draining atomic.Bool

	// Router, when set, may take over a request before it is served locally
	// (cluster forwarding, spec §8.4): it returns true when it answered.
	Router func(w http.ResponseWriter, r *http.Request, t *Target) bool
	// Forwarded is the home's counterpart of Router: it sees a request that a
	// peer forwarded (ServeForwarded), which is never routed again, and may
	// refuse it (421, spec §8.4). It returns true when it answered.
	Forwarded func(w http.ResponseWriter, r *http.Request, t *Target) bool
	// Gate, when set, is asked wherever the node resolves a local bucket, with
	// the local row (nil when there is none): a cluster node serves a bucket only
	// when the catalog says it is the home of exactly this incarnation (spec
	// §8.5). A non-nil error is answered as it is.
	Gate func(ctx context.Context, name string, local *meta.Bucket) error

	trusted []netip.Prefix
}

// Metrics are the counters the data plane maintains itself.
type Metrics struct {
	AuthFailures *obs.CounterVec
	Throttled    *obs.CounterVec
}

// NewMetrics registers the data-plane counters.
func NewMetrics(r *obs.Registry) *Metrics {
	return &Metrics{
		AuthFailures: r.Counter("binvault_auth_failures_total", "Failed authentications.", "scheme"),
		Throttled:    r.Counter("binvault_throttled_total", "Throttled requests.", "reason"),
	}
}

func (m *Metrics) authFail(scheme string) {
	if m != nil {
		m.AuthFailures.Inc(scheme)
	}
}
func (m *Metrics) throttled(reason string) {
	if m != nil {
		m.Throttled.Inc(reason)
	}
}

// ---- request context ---------------------------------------------------------

// reqCtx is everything a handler needs about one request.
type reqCtx struct {
	s    *Server
	w    http.ResponseWriter
	r    *http.Request
	ctx  context.Context
	t    *Target
	info *httpx.Info
	op   string
	b    *meta.Bucket
	p    *auth.Principal
	sig  *sigv4.Result // nil for bearer and anonymous
	kind sigv4.Kind
}

// ServeHTTP implements http.Handler.
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) { s.serve(w, r, false) }

// ServeForwarded serves a request that a peer forwarded here (spec §8.4): exactly
// like ServeHTTP, except that it is never routed to another node again — at most
// one hop — and that Forwarded, not Router, sees it first.
func (s *Server) ServeForwarded(w http.ResponseWriter, r *http.Request) { s.serve(w, r, true) }

// WriteError renders err as an S3 error response, for the packages that answer
// requests before they reach a handler (the cluster forwarder).
func (s *Server) WriteError(w http.ResponseWriter, r *http.Request, t *Target, err error) {
	s.writeError(w, r, t, err)
}

// bucket loads a local bucket and asks the cluster gate whether this node may
// serve it.
func (s *Server) bucket(ctx context.Context, name string) (*meta.Bucket, error) {
	b, err := s.Eng.Bucket(ctx, name)
	if s.Gate != nil {
		var local *meta.Bucket
		if err == nil {
			local = b
		}
		if gerr := s.Gate(ctx, name, local); gerr != nil {
			return nil, gerr
		}
	}
	return b, err
}

func (s *Server) serve(w http.ResponseWriter, r *http.Request, forwarded bool) {
	info := httpx.From(r.Context())
	t, err := ParseTarget(r, s.Cfg.Domain)
	if err != nil {
		s.writeError(w, r, nil, err)
		return
	}
	if t.Reserved {
		if forwarded {
			http.NotFound(w, r) // the forwarder never sends a reserved path (spec §8.4)
			return
		}
		s.serveReserved(w, r, t)
		return
	}
	info.Bucket, info.Key = t.Bucket, t.Key

	op, stub, err := Dispatch(r, t)
	if err != nil {
		info.Op = OpUnknown
		s.writeError(w, r, t, err)
		return
	}
	info.Op = op

	if forwarded {
		if s.Forwarded != nil && s.Forwarded(w, r, t) {
			return
		}
	} else if s.Router != nil && s.Router(w, r, t) {
		return
	}

	// per-address brute-force throttle (spec §4.8)
	if blocked, wait := s.Throttle.Blocked(info.Client); blocked {
		s.Metrics.throttled("auth")
		s.writeError(w, r, t, apierr.New("SlowDown", "Please reduce your request rate.").
			WithHeader("Retry-After", strconv.Itoa(int(wait.Seconds()+0.999))))
		return
	}

	rc := &reqCtx{s: s, w: w, r: r, ctx: r.Context(), t: t, info: info, op: op}

	if op == OpOptions {
		s.preflight(rc)
		return
	}

	if err := s.authenticate(rc); err != nil {
		s.writeError(w, r, t, err)
		return
	}
	info.Principal = rc.p.Label()

	if t.Service { // ListBuckets: the credential's own bucket
		if rc.p.Kind == auth.KindAnonymous {
			// as S3 answers an unsigned GET / (spec §2.4)
			s.writeError(w, r, t, accessDenied("Anonymous requests cannot list buckets."))
			return
		}
		t.Bucket = rc.p.Bucket
		info.Bucket = t.Bucket
	}
	b, err := s.bucket(rc.ctx, t.Bucket)
	if err != nil {
		if rc.op == OpCreateBucket && apierr.Is(err, "NoSuchBucket") {
			// spec §5.2: a bucket is never created here, whatever its name
			err = accessDenied("Buckets are created through the admin API.")
		}
		s.writeError(w, r, t, err)
		return
	}
	rc.b = b

	// a bucket that is being moved refuses writes (and, at the switch, reads): a
	// write that is still on its way when the freeze starts is ended with the
	// same answer (spec §8.8)
	if s.Eng.Gate != nil {
		ctx, end, err := s.Eng.Gate.Begin(rc.ctx, b.Name, writesBucket(rc.op))
		if err != nil {
			s.writeError(w, r, t, err)
			return
		}
		defer end()
		rc.ctx = ctx
	}

	if err := rejectCustomerKeys(r.Header); err != nil {
		s.writeError(w, r, t, err)
		return
	}
	if rc.p.Kind != auth.KindAnonymous && rc.p.Bucket != b.Name {
		s.writeError(w, r, t, apierr.New("AccessDenied", "This credential does not belong to this bucket."))
		return
	}
	if s.Limits != nil && rc.p.Kind != auth.KindPipeline && rc.op != OpPostObject { // POST charges itself once the token is known
		if ok, wait := s.Limits.Allow(rc.p, b, time.Now()); !ok {
			s.Metrics.throttled("rate")
			s.writeError(w, r, t, apierr.New("SlowDown", "Please reduce your request rate.").
				WithHeader("Retry-After", strconv.Itoa(int(wait.Seconds()+0.999))))
			return
		}
	}

	// requests made with a pipeline token live and die with the token (spec §7.8)
	if pt := rc.pipe(); pt != nil {
		end, err := s.bindPipelineRequest(rc, pt)
		if err != nil {
			s.writeError(w, r, t, err)
			return
		}
		defer end()
		if pt.StagedKey() != "" {
			if err := rc.beforeGate(); err != nil {
				s.writeError(w, r, t, err)
				return
			}
		}
	}

	if err := s.handle(rc, stub); err != nil {
		s.writeError(w, rc.r, t, engine.FrozenCause(rc.ctx, err))
	}
}

// writesBucket reports whether an operation changes the bucket's data.
func writesBucket(op string) bool {
	switch op {
	case OpPutObject, OpDeleteObject, OpDeleteObjects, OpPostObject, OpCopyObject, OpPutObjectTagging,
		OpDeleteObjectTagging, OpCreateMultipartUpload, OpUploadPart, OpUploadPartCopy,
		OpCompleteMultipartUpload, OpAbortMultipartUpload:
		return true
	}
	return false
}

// handle runs the operation's handler.
func (s *Server) handle(rc *reqCtx, stub string) error {
	switch rc.op {
	case OpListBuckets:
		return s.listBuckets(rc)
	case OpHeadBucket:
		return s.headBucket(rc)
	case OpCreateBucket:
		return s.createBucket(rc)
	case OpDeleteBucket, OpBucketRestricted:
		return apierr.New("AccessDenied", "Bucket configuration is managed through the admin API.")
	case OpGetBucketLocation, OpGetBucketVersioning, OpGetBucketLifecycle, OpGetBucketEncryption,
		OpGetBucketCors, OpGetBucketAcl, OpPutBucketAcl, OpBucketStub:
		return s.bucketSubresource(rc, stub)
	case OpPutObject:
		return s.putObject(rc)
	case OpGetObject, OpHeadObject:
		return s.getObject(rc)
	case OpDeleteObject:
		return s.deleteObject(rc)
	case OpListObjects:
		return s.listObjects(rc, false)
	case OpListObjectsV2:
		return s.listObjects(rc, true)
	case OpListObjectVersions:
		return s.listObjectVersions(rc)
	case OpDeleteObjects:
		return s.deleteObjects(rc)
	case OpPostObject:
		return s.postObject(rc)
	case OpCopyObject:
		return s.copyObject(rc)
	case OpGetObjectTagging:
		return s.getObjectTagging(rc)
	case OpPutObjectTagging:
		return s.putObjectTagging(rc)
	case OpDeleteObjectTagging:
		return s.deleteObjectTagging(rc)
	case OpGetObjectAcl:
		return s.getObjectAcl(rc)
	case OpPutObjectAcl:
		return s.putObjectAcl(rc)
	case OpGetObjectAttributes:
		return s.getObjectAttributes(rc)
	case OpCreateMultipartUpload:
		return s.createMultipartUpload(rc)
	case OpUploadPart:
		return s.uploadPart(rc)
	case OpUploadPartCopy:
		return s.uploadPartCopy(rc)
	case OpCompleteMultipartUpload:
		return s.completeMultipartUpload(rc)
	case OpAbortMultipartUpload:
		return s.abortMultipartUpload(rc)
	case OpListParts:
		return s.listParts(rc)
	case OpListMultipartUploads:
		return s.listMultipartUploads(rc)
	}
	return apierr.New("NotImplemented", "A header you provided implies functionality that is not implemented.")
}

// ---- authentication ---------------------------------------------------------------

func (s *Server) signOpts() sigv4.Options {
	return sigv4.Options{ClockSkew: s.Cfg.ClockSkew, Cache: s.KeyCache}
}

// authenticate fills rc.p (and rc.sig). Failures count toward the per-address
// throttle, except for pipeline keys (spec §4.8).
func (s *Server) authenticate(rc *reqCtx) error {
	r := rc.r
	kind, err := sigv4.Detect(r)
	if err != nil {
		s.failAuth(rc, "", err)
		return err
	}
	rc.kind = kind
	switch kind {
	case sigv4.None:
		rc.p = auth.Anonymous(rc.t.Bucket)
		return nil
	case sigv4.Bearer:
		return s.authBearer(rc)
	}

	akid, err := sigv4.PeekAccessKey(r)
	if err != nil {
		s.failAuth(rc, "", err)
		return err
	}
	var (
		secret string
		prin   *auth.Principal
	)
	switch {
	case auth.IsPipelineKey(akid):
		if s.Pipes != nil {
			if p, sec, ok := s.Pipes.Lookup(akid); ok {
				prin, secret = p, sec
			}
		}
	default:
		c, err := s.Tokens.Lookup(rc.ctx, akid)
		if err != nil {
			s.Log.Error("token lookup failed", "error", err)
			return apierr.Wrap("InternalError", "We encountered an internal error. Please try again.", err)
		}
		if c != nil {
			prin, secret = c.Principal(), c.Secret
		}
	}
	rawPath, rawQuery := httpx.SplitRequestURI(r)
	res, verr := sigv4.Verify(r, rawPath, rawQuery, func(id string) (string, bool) {
		if prin != nil && id == akid {
			return secret, true
		}
		return "", false
	}, s.signOpts())
	if verr != nil {
		s.failAuth(rc, akid, verr)
		return verr
	}
	rc.p, rc.sig = prin, res
	if prin.Kind == auth.KindToken {
		s.Tokens.Touch(akid) // a verified signature is the only proof of use (spec §4.3)
	}
	if res.Presigned {
		rc.hoistPresigned() // the signed query's x-amz-* parameters are request headers (spec §5.9)
	}
	return nil
}

// authBearer accepts `Authorization: Bearer <id>.<secret>` for pipeline tokens
// only (spec §4.5 item 3).
func (s *Server) authBearer(rc *reqCtx) error {
	akid, secret, ok := sigv4.ParseBearer(rc.r)
	if !ok {
		err := apierr.New("InvalidAccessKeyId", "The AWS Access Key Id you provided does not exist in our records.")
		s.failAuth(rc, "", err)
		return err
	}
	if auth.IsPipelineKey(akid) {
		if s.Pipes != nil {
			if p, sec, found := s.Pipes.Lookup(akid); found && subtle.ConstantTimeCompare([]byte(sec), []byte(secret)) == 1 {
				rc.p = p
				return nil
			}
		}
		return apierr.New("InvalidAccessKeyId", "The AWS Access Key Id you provided does not exist in our records.")
	}
	if strings.HasPrefix(akid, auth.BucketKeyPrefix) {
		// a bucket secret must not travel in a header (spec §4.5)
		err := apierr.New("AccessDenied", "Bucket tokens must use SigV4 or a presigned URL, not a bearer header.")
		s.failAuth(rc, akid, err)
		return err
	}
	// anything else, the admin token included, is just an invalid bearer
	err := apierr.New("InvalidAccessKeyId", "The AWS Access Key Id you provided does not exist in our records.")
	s.failAuth(rc, akid, err)
	return err
}

func (s *Server) failAuth(rc *reqCtx, akid string, err error) {
	scheme := rc.kind.String()
	s.Metrics.authFail(scheme)
	if auth.IsPipelineKey(akid) {
		return // a service calling with a revoked token cannot lock itself out
	}
	s.Throttle.Fail(rc.info.Client)
}

// ---- errors ---------------------------------------------------------------------

// toAPIError normalises any error into an S3 error.
func toAPIError(err error) *apierr.Error {
	if ae, ok := apierr.As(err); ok {
		return ae
	}
	switch {
	case errors.Is(err, httpx.ErrIdle):
		return apierr.New("RequestTimeout", "Your socket connection to the server was not read from or written to within the timeout period.")
	case errors.Is(err, context.Canceled):
		return apierr.Wrap("RequestTimeout", "The request was cancelled.", err)
	}
	return apierr.Wrap("InternalError", "We encountered an internal error. Please try again.", err)
}

// writeError renders an S3 error response (XML body; status only for HEAD).
func (s *Server) writeError(w http.ResponseWriter, r *http.Request, t *Target, err error) {
	ae := toAPIError(err)
	info := httpx.From(r.Context())
	info.ErrCode = ae.Code
	if ae.Status >= 500 && ae.Err != nil {
		s.Log.Error("request failed", "request_id", info.ID, "code", ae.Code, "error", ae.Err)
	}
	h := w.Header()
	for k, vs := range ae.Header {
		h[k] = vs
	}
	if httpx.HeaderWritten(w) {
		return // too late to change the status; the connection is cut by the caller
	}
	if r.Method == http.MethodHead {
		w.WriteHeader(ae.Status)
		return
	}
	resource := ""
	if t != nil && !t.Service {
		resource = "/" + t.Bucket
		if t.Key != "" {
			resource += "/" + t.Key
		}
	} else {
		resource, _ = httpx.SplitRequestURI(r) // the service root, or a request that did not parse: S3 names the path (spec §5.11)
	}
	body := s3xml.FromAPIError(ae, info.ID, resource)
	h.Set("Content-Type", s3xml.ContentType)
	h.Set("Content-Length", strconv.Itoa(len(body)))
	w.WriteHeader(ae.Status)
	_, _ = w.Write(body)
}

// writeXML marshals v and sends it with the given status.
func (s *Server) writeXML(rc *reqCtx, status int, v any) error {
	body, err := s3xml.Marshal(v)
	if err != nil {
		var ice *s3xml.InvalidCharError
		if errors.As(err, &ice) {
			// a key with characters XML 1.0 cannot carry: S3 clients ask for
			// encoding-type=url in that case
			return apierr.Wrap("InvalidRequest", "The response contains a key with characters that XML 1.0 cannot carry; retry the listing with encoding-type=url.", err)
		}
		return apierr.Wrap("InternalError", "We encountered an internal error. Please try again.", err)
	}
	h := rc.w.Header()
	h.Set("Content-Type", s3xml.ContentType)
	h.Set("Content-Length", strconv.Itoa(len(body)))
	rc.w.WriteHeader(status)
	if rc.r.Method != http.MethodHead {
		_, _ = rc.w.Write(body)
	}
	return nil
}

// ---- reserved paths ---------------------------------------------------------------

// serveReserved handles /_healthz and /_version, on exactly those paths; every
// other "_" path is 404 (spec §2.4: the admin API exists only on the admin
// listener).
func (s *Server) serveReserved(w http.ResponseWriter, r *http.Request, t *Target) {
	info := httpx.From(r.Context())
	info.Op = "Reserved"
	switch {
	case t.RawPath == "/_healthz" && (r.Method == http.MethodGet || r.Method == http.MethodHead):
		info.Op = "Healthz"
		if s.Draining.Load() {
			http.Error(w, "draining", http.StatusServiceUnavailable)
			return
		}
		if s.Health != nil {
			if msg := s.Health(r.Context()); msg != "" {
				http.Error(w, msg, http.StatusServiceUnavailable)
				return
			}
		}
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = io.WriteString(w, "ok\n")
	case t.RawPath == "/_version" && (r.Method == http.MethodGet || r.Method == http.MethodHead):
		info.Op = "Version"
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"version":`+strconv.Quote(s.Version)+`,"commit":`+strconv.Quote(s.Commit)+`,"go":`+strconv.Quote(runtime.Version())+`}`+"\n")
	default:
		http.NotFound(w, r)
	}
}

// rejectCustomerKeys refuses SSE-C and SSE-KMS key headers on any request, so a
// client never believes its own key protects data binvault cannot (spec §5.1).
func rejectCustomerKeys(h http.Header) error {
	for k := range h {
		lk := strings.ToLower(k)
		if strings.HasPrefix(lk, "x-amz-server-side-encryption-customer-") ||
			strings.HasPrefix(lk, "x-amz-copy-source-server-side-encryption-customer-") ||
			lk == "x-amz-server-side-encryption-aws-kms-key-id" {
			return apierr.New("NotImplemented", "Server-side encryption with customer-provided or KMS keys is not supported.")
		}
	}
	return nil
}
