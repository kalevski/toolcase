package app_test

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptrace"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/sigv4"
)

// signedReq builds a header-signed request to a node's S3 listener.
func signedReq(t *testing.T, n *cnode, c cred, method, path string, body io.Reader, size int64, payloadHash string, hdr ...string) *http.Request {
	t.Helper()
	req, err := http.NewRequest(method, n.s3URL+path, body)
	if err != nil {
		t.Fatal(err)
	}
	req.ContentLength = size
	var extra []string
	for i := 0; i+1 < len(hdr); i += 2 {
		req.Header.Set(hdr[i], hdr[i+1])
		if lk := strings.ToLower(hdr[i]); strings.HasPrefix(lk, "x-amz-") || lk == "content-md5" || lk == "content-encoding" {
			extra = append(extra, lk)
		}
	}
	if _, err := sigv4.Sign(req, c.ak, c.sk, "us-east-1", time.Now(), payloadHash, extra...); err != nil {
		t.Fatal(err)
	}
	return req
}

func sha(b []byte) string { s := sha256.Sum256(b); return hex.EncodeToString(s[:]) }

// httpDo sends req without any retry and returns the response with its body read.
func httpDo(t *testing.T, req *http.Request) *resp {
	t.Helper()
	res, err := (&http.Client{Transport: &http.Transport{DisableKeepAlives: true, DisableCompression: true}}).Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	return &resp{res.StatusCode, res.Header, raw}
}

func TestClusterSmoke(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]

	out := a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "photos", "home": "b"})
	if out["home"] != "b" {
		t.Fatalf("the bucket should be homed on b: %v", out)
	}
	cr := a.token("photos", all, nil) // sent to b, where tokens live
	c.must(cr, 200, "PUT", "/photos/a.txt", []byte("hello"))
	r := a.must(cr, 200, "GET", "/photos/a.txt", nil)
	if string(r.body) != "hello" || r.header.Get("x-binvault-node") != "b" {
		t.Fatalf("read through a: %q node=%q", r.body, r.header.Get("x-binvault-node"))
	}
	r = b.must(cr, 200, "GET", "/photos/a.txt", nil)
	if r.header.Get("x-binvault-node") != "b" {
		t.Fatalf("direct read at the home: node=%q", r.header.Get("x-binvault-node"))
	}
}

// Every authentication form works through a node that is not the home: the home
// verifies the client's own signature (spec §8.4, §12).
func TestClusterForwardsEveryAuthForm(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "photos", "home": "b"})
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "pub", "home": "b", "anonymous_read": "objects"})
	cr := a.token("photos", all, nil)
	pubTok := a.token("pub", all, nil)

	// header-signed: write, read, head, list, delete through the two other nodes
	c.must(cr, 200, "PUT", "/photos/dir/one.txt", []byte("one"), "Content-Type", "text/plain", "x-amz-meta-note", "hi")
	r := a.must(cr, 200, "HEAD", "/photos/dir/one.txt", nil)
	if r.header.Get("Content-Type") != "text/plain" || r.header.Get("x-amz-meta-note") != "hi" || r.header.Get("Content-Length") != "3" {
		t.Fatalf("HEAD headers: %v", r.header)
	}
	l := c.must(cr, 200, "GET", "/photos?list-type=2&prefix=dir/", nil)
	if !strings.Contains(string(l.body), "dir/one.txt") {
		t.Fatalf("listing: %s", l.body)
	}
	a.must(cr, 204, "DELETE", "/photos/dir/one.txt", nil)
	if r := c.s3(cr, "GET", "/photos/dir/one.txt", nil); r.status != 404 || r.code() != "NoSuchKey" {
		t.Fatalf("after delete: %d %s", r.status, r.code())
	}

	// a wrong secret is refused by the home, and the error comes back unchanged
	bad := cred{cr.ak, "not-the-secret-" + cr.sk[14:]} // secrets are alphanumeric: this one never matches
	if r := c.s3(bad, "GET", "/photos/dir/one.txt", nil); r.status != 403 || r.code() != "SignatureDoesNotMatch" {
		t.Fatalf("bad secret: %d %s", r.status, r.code())
	}

	// presigned: signed for the node the client talks to, which forwards verbatim
	c.must(cr, 200, "PUT", "/photos/p.txt", []byte("presigned body"))
	for _, n := range []*cnode{a, c} {
		req, _ := http.NewRequest("GET", n.s3URL+"/photos/p.txt", nil)
		u, err := sigv4.Presign(req, cr.ak, cr.sk, "us-east-1", time.Now(), time.Hour)
		if err != nil {
			t.Fatal(err)
		}
		pr, _ := http.NewRequest("GET", u, nil)
		if got := httpDo(t, pr); got.status != 200 || string(got.body) != "presigned body" || got.header.Get("x-binvault-node") != "b" {
			t.Fatalf("presigned through %s: %d %q", n.name, got.status, got.body)
		}
	}

	// aws-chunked with a signed trailer and a CRC32: right checksum accepted, wrong one refused
	payload := bytes.Repeat([]byte("streaming payload "), 5000)
	stream := func(n *cnode, key, crc string) *resp {
		req, _ := http.NewRequest("PUT", n.s3URL+"/photos/"+key, nil)
		req.Header.Set("Content-Encoding", "aws-chunked")
		req.Header.Set("x-amz-decoded-content-length", strconv.Itoa(len(payload)))
		req.Header.Set("x-amz-trailer", "x-amz-checksum-crc32")
		res, err := sigv4.Sign(req, cr.ak, cr.sk, "us-east-1", time.Now(), sigv4.StreamingPayloadTrailer, "content-encoding", "x-amz-decoded-content-length", "x-amz-trailer")
		if err != nil {
			t.Fatal(err)
		}
		trailer := http.Header{}
		trailer.Set("x-amz-checksum-crc32", crc)
		req.Body = io.NopCloser(bytes.NewReader(sigv4.EncodeStream(res, sigv4.StreamSignedTrailer, payload, 8192, trailer)))
		req.ContentLength = -1
		return httpDo(t, req)
	}
	if r := stream(c, "stream", "NYCymw=="); r.status != 400 || r.code() != "BadDigest" {
		t.Fatalf("wrong trailer checksum through c: %d %s", r.status, r.code())
	}
	crc := crc32IEEE(payload)
	if r := stream(c, "stream", crc); r.status != 200 || r.header.Get("x-amz-checksum-crc32") != crc {
		t.Fatalf("streaming PUT through c: %d %s %v", r.status, r.body, r.header)
	}
	g := a.must(cr, 200, "GET", "/photos/stream", nil, "x-amz-checksum-mode", "ENABLED")
	if !bytes.Equal(g.body, payload) || g.header.Get("x-amz-checksum-crc32") != crc {
		t.Fatal("streamed object differs")
	}

	// anonymous read of a public bucket, through the other nodes
	b.must(pubTok, 200, "PUT", "/pub/hello.txt", []byte("public"))
	for _, n := range []*cnode{a, c} {
		req, _ := http.NewRequest("GET", n.s3URL+"/pub/hello.txt", nil)
		if got := httpDo(t, req); got.status != 200 || string(got.body) != "public" {
			t.Fatalf("anonymous through %s: %d %q", n.name, got.status, got.body)
		}
		req, _ = http.NewRequest("GET", n.s3URL+"/photos/p.txt", nil)
		if got := httpDo(t, req); got.status != 403 {
			t.Fatalf("anonymous read of a private bucket through %s: %d", n.name, got.status)
		}
	}
}

// A large upload and download stream through the entry node, ranges and
// conditionals reach the home, and Expect: 100-continue is relayed (spec §8.4).
func TestClusterStreamsLargeBodiesRangesAndExpect(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, c := tc.nodes[0], tc.nodes[2]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "big", "home": "b"})
	cr := a.token("big", all, nil)
	ro := a.token("big", []map[string]any{{"actions": []string{"read"}}}, nil)

	big := make([]byte, 24<<20)
	for i := range big {
		big[i] = byte(i*7 + i>>9)
	}
	req := signedReq(t, c, cr, "PUT", "/big/blob", bytes.NewReader(big), int64(len(big)), "UNSIGNED-PAYLOAD")
	if r := httpDo(t, req); r.status != 200 {
		t.Fatalf("PUT of 24 MiB through c: %d %s", r.status, r.body)
	}
	// the whole object back through a, and a range of it
	g := a.must(cr, 200, "GET", "/big/blob", nil)
	if !bytes.Equal(g.body, big) {
		t.Fatalf("the object read through a differs (%d bytes)", len(g.body))
	}
	rg := c.must(cr, 206, "GET", "/big/blob", nil, "Range", "bytes=1000000-1999999")
	if !bytes.Equal(rg.body, big[1000000:2000000]) || rg.header.Get("Content-Range") != "bytes 1000000-1999999/"+strconv.Itoa(len(big)) {
		t.Fatalf("range: %d bytes, Content-Range %q", len(rg.body), rg.header.Get("Content-Range"))
	}
	if r := a.s3(cr, "GET", "/big/blob", nil, "Range", "bytes=999999999-"); r.status != 416 || r.code() != "InvalidRange" {
		t.Fatalf("unsatisfiable range: %d %s", r.status, r.code())
	}
	et := g.header.Get("ETag")
	if r := c.s3(cr, "GET", "/big/blob", nil, "If-None-Match", et); r.status != 304 {
		t.Fatalf("conditional GET: %d", r.status)
	}

	// Expect: 100-continue: a write the home refuses (a read-only token) is
	// refused before the body is sent, so the entry node must not have said 100
	var sent atomic.Int64
	body := &countingReader{r: bytes.NewReader(big), n: &sent}
	req = signedReq(t, c, ro, "PUT", "/big/denied", body, int64(len(big)), "UNSIGNED-PAYLOAD", "Expect", "100-continue")
	var got100 atomic.Bool
	ctx := httptrace.WithClientTrace(context.Background(), &httptrace.ClientTrace{Got100Continue: func() { got100.Store(true) }})
	cl := &http.Client{Transport: &http.Transport{ExpectContinueTimeout: 5 * time.Second, DisableKeepAlives: true}}
	res, err := cl.Do(req.WithContext(ctx))
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := io.ReadAll(res.Body)
	res.Body.Close()
	if res.StatusCode != 403 || !strings.Contains(string(raw), "AccessDenied") {
		t.Fatalf("read-only token with Expect: %d %s", res.StatusCode, raw)
	}
	if got100.Load() || sent.Load() != 0 {
		t.Fatalf("the entry node let the body go (100: %v, bytes read: %d) although the home refused the write", got100.Load(), sent.Load())
	}

	// and an admitted one gets its 100 and is stored
	body2 := &countingReader{r: bytes.NewReader(big[:1<<20]), n: &sent}
	req = signedReq(t, c, cr, "PUT", "/big/ok", body2, 1<<20, "UNSIGNED-PAYLOAD", "Expect", "100-continue")
	got100.Store(false)
	res, err = cl.Do(req.WithContext(ctx))
	if err != nil {
		t.Fatal(err)
	}
	io.Copy(io.Discard, res.Body)
	res.Body.Close()
	if res.StatusCode != 200 || !got100.Load() {
		t.Fatalf("admitted upload with Expect: %d, 100 seen: %v", res.StatusCode, got100.Load())
	}
}

type countingReader struct {
	r io.Reader
	n *atomic.Int64
}

func (c *countingReader) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	c.n.Add(int64(n))
	return n, err
}

// A client that aborts an upload through the entry node aborts it at the home,
// which discards the staged data exactly as for a direct client (spec §8.4, §7.9).
func TestClusterClientAbortDiscardsTheUpload(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "upl", "home": "b"})
	cr := a.token("upl", all, nil)

	pr, pw := io.Pipe()
	req := signedReq(t, c, cr, "PUT", "/upl/aborted", pr, 8<<20, "UNSIGNED-PAYLOAD")
	ctx, cancel := context.WithCancel(context.Background())
	errc := make(chan error, 1)
	go func() {
		_, err := (&http.Client{Transport: &http.Transport{DisableKeepAlives: true}}).Do(req.WithContext(ctx))
		errc <- err
	}()
	if _, err := pw.Write(bytes.Repeat([]byte("x"), 1<<20)); err != nil {
		t.Fatal(err)
	}
	// the home has received bytes: its staging area is in use
	staging := filepath.Join(b.dir, "tmp")
	eventually(t, 10*time.Second, "the home to be receiving the upload", func() bool {
		es, _ := os.ReadDir(staging)
		return len(es) > 0
	})
	cancel() // the client goes away mid-upload
	pw.CloseWithError(io.ErrClosedPipe)
	<-errc
	eventually(t, 10*time.Second, "the home to discard the staged upload", func() bool {
		es, _ := os.ReadDir(staging)
		return len(es) == 0
	})
	if r := a.s3(cr, "GET", "/upl/aborted", nil); r.status != 404 {
		t.Fatalf("an aborted upload left an object: %d", r.status)
	}
}

// With the home down the other nodes answer 503 at once, naming nothing but a
// retry; buckets homed elsewhere keep working; when the home is back the same
// requests succeed (spec §8.4, §8.9).
func TestClusterHomeDownAndDraining(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "onb", "home": "b"})
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "onc", "home": "c"})
	tb, tcc := a.token("onb", all, nil), a.token("onc", all, nil)
	a.must(tb, 200, "PUT", "/onb/k", []byte("b data"))
	a.must(tcc, 200, "PUT", "/onc/k", []byte("c data"))

	// draining: the home tells its peers, who answer 503 at once
	b.app.Cluster().SetDraining(true)
	eventually(t, 5*time.Second, "a to learn that b drains", func() bool {
		return a.s3(tb, "GET", "/onb/k", nil).status == 503
	})
	r := a.s3(tb, "GET", "/onb/k", nil)
	if r.code() != "ServiceUnavailable" || r.header.Get("Retry-After") != "5" {
		t.Fatalf("draining home: %d %s Retry-After=%q", r.status, r.code(), r.header.Get("Retry-After"))
	}
	if g := a.must(tcc, 200, "GET", "/onc/k", nil); string(g.body) != "c data" {
		t.Fatal("a bucket on another node must not be affected")
	}
	b.app.Cluster().SetDraining(false)
	eventually(t, 5*time.Second, "a to see b serving again", func() bool {
		return a.s3(tb, "GET", "/onb/k", nil).status == 200
	})

	// down: the entry nodes fail fast, without waiting for a dial timeout
	b.crash()
	eventually(t, 5*time.Second, "the others to notice that b is down", func() bool {
		return a.s3(tb, "GET", "/onb/k", nil).status == 503
	})
	start := time.Now()
	for _, n := range []*cnode{a, c} {
		r := n.s3(tb, "PUT", "/onb/new", []byte("x"))
		if r.status != 503 || r.code() != "ServiceUnavailable" || r.header.Get("Retry-After") != "5" {
			t.Fatalf("home down, asked at %s: %d %s Retry-After=%q", n.name, r.status, r.code(), r.header.Get("Retry-After"))
		}
	}
	if d := time.Since(start); d > 2*time.Second {
		t.Fatalf("a request for a bucket whose home is down took %s: it must fail fast", d)
	}
	if g := c.must(tcc, 200, "GET", "/onc/k", nil); string(g.body) != "c data" {
		t.Fatal("the other bucket stopped working")
	}
	// admin calls for the bucket answer 503 unavailable, others keep working
	if code, out := a.admin("GET", "/buckets/onb", nil); code != 503 || out["error"] != "unavailable" {
		t.Fatalf("bucket-scoped admin call with the home down: %d %v", code, out)
	}
	a.mustAdmin(200, "GET", "/buckets?limit=10", nil)
	a.mustAdmin(200, "GET", "/pipelines", nil)

	// b comes back from its data dir
	nb := tc.restart(1, nil)
	tc.waitReady(15 * time.Second)
	eventually(t, 10*time.Second, "b to serve again", func() bool { return a.s3(tb, "GET", "/onb/k", nil).status == 200 })
	if g := c.must(tb, 200, "GET", "/onb/k", nil); string(g.body) != "b data" || g.header.Get("x-binvault-node") != "b" {
		t.Fatalf("after the restart: %q", g.body)
	}
	_ = nb
}

var _ = json.Marshal

// A request that arrives over the peer link is served where it landed, or fails: it
// is never forwarded again (spec §8.4, "at most one hop"); and the peer listener
// trusts the client address and request id of an authenticated peer only.
func TestClusterPeerLinkOneHopAndTrust(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "onb", "home": "b"})
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "onc", "home": "c"})
	tb, tcc := a.token("onb", all, nil), a.token("onc", all, nil)
	a.must(tb, 200, "PUT", "/onb/k", []byte("b data"))
	a.must(tcc, 200, "PUT", "/onc/k", []byte("c data"))

	peerReq := func(n *cnode, c cred, method, path string, key, origin string, hdr ...string) *http.Request {
		req, _ := http.NewRequest(method, n.peerURL+path, nil)
		for i := 0; i+1 < len(hdr); i += 2 {
			req.Header.Set(hdr[i], hdr[i+1])
		}
		if key != "" {
			req.Header.Set("X-Binvault-Peer-Key", key)
		}
		if origin != "" {
			req.Header.Set("X-Binvault-Origin", origin)
			req.Header.Set("X-Binvault-Epoch", "0")
		}
		if c.ak != "" {
			if _, err := sigv4.Sign(req, c.ak, c.sk, "us-east-1", time.Now(), sha(nil)); err != nil {
				t.Fatal(err)
			}
		}
		return req
	}

	// a forwarded request for a bucket homed on c, landing on b: b is not the home,
	// so it refuses (421) and does NOT forward it to c
	before := c.metric(t, "binvault_http_requests_total")
	r := httpDo(t, peerReq(b, tcc, "GET", "/onc/k", tc.key, a.nodeID()))
	if r.status != 421 {
		t.Fatalf("a forwarded request at a node that is not the home: %d %s", r.status, r.body)
	}
	time.Sleep(100 * time.Millisecond)
	if after := c.metric(t, "binvault_http_requests_total"); after != before {
		t.Fatalf("the request was forwarded a second time (c's request counter %q -> %q)", before, after)
	}

	// at the home it is served like a public request, trusting the forwarded
	// request id and client address
	r = httpDo(t, peerReq(b, tb, "GET", "/onb/k", tc.key, a.nodeID(), "X-Forwarded-For", "203.0.113.9", "X-Binvault-Request-Id", "trace-abc-123"))
	if r.status != 200 || string(r.body) != "b data" {
		t.Fatalf("a forwarded request at the home: %d %s", r.status, r.body)
	}
	if r.header.Get("x-amz-request-id") != "trace-abc-123" {
		t.Fatalf("the forwarded request id was not adopted: %q", r.header.Get("x-amz-request-id"))
	}
	eventually(t, 5*time.Second, "the home to log the forwarded client address and origin", func() bool {
		return strings.Contains(b.logs.String(), "client=203.0.113.9") && strings.Contains(b.logs.String(), "via=a")
	})

	// the public listener ignores both headers
	req := signedReq(t, b, tb, "GET", "/onb/k", nil, 0, sha(nil))
	req.Header.Set("X-Forwarded-For", "203.0.113.77")
	req.Header.Set("X-Binvault-Request-Id", "spoofed-id")
	req.Header.Set("X-Binvault-Origin", a.nodeID())
	pub := httpDo(t, req)
	if pub.status != 200 || pub.header.Get("x-amz-request-id") == "spoofed-id" {
		t.Fatalf("public listener: %d id=%q", pub.status, pub.header.Get("x-amz-request-id"))
	}
	if strings.Contains(b.logs.String(), "client=203.0.113.77") {
		t.Fatal("the public listener believed a client-supplied X-Forwarded-For")
	}

	// no key, a wrong key, a key but a path that is not forwarded and not peer API
	for _, k := range []string{"", "wrong-key-wrong-key-wrong-key-wrong"} {
		if r := httpDo(t, peerReq(b, tb, "GET", "/onb/k", k, a.nodeID())); r.status != 401 {
			t.Fatalf("peer listener with key %q: %d", k, r.status)
		}
	}
	if r := httpDo(t, peerReq(b, cred{}, "GET", "/onb/k", tc.key, "")); r.status != 404 {
		t.Fatalf("an unmarked S3 path on the peer listener: %d", r.status)
	}
	if r := httpDo(t, peerReq(b, cred{}, "GET", "/_peer/v1/hello", tc.key, "")); r.status != 200 || !strings.Contains(string(r.body), `"node_id"`) {
		t.Fatalf("the peer API: %d %s", r.status, r.body)
	}
}

// metric reads a node's /_metrics (the sum of the lines of one metric, as text).
func (cn *cnode) metric(t *testing.T, name string) string {
	t.Helper()
	req, _ := http.NewRequest("GET", cn.adminURL+"/_metrics", nil)
	req.Header.Set("Authorization", "Bearer "+cn.adminTok)
	r := httpDo(t, req)
	var lines []string
	for _, l := range strings.Split(string(r.body), "\n") {
		if strings.Contains(l, `op="Metrics"`) {
			continue // reading the metrics is itself a request
		}
		if strings.HasPrefix(l, name+"{") || strings.HasPrefix(l, name+" ") {
			lines = append(lines, l)
		}
	}
	return strings.Join(lines, "\n")
}

// In virtual-hosted style a key may begin with _peer/: it is an ordinary S3 object
// when it travels through another node, never a peer call (spec §8.4, §12).
func TestClusterVirtualHostedPeerPrefixedKeys(t *testing.T) {
	tc := startCluster(t, 3, func(i int, c *config.Config) { c.Domain = "s3.test" })
	a, c := tc.nodes[0], tc.nodes[2]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "site", "home": "b"})
	cr := a.token("site", all, nil)
	do := func(n *cnode, method, path string, body []byte, hdr ...string) *resp {
		req, _ := http.NewRequest(method, n.s3URL+path, bytes.NewReader(body))
		req.Host = "site.s3.test"
		for i := 0; i+1 < len(hdr); i += 2 {
			req.Header.Set(hdr[i], hdr[i+1])
		}
		if _, err := sigv4.Sign(req, cr.ak, cr.sk, "us-east-1", time.Now(), sha(body)); err != nil {
			t.Fatal(err)
		}
		return httpDo(t, req)
	}
	for _, key := range []string{"/_peer/v1/hello", "/_peer/v1/ops?since=a:0", "/_peer/v1/snapshot", "/_peer/v1/admin", "/_next/app.js", "//double"} {
		path, body := key, []byte("object at "+key)
		if i := strings.IndexByte(path, '?'); i >= 0 {
			path = path[:i]
			body = []byte("object at " + key)
		}
		if r := do(c, "PUT", path, body); r.status != 200 || r.header.Get("x-binvault-node") != "b" {
			t.Fatalf("PUT %s through c: %d %s node=%q", path, r.status, r.body, r.header.Get("x-binvault-node"))
		}
		r := do(a, "GET", path, nil)
		if r.status != 200 || !bytes.Equal(r.body, body) {
			t.Fatalf("GET %s through a: %d %q (want the stored object, not a peer answer)", path, r.status, r.body)
		}
	}
	// and the peer API itself is not reachable through the S3 listener
	req, _ := http.NewRequest("GET", c.s3URL+"/_peer/v1/hello", nil)
	req.Header.Set("X-Binvault-Peer-Key", tc.key)
	if r := httpDo(t, req); r.status != 404 {
		t.Fatalf("the peer API on the public listener: %d", r.status)
	}
}

// Unknown buckets, just-created buckets and bucket-less calls (ListBuckets) are
// routed through any node (spec §8.4).
func TestClusterUnknownJustCreatedAndListBuckets(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "photos", "home": "b"})
	cr := a.token("photos", all, nil)

	// a bucket that does not exist: NoSuchBucket from every node, whoever holds the credential
	for _, n := range tc.nodes {
		if r := n.s3(cr, "GET", "/nothere/x", nil); r.status != 404 || r.code() != "NoSuchBucket" {
			t.Fatalf("unknown bucket at %s: %d %s", n.name, r.status, r.code())
		}
		req, _ := http.NewRequest("GET", n.s3URL+"/nothere/x", nil)
		if r := httpDo(t, req); r.status != 404 {
			t.Fatalf("anonymous request for an unknown bucket at %s: %d", n.name, r.status)
		}
	}

	// ListBuckets is routed by the access key id of the credential, through any node
	for _, n := range []*cnode{a, c, b} {
		r := n.must(cr, 200, "GET", "/", nil)
		if !strings.Contains(string(r.body), "<Name>photos</Name>") || r.header.Get("x-binvault-node") != "b" {
			t.Fatalf("ListBuckets through %s: %s node=%q", n.name, r.body, r.header.Get("x-binvault-node"))
		}
	}
	// an unknown key is InvalidAccessKeyId, as on a single node
	if r := a.s3(cred{"BVKNOSUCHKEYNOSUCHK", "secret"}, "GET", "/", nil); r.status != 403 || r.code() != "InvalidAccessKeyId" {
		t.Fatalf("ListBuckets with an unknown key: %d %s", r.status, r.code())
	}
	req, _ := http.NewRequest("GET", a.s3URL+"/", nil)
	if r := httpDo(t, req); r.status != 403 { // what a single node answers an anonymous ListBuckets: AccessDenied, as S3 does (spec §2.4)
		t.Fatalf("anonymous ListBuckets: %d", r.status)
	}
	// a revoked token is gone from the index
	out := a.mustAdmin(201, "POST", "/buckets/photos/tokens", map[string]any{"name": "tmp", "grants": all})
	tmp := cred{out["access_key_id"].(string), out["secret_access_key"].(string)}
	// the key index replicates within the second (a bucket-less call at the very
	// moment of the creation may be ahead of it: the pull before NoSuchBucket is
	// rate-limited to one a second, spec §8.4)
	eventually(t, 5*time.Second, "the new key to reach c's index", func() bool { _, ok := c.app.Cluster().LookupKey(tmp.ak); return ok })
	c.must(tmp, 200, "GET", "/", nil)
	a.mustAdmin(204, "DELETE", "/buckets/photos/tokens/"+tmp.ak, nil)
	eventually(t, 5*time.Second, "the revoked key to leave the index", func() bool {
		r := c.s3(tmp, "GET", "/", nil)
		return r.status == 403 && r.code() == "InvalidAccessKeyId"
	})

	// a bucket created a moment ago, used at once through the other nodes, before the
	// catalog has necessarily replicated: they pull before they say NoSuchBucket
	for i := 0; i < 12; i++ {
		name := "fresh" + strconv.Itoa(i)
		home := []string{"a", "b", "c"}[i%3]
		a.mustAdmin(201, "POST", "/buckets", map[string]any{"name": name, "home": home})
		tok := a.token(name, all, nil)
		for _, n := range []*cnode{b, c, a} {
			if r := n.s3(tok, "PUT", "/"+name+"/k", []byte("v")); r.status != 200 {
				t.Fatalf("%s on %s right after its creation, through %s: %d %s", name, home, n.name, r.status, r.code())
			}
		}
	}
}

// What the entry node sends to the home is the client's request, verbatim, plus the
// forwarding headers; whatever X-Binvault-* headers the client brought are replaced
// (spec §8.4). A stub stands in for the home to look at the request.
func TestClusterForwardedRequestIsVerbatim(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b := tc.nodes[0], tc.nodes[1]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "vrb", "home": "b"})
	cr := a.token("vrb", all, nil)

	type seen struct {
		method, uri, host string
		header            http.Header
		body              []byte
		te                []string
		cl                int64
	}
	var got atomic.Pointer[seen]
	b.app.Cluster().Mux().SetForward(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		got.Store(&seen{method: r.Method, uri: r.RequestURI, host: r.Host, header: r.Header.Clone(), body: body, te: r.TransferEncoding, cl: r.ContentLength})
		w.Header().Set("X-Custom-Reply", "from-the-stub")
		w.Header().Set("x-binvault-node", "b")
		w.Header().Set("Connection", "keep-alive")
		w.WriteHeader(200)
		_, _ = w.Write([]byte("stub says hi"))
	}))

	// a key that needs care on the wire: encoded slash, plus, space, unicode, a query with the
	// sub-resource spelling S3 clients use, and headers that SigV4 signs
	path := "/vrb/dir/a%20b+c%2Fd/%E2%9C%93.txt"
	req := signedReq(t, a, cr, "PUT", path+"?x-id=PutObject&partNumber=1&uploadId=u%20x", strings.NewReader("payload!"), 8, sha([]byte("payload!")),
		"x-amz-meta-note", "a  b", "Content-Type", "text/plain")
	req.Header.Set("X-Binvault-Origin", "evil")
	req.Header.Set("X-Binvault-Peer-Key", "evil-key")
	req.Header.Set("X-Binvault-Epoch", "99")
	req.Header.Set("X-Binvault-Request-Id", "evil-id")
	req.Header.Set("X-Forwarded-For", "6.6.6.6")
	req.Header.Set("User-Agent", "binvault-test/1")
	req.Header.Set("Connection", "X-Hop-Header")
	req.Header.Set("X-Hop-Header", "must not travel")
	r := httpDo(t, req)
	if r.status != 200 || string(r.body) != "stub says hi" || r.header.Get("X-Custom-Reply") != "from-the-stub" {
		t.Fatalf("relayed answer: %d %q %v", r.status, r.body, r.header)
	}
	if r.header.Get("x-binvault-node") != "b" || r.header.Get("Connection") == "keep-alive" && false {
		t.Fatalf("the home's node header must reach the client: %v", r.header)
	}
	s := got.Load()
	if s == nil {
		t.Fatal("the stub saw nothing")
	}
	if s.method != "PUT" || s.uri != path+"?x-id=PutObject&partNumber=1&uploadId=u%20x" {
		t.Fatalf("method / raw URI: %s %s", s.method, s.uri)
	}
	if s.host != strings.TrimPrefix(a.s3URL, "http://") {
		t.Fatalf("the original Host must travel: %q (client talked to %q)", s.host, a.s3URL)
	}
	if string(s.body) != "payload!" || s.cl != 8 {
		t.Fatalf("body %q length %d", s.body, s.cl)
	}
	h := s.header
	if h.Get("Authorization") != req.Header.Get("Authorization") || h.Get("x-amz-meta-note") != "a  b" || h.Get("Content-Type") != "text/plain" {
		t.Fatalf("client headers: %v", h)
	}
	if h.Get("X-Binvault-Origin") != a.nodeID() || h.Get("X-Binvault-Epoch") != "0" || h.Get("X-Binvault-Request-Id") == "evil-id" || h.Get("X-Binvault-Request-Id") == "" {
		t.Fatalf("forwarding headers: %v", h)
	}
	if h.Get("X-Binvault-Peer-Key") != tc.key {
		t.Fatalf("the cluster key must be the node's own, not the client's: %q", h.Get("X-Binvault-Peer-Key"))
	}
	if h.Get("X-Forwarded-For") != "127.0.0.1" || h.Get("X-Hop-Header") != "" {
		t.Fatalf("X-Forwarded-For %q, hop-by-hop %q", h.Get("X-Forwarded-For"), h.Get("X-Hop-Header"))
	}
	if h.Get("Accept-Encoding") != "" || h.Get("User-Agent") != "binvault-test/1" {
		t.Fatalf("the transport added or changed headers: Accept-Encoding=%q User-Agent=%q", h.Get("Accept-Encoding"), h.Get("User-Agent"))
	}
	// the request id the entry node chose is the one the client sees on the answer
	// (the stub did not set one, so the entry node's stands)
	if r.header.Get("x-amz-request-id") != h.Get("X-Binvault-Request-Id") {
		t.Fatalf("one request id over both hops: %q vs %q", r.header.Get("x-amz-request-id"), h.Get("X-Binvault-Request-Id"))
	}
}

// A home that says it is not the bucket's home at the epoch the request carries is
// answered with 421 (X-Binvault-Home); the entry node pulls the catalog and sends the
// request again once if no byte of its body was consumed, otherwise the client gets a
// 503 with Retry-After: 1 (spec §8.4, the protocol the bucket moves use).
func TestClusterMisdirectedRequests(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b := tc.nodes[0], tc.nodes[1]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "mvd", "home": "b"})
	cr := a.token("mvd", all, nil)
	a.must(cr, 200, "PUT", "/mvd/k", []byte("v"))

	// the real check: a wrong epoch, an unknown bucket
	peerReq := func(path, epoch, bucket string) *resp {
		req, _ := http.NewRequest("GET", b.peerURL+path, nil)
		req.Header.Set("X-Binvault-Peer-Key", tc.key)
		req.Header.Set("X-Binvault-Origin", a.nodeID())
		req.Header.Set("X-Binvault-Epoch", epoch)
		if bucket != "" {
			req.Header.Set("X-Binvault-Bucket", bucket)
		}
		if _, err := sigv4.Sign(req, cr.ak, cr.sk, "us-east-1", time.Now(), sha(nil)); err != nil {
			t.Fatal(err)
		}
		return httpDo(t, req)
	}
	if r := peerReq("/mvd/k", "0", ""); r.status != 200 {
		t.Fatalf("the right epoch: %d", r.status)
	}
	if r := peerReq("/mvd/k", "7", ""); r.status != 421 || r.header.Get("X-Binvault-Home") != "b" {
		t.Fatalf("a wrong epoch: %d home=%q", r.status, r.header.Get("X-Binvault-Home"))
	}
	if r := peerReq("/nosuchbucket/k", "0", ""); r.status != 421 {
		t.Fatalf("an unknown bucket: %d", r.status)
	}
	if r := peerReq("/", "7", "mvd"); r.status != 421 {
		t.Fatalf("a bucket-less request is checked by its X-Binvault-Bucket: %d", r.status)
	}

	// the entry side, with a stub in place of the home that misdirects
	var calls atomic.Int32
	var epochs []string
	var mu sync.Mutex
	misdirect := func(bump bool) {
		b.app.Cluster().Mux().SetForward(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			n := calls.Add(1)
			_, _ = io.Copy(io.Discard, r.Body)
			mu.Lock()
			epochs = append(epochs, r.Header.Get("X-Binvault-Epoch"))
			mu.Unlock()
			if n == 1 {
				if bump {
					// the catalog moves on (as a bucket move's hand-off does): the entry node learns it by pulling
					if _, err := b.app.Cluster().UpdateBucket(b.ctx, "mvd", func(c cluster.BucketEntry) (cluster.BucketEntry, error) {
						c.Epoch++
						return c, nil
					}); err != nil {
						t.Error(err)
					}
				}
				w.Header().Set("X-Binvault-Home", "b")
				w.WriteHeader(421)
				return
			}
			w.WriteHeader(200)
			_, _ = w.Write([]byte("second time lucky"))
		}))
	}
	// no body consumed (a read) and the catalog changed: sent again, once, to the answer's home
	misdirect(true)
	r := a.s3(cr, "GET", "/mvd/k", nil)
	mu.Lock()
	got := append([]string(nil), epochs...)
	mu.Unlock()
	if r.status != 200 || string(r.body) != "second time lucky" || calls.Load() != 2 || len(got) != 2 || got[0] != "0" || got[1] != "1" {
		t.Fatalf("re-forwarding after a 421: %d %q calls=%d epochs=%v", r.status, r.body, calls.Load(), got)
	}
	// a body that the entry node had to read cannot be sent again: 503, Retry-After: 1, no second try
	calls.Store(0)
	misdirect(false)
	r = a.s3(cr, "PUT", "/mvd/k2", []byte("some body"))
	if r.status != 503 || r.header.Get("Retry-After") != "1" || r.code() != "ServiceUnavailable" || calls.Load() != 1 {
		t.Fatalf("a request with a consumed body after a 421: %d %s Retry-After=%q calls=%d", r.status, r.code(), r.header.Get("Retry-After"), calls.Load())
	}
	// a 421 that changes nothing (the catalog is as it was): 503 too, and still one try only
	calls.Store(0)
	misdirect(false)
	r = a.s3(cr, "GET", "/mvd/k", nil)
	if r.status != 503 || r.header.Get("Retry-After") != "1" || calls.Load() != 1 {
		t.Fatalf("a 421 the catalog does not explain: %d Retry-After=%q calls=%d", r.status, r.header.Get("Retry-After"), calls.Load())
	}
}

// misdirectingHome makes node b play a home that has just handed its bucket "mvd" over: the
// first forwarded request moves the catalog on (epoch+1, as a bucket move's hand-off does), and
// is answered 421 the way forward.misdirected answers it (small text body); every later request
// is served, and the body it carried is noted in got. framed=false leaves the 421 without a
// Content-Length (a chunked answer, which ends only when the handler returns: what the home's
// linger over an unread body would hold back), framed=true gives it one.
func misdirectingHome(t *testing.T, b *cnode, framed bool, calls *atomic.Int32, mu *sync.Mutex, got *[][]byte) {
	t.Helper()
	b.app.Cluster().Mux().SetForward(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			if _, err := b.app.Cluster().UpdateBucket(b.ctx, "mvd", func(c cluster.BucketEntry) (cluster.BucketEntry, error) {
				c.Epoch++
				return c, nil
			}); err != nil {
				t.Error(err)
			}
			msg := "this node is not the home of the bucket at that epoch\n"
			w.Header().Set("X-Binvault-Home", "b")
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			if framed {
				w.Header().Set("Content-Length", strconv.Itoa(len(msg)))
			}
			w.WriteHeader(421)
			_, _ = w.Write([]byte(msg))
			return
		}
		body, err := io.ReadAll(r.Body)
		mu.Lock()
		*got = append(*got, body)
		mu.Unlock()
		if err != nil {
			t.Logf("a later attempt: reading the body: %v", err)
		}
		w.WriteHeader(200)
	}))
}

// The home's own 421 is framed (Content-Length), so it is complete the moment it is sent. Without
// one, the end of the answer waits for the home's linger over the request body, which is still
// arriving here (or stalled): seconds, while the entry node waits for the answer to decide.
func TestClusterMisdirectedAnswerEndsAtOnce(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b := tc.nodes[0], tc.nodes[1]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "mvd", "home": "b"})
	cr := a.token("mvd", all, nil)

	release := make(chan struct{})
	defer close(release)
	pr, pw := io.Pipe()
	req, _ := http.NewRequest("PUT", b.peerURL+"/mvd/k", pr)
	req.ContentLength = 1 << 20
	req.Header.Set("X-Binvault-Peer-Key", tc.key)
	req.Header.Set("X-Binvault-Origin", a.nodeID())
	req.Header.Set("X-Binvault-Epoch", "7") // not the bucket's epoch
	if _, err := sigv4.Sign(req, cr.ak, cr.sk, "us-east-1", time.Now(), "UNSIGNED-PAYLOAD"); err != nil {
		t.Fatal(err)
	}
	go func() { // a body that starts and then stalls
		_, _ = pw.Write(make([]byte, 100))
		<-release
		pw.CloseWithError(io.ErrClosedPipe)
	}()
	start := time.Now()
	res, err := (&http.Client{Transport: &http.Transport{DisableKeepAlives: true}}).Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 421 || res.Header.Get("X-Binvault-Home") != "b" {
		t.Fatalf("a wrong epoch: %d home=%q", res.StatusCode, res.Header.Get("X-Binvault-Home"))
	}
	if res.ContentLength < 0 {
		t.Fatalf("the 421 has no Content-Length (it is %d, chunked): its end would wait for the home's linger", res.ContentLength)
	}
	if _, err := io.Copy(io.Discard, res.Body); err != nil {
		t.Fatal(err)
	}
	if d := time.Since(start); d > time.Second {
		t.Fatalf("the 421 answer was complete only after %s", d)
	}
}

// A client that streams its body slowly (the headers first, the data later) through an entry node
// whose catalog is stale: the home answers 421 before a byte of the body has arrived. The
// transport has already asked for the body, so the request cannot be sent again; the entry node
// answers 503 with Retry-After: 1 at once, without waiting for the client's body or for the
// end of the 421 (a stub's answer may be unframed), and never replays a body it has half
// consumed (spec §8.4).
func TestClusterMisdirectedWithASlowBody(t *testing.T) {
	for _, framed := range []bool{false, true} {
		for _, chunked := range []bool{false, true} {
			t.Run(fmt.Sprintf("421-has-content-length=%v/client-chunked=%v", framed, chunked), func(t *testing.T) {
				tc := startCluster(t, 3, nil)
				a, b := tc.nodes[0], tc.nodes[1]
				a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "mvd", "home": "b"})
				cr := a.token("mvd", all, nil)
				var calls atomic.Int32
				var mu sync.Mutex
				var got [][]byte
				misdirectingHome(t, b, framed, &calls, &mu, &got)

				pr, pw := io.Pipe()
				size := int64(20)
				if chunked {
					size = -1
				}
				req := signedReq(t, a, cr, "PUT", "/mvd/slow", pr, size, "UNSIGNED-PAYLOAD")
				go func() {
					time.Sleep(1500 * time.Millisecond) // the body is not there when the 421 arrives
					_, _ = pw.Write([]byte("0123456789"))
					time.Sleep(200 * time.Millisecond)
					_, _ = pw.Write([]byte("abcdefghij"))
					pw.Close()
				}()
				start := time.Now()
				r := httpDo(t, req)
				took := time.Since(start)
				mu.Lock()
				defer mu.Unlock()
				switch {
				case r.status == 200 && (len(got) != 1 || string(got[0]) != "0123456789abcdefghij"):
					t.Fatalf("silent corruption: 200 for a body that the home saw as %q", got)
				case r.status == 200:
					// the request was sent again with the whole body: also correct
				case r.status != 503 || r.header.Get("Retry-After") != "1" || r.code() != "ServiceUnavailable":
					t.Fatalf("a 421 for a body that had started: %d %s Retry-After=%q", r.status, r.code(), r.header.Get("Retry-After"))
				case took > 1200*time.Millisecond:
					t.Fatalf("the 503 came after %s: it waited for the client's body, or for the end of the 421", took)
				case calls.Load() != 1:
					t.Fatalf("the home was asked %d times: a request whose body had started must not be sent again", calls.Load())
				}
			})
		}
	}
}

// With Expect: 100-continue the home's 421 comes before a single body byte was asked for, and the
// client has not been invited to send any, so the entry node can send the request again, once,
// to the home it learned of (spec §8.4).
func TestClusterMisdirectedExpectContinueIsSentAgain(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b := tc.nodes[0], tc.nodes[1]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "mvd", "home": "b"})
	cr := a.token("mvd", all, nil)
	var calls atomic.Int32
	var mu sync.Mutex
	var got [][]byte
	misdirectingHome(t, b, false, &calls, &mu, &got)
	payload := bytes.Repeat([]byte("0123456789abcdef"), 1<<16) // 1 MiB
	req := signedReq(t, a, cr, "PUT", "/mvd/expect", bytes.NewReader(payload), int64(len(payload)), "UNSIGNED-PAYLOAD", "Expect", "100-continue")
	res, err := (&http.Client{Transport: &http.Transport{ExpectContinueTimeout: 5 * time.Second, DisableKeepAlives: true}}).Do(req)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = io.Copy(io.Discard, res.Body)
	res.Body.Close()
	mu.Lock()
	defer mu.Unlock()
	if res.StatusCode != 200 || calls.Load() != 2 || len(got) != 1 || !bytes.Equal(got[0], payload) {
		t.Fatalf("a 421 for an Expect: 100-continue upload: %d, the home was asked %d times, bodies %d", res.StatusCode, calls.Load(), len(got))
	}
}

// A client whose first bytes come late (`tar c | curl -T -`) has no body byte consumed when the 421
// arrives, but the first attempt's transport goroutine is already waiting in a Read of it. Sending
// the request again would let that goroutine take the first bytes into the void and the second
// attempt would store the tail: a 200 for a damaged object. Whatever the entry node answers, it is
// never that. (The 421 is framed, as the home's is: it is complete at once, so nothing but the
// entry node's own rule stands between the stale reader and the second attempt.)
func TestClusterMisdirectedLateStreamIsNeverTruncated(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b := tc.nodes[0], tc.nodes[1]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "mvd", "home": "b"})
	cr := a.token("mvd", all, nil)
	var calls atomic.Int32
	var mu sync.Mutex
	var got [][]byte
	misdirectingHome(t, b, true, &calls, &mu, &got)

	pr, pw := io.Pipe()
	req := signedReq(t, a, cr, "PUT", "/mvd/late", pr, -1, "UNSIGNED-PAYLOAD") // Transfer-Encoding: chunked, no Expect
	go func() {
		time.Sleep(1 * time.Second)
		_, _ = pw.Write([]byte("0123456789"))
		time.Sleep(200 * time.Millisecond)
		_, _ = pw.Write([]byte("abcdefghij"))
		pw.Close()
	}()
	r := httpDo(t, req)
	mu.Lock()
	defer mu.Unlock()
	switch {
	case r.status == 200 && (len(got) != 1 || string(got[0]) != "0123456789abcdefghij"):
		t.Fatalf("SILENT CORRUPTION: the client was told 200 for a 20-byte upload; the home stored %q", got)
	case r.status != 200 && (r.status != 503 || r.header.Get("Retry-After") != "1"):
		t.Fatalf("a 421 for a stream that starts late: %d %s Retry-After=%q", r.status, r.code(), r.header.Get("Retry-After"))
	}
}

// A request that takes longer than the forwarder's wait for response headers (the before budget
// plus 15 s) is one failed request, not a sign that the home is down: the home's other clients
// must not be refused because of it.
func TestClusterSlowRequestDoesNotMarkTheHomeDown(t *testing.T) {
	if testing.Short() {
		t.Skip("takes about 16 s: the forwarder's response timeout is not shortened")
	}
	tc := startCluster(t, 3, func(i int, c *config.Config) { c.PipelineBeforeTotalTimeout = 500 * time.Millisecond })
	a, b := tc.nodes[0], tc.nodes[1]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "slw", "home": "b"})
	cr := a.token("slw", all, nil)
	var slow atomic.Bool
	b.app.Cluster().Mux().SetForward(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/slw/slow" && slow.CompareAndSwap(false, true) {
			select { // a heavy listing, say
			case <-time.After(30 * time.Second):
			case <-r.Context().Done():
			}
		}
		w.WriteHeader(200)
		_, _ = w.Write([]byte("fast"))
	}))
	done := make(chan *resp, 1)
	go func() { done <- a.s3(cr, "GET", "/slw/slow", nil) }()
	var other *resp
	eventually(t, 40*time.Second, "the slow request to be given up", func() bool {
		select {
		case r := <-done:
			if r.status != 503 {
				t.Errorf("the slow request ended with %d %s, want 503", r.status, r.code())
			}
			other = a.s3(cr, "GET", "/slw/other", nil) // an unrelated, fast request, right after
			return true
		default:
			return false
		}
	})
	if other.status != 200 {
		t.Fatalf("a healthy home was treated as down because one request was slow: %d %s Retry-After=%q", other.status, other.code(), other.header.Get("Retry-After"))
	}
}

// A virtual-hosted key that starts with "/" and holds percent-escapes travels as a path that
// begins with "//", which a request target built from URL.Opaque cannot carry. SigV4 signs the
// path, so the home must receive the client's escapes as they are: a key re-escaped on the way
// (%20 becoming %2520) fails the signature check behind an entry node and not on the home itself.
func TestClusterVirtualHostedLeadingSlashKeysKeepTheirEscapes(t *testing.T) {
	tc := startCluster(t, 3, func(i int, c *config.Config) { c.Domain = "s3.test" })
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "site", "home": "b"})
	cr := a.token("site", all, nil)
	do := func(n *cnode, method, path string, body []byte) *resp {
		req, _ := http.NewRequest(method, n.s3URL+path, bytes.NewReader(body))
		req.Host = "site.s3.test"
		if _, err := sigv4.Sign(req, cr.ak, cr.sk, "us-east-1", time.Now(), sha(body)); err != nil {
			t.Fatal(err)
		}
		return httpDo(t, req)
	}
	for _, path := range []string{"//plain", "//a%20b", "//a%2Bb", "//%41", "//caf%C3%A9", "//x%2Fy"} {
		body := []byte("object at " + path)
		if r := do(b, "PUT", path, body); r.status != 200 { // at the home itself: the control
			t.Fatalf("control: PUT %s at the home: %d %s %s", path, r.status, r.code(), r.body)
		}
		for _, n := range []*cnode{a, c} {
			if r := do(n, "PUT", path, body); r.status != 200 {
				t.Errorf("PUT %s through %s: %d %s", path, n.name, r.status, r.code())
			}
			if r := do(n, "GET", path, nil); r.status != 200 || !bytes.Equal(r.body, body) {
				t.Errorf("GET %s through %s: %d %s (%d body bytes)", path, n.name, r.status, r.code(), len(r.body))
			}
		}
	}
}

// A shutting-down home lets the transfers that are in flight finish and answers new
// requests with 503 at once; its peers stop forwarding to it as soon as it says it
// drains (spec §9.4).
func TestClusterGracefulShutdownLetsForwardsFinish(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b := tc.nodes[0], tc.nodes[1]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "gsd", "home": "b"})
	cr := a.token("gsd", all, nil)
	big := make([]byte, 24<<20)
	for i := range big {
		big[i] = byte(i * 13)
	}
	a.must(cr, 200, "PUT", "/gsd/big", big)

	req := signedReq(t, a, cr, "GET", "/gsd/big", nil, 0, sha(nil))
	res, err := (&http.Client{Transport: &http.Transport{DisableKeepAlives: true}}).Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	got := make([]byte, 0, len(big))
	buf := make([]byte, 1<<20)
	n, _ := io.ReadFull(res.Body, buf) // the transfer is under way
	got = append(got, buf[:n]...)
	stopped := make(chan struct{})
	go func() { b.stop(); close(stopped) }()
	// the home announces that it drains: new requests are refused, the old one goes on
	eventually(t, 5*time.Second, "new requests to be refused while b shuts down", func() bool {
		return a.s3(cr, "GET", "/gsd/big", nil, "Range", "bytes=0-9").status == 503
	})
	rest, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatalf("the transfer that was in flight broke: %v", err)
	}
	got = append(got, rest...)
	if !bytes.Equal(got, big) {
		t.Fatalf("the in-flight download is %d bytes (want %d) or differs", len(got), len(big))
	}
	<-stopped
}

// PauseBucket is the seam for the bucket move's activation step: the bucket answers 503
// SlowDown, reads included, until it is resumed — on the home's public listener and for
// requests forwarded to it (spec §8.8).
func TestClusterPausedBucketAnswers503(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b := tc.nodes[0], tc.nodes[1]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "pzd", "home": "b"})
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "other", "home": "b"})
	cr, or := a.token("pzd", all, nil), a.token("other", all, nil)
	a.must(cr, 200, "PUT", "/pzd/k", []byte("v"))

	b.app.PauseBucket("pzd")
	for _, n := range []*cnode{a, b} {
		r := n.s3(cr, "GET", "/pzd/k", nil)
		if r.status != 503 || r.code() != "SlowDown" || r.header.Get("Retry-After") != "1" {
			t.Fatalf("a paused bucket through %s: %d %s Retry-After=%q", n.name, r.status, r.code(), r.header.Get("Retry-After"))
		}
	}
	a.must(or, 200, "PUT", "/other/k", []byte("v")) // others are not affected
	b.app.ResumeBucket("pzd")
	a.must(cr, 200, "GET", "/pzd/k", nil)
}

// Many clients on every node, against buckets homed on every node: the forwarder is
// exercised concurrently (run with -race).
func TestClusterConcurrentTrafficThroughEveryNode(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a := tc.nodes[0]
	creds := map[string]cred{}
	for i, name := range []string{"load1", "load2", "load3"} {
		a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": name, "home": []string{"a", "b", "c"}[i]})
		creds[name] = a.token(name, all, nil)
	}
	var wg sync.WaitGroup
	var failures atomic.Int32
	for ni, n := range tc.nodes {
		for w := 0; w < 4; w++ {
			wg.Add(1)
			go func(n *cnode, ni, w int) {
				defer wg.Done()
				for i := 0; i < 15; i++ {
					for name, cr := range creds {
						key := fmt.Sprintf("/%s/n%d-w%d-%d", name, ni, w, i)
						body := bytes.Repeat([]byte{byte(i + w)}, 1000+i*37)
						req := signedReq(t, n, cr, "PUT", key, bytes.NewReader(body), int64(len(body)), sha(body))
						res, err := (&http.Client{}).Do(req)
						if err != nil || res.StatusCode != 200 {
							failures.Add(1)
							continue
						}
						res.Body.Close()
						req = signedReq(t, n, cr, "GET", key, nil, 0, sha(nil))
						res, err = (&http.Client{}).Do(req)
						if err != nil {
							failures.Add(1)
							continue
						}
						got, _ := io.ReadAll(res.Body)
						res.Body.Close()
						if res.StatusCode != 200 || !bytes.Equal(got, body) {
							failures.Add(1)
						}
					}
				}
			}(n, ni, w)
		}
	}
	wg.Wait()
	if f := failures.Load(); f != 0 {
		t.Fatalf("%d requests failed", f)
	}
	// the forwarders counted what they relayed
	if m := a.metric(t, "binvault_cluster_forwarded_requests_total"); !strings.Contains(m, `peer="b"`) || !strings.Contains(m, `peer="c"`) || !strings.Contains(m, `status="200"`) {
		t.Fatalf("forwarded request metrics: %q", m)
	}
}

// A client that stalls mid-upload through the entry node gets RequestTimeout from the
// entry node (the idle timeout applies on the client hop) and the home discards the
// partial upload (spec §8.4).
func TestClusterIdleTimeoutOnTheClientHop(t *testing.T) {
	tc := startCluster(t, 3, func(i int, c *config.Config) { c.BodyIdleTimeout = 600 * time.Millisecond })
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "idl", "home": "b"})
	cr := a.token("idl", all, nil)
	pr, pw := io.Pipe()
	req := signedReq(t, c, cr, "PUT", "/idl/stalled", pr, 4<<20, "UNSIGNED-PAYLOAD")
	go func() {
		pw.Write(bytes.Repeat([]byte("s"), 256<<10))
		// then nothing: the client stalls (the pipe stays open until the test ends)
	}()
	defer pw.Close()
	start := time.Now()
	r := httpDo(t, req)
	if r.status != 400 || r.code() != "RequestTimeout" {
		t.Fatalf("a stalled upload: %d %s", r.status, r.code())
	}
	if d := time.Since(start); d > 8*time.Second {
		t.Fatalf("the idle timeout took %s", d)
	}
	staging := filepath.Join(b.dir, "tmp")
	eventually(t, 10*time.Second, "the home to discard the stalled upload", func() bool {
		es, _ := os.ReadDir(staging)
		return len(es) == 0
	})
	if r := a.s3(cr, "GET", "/idl/stalled", nil); r.status != 404 {
		t.Fatalf("a stalled upload left an object: %d", r.status)
	}
}

// A home that dies mid-request: 503 when it had sent nothing, a reset connection when
// some of the response was already out (spec §8.4). A stub plays the home.
func TestClusterHomeDiesMidRequest(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b := tc.nodes[0], tc.nodes[1]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "die", "home": "b"})
	cr := a.token("die", all, nil)

	// dies before sending anything: the client gets a retryable 503
	b.app.Cluster().Mux().SetForward(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hj, ok := w.(http.Hijacker)
		if !ok {
			t.Error("no hijacker")
			return
		}
		c, _, _ := hj.Hijack()
		c.Close()
	}))
	r := a.s3(cr, "GET", "/die/k", nil)
	if r.status != 503 || r.code() != "ServiceUnavailable" || r.header.Get("Retry-After") != "5" {
		t.Fatalf("a home that dies before answering: %d %s Retry-After=%q", r.status, r.code(), r.header.Get("Retry-After"))
	}
	if m := a.metric(t, "binvault_cluster_forward_failures_total"); !strings.Contains(m, `peer="b"`) {
		t.Fatalf("forward failure metrics: %q", m)
	}

	// the failed forward told a that b is down for a moment; wait until it answers hello again
	eventually(t, 5*time.Second, "a to see b again", func() bool {
		for _, p := range a.app.Cluster().Peers() {
			if p.Name == "b" && p.Reachable {
				return true
			}
		}
		return false
	})
	// dies half way through the body: headers are out, so the connection is reset and the
	// client sees a truncated transfer, never a complete-looking answer
	b.app.Cluster().Mux().SetForward(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", "1000000")
		w.WriteHeader(200)
		_, _ = w.Write(bytes.Repeat([]byte("p"), 4096))
		w.(http.Flusher).Flush()
		time.Sleep(100 * time.Millisecond)
		panic(http.ErrAbortHandler)
	}))
	req := signedReq(t, a, cr, "GET", "/die/k", nil, 0, sha(nil))
	res, err := (&http.Client{Transport: &http.Transport{DisableKeepAlives: true}}).Do(req)
	if err != nil {
		t.Fatal(err)
	}
	n, err := io.Copy(io.Discard, res.Body)
	res.Body.Close()
	if res.StatusCode != 200 || err == nil || n >= 1000000 {
		t.Fatalf("a body cut off by the home: status %d, %d bytes, error %v: the client must see a broken transfer", res.StatusCode, n, err)
	}
}

// A home that stops reading an upload: the entry node gives up after the idle timeout
// instead of waiting for ever, and answers 503 (the idle timeout applies on the home hop too).
func TestClusterIdleTimeoutOnTheHomeHop(t *testing.T) {
	tc := startCluster(t, 3, func(i int, c *config.Config) { c.BodyIdleTimeout = 700 * time.Millisecond })
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "stl", "home": "b"})
	cr := a.token("stl", all, nil)
	release := make(chan struct{})
	b.app.Cluster().Mux().SetForward(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf := make([]byte, 64<<10)
		_, _ = r.Body.Read(buf) // takes a little, then stops reading and never answers
		select {
		case <-release:
		case <-r.Context().Done():
		}
	}))
	defer close(release)
	size := int64(256 << 20)
	req := signedReq(t, c, cr, "PUT", "/stl/stuck", io.LimitReader(zeroReader{}, size), size, "UNSIGNED-PAYLOAD")
	start := time.Now()
	r := httpDo(t, req)
	if r.status != 503 || r.code() != "ServiceUnavailable" {
		t.Fatalf("an upload to a home that stopped reading: %d %s", r.status, r.code())
	}
	if d := time.Since(start); d > 15*time.Second {
		t.Fatalf("it took %s to give up", d)
	}
}

type zeroReader struct{}

func (zeroReader) Read(p []byte) (int, error) {
	for i := range p {
		p[i] = 'z'
	}
	return len(p), nil
}

// The catalog says a node homes a bucket but the node has no data for it (a restore from
// a backup older than the bucket): 503 and a `missing` alarm, never NoSuchBucket (spec §8.4).
func TestClusterMissingLocalStateIs503NotNoSuchBucket(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b := tc.nodes[0], tc.nodes[1]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "lost", "home": "b"})
	cr := a.token("lost", all, nil)
	a.must(cr, 200, "PUT", "/lost/k", []byte("v"))
	// the data vanishes from b (as if its volume came from an older backup)
	if err := b.app.DB.Update(b.ctx, func(tx *meta.Tx) error { return tx.DeleteBucket(b.ctx, "lost") }); err != nil {
		t.Fatal(err)
	}
	for _, n := range []*cnode{a, b} {
		r := n.s3(cr, "GET", "/lost/k", nil)
		if r.status != 503 || r.code() != "ServiceUnavailable" {
			t.Fatalf("a bucket the catalog homes on a node without data, asked at %s: %d %s", n.name, r.status, r.code())
		}
	}
	// the node itself lists the bucket under `missing`, and the others see the count in its entry
	eventually(t, 10*time.Second, "the missing alarm", func() bool {
		_, out := b.admin("GET", "/cluster", nil)
		missing, _ := out["alarms"].(map[string]any)["missing"].([]any)
		for _, m := range missing {
			if m.(map[string]any)["name"] == "lost" && m.(map[string]any)["reason"] == "no_local_data" {
				return true
			}
		}
		return false
	})
	eventually(t, 15*time.Second, "a to see b's missing count", func() bool {
		_, out := a.admin("GET", "/cluster", nil)
		for _, nd := range items2(out["nodes"]) {
			if nd["name"] == "b" && nd["missing"] == float64(1) {
				return true
			}
		}
		return false
	})
}

// A single node answers the cluster endpoints too: mode single, itself the only node
// (spec §6.9), and the cluster-only calls are refused with 409 (spec §6.10).
func TestSingleNodeClusterEndpoints(t *testing.T) {
	tc := newCluster(t, 1)
	single, stop := startSingle(t, tc, t.TempDir())
	defer stop()
	out := single.mustAdmin(200, "GET", "/cluster", nil)
	nodes := items2(out["nodes"])
	if out["mode"] != "single" || out["id"] != single.app.NodeID || len(nodes) != 1 || nodes[0]["self"] != true || nodes[0]["reachable"] != true {
		t.Fatalf("GET /cluster on a single node: %v", out)
	}
	for _, k := range []string{"conflicts", "orphans", "held_ops", "clones", "missing", "mismatches"} {
		if l, ok := out["alarms"].(map[string]any)[k].([]any); !ok || len(l) != 0 {
			t.Fatalf("alarm %s: %v", k, out["alarms"])
		}
	}
	single.bucket("solo", nil)
	if n := items2(single.mustAdmin(200, "GET", "/cluster", nil)["nodes"])[0]["buckets_homed"]; n != float64(1) {
		t.Fatalf("buckets homed: %v", n)
	}
	for _, call := range [][2]string{{"POST", "/buckets/solo/move"}, {"GET", "/moves"}, {"POST", "/cluster/nodes/x/drain"}, {"DELETE", "/cluster/nodes/x"}, {"DELETE", "/cluster/orphans/x"}} {
		if code, out := single.admin(call[0], call[1], map[string]any{"to": "b"}); code != 409 {
			t.Fatalf("%s %s on a single node: %d %v", call[0], call[1], code, out)
		}
	}
	// no peer listener, no cluster metrics, the same x-binvault-node-less answers as before
	if single.app.PeerAddr() != "" || single.app.Cluster() != nil || !single.app.ClusterReady() {
		t.Fatal("a single node must have no cluster node and no peer listener")
	}
	tok := single.token("solo", all, nil)
	r := single.must(tok, 200, "PUT", "/solo/k", []byte("v"))
	if r.header.Get("x-binvault-node") != "" {
		t.Fatalf("a single node sets x-binvault-node: %q", r.header.Get("x-binvault-node"))
	}
	req, _ := http.NewRequest("GET", single.adminURL+"/_metrics", nil)
	req.Header.Set("Authorization", "Bearer "+single.adminTok)
	if m := httpDo(t, req); strings.Contains(string(m.body), "binvault_cluster_") {
		t.Fatal("a single node exports cluster metrics")
	}
}

// A node that is shutting down starts no new forwards (its in-flight ones finish), while
// the buckets it homes itself are served until its listeners close (spec §9.4).
func TestClusterDrainingEntryNodeStartsNoForwards(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b := tc.nodes[0], tc.nodes[1]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "ona", "home": "a"})
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "onb", "home": "b"})
	ta, tb := a.token("ona", all, nil), a.token("onb", all, nil)
	a.must(ta, 200, "PUT", "/ona/k", []byte("a"))
	a.must(tb, 200, "PUT", "/onb/k", []byte("b"))

	a.app.Cluster().SetDraining(true)
	if r := a.s3(tb, "GET", "/onb/k", nil); r.status != 503 || r.header.Get("Retry-After") != "5" {
		t.Fatalf("a draining entry node forwarded: %d", r.status)
	}
	a.must(ta, 200, "GET", "/ona/k", nil) // its own bucket is still served
	eventually(t, 5*time.Second, "peers to answer 503 for the buckets of a draining node", func() bool {
		return b.s3(ta, "GET", "/ona/k", nil).status == 503
	})
	a.app.Cluster().SetDraining(false)
	eventually(t, 5*time.Second, "forwarding to resume", func() bool { return a.s3(tb, "GET", "/onb/k", nil).status == 200 })
}

// The early-200 keep-alive of slow copies and completes (a 200 and whitespace first, the
// outcome in the body later) passes straight through the entry node: bytes are flushed as
// they arrive, not when the response ends (spec §5.4.5, §5.6, §8.4).
func TestClusterKeepAliveWhitespacePassesThrough(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "kal", "home": "b"})
	cr := a.token("kal", all, nil)
	b.app.Cluster().Mux().SetForward(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/xml")
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`<?xml version="1.0" encoding="UTF-8"?>`))
		w.(http.Flusher).Flush()
		for i := 0; i < 3; i++ {
			time.Sleep(400 * time.Millisecond)
			_, _ = w.Write([]byte(" "))
			w.(http.Flusher).Flush()
		}
		_, _ = w.Write([]byte(`<CopyObjectResult><ETag>"x"</ETag></CopyObjectResult>`))
	}))
	req := signedReq(t, c, cr, "PUT", "/kal/dst", nil, 0, sha(nil), "x-amz-copy-source", "/kal/src")
	start := time.Now()
	res, err := (&http.Client{Transport: &http.Transport{DisableKeepAlives: true}}).Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatalf("status %d", res.StatusCode)
	}
	if d := time.Since(start); d > 300*time.Millisecond {
		t.Fatalf("the early 200 reached the client after %s: it must not wait for the end of the answer", d)
	}
	var arrivals []time.Duration
	buf := make([]byte, 256)
	var all []byte
	for {
		n, err := res.Body.Read(buf)
		if n > 0 {
			arrivals = append(arrivals, time.Since(start))
			all = append(all, buf[:n]...)
		}
		if err != nil {
			break
		}
	}
	if len(arrivals) < 4 || arrivals[1] > 900*time.Millisecond || !strings.Contains(string(all), "<CopyObjectResult>") {
		t.Fatalf("the whitespace was not flushed as it came: arrivals %v body %q", arrivals, all)
	}
	_ = a
}

// Failed authentications are counted by the home, per the client address the entry node
// reports (spec §4.8, §8.4): three bad signatures through any node throttle that client
// at the home, whichever node it asks next; another client address is not affected.
func TestClusterThrottleUsesTheForwardedClientAddress(t *testing.T) {
	tc := startCluster(t, 3, func(i int, c *config.Config) { c.AuthFailLimit = 3 })
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "thr", "home": "b"})
	cr := a.token("thr", all, nil)
	a.must(cr, 200, "PUT", "/thr/k", []byte("v"))

	bad := cred{cr.ak, "not-the-secret-" + cr.sk[14:]} // secrets are alphanumeric: this one never matches
	for i := 0; i < 3; i++ {
		n := []*cnode{a, c, a}[i]
		if r := n.s3(bad, "GET", "/thr/k", nil); r.status != 403 || r.code() != "SignatureDoesNotMatch" {
			t.Fatalf("bad signature %d: %d %s", i, r.status, r.code())
		}
	}
	for _, n := range []*cnode{c, a} {
		if r := n.s3(cr, "GET", "/thr/k", nil); r.status != 503 || r.code() != "SlowDown" || r.header.Get("Retry-After") == "" {
			t.Fatalf("the throttled client through %s: %d %s", n.name, r.status, r.code())
		}
	}
	// the same request for another client address (reported by a peer) goes through
	req, _ := http.NewRequest("GET", b.peerURL+"/thr/k", nil)
	req.Header.Set("X-Binvault-Peer-Key", tc.key)
	req.Header.Set("X-Binvault-Origin", a.nodeID())
	req.Header.Set("X-Binvault-Epoch", "0")
	req.Header.Set("X-Forwarded-For", "203.0.113.50")
	if _, err := sigv4.Sign(req, cr.ak, cr.sk, "us-east-1", time.Now(), sha(nil)); err != nil {
		t.Fatal(err)
	}
	if r := httpDo(t, req); r.status != 200 {
		t.Fatalf("another client address: %d %s", r.status, r.code())
	}
}
