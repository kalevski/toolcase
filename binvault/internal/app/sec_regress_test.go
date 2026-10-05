package app_test

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"mime/multipart"
	"net"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/app"
	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/sigv4"
)

// Regression tests for the findings of the security review (2026-10-02).

type syncBuf struct {
	mu sync.Mutex
	b  bytes.Buffer
}

func (s *syncBuf) Write(p []byte) (int, error) { s.mu.Lock(); defer s.mu.Unlock(); return s.b.Write(p) }
func (s *syncBuf) String() string              { s.mu.Lock(); defer s.mu.Unlock(); return s.b.String() }

// startNodeLog is startNode with the access log captured.
func startNodeLog(t *testing.T) (*node, *syncBuf) {
	t.Helper()
	dir := t.TempDir()
	cfg := config.ForTest(func(c *config.Config) {
		c.DataDir = dir
		c.Listen, c.AdminListen = "127.0.0.1:0", "127.0.0.1:0"
		c.Fsync, c.MinFreeMB = false, 1
		c.EndpointURL = "http://127.0.0.1:9000"
	})
	buf := &syncBuf{}
	ctx, cancel := context.WithCancel(context.Background())
	a, err := app.New(ctx, cfg, slog.New(slog.NewTextHandler(buf, nil)), app.Build{Version: "test"})
	if err != nil {
		cancel()
		t.Fatal(err)
	}
	done := make(chan struct{})
	go func() { _ = a.Run(ctx); close(done) }()
	t.Cleanup(func() { cancel(); <-done })
	return &node{t: t, app: a, s3URL: "http://" + a.PublicAddr(), adminURL: "http://" + a.AdminAddr(), adminTok: cfg.AdminToken[0], dir: dir}, buf
}

func postFormBody(fields [][2]string, file []byte) ([]byte, string) {
	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	for _, f := range fields {
		_ = w.WriteField(f[0], f[1])
	}
	fw, _ := w.CreateFormFile("file", "up.bin")
	_, _ = fw.Write(file)
	_ = w.Close()
	return b.Bytes(), w.FormDataContentType()
}

func policyFor(conds ...any) string {
	conds = append(conds, []any{"starts-with", "$x-amz-algorithm", ""}, []any{"starts-with", "$x-amz-credential", ""}, []any{"starts-with", "$x-amz-date", ""})
	raw, _ := json.Marshal(map[string]any{"expiration": time.Now().Add(time.Hour).UTC().Format(time.RFC3339), "conditions": conds})
	return base64.StdEncoding.EncodeToString(raw)
}

func (n *node) postForm(bucket string, c cred, policy string, extra [][2]string, file []byte) *resp {
	cr, dt, sig := sigv4.SignPostPolicy(policy, c.ak, c.sk, "us-east-1", time.Now())
	fields := append([][2]string{{"policy", policy}, {"x-amz-algorithm", sigv4.Algorithm}, {"x-amz-credential", cr}, {"x-amz-date", dt}, {"x-amz-signature", sig}}, extra...)
	body, ct := postFormBody(fields, file)
	req, _ := http.NewRequest("POST", n.s3URL+"/"+bucket, bytes.NewReader(body))
	req.Header.Set("Content-Type", ct)
	return n.do(req)
}

func TestSecPostObjectNeedsTagActionForTagFields(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	createOnly := n.token("bkt", []map[string]any{{"actions": []string{"create", "read"}}}, nil)
	reader := n.token("bkt", all, nil)

	for _, tc := range []struct{ name, field, value string }{
		{"x-amz-tagging field", "x-amz-tagging", "scan=clean"},
		{"tagging XML field", "tagging", `<Tagging><TagSet><Tag><Key>scan</Key><Value>clean</Value></Tag></TagSet></Tagging>`},
	} {
		pol := policyFor(map[string]string{"bucket": "bkt"}, []any{"starts-with", "$key", ""}, []any{"starts-with", "$" + tc.field, ""})
		r := n.postForm("bkt", createOnly, pol, [][2]string{{"key", "post-" + tc.field}, {tc.field, tc.value}}, []byte("data"))
		if r.status != 403 {
			t.Fatalf("%s: a token without `tag` set tags through POST Object: %d %s", tc.name, r.status, r.body)
		}
		if g := n.s3(reader, "GET", "/bkt/post-"+tc.field, nil); g.status != 404 {
			t.Fatalf("%s: the refused upload left an object behind: %d", tc.name, g.status)
		}
	}
	// without tag fields the same token may upload
	pol := policyFor(map[string]string{"bucket": "bkt"}, []any{"starts-with", "$key", ""})
	if r := n.postForm("bkt", createOnly, pol, [][2]string{{"key", "plain"}}, []byte("data")); r.status/100 != 2 {
		t.Fatalf("plain POST: %d %s", r.status, r.body)
	}
	// and a token holding `tag` may set them
	taggerG := n.token("bkt", []map[string]any{{"actions": []string{"create", "tag", "read"}}}, nil)
	pol2 := policyFor(map[string]string{"bucket": "bkt"}, []any{"starts-with", "$key", ""}, []any{"starts-with", "$x-amz-tagging", ""})
	if r := n.postForm("bkt", taggerG, pol2, [][2]string{{"key", "tagged"}, {"x-amz-tagging", "scan=clean"}}, []byte("data")); r.status/100 != 2 {
		t.Fatalf("tagging with the tag action: %d %s", r.status, r.body)
	}
	if g := n.must(reader, 200, "GET", "/bkt/tagged?tagging", nil); !strings.Contains(string(g.body), "<Key>scan</Key>") {
		t.Fatalf("%s", g.body)
	}
}

func TestSecPostObjectHonoursTheTokensRateLimit(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	c := n.token("bkt", []map[string]any{{"actions": []string{"create", "write", "read"}}},
		map[string]any{"limits": map[string]any{"requests_per_second": 1, "burst": 1}})
	pol := policyFor(map[string]string{"bucket": "bkt"}, []any{"starts-with", "$key", ""})
	ok, slow := 0, 0
	for i := 0; i < 8; i++ {
		switch r := n.postForm("bkt", c, pol, [][2]string{{"key", "k"}}, []byte("x")); {
		case r.status/100 == 2:
			ok++
		case r.status == 503 && r.code() == "SlowDown":
			slow++
		default:
			t.Fatalf("unexpected %d %s", r.status, r.code())
		}
	}
	if slow == 0 || ok > 3 {
		t.Fatalf("POST bypasses the token limit: %d accepted, %d throttled", ok, slow)
	}
}

func TestSecSignedPayloadHashCoversXMLBodies(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)
	n.must(c, 200, "PUT", "/bkt/victim", []byte("precious"))
	n.must(c, 200, "PUT", "/bkt/keep", []byte("other"))

	hash := func(b []byte) string { s := sha256.Sum256(b); return hex.EncodeToString(s[:]) }
	attack := func(path, method string, signedFor, actual []byte) *resp {
		req, _ := http.NewRequest(method, n.s3URL+path, bytes.NewReader(actual))
		if _, err := sigv4.Sign(req, c.ak, c.sk, "us-east-1", time.Now(), hash(signedFor)); err != nil {
			t.Fatal(err)
		}
		return n.do(req)
	}
	signedDoc := []byte(`<Delete><Object><Key>keep</Key></Object></Delete>`)
	evilDoc := []byte(`<Delete><Object><Key>victim</Key></Object></Delete>`)
	r := attack("/bkt?delete", "POST", signedDoc, evilDoc)
	if r.status != 400 || r.code() != "XAmzContentSHA256Mismatch" {
		t.Fatalf("DeleteObjects with a body that does not match the signed hash: %d %s", r.status, r.body)
	}
	if g := n.s3(c, "GET", "/bkt/victim", nil); g.status != 200 {
		t.Fatalf("the tampered DeleteObjects deleted the object: %d", g.status)
	}
	// tagging and Complete are covered the same way
	tag := []byte(`<Tagging><TagSet><Tag><Key>a</Key><Value>b</Value></Tag></TagSet></Tagging>`)
	if r := attack("/bkt/keep?tagging", "PUT", []byte("<x/>"), tag); r.code() != "XAmzContentSHA256Mismatch" {
		t.Fatalf("tagging: %d %s", r.status, r.body)
	}
	// the honest request still works
	if r := attack("/bkt?delete", "POST", evilDoc, evilDoc); r.status != 200 {
		t.Fatalf("a correctly signed DeleteObjects: %d %s", r.status, r.body)
	}
	if g := n.s3(c, "GET", "/bkt/victim", nil); g.status != 404 {
		t.Fatal("the honest delete did not delete")
	}
}

func TestSecVersionMarkersDoNotProbeKeysOutsideTheGrant(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	admin := n.token("bkt", all, nil)
	n.must(admin, 200, "PUT", "/bkt/secret/passwords.txt", []byte("x"))
	n.must(admin, 200, "PUT", "/bkt/public/a", []byte("x"))
	lister := n.token("bkt", []map[string]any{{"actions": []string{"list"}, "keys": []string{"public/*"}}}, nil)
	probe := func(key string) *resp {
		return n.s3(lister, "GET", "/bkt?versions&prefix=public/&key-marker="+key+"&version-id-marker=null", nil)
	}
	exists, missing := probe("secret/passwords.txt"), probe("secret/nothing-here.txt")
	if exists.status != missing.status || exists.code() != missing.code() {
		t.Fatalf("existence leak: existing %d %s, missing %d %s", exists.status, exists.code(), missing.status, missing.code())
	}
	if exists.status != 400 {
		t.Fatalf("a marker outside the grant must be refused, got %d", exists.status)
	}
	// markers inside the grant keep working
	if r := probe("public/a"); r.status != 200 {
		t.Fatalf("marker inside the grant: %d %s", r.status, r.body)
	}
}

func TestSecLastUsedOnlyAfterAVerifiedSignature(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)
	lastUsed := func() any {
		if err := n.app.Tokens.Flush(context.Background()); err != nil {
			t.Fatal(err)
		}
		out := n.mustAdmin(200, "GET", "/buckets/bkt/tokens", nil)
		return out["items"].([]any)[0].(map[string]any)["last_used_at"]
	}
	if r := n.s3(cred{c.ak, "wrong-secret-wrong-secret-wrong-secret-00"}, "GET", "/bkt/x", nil); r.code() != "SignatureDoesNotMatch" {
		t.Fatalf("%d %s", r.status, r.code())
	}
	if v := lastUsed(); v != nil {
		t.Fatalf("a request with a bad signature set last_used_at: %v", v)
	}
	n.s3(c, "GET", "/bkt/x", nil)
	if v := lastUsed(); v == nil {
		t.Fatal("a verified request must set last_used_at")
	}
}

func TestSecAccessLogNeverHoldsPresignedSignatures(t *testing.T) {
	n, logs := startNodeLog(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)
	n.must(c, 200, "PUT", "/bkt/k", []byte("x"))
	req, _ := http.NewRequest("GET", n.s3URL+"/bkt/k", nil)
	u, err := sigv4.Presign(req, c.ak, c.sk, "us-east-1", time.Now(), time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	res, err := http.Get(u)
	if err != nil || res.StatusCode != 200 {
		t.Fatalf("presigned GET: %v %v", err, res)
	}
	res.Body.Close()
	time.Sleep(50 * time.Millisecond)
	out := logs.String()
	sigIdx := strings.Index(u, "X-Amz-Signature=")
	sig := u[sigIdx+len("X-Amz-Signature="):]
	if i := strings.IndexByte(sig, '&'); i >= 0 {
		sig = sig[:i]
	}
	if sig == "" || strings.Contains(out, sig) || strings.Contains(strings.ToLower(out), "x-amz-signature") {
		t.Fatalf("presigned signature in the access log:\n%s", out)
	}
}

func TestSecStalledBodyDoesNotPinTheConnection(t *testing.T) {
	n := startNode(t, nil)
	conn, err := net.Dial("tcp", strings.TrimPrefix(n.s3URL, "http://"))
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	io.WriteString(conn, "PUT /bkt/k HTTP/1.1\r\nHost: x\r\nContent-Length: 1000\r\n\r\nab")
	conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	buf := make([]byte, 1024)
	nr, err := conn.Read(buf)
	if err != nil {
		t.Fatalf("an unauthenticated request with a stalled body got no answer: %v", err)
	}
	if !strings.HasPrefix(string(buf[:nr]), "HTTP/1.1 4") {
		t.Fatalf("unexpected answer %q", buf[:nr])
	}
}
