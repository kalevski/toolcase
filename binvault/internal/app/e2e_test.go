package app_test

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"encoding/xml"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/app"
	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/sigv4"
)

type node struct {
	t        *testing.T
	app      *app.App
	s3URL    string
	adminURL string
	adminTok string
	dir      string
}

type cred struct{ ak, sk string }

type resp struct {
	status int
	header http.Header
	body   []byte
}

func (r *resp) code() string {
	var e struct {
		Code string `xml:"Code"`
	}
	_ = xml.Unmarshal(r.body, &e)
	return e.Code
}

func startNode(t *testing.T, mod func(*config.Config)) *node {
	t.Helper()
	dir := t.TempDir()
	cfg := config.ForTest(func(c *config.Config) {
		c.DataDir = dir
		c.Listen, c.AdminListen = "127.0.0.1:0", "127.0.0.1:0"
		c.Fsync = false
		c.MinFreeMB = 1
		c.EndpointURL = "http://127.0.0.1:9000"
		if mod != nil {
			mod(c)
		}
	})
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	ctx, cancel := context.WithCancel(context.Background())
	a, err := app.New(ctx, cfg, log, app.Build{Version: "test"})
	if err != nil {
		cancel()
		t.Fatal(err)
	}
	done := make(chan struct{})
	go func() { _ = a.Run(ctx); close(done) }()
	t.Cleanup(func() { cancel(); <-done })
	return &node{t: t, app: a, s3URL: "http://" + a.PublicAddr(), adminURL: "http://" + a.AdminAddr(), adminTok: cfg.AdminToken[0], dir: dir}
}

// admin calls the admin API; body may be nil, a map or a string.
func (n *node) admin(method, path string, body any, hdr ...string) (int, map[string]any) {
	n.t.Helper()
	var rd io.Reader
	switch b := body.(type) {
	case nil:
	case string:
		rd = strings.NewReader(b)
	default:
		raw, _ := json.Marshal(b)
		rd = bytes.NewReader(raw)
	}
	req, _ := http.NewRequest(method, n.adminURL+"/_admin/v1"+path, rd)
	req.Header.Set("Authorization", "Bearer "+n.adminTok)
	for i := 0; i+1 < len(hdr); i += 2 {
		req.Header.Set(hdr[i], hdr[i+1])
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		n.t.Fatal(err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	var out map[string]any
	_ = json.Unmarshal(raw, &out)
	return res.StatusCode, out
}

func (n *node) mustAdmin(want int, method, path string, body any, hdr ...string) map[string]any {
	n.t.Helper()
	code, out := n.admin(method, path, body, hdr...)
	if code != want {
		n.t.Fatalf("%s %s: status %d, want %d: %v", method, path, code, want, out)
	}
	return out
}

func (n *node) bucket(name string, settings map[string]any) {
	n.t.Helper()
	body := map[string]any{"name": name}
	for k, v := range settings {
		body[k] = v
	}
	n.mustAdmin(201, "POST", "/buckets", body)
}

func (n *node) token(bucket string, grants any, extra map[string]any) cred {
	n.t.Helper()
	body := map[string]any{"name": "t", "grants": grants}
	for k, v := range extra {
		body[k] = v
	}
	out := n.mustAdmin(201, "POST", "/buckets/"+bucket+"/tokens", body)
	return cred{out["access_key_id"].(string), out["secret_access_key"].(string)}
}

var all = []map[string]any{{"actions": []string{"read", "write", "list", "delete", "purge", "tag"}}}

// s3 sends a SigV4-signed request.
func (n *node) s3(c cred, method, path string, body []byte, hdr ...string) *resp {
	n.t.Helper()
	req, _ := http.NewRequest(method, n.s3URL+path, bytes.NewReader(body))
	for i := 0; i+1 < len(hdr); i += 2 {
		req.Header.Set(hdr[i], hdr[i+1])
	}
	if c.ak != "" {
		sum := sha256.Sum256(body)
		var extra []string
		for k := range req.Header {
			if lk := strings.ToLower(k); strings.HasPrefix(lk, "x-amz-") || lk == "content-md5" {
				extra = append(extra, lk)
			}
		}
		if _, err := sigv4.Sign(req, c.ak, c.sk, "us-east-1", time.Now(), hex.EncodeToString(sum[:]), extra...); err != nil {
			n.t.Fatal(err)
		}
	}
	return n.do(req)
}

func (n *node) do(req *http.Request) *resp {
	n.t.Helper()
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		n.t.Fatal(err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	return &resp{res.StatusCode, res.Header, raw}
}

func (n *node) must(c cred, want int, method, path string, body []byte, hdr ...string) *resp {
	n.t.Helper()
	r := n.s3(c, method, path, body, hdr...)
	if r.status != want {
		n.t.Fatalf("%s %s: status %d (%s), want %d: %s", method, path, r.status, r.code(), want, r.body)
	}
	return r
}

func TestAdminBucketLifecycle(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("photos", nil)
	if code, out := n.admin("POST", "/buckets", map[string]any{"name": "photos"}); code != 409 {
		t.Fatalf("duplicate: %d %v", code, out)
	}
	code, out := n.admin("POST", "/buckets", map[string]any{"name": "Bad_Name"})
	if code != 400 || out["fields"] == nil {
		t.Fatalf("bad name: %d %v", code, out)
	}
	if code, out := n.admin("POST", "/buckets", map[string]any{"name": "x1x", "bogus": 1}); code != 400 {
		t.Fatalf("unknown field must be 400: %d %v", code, out)
	}
	if code, _ := n.admin("GET", "/buckets/nope", nil); code != 404 {
		t.Fatalf("missing bucket: %d", code)
	}
	if code, _ := n.admin("PUT", "/buckets/nope", map[string]any{}); code != 404 {
		t.Fatalf("PUT must not create: %d", code)
	}

	// PATCH merges, PUT replaces, If-Match is exact
	b := n.mustAdmin(200, "PATCH", "/buckets/photos", map[string]any{"quota_bytes": 1000, "limits": map[string]any{"requests_per_second": 5}})
	rev := int(b["revision"].(float64))
	if b["quota_bytes"].(float64) != 1000 {
		t.Fatalf("%v", b)
	}
	if code, _ := n.admin("PATCH", "/buckets/photos", map[string]any{"max_objects": 3}, "If-Match", `"`+strconv.Itoa(rev-1)+`"`); code != 412 {
		t.Fatalf("stale revision must be 412, got %d", code)
	}
	b = n.mustAdmin(200, "PATCH", "/buckets/photos", map[string]any{"quota_bytes": nil}, "If-Match", `"`+strconv.Itoa(rev)+`"`)
	if b["quota_bytes"] != nil || b["limits"].(map[string]any)["requests_per_second"].(float64) != 5 {
		t.Fatalf("null removes, others stay: %v", b)
	}
	b = n.mustAdmin(200, "PUT", "/buckets/photos", map[string]any{"versioning": "enabled"})
	if b["versioning"] != "enabled" || b["limits"].(map[string]any)["requests_per_second"] != nil {
		t.Fatalf("PUT replaces everything: %v", b)
	}
	if code, _ := n.admin("PUT", "/buckets/photos", map[string]any{"versioning": "off"}); code != 409 {
		t.Fatalf("versioning cannot go back: %d", code)
	}
	if code, _ := n.admin("PATCH", "/buckets/photos", map[string]any{"name": "other"}); code != 400 {
		t.Fatalf("name is immutable: %d", code)
	}
	if code, _ := n.admin("PATCH", "/buckets/photos", map[string]any{"lifecycle": []any{map[string]any{"id": "x"}}}); code != 400 {
		t.Fatalf("a rule without an action must be refused: %d", code)
	}

	// list, delete guards
	list := n.mustAdmin(200, "GET", "/buckets?stats=true", nil)
	if len(list["items"].([]any)) != 1 {
		t.Fatalf("%v", list)
	}
	c := n.token("photos", all, nil)
	n.must(c, 200, "PUT", "/photos/k", []byte("x"))
	if code, _ := n.admin("DELETE", "/buckets/photos", nil); code != 409 {
		t.Fatalf("non-empty delete must be 409: %d", code)
	}
	n.mustAdmin(204, "DELETE", "/buckets/photos?force=true", nil)
	if r := n.s3(c, "GET", "/photos/k", nil); r.status != 403 || r.code() != "InvalidAccessKeyId" {
		t.Fatalf("tokens die with the bucket: %d %s", r.status, r.code())
	}
	n.bucket("photos", nil) // the name can be reused, starting clean
	c2 := n.token("photos", all, nil)
	if r := n.s3(c2, "GET", "/photos/k", nil); r.status != 404 {
		t.Fatalf("a recreated bucket starts clean: %d", r.status)
	}
}

func TestAdminAuth(t *testing.T) {
	n := startNode(t, func(c *config.Config) { c.AuthFailLimit = 3 })
	req, _ := http.NewRequest("GET", n.adminURL+"/_admin/v1/status", nil)
	for i := 0; i < 3; i++ {
		if r := n.do(req); r.status != 401 {
			t.Fatalf("no token: %d", r.status)
		}
	}
	// the address is throttled after the limit (429), even with the right token
	req.Header.Set("Authorization", "Bearer "+n.adminTok)
	if r := n.do(req); r.status != 429 || r.header.Get("Retry-After") == "" {
		t.Fatalf("throttle: %d %v", r.status, r.header)
	}
}

func TestPublicListenerHidesAdmin(t *testing.T) {
	n := startNode(t, nil)
	for _, p := range []string{"/_admin/v1/status", "/_metrics", "/_nothing"} {
		req, _ := http.NewRequest("GET", n.s3URL+p, nil)
		req.Header.Set("Authorization", "Bearer "+n.adminTok)
		if r := n.do(req); r.status != 404 {
			t.Fatalf("%s on the public listener: %d", p, r.status)
		}
	}
	// the admin listener does not serve S3
	req, _ := http.NewRequest("GET", n.adminURL+"/photos/k", nil)
	if r := n.do(req); r.status != 404 {
		t.Fatalf("S3 path on the admin listener: %d", r.status)
	}
	// health and version are public
	req, _ = http.NewRequest("GET", n.s3URL+"/_healthz", nil)
	if r := n.do(req); r.status != 200 {
		t.Fatalf("healthz: %d", r.status)
	}
	req, _ = http.NewRequest("GET", n.s3URL+"/_version", nil)
	if r := n.do(req); r.status != 200 || !strings.Contains(string(r.body), `"version":"test"`) {
		t.Fatalf("version: %d %s", r.status, r.body)
	}
	// metrics need the admin token
	req, _ = http.NewRequest("GET", n.adminURL+"/_metrics", nil)
	if r := n.do(req); r.status != 401 {
		t.Fatalf("metrics without token: %d", r.status)
	}
	req.Header.Set("Authorization", "Bearer "+n.adminTok)
	if r := n.do(req); r.status != 200 || !strings.Contains(string(r.body), "binvault_http_requests_total") {
		t.Fatalf("metrics: %d", r.status)
	}
}

func TestTokenGrantsRevocationAndExpiry(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	admin := n.token("bkt", all, nil)
	n.must(admin, 200, "PUT", "/bkt/public/a.txt", []byte("A"))
	n.must(admin, 200, "PUT", "/bkt/private/s.txt", []byte("S"))

	rd := n.token("bkt", []map[string]any{{"actions": []string{"read", "list"}, "keys": []string{"public/*"}}}, nil)
	n.must(rd, 200, "GET", "/bkt/public/a.txt", nil)
	if r := n.s3(rd, "GET", "/bkt/private/s.txt", nil); r.status != 403 || r.code() != "AccessDenied" {
		t.Fatalf("outside the pattern: %d %s", r.status, r.code())
	}
	if r := n.s3(rd, "PUT", "/bkt/public/new", []byte("x")); r.status != 403 {
		t.Fatalf("read-only token wrote: %d", r.status)
	}
	if r := n.s3(rd, "DELETE", "/bkt/public/a.txt", nil); r.status != 403 {
		t.Fatalf("read-only token deleted: %d", r.status)
	}
	// listing is bound to the granted prefix, and filtered
	n.must(rd, 200, "GET", "/bkt?list-type=2&prefix=public/", nil)
	if r := n.s3(rd, "GET", "/bkt?list-type=2", nil); r.status != 403 {
		t.Fatalf("list without a granted prefix: %d", r.status)
	}
	// another bucket is out of reach
	n.bucket("other", nil)
	if r := n.s3(rd, "GET", "/other/x", nil); r.status != 403 || r.code() != "AccessDenied" {
		t.Fatalf("cross-bucket: %d %s", r.status, r.code())
	}

	// editing grants applies to the very next request
	out := n.mustAdmin(200, "GET", "/buckets/bkt/tokens", nil)
	var id string
	for _, it := range out["items"].([]any) {
		m := it.(map[string]any)
		if m["access_key_id"] == rd.ak {
			id = rd.ak
		}
	}
	if id == "" {
		t.Fatal("token not listed")
	}
	n.mustAdmin(200, "PATCH", "/buckets/bkt/tokens/"+id, map[string]any{"grants": []map[string]any{{"actions": []string{"read"}}}})
	n.must(rd, 200, "GET", "/bkt/private/s.txt", nil)

	// revocation is immediate
	n.mustAdmin(204, "DELETE", "/buckets/bkt/tokens/"+id, nil)
	if r := n.s3(rd, "GET", "/bkt/private/s.txt", nil); r.status != 403 || r.code() != "InvalidAccessKeyId" {
		t.Fatalf("revoked: %d %s", r.status, r.code())
	}

	// an expired token fails like an unknown one
	exp := n.token("bkt", all, map[string]any{"expires_at": time.Now().Add(1500 * time.Millisecond).UTC().Format(time.RFC3339Nano)})
	n.must(exp, 200, "GET", "/bkt/public/a.txt", nil)
	time.Sleep(1700 * time.Millisecond)
	if r := n.s3(exp, "GET", "/bkt/public/a.txt", nil); r.code() != "InvalidAccessKeyId" {
		t.Fatalf("expired: %d %s", r.status, r.code())
	}
	// grants validation
	if code, _ := n.admin("POST", "/buckets/bkt/tokens", map[string]any{"name": "x", "grants": []any{}}); code != 400 {
		t.Fatal("empty grants accepted")
	}
	if code, _ := n.admin("POST", "/buckets/bkt/tokens", map[string]any{"name": "x", "grants": []map[string]any{{"actions": []string{"fly"}}}}); code != 400 {
		t.Fatal("unknown action accepted")
	}
}

func TestBearerAndAdminTokenAreNotS3Credentials(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)
	for name, auth := range map[string]string{
		"bucket token as bearer": "Bearer " + c.ak + "." + c.sk,
		"admin token as bearer":  "Bearer " + n.adminTok,
		"basic":                  "Basic Zm9vOmJhcg==",
	} {
		req, _ := http.NewRequest("GET", n.s3URL+"/bkt/k", nil)
		req.Header.Set("Authorization", auth)
		r := n.do(req)
		if r.status != 403 && r.status != 400 {
			t.Fatalf("%s accepted: %d", name, r.status)
		}
		if name == "admin token as bearer" && (r.code() != "InvalidAccessKeyId" || strings.Contains(string(r.body), "admin")) {
			t.Fatalf("the admin token must look like any invalid bearer: %s", r.body)
		}
	}
}

func TestAuthThrottle(t *testing.T) {
	n := startNode(t, func(c *config.Config) { c.AuthFailLimit = 4 })
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)
	bad := cred{c.ak, "wrongsecretwrongsecretwrongsecretwrong"}
	for i := 0; i < 4; i++ {
		if r := n.s3(bad, "GET", "/bkt/k", nil); r.code() != "SignatureDoesNotMatch" {
			t.Fatalf("attempt %d: %d %s", i, r.status, r.code())
		}
	}
	r := n.s3(bad, "GET", "/bkt/k", nil)
	if r.status != 503 || r.code() != "SlowDown" || r.header.Get("Retry-After") == "" {
		t.Fatalf("throttled: %d %s %v", r.status, r.code(), r.header)
	}
	// the address, not the key, is blocked: a different key from the same address too
	if r := n.s3(c, "GET", "/bkt/k", nil); r.status != 503 {
		t.Fatalf("blocked address: %d", r.status)
	}
}

func TestVersioningOverHTTP(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("ver", map[string]any{"versioning": "enabled"})
	c := n.token("ver", all, nil)
	delOnly := n.token("ver", []map[string]any{{"actions": []string{"read", "list", "delete"}}}, nil)

	r1 := n.must(c, 200, "PUT", "/ver/k", []byte("one"))
	r2 := n.must(c, 200, "PUT", "/ver/k", []byte("two!"))
	v1, v2 := r1.header.Get("x-amz-version-id"), r2.header.Get("x-amz-version-id")
	if v1 == "" || v1 == v2 {
		t.Fatalf("version ids: %q %q", v1, v2)
	}
	if g := n.must(c, 200, "GET", "/ver/k?versionId="+v1, nil); string(g.body) != "one" || g.header.Get("x-amz-version-id") != v1 {
		t.Fatalf("%q", g.body)
	}

	// ListObjectVersions: newest first, IsLatest on the current one
	lv := n.must(c, 200, "GET", "/ver?versions", nil)
	var lvr struct {
		Versions []struct {
			Key       string `xml:"Key"`
			VersionID string `xml:"VersionId"`
			IsLatest  bool   `xml:"IsLatest"`
			Size      int64  `xml:"Size"`
		} `xml:"Version"`
	}
	if err := xml.Unmarshal(lv.body, &lvr); err != nil || len(lvr.Versions) != 2 || lvr.Versions[0].VersionID != v2 || !lvr.Versions[0].IsLatest || lvr.Versions[1].IsLatest {
		t.Fatalf("%v %s", err, lv.body)
	}

	// a plain delete adds a marker; reads see 404 with the marker headers
	d := n.must(delOnly, 204, "DELETE", "/ver/k", nil)
	if d.header.Get("x-amz-delete-marker") != "true" || d.header.Get("x-amz-version-id") == "" {
		t.Fatalf("%v", d.header)
	}
	g := n.s3(c, "GET", "/ver/k", nil)
	if g.status != 404 || g.header.Get("x-amz-delete-marker") != "true" {
		t.Fatalf("%d %v", g.status, g.header)
	}
	marker := d.header.Get("x-amz-version-id")
	if g := n.s3(c, "GET", "/ver/k?versionId="+marker, nil); g.status != 405 || g.header.Get("x-amz-delete-marker") != "true" {
		t.Fatalf("marker by id: %d", g.status)
	}
	// a delete-only token cannot purge (needs `purge`)
	if r := n.s3(delOnly, "DELETE", "/ver/k?versionId="+v1, nil); r.status != 403 {
		t.Fatalf("purge without the action: %d", r.status)
	}
	// ... the full token can: removing the marker brings the key back
	n.must(c, 204, "DELETE", "/ver/k?versionId="+marker, nil)
	if g := n.must(c, 200, "GET", "/ver/k", nil); string(g.body) != "two!" {
		t.Fatalf("%q", g.body)
	}
	// removing the latest uncovers the older version
	n.must(c, 204, "DELETE", "/ver/k?versionId="+v2, nil)
	if g := n.must(c, 200, "GET", "/ver/k", nil); string(g.body) != "one" {
		t.Fatalf("%q", g.body)
	}
	if r := n.s3(c, "GET", "/ver/k?versionId=01ZZZZZZZZZZZZZZZZZZZZZZZZ", nil); r.status != 404 || r.code() != "NoSuchVersion" {
		t.Fatalf("%d %s", r.status, r.code())
	}
	// stats
	st := n.mustAdmin(200, "GET", "/buckets/ver", nil)["stats"].(map[string]any)
	if st["objects"].(float64) != 1 || st["versions"].(float64) != 1 || st["bytes"].(float64) != 3 {
		t.Fatalf("%v", st)
	}
}

func TestNullVersionAfterEnablingVersioning(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)
	r := n.must(c, 200, "PUT", "/bkt/k", []byte("legacy"))
	if r.header.Get("x-amz-version-id") != "" {
		t.Fatal("no version id header while unversioned")
	}
	if r.header.Get("x-binvault-version") == "" {
		t.Fatal("x-binvault-version is always present")
	}
	n.mustAdmin(200, "PATCH", "/buckets/bkt", map[string]any{"versioning": "enabled"})
	n.must(c, 200, "PUT", "/bkt/k", []byte("new"))
	if g := n.must(c, 200, "GET", "/bkt/k?versionId=null", nil); string(g.body) != "legacy" {
		t.Fatalf("%q", g.body)
	}
	lv := n.must(c, 200, "GET", "/bkt?versions", nil)
	if !strings.Contains(string(lv.body), "<VersionId>null</VersionId>") {
		t.Fatalf("%s", lv.body)
	}
	// versionId in an unversioned bucket
	n.bucket("unv", nil)
	cu := n.token("unv", all, nil)
	n.must(cu, 200, "PUT", "/unv/k", []byte("x"))
	n.must(cu, 200, "GET", "/unv/k?versionId=null", nil)
	if r := n.s3(cu, "GET", "/unv/k?versionId=abc", nil); r.status != 400 || r.code() != "InvalidArgument" {
		t.Fatalf("%d %s", r.status, r.code())
	}
	n.must(cu, 204, "DELETE", "/unv/k?versionId=null", nil)
	if r := n.s3(cu, "GET", "/unv/k", nil); r.status != 404 {
		t.Fatal("versionId=null delete must remove the object")
	}
}

func TestWriteOnceTokenOverHTTP(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	backup := n.token("bkt", []map[string]any{{"actions": []string{"create", "read", "list"}}}, nil)
	n.must(backup, 200, "PUT", "/bkt/a", []byte("1"))
	if r := n.s3(backup, "PUT", "/bkt/a", []byte("2")); r.status != 403 || r.code() != "AccessDenied" {
		t.Fatalf("overwrite by a create-only token: %d %s", r.status, r.code())
	}
	if r := n.s3(backup, "DELETE", "/bkt/a", nil); r.status != 403 {
		t.Fatalf("delete: %d", r.status)
	}
	n.must(backup, 200, "PUT", "/bkt/b", []byte("1"))
	// tags need the tag action
	if r := n.s3(backup, "PUT", "/bkt/c", []byte("1"), "x-amz-tagging", "k=v"); r.status != 403 {
		t.Fatalf("tags without `tag`: %d", r.status)
	}
	// multipart is write-once too
	if r := n.s3(backup, "POST", "/bkt/a?uploads", nil); r.status != 403 {
		t.Fatalf("multipart over an existing key: %d", r.status)
	}
	n.must(backup, 200, "POST", "/bkt/fresh?uploads", nil)
}

func TestAnonymousReadAndCORS(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("pub", map[string]any{
		"anonymous_read": "objects", "anonymous_prefixes": []string{"open/"}, "versioning": "enabled",
		"cors": []map[string]any{{"allowed_origins": []string{"https://app.example.com"}, "allowed_methods": []string{"GET", "PUT"},
			"allowed_headers": []string{"*"}, "expose_headers": []string{"ETag"}, "max_age_seconds": 600}},
	})
	c := n.token("pub", all, nil)
	r1 := n.must(c, 200, "PUT", "/pub/open/a.txt", []byte("hello"), "Cache-Control", "max-age=60", "Content-Type", "text/html")
	n.must(c, 200, "PUT", "/pub/closed/b.txt", []byte("secret"))

	anon := func(path string, hdr ...string) *resp { return n.s3(cred{}, "GET", path, nil, hdr...) }
	r := anon("/pub/open/a.txt")
	if r.status != 200 || string(r.body) != "hello" || r.header.Get("Cache-Control") != "max-age=60" ||
		r.header.Get("Content-Security-Policy") != "sandbox" || r.header.Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("anonymous read: %d %v", r.status, r.header)
	}
	if r := anon("/pub/closed/b.txt"); r.status != 403 {
		t.Fatalf("outside anonymous_prefixes: %d", r.status)
	}
	if r := anon("/pub/open/a.txt?versionId=" + r1.header.Get("x-amz-version-id")); r.status != 403 {
		t.Fatalf("anonymous versionId: %d", r.status)
	}
	if r := anon("/pub/open/a.txt?response-content-type=x%2Fy"); r.status != 400 {
		t.Fatalf("anonymous response-* override: %d", r.status)
	}
	if r := anon("/pub?list-type=2"); r.status != 403 {
		t.Fatalf("anonymous listing: %d", r.status)
	}
	if r := n.s3(cred{}, "PUT", "/pub/open/new", []byte("x")); r.status != 403 {
		t.Fatalf("anonymous write: %d", r.status)
	}
	if r := n.s3(cred{}, "HEAD", "/pub/open/a.txt", nil); r.status != 200 {
		t.Fatalf("anonymous HEAD: %d", r.status)
	}

	// CORS: the preflight is answered before authentication
	pre := n.s3(cred{}, "OPTIONS", "/pub/open/a.txt", nil, "Origin", "https://app.example.com",
		"Access-Control-Request-Method", "PUT", "Access-Control-Request-Headers", "content-type,x-amz-meta-x")
	if pre.status != 200 || pre.header.Get("Access-Control-Allow-Origin") != "https://app.example.com" ||
		pre.header.Get("Access-Control-Max-Age") != "600" {
		t.Fatalf("preflight: %d %v", pre.status, pre.header)
	}
	if bad := n.s3(cred{}, "OPTIONS", "/pub/open/a.txt", nil, "Origin", "https://evil.example.com", "Access-Control-Request-Method", "GET"); bad.status != 403 {
		t.Fatalf("foreign origin: %d", bad.status)
	}
	if bad := n.s3(cred{}, "OPTIONS", "/pub/open/a.txt", nil, "Origin", "https://app.example.com", "Access-Control-Request-Method", "DELETE"); bad.status != 403 {
		t.Fatalf("method outside the rule: %d", bad.status)
	}
	got := anon("/pub/open/a.txt", "Origin", "https://app.example.com")
	if got.header.Get("Access-Control-Allow-Origin") != "https://app.example.com" || got.header.Get("Access-Control-Expose-Headers") != "ETag" {
		t.Fatalf("CORS headers on an actual response: %v", got.header)
	}
	n.bucket("nocors", nil)
	if bad := n.s3(cred{}, "OPTIONS", "/nocors/k", nil, "Origin", "https://app.example.com", "Access-Control-Request-Method", "GET"); bad.status != 403 {
		t.Fatalf("no rules: %d", bad.status)
	}
}

func TestSSEOverHTTP(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("enc", map[string]any{"encryption": "sse-s3"})
	c := n.token("enc", all, nil)
	plain := bytes.Repeat([]byte("confidential "), 20000)
	r := n.must(c, 200, "PUT", "/enc/doc", plain)
	if r.header.Get("x-amz-server-side-encryption") != "AES256" {
		t.Fatalf("%v", r.header)
	}
	g := n.must(c, 200, "GET", "/enc/doc", nil)
	if !bytes.Equal(g.body, plain) || g.header.Get("x-amz-server-side-encryption") != "AES256" {
		t.Fatal("round trip")
	}
	rg := n.must(c, 206, "GET", "/enc/doc", nil, "Range", "bytes=65530-65545")
	if string(rg.body) != string(plain[65530:65546]) {
		t.Fatalf("range %q", rg.body)
	}
	// nothing on disk contains the plaintext
	found := false
	_ = filepath.Walk(n.dir, func(p string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() && strings.Contains(p, "blobs") {
			raw, _ := os.ReadFile(p)
			if bytes.Contains(raw, []byte("confidential")) {
				found = true
			}
		}
		return nil
	})
	if found {
		t.Fatal("plaintext found in a blob file")
	}
	// the S3 view of the bucket configuration
	if r := n.must(c, 200, "GET", "/enc?encryption", nil); !strings.Contains(string(r.body), "AES256") {
		t.Fatalf("%s", r.body)
	}
	if r := n.s3(c, "PUT", "/enc?encryption", []byte("<x/>")); r.status != 403 {
		t.Fatalf("PutBucketEncryption must be refused: %d", r.status)
	}
	// request-level SSE in a plain bucket, KMS refused
	n.bucket("plain", nil)
	cp := n.token("plain", all, nil)
	if r := n.must(cp, 200, "PUT", "/plain/k", []byte("x"), "x-amz-server-side-encryption", "AES256"); r.header.Get("x-amz-server-side-encryption") != "AES256" {
		t.Fatal("request-level SSE ignored")
	}
	if r := n.s3(cp, "PUT", "/plain/k2", []byte("x"), "x-amz-server-side-encryption", "aws:kms"); r.status != 501 {
		t.Fatalf("KMS: %d", r.status)
	}
}

func TestBucketRulesOverHTTP(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("rul", map[string]any{"quota_bytes": 20, "max_object_bytes": 12, "allowed_content_types": []string{"text/*"}})
	c := n.token("rul", all, nil)
	n.must(c, 200, "PUT", "/rul/a", []byte("hello"))
	if r := n.s3(c, "PUT", "/rul/big", []byte("0123456789abcdef")); r.status != 400 || r.code() != "EntityTooLarge" {
		t.Fatalf("%d %s", r.status, r.code())
	}
	if r := n.s3(c, "PUT", "/rul/png", []byte("\x89PNG\r\n\x1a\n"), "Content-Type", "text/plain"); r.status != 415 || r.code() != "ContentTypeNotAllowed" {
		t.Fatalf("%d %s", r.status, r.code())
	}
	n.must(c, 200, "PUT", "/rul/b", []byte("1234567890"))
	if r := n.s3(c, "PUT", "/rul/c", []byte("1234567")); r.status != 403 || r.code() != "QuotaExceeded" {
		t.Fatalf("%d %s", r.status, r.code())
	}
}

func TestStreamingChunkedWithTrailerAndDigests(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)

	payload := bytes.Repeat([]byte("streaming payload "), 5000)
	req, _ := http.NewRequest("PUT", n.s3URL+"/bkt/stream", nil)
	req.Header.Set("Content-Encoding", "aws-chunked")
	req.Header.Set("x-amz-decoded-content-length", strconv.Itoa(len(payload)))
	req.Header.Set("x-amz-trailer", "x-amz-checksum-crc32")
	res, err := sigv4.Sign(req, c.ak, c.sk, "us-east-1", time.Now(), sigv4.StreamingPayloadTrailer, "content-encoding", "x-amz-decoded-content-length", "x-amz-trailer")
	if err != nil {
		t.Fatal(err)
	}
	trailer := http.Header{}
	trailer.Set("x-amz-checksum-crc32", "NYCymw==") // not the real CRC: the upload must be refused
	req.Body = io.NopCloser(bytes.NewReader(sigv4.EncodeStream(res, sigv4.StreamSignedTrailer, payload, 8192, trailer)))
	req.ContentLength = -1
	if r := n.do(req); r.status != 400 || r.code() != "BadDigest" {
		t.Fatalf("wrong trailer checksum: %d %s %s", r.status, r.code(), r.body)
	}
	if r := n.s3(c, "GET", "/bkt/stream", nil); r.status != 404 {
		t.Fatal("a failed upload left an object behind")
	}

	// the same upload with the right CRC32 is stored and reported
	req2, _ := http.NewRequest("PUT", n.s3URL+"/bkt/stream", nil)
	req2.Header = req.Header.Clone()
	res2, _ := sigv4.Sign(req2, c.ak, c.sk, "us-east-1", time.Now(), sigv4.StreamingPayloadTrailer, "content-encoding", "x-amz-decoded-content-length", "x-amz-trailer")
	crc := crc32IEEE(payload)
	trailer.Set("x-amz-checksum-crc32", crc)
	req2.Body = io.NopCloser(bytes.NewReader(sigv4.EncodeStream(res2, sigv4.StreamSignedTrailer, payload, 8192, trailer)))
	req2.ContentLength = -1
	r := n.do(req2)
	if r.status != 200 || r.header.Get("x-amz-checksum-crc32") != crc {
		t.Fatalf("%d %s %v", r.status, r.body, r.header)
	}
	g := n.must(c, 200, "GET", "/bkt/stream", nil, "x-amz-checksum-mode", "ENABLED")
	if !bytes.Equal(g.body, payload) || g.header.Get("x-amz-checksum-crc32") != crc {
		t.Fatal("round trip / checksum header")
	}
	if g.header.Get("Content-Encoding") != "" {
		t.Fatalf("aws-chunked leaked into the stored Content-Encoding: %q", g.header.Get("Content-Encoding"))
	}

	// Content-MD5 and signed payload hash mismatches
	if r := n.s3(c, "PUT", "/bkt/md5", []byte("data"), "Content-MD5", "AAAAAAAAAAAAAAAAAAAAAA=="); r.code() != "BadDigest" {
		t.Fatalf("%d %s", r.status, r.code())
	}
	req3, _ := http.NewRequest("PUT", n.s3URL+"/bkt/hash", strings.NewReader("data"))
	if _, err := sigv4.Sign(req3, c.ak, c.sk, "us-east-1", time.Now(), strings.Repeat("0", 64)); err != nil {
		t.Fatal(err)
	}
	if r := n.do(req3); r.code() != "XAmzContentSHA256Mismatch" {
		t.Fatalf("%d %s", r.status, r.code())
	}
}

func TestVirtualHostedStyle(t *testing.T) {
	n := startNode(t, func(c *config.Config) { c.Domain = "s3.test" })
	n.bucket("site", nil)
	c := n.token("site", all, nil)
	do := func(method, path string, body []byte) *resp {
		req, _ := http.NewRequest(method, n.s3URL+path, bytes.NewReader(body))
		req.Host = "site.s3.test"
		sum := sha256.Sum256(body)
		if _, err := sigv4.Sign(req, c.ak, c.sk, "us-east-1", time.Now(), hex.EncodeToString(sum[:])); err != nil {
			t.Fatal(err)
		}
		return n.do(req)
	}
	if r := do("PUT", "/_next/app.js", []byte("js")); r.status != 200 {
		t.Fatalf("keys starting with _ are legal in virtual-hosted style: %d %s", r.status, r.body)
	}
	if r := do("GET", "/_next/app.js", nil); r.status != 200 || string(r.body) != "js" {
		t.Fatalf("%d %s", r.status, r.body)
	}
	if r := do("GET", "/?list-type=2", nil); r.status != 200 || !strings.Contains(string(r.body), "<Key>_next/app.js</Key>") {
		t.Fatalf("%d %s", r.status, r.body)
	}
	// the same key through path style
	n.must(c, 200, "GET", "/site/_next/app.js", nil)
	// dotted bucket names are refused while a domain is set
	if code, _ := n.admin("POST", "/buckets", map[string]any{"name": "a.b"}); code != 400 {
		t.Fatalf("dotted bucket name: %d", code)
	}
}

func TestRawPathKeysSurvive(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)
	for _, key := range []string{"a//b", "x/./y", "x/../y", "plus+sign", "sp ace", "%41", "ü/ß", "trail/"} {
		enc := (&urlPath{}).enc(key)
		n.must(c, 200, "PUT", "/bkt/"+enc, []byte(key))
		if g := n.must(c, 200, "GET", "/bkt/"+enc, nil); string(g.body) != key {
			t.Fatalf("%q came back as %q", key, g.body)
		}
	}
	lst := n.must(c, 200, "GET", "/bkt?list-type=2", nil)
	for _, key := range []string{"a//b", "x/./y", "x/../y", "plus+sign", "sp ace", "%41"} {
		if !strings.Contains(string(lst.body), "<Key>"+key+"</Key>") {
			t.Fatalf("%q missing from the listing: %s", key, lst.body)
		}
	}
	if r := n.s3(c, "PUT", "/bkt/"+strings.Repeat("k", 1025), []byte("x")); r.code() != "KeyTooLongError" {
		t.Fatalf("%d %s", r.status, r.code())
	}
}

func TestRateLimits(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("lim", map[string]any{"limits": map[string]any{"requests_per_second": 2, "burst": 3}})
	c := n.token("lim", all, nil)
	ok, throttled := 0, 0
	var retry string
	for i := 0; i < 12; i++ {
		r := n.s3(c, "GET", "/lim/none", nil)
		switch {
		case r.status == 404:
			ok++
		case r.status == 503 && r.code() == "SlowDown":
			throttled++
			retry = r.header.Get("Retry-After")
		default:
			t.Fatalf("unexpected %d %s", r.status, r.code())
		}
	}
	if ok < 3 || throttled == 0 || retry == "" {
		t.Fatalf("burst 3 at 2 rps: ok=%d throttled=%d retry=%q", ok, throttled, retry)
	}
	// a token can carry its own limit too; the stricter of the two applies
	n.bucket("lim2", nil)
	tl := n.token("lim2", all, map[string]any{"limits": map[string]any{"requests_per_second": 1, "burst": 1}})
	n.s3(tl, "GET", "/lim2/none", nil)
	if r := n.s3(tl, "GET", "/lim2/none", nil); r.status != 503 {
		t.Fatalf("token limit not applied: %d", r.status)
	}
	// the metrics count it
	req, _ := http.NewRequest("GET", n.adminURL+"/_metrics", nil)
	req.Header.Set("Authorization", "Bearer "+n.adminTok)
	if m := n.do(req); !strings.Contains(string(m.body), `binvault_throttled_total{reason="rate"}`) {
		t.Fatalf("throttle metric missing:\n%s", m.body)
	}
}

func TestBandwidthLimitSlowsDownloads(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bwl", map[string]any{"limits": map[string]any{"bytes_out_per_second": 200000}})
	c := n.token("bwl", all, nil)
	n.must(c, 200, "PUT", "/bwl/blob", bytes.Repeat([]byte("x"), 400000))
	start := time.Now()
	r := n.must(c, 200, "GET", "/bwl/blob", nil)
	took := time.Since(start)
	if len(r.body) != 400000 {
		t.Fatalf("body %d", len(r.body))
	}
	// 400 kB at 200 kB/s with one second of burst: roughly a second, never instant
	if took < 700*time.Millisecond {
		t.Fatalf("download was not paced: %v", took)
	}
}

func TestControlCharacterKeysNeedURLEncodingInListings(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("ctl", nil)
	c := n.token("ctl", all, nil)
	n.must(c, 200, "PUT", "/ctl/a%01b", []byte("x")) // key contains U+0001
	if r := n.s3(c, "GET", "/ctl?list-type=2", nil); r.status != 400 || !strings.Contains(string(r.body), "encoding-type=url") {
		t.Fatalf("%d %s", r.status, r.body)
	}
	r := n.must(c, 200, "GET", "/ctl?list-type=2&encoding-type=url", nil)
	if !strings.Contains(string(r.body), "<Key>a%01b</Key>") {
		t.Fatalf("%s", r.body)
	}
}
