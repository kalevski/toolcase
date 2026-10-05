package sdkgo

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptrace"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awshttp "github.com/aws/aws-sdk-go-v2/aws/transport/http"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"
	"github.com/aws/smithy-go/logging"
)

// ---- wire recorder ------------------------------------------------------------------------------

// wire is one HTTP exchange as it left the SDK (after signing and checksum wrapping) and came back.
type wire struct {
	mu         sync.Mutex
	Method     string
	URI        string // exact request-target on the wire
	Host       string
	Header     http.Header
	ContentLen int64
	BodyHead   []byte // first bytes of the body as sent
	BodyTail   []byte // last bytes of the body as sent
	BodyLen    int64  // bytes the transport actually pulled from the body
	Status     int
	Proto      string
	RespHeader http.Header
	RespBody   []byte // only kept for status >= 400
	Reused     bool
	Got100     bool
	Err        error
	Start, End time.Time
}

func (w *wire) hdr(name string) string { return w.Header.Get(name) }

// recorder wraps an HTTP client and remembers every exchange.
type recorder struct {
	mu   sync.Mutex
	reqs []*wire
	next aws.HTTPClient
}

func (r *recorder) all() []*wire {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]*wire(nil), r.reqs...)
}

func (r *recorder) last() *wire {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.reqs) == 0 {
		return nil
	}
	return r.reqs[len(r.reqs)-1]
}

func (r *recorder) reset() {
	r.mu.Lock()
	r.reqs = nil
	r.mu.Unlock()
}

// matching returns the exchanges with the given method whose request-target contains substr.
func (r *recorder) matching(method, substr string) []*wire {
	var out []*wire
	for _, w := range r.all() {
		if (method == "" || w.Method == method) && strings.Contains(w.URI, substr) {
			out = append(out, w)
		}
	}
	return out
}

const (
	bodyHeadMax = 256
	bodyTailMax = 512
)

type tapBody struct {
	rc io.ReadCloser
	w  *wire
}

func (b *tapBody) Read(p []byte) (int, error) {
	n, err := b.rc.Read(p)
	if n > 0 {
		b.w.mu.Lock()
		b.w.BodyLen += int64(n)
		if len(b.w.BodyHead) < bodyHeadMax {
			take := min(n, bodyHeadMax-len(b.w.BodyHead))
			b.w.BodyHead = append(b.w.BodyHead, p[:take]...)
		}
		b.w.BodyTail = append(b.w.BodyTail, p[:n]...)
		if len(b.w.BodyTail) > bodyTailMax {
			b.w.BodyTail = append([]byte(nil), b.w.BodyTail[len(b.w.BodyTail)-bodyTailMax:]...)
		}
		b.w.mu.Unlock()
	}
	return n, err
}

func (b *tapBody) Close() error { return b.rc.Close() }

func (r *recorder) Do(req *http.Request) (*http.Response, error) {
	w := &wire{
		Method: req.Method, URI: req.URL.RequestURI(), Host: req.Host, Header: req.Header.Clone(),
		ContentLen: req.ContentLength, Start: time.Now(),
	}
	if w.Host == "" {
		w.Host = req.URL.Host
	}
	r.mu.Lock()
	r.reqs = append(r.reqs, w)
	r.mu.Unlock()

	trace := &httptrace.ClientTrace{
		GotConn:        func(i httptrace.GotConnInfo) { w.mu.Lock(); w.Reused = i.Reused; w.mu.Unlock() },
		Got100Continue: func() { w.mu.Lock(); w.Got100 = true; w.mu.Unlock() },
	}
	req = req.WithContext(httptrace.WithClientTrace(req.Context(), trace))
	if req.Body != nil && req.Body != http.NoBody {
		req.Body = &tapBody{rc: req.Body, w: w}
	}
	resp, err := r.next.Do(req)
	w.mu.Lock()
	w.End = time.Now()
	w.Err = err
	if resp != nil {
		w.Status, w.Proto, w.RespHeader = resp.StatusCode, resp.Proto, resp.Header.Clone()
	}
	w.mu.Unlock()
	if err == nil && resp.StatusCode >= 400 && req.Method != http.MethodHead {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
		_ = resp.Body.Close()
		w.mu.Lock()
		w.RespBody = raw
		w.mu.Unlock()
		resp.Body = io.NopCloser(bytes.NewReader(raw))
	}
	return resp, err
}

// ---- client construction --------------------------------------------------------------------------

type clientOpts struct {
	virtual   bool
	region    string
	retryer   func() aws.Retryer
	rec       *recorder
	reqCS     aws.RequestChecksumCalculation
	respCS    aws.ResponseChecksumValidation
	anonymous bool
	endpoint  string
	rootCAs   *x509.CertPool
	s3mods    []func(*s3.Options)
}

type copt func(*clientOpts)

func withVirtual() copt                     { return func(o *clientOpts) { o.virtual = true } }
func withRegion(r string) copt              { return func(o *clientOpts) { o.region = r } }
func withRetryer(f func() aws.Retryer) copt { return func(o *clientOpts) { o.retryer = f } }
func withRecorder(r *recorder) copt         { return func(o *clientOpts) { o.rec = r } }
func withAnonymous() copt                   { return func(o *clientOpts) { o.anonymous = true } }
func withReqChecksum(c aws.RequestChecksumCalculation) copt {
	return func(o *clientOpts) { o.reqCS = c }
}
func withRespChecksum(c aws.ResponseChecksumValidation) copt {
	return func(o *clientOpts) { o.respCS = c }
}
func withS3(f ...func(*s3.Options)) copt {
	return func(o *clientOpts) { o.s3mods = append(o.s3mods, f...) }
}
func withTLS(endpoint string, pool *x509.CertPool) copt {
	return func(o *clientOpts) { o.endpoint, o.rootCAs = endpoint, pool }
}

// port returns the S3 port of the shared node.
func (e *environment) port() string {
	u, _ := url.Parse(e.Endpoint)
	return u.Port()
}

// vhEndpoint is the base endpoint for virtual-hosted-style addressing (<bucket>.<domain>:<port>).
func (e *environment) vhEndpoint() string { return "http://" + e.Domain + ":" + e.port() }

// httpClient builds the SDK's own default HTTP client with proxies off and every <anything>.<domain>
// name dialled at loopback, so virtual-hosted style works without DNS.
func (e *environment) httpClient(o *clientOpts) *awshttp.BuildableClient {
	domain := e.Domain
	return awshttp.NewBuildableClient().WithTransportOptions(func(tr *http.Transport) {
		tr.Proxy = nil
		dial := tr.DialContext
		if dial == nil {
			dial = (&net.Dialer{Timeout: 30 * time.Second}).DialContext
		}
		tr.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
			if host, port, err := net.SplitHostPort(addr); err == nil && domain != "" && (host == domain || strings.HasSuffix(host, "."+domain)) {
				addr = net.JoinHostPort("127.0.0.1", port)
			}
			return dial(ctx, network, addr)
		}
		if o.rootCAs != nil {
			tr.TLSClientConfig = &tls.Config{RootCAs: o.rootCAs, MinVersion: tls.VersionTLS12}
			tr.ForceAttemptHTTP2 = true
		}
	})
}

// plainHTTP is a bare net/http client with the same name mapping, for fetching presigned URLs.
func (e *environment) plainHTTP(pool *x509.CertPool) *http.Client {
	domain := e.Domain
	tr := &http.Transport{
		Proxy: nil,
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			if host, port, err := net.SplitHostPort(addr); err == nil && domain != "" && (host == domain || strings.HasSuffix(host, "."+domain)) {
				addr = net.JoinHostPort("127.0.0.1", port)
			}
			return (&net.Dialer{Timeout: 30 * time.Second}).DialContext(ctx, network, addr)
		},
		DisableKeepAlives: true,
	}
	if pool != nil {
		tr.TLSClientConfig = &tls.Config{RootCAs: pool, MinVersion: tls.VersionTLS12}
	}
	return &http.Client{Transport: tr, Timeout: 120 * time.Second}
}

// newClient builds an S3 client for one bucket token. By default: path-style, SDK retries off (a
// retried 5xx would hide what the server said), the SDK's default checksum behaviour.
func (e *environment) newClient(t testing.TB, b bucketInfo, opts ...copt) *s3.Client {
	t.Helper()
	o := &clientOpts{region: e.Region, endpoint: e.Endpoint}
	for _, f := range opts {
		f(o)
	}
	if o.virtual && o.rootCAs == nil {
		o.endpoint = e.vhEndpoint()
	}
	var hc aws.HTTPClient = e.httpClient(o)
	if o.rec != nil {
		o.rec.next = hc
		hc = o.rec
	}
	retryer := o.retryer
	if retryer == nil {
		retryer = func() aws.Retryer { return aws.NopRetryer{} }
	}
	var creds aws.CredentialsProvider = credentials.NewStaticCredentialsProvider(b.AccessKey, b.SecretKey, "")
	if o.anonymous {
		creds = aws.AnonymousCredentials{}
	}
	lo := []func(*config.LoadOptions) error{
		config.WithRegion(o.region),
		config.WithHTTPClient(hc),
		config.WithRetryer(retryer),
		config.WithLogger(logging.Nop{}),
		config.WithCredentialsProvider(creds),
		config.WithSharedConfigFiles([]string{}),
		config.WithSharedCredentialsFiles([]string{}),
	}
	if o.reqCS != aws.RequestChecksumCalculationUnset {
		lo = append(lo, config.WithRequestChecksumCalculation(o.reqCS))
	}
	if o.respCS != aws.ResponseChecksumValidationUnset {
		lo = append(lo, config.WithResponseChecksumValidation(o.respCS))
	}
	cfg, err := config.LoadDefaultConfig(context.Background(), lo...)
	if err != nil {
		t.Fatalf("load SDK config: %v", err)
	}
	mods := append([]func(*s3.Options){func(so *s3.Options) {
		so.BaseEndpoint = aws.String(o.endpoint)
		so.UsePathStyle = !o.virtual
	}}, o.s3mods...)
	return s3.NewFromConfig(cfg, mods...)
}

// ---- errors ---------------------------------------------------------------------------------------

// apiError returns the S3 error code and HTTP status carried by an SDK error ("" / 0 when absent).
func apiError(err error) (code string, status int) {
	var ae smithy.APIError
	if errors.As(err, &ae) {
		code = ae.ErrorCode()
	}
	var re *awshttp.ResponseError
	if errors.As(err, &re) {
		status = re.HTTPStatusCode()
	}
	return code, status
}

// requireAPIError fails unless err is an S3 error with the given code (when non-empty) and HTTP
// status (when non-zero).
func requireAPIError(t testing.TB, err error, code string, status int) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected S3 error %q (HTTP %d), but the call succeeded", code, status)
	}
	gc, gs := apiError(err)
	if code != "" && gc != code {
		t.Fatalf("expected S3 error code %q, got %q (HTTP %d): %v", code, gc, gs, err)
	}
	if status != 0 && gs != status {
		t.Fatalf("expected HTTP %d, got %d (code %q): %v", status, gs, gc, err)
	}
}

func must(t testing.TB, err error, what string) {
	t.Helper()
	if err != nil {
		t.Fatalf("%s: %v", what, err)
	}
}
