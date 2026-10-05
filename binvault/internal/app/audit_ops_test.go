package app_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/config"
)

// Regression tests for the operations audit (2026-10-03): admin API behaviour.

func (n *node) metrics() string {
	n.t.Helper()
	req, _ := http.NewRequest("GET", n.adminURL+"/_metrics", nil)
	req.Header.Set("Authorization", "Bearer "+n.adminTok)
	r := n.do(req)
	if r.status != 200 {
		n.t.Fatalf("/_metrics: %d", r.status)
	}
	return string(r.body)
}

func metricValue(t *testing.T, text, series string) float64 {
	t.Helper()
	m := regexp.MustCompile(`(?m)^` + regexp.QuoteMeta(series) + ` (\S+)$`).FindStringSubmatch(text)
	if m == nil {
		t.Fatalf("no series %q in:\n%s", series, text)
	}
	v, err := strconv.ParseFloat(m[1], 64)
	if err != nil {
		t.Fatal(err)
	}
	return v
}

// PUT and PATCH answer a body over 256 KiB with 413 payload_too_large, as POST does (spec §3.8, §6.1).
func TestAdminBucketBodyTooLargeIs413(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bigbody", nil)
	big := `{"anonymous_prefixes":["` + strings.Repeat("a", 300<<10) + `"]}`
	for _, m := range []string{"POST", "PUT", "PATCH"} {
		path := "/buckets/bigbody"
		if m == "POST" {
			path = "/buckets"
		}
		code, out := n.admin(m, path, big)
		if code != 413 || out["error"] != "payload_too_large" {
			t.Errorf("%s with a 300 KiB body: %d %v", m, code, out)
		}
	}
	// and a body that fits is still read in full
	n.mustAdmin(200, "PATCH", "/buckets/bigbody", map[string]any{"quota_bytes": 5})
}

// BINVAULT_BODY_IDLE_TIMEOUT applies to the admin listener too: a request that announces a body and
// then goes silent is ended instead of holding a connection forever, and the bytes that did arrive
// count as bytes in (spec §2.3, §9.2).
func TestAdminListenerBodyIdleTimeoutAndBytesIn(t *testing.T) {
	n := startNode(t, func(c *config.Config) { c.BodyIdleTimeout = 300 * time.Millisecond })

	n.mustAdmin(200, "GET", "/status", nil) // the series exists once a request has been counted
	before := metricValue(t, n.metrics(), `binvault_bytes_total{direction="in"}`)
	body := `{"name":"countedbytes"}`
	n.mustAdmin(201, "POST", "/buckets", body)
	after := metricValue(t, n.metrics(), `binvault_bytes_total{direction="in"}`)
	if got := after - before; got < float64(len(body)) {
		t.Errorf("an admin request of %d body bytes counted %v bytes in", len(body), got)
	}

	conn, err := net.Dial("tcp", n.app.AdminAddr())
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	fmt.Fprintf(conn, "POST /_admin/v1/buckets HTTP/1.1\r\nHost: x\r\nAuthorization: Bearer %s\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n0123456789", n.adminTok)
	start := time.Now()
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	buf := make([]byte, 4096)
	k, err := conn.Read(buf)
	if err != nil {
		t.Fatalf("a stalled admin body was never answered after %v: %v", time.Since(start), err)
	}
	if !bytes.HasPrefix(buf[:k], []byte("HTTP/1.1 400 ")) || !bytes.Contains(buf[:k], []byte("stopped arriving")) {
		t.Fatalf("a stalled admin body is answered 400:\n%s", buf[:k])
	}
	if d := time.Since(start); d < 250*time.Millisecond || d > 3*time.Second {
		t.Errorf("answered after %v, want about the 300ms idle timeout", d)
	}
}

// Identical settings change nothing, the revision included, with or without If-Match (spec §6.3).
func TestAdminIdenticalBucketSettingsKeepTheRevision(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("samesame", map[string]any{"versioning": "enabled", "limits": map[string]any{"requests_per_second": 5}})
	cur := n.mustAdmin(200, "GET", "/buckets/samesame", nil)
	rev := cur["revision"].(float64)
	put := map[string]any{"versioning": "enabled", "limits": map[string]any{"requests_per_second": 5}}
	for name, call := range map[string]func() map[string]any{
		"PUT": func() map[string]any { return n.mustAdmin(200, "PUT", "/buckets/samesame", put) },
		"PATCH": func() map[string]any {
			return n.mustAdmin(200, "PATCH", "/buckets/samesame", map[string]any{"versioning": "enabled"})
		},
		"PUT with If-Match": func() map[string]any {
			return n.mustAdmin(200, "PUT", "/buckets/samesame", put, "If-Match", fmt.Sprintf(`"%d"`, int(rev)))
		},
		"PATCH with If-Match": func() map[string]any {
			return n.mustAdmin(200, "PATCH", "/buckets/samesame", map[string]any{"limits": map[string]any{"requests_per_second": 5}}, "If-Match", fmt.Sprintf(`"%d"`, int(rev)))
		},
	} {
		if got := call()["revision"].(float64); got != rev {
			t.Errorf("%s with identical settings moved the revision %v -> %v", name, rev, got)
		}
	}
	// If-Match still decides when nothing would change
	if code, _ := n.admin("PUT", "/buckets/samesame", put, "If-Match", fmt.Sprintf(`"%d"`, int(rev)+7)); code != 412 {
		t.Errorf("a stale If-Match on identical settings: %d, want 412", code)
	}
	// a real change moves it by one
	if got := n.mustAdmin(200, "PATCH", "/buckets/samesame", map[string]any{"quota_bytes": 9})["revision"].(float64); got != rev+1 {
		t.Errorf("a change moves the revision to %v, want %v", got, rev+1)
	}
}

// Every timestamp is RFC 3339 UTC with millisecond precision, the create response included, and
// agrees with the list (spec §6.1).
func TestAdminTokenTimestampsAreUTCMilliseconds(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("stamps", nil)
	// an expiry in a far-away offset, with a precision the database does not keep
	exp := time.Now().Add(48 * time.Hour).In(time.FixedZone("x", 5*3600+1800)).Truncate(time.Microsecond).Format("2006-01-02T15:04:05.999999-07:00")
	created := n.mustAdmin(201, "POST", "/buckets/stamps/tokens", map[string]any{"name": "t", "grants": all, "expires_at": exp})
	list := n.mustAdmin(200, "GET", "/buckets/stamps/tokens", nil)["items"].([]any)[0].(map[string]any)
	ms := regexp.MustCompile(`^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,3})?Z$`)
	for _, f := range []string{"created_at", "expires_at"} {
		got, listed := created[f].(string), list[f].(string)
		if !ms.MatchString(got) {
			t.Errorf("%s of the create response is %q: not UTC with at most milliseconds", f, got)
		}
		if got != listed {
			t.Errorf("%s: the create says %q, the list says %q", f, got, listed)
		}
	}
	got := n.mustAdmin(200, "PATCH", "/buckets/stamps/tokens/"+created["access_key_id"].(string), map[string]any{"name": "renamed"})
	for _, f := range []string{"created_at", "expires_at"} {
		if got[f] != created[f] {
			t.Errorf("PATCH %s %v, create %v", f, got[f], created[f])
		}
	}
}

// PATCH refuses an expiry that is not in the future, like POST does; an expired token can still be
// renamed (spec §6.4).
func TestAdminPatchTokenExpiryMustBeInTheFuture(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("expiring", nil)
	tok := n.mustAdmin(201, "POST", "/buckets/expiring/tokens", map[string]any{"name": "t", "grants": all,
		"expires_at": time.Now().Add(1500 * time.Millisecond).UTC().Format(time.RFC3339Nano)})
	path := "/buckets/expiring/tokens/" + tok["access_key_id"].(string)
	past := time.Now().Add(-time.Hour).UTC().Format(time.RFC3339)
	if code, out := n.admin("PATCH", path, map[string]any{"expires_at": past}); code != 400 || out["fields"].(map[string]any)["expires_at"] == nil {
		t.Fatalf("an expiry in the past must be refused: %d %v", code, out)
	}
	n.mustAdmin(200, "PATCH", path, map[string]any{"expires_at": time.Now().Add(time.Hour).UTC().Format(time.RFC3339)})
	n.mustAdmin(200, "PATCH", path, map[string]any{"expires_at": nil}) // no expiry at all is fine
	n.mustAdmin(200, "PATCH", path, map[string]any{"expires_at": time.Now().Add(1200 * time.Millisecond).UTC().Format(time.RFC3339Nano)})
	time.Sleep(1300 * time.Millisecond)
	// expired now: editing the name keeps the expiry it has and is allowed
	n.mustAdmin(200, "PATCH", path, map[string]any{"name": "still editable"})
}

// A bucket with no pipelines lists none; GET /config shows the non-secret settings (spec §6.2, §6.3).
func TestAdminBucketPipelinesAndConfigAreComplete(t *testing.T) {
	n := startNode(t, func(c *config.Config) {
		c.TrustedProxies = nil
	})
	n.bucket("nopipes", nil)
	b := n.mustAdmin(200, "GET", "/buckets/nopipes", nil)
	if p, ok := b["pipelines"].([]any); !ok || len(p) != 0 {
		t.Fatalf("pipelines of a bucket with none: %v", b["pipelines"])
	}
	code, cfg := n.admin("GET", "/config", nil)
	if code != 200 {
		t.Fatal(code)
	}
	for _, k := range []string{"data_dir", "trusted_proxies", "tls", "admin_tls", "admin_insecure_http", "pipeline_ca_file"} {
		if _, ok := cfg[k]; !ok {
			t.Errorf("GET /config lacks %s: %v", k, cfg)
		}
	}
	if cfg["data_dir"] != n.dir {
		t.Errorf("data_dir %v, want %s", cfg["data_dir"], n.dir)
	}
	raw, _ := json.Marshal(cfg)
	for _, secret := range []string{n.adminTok} {
		if bytes.Contains(raw, []byte(secret)) {
			t.Errorf("GET /config shows a secret: %s", raw)
		}
	}
	if _, ok := cfg["cluster_urls"]; ok {
		t.Errorf("a single node reports cluster settings: %v", cfg)
	}
}

// What the admin API says about a bad body is about the body, not about Go (spec §6.1).
func TestAdminErrorsDoNotLeakGoInternals(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("detail", nil)
	cases := []struct {
		method, path string
		body         any
		field        string // the field that must be named
	}{
		{"POST", "/buckets", `{"name":"abcd","quota_bytes":"x"}`, "quota_bytes"},
		{"POST", "/buckets", `{"name":"abcd","lifecycle":"x"}`, "lifecycle"},
		{"POST", "/buckets", `{"name":"abcd","cors":[{"allowed_origins":5}]}`, "cors.allowed_origins"},
		{"POST", "/buckets", `{"name":"abcd","limits":{"burst":"a"}}`, "limits.burst"},
		{"POST", "/buckets", `[1]`, ""},
		{"PUT", "/buckets/detail", `"str"`, ""},
		{"POST", "/buckets/detail/tokens", `{"name":"t","grants":"x"}`, "grants"},
		{"POST", "/buckets/detail/tokens", `{"name":"t","grants":[{"actions":["read"],"keys":["a*b"]}]}`, "grants"},
		{"POST", "/buckets/detail/tokens", `{"name":"t","grants":[{"actions":["read"]}],"expires_at":"nope"}`, ""},
		{"POST", "/buckets", `{"name":"Bad_Name"}`, "name"},
		{"POST", "/buckets", `{"name":"okname","allowed_content_types":["bad"]}`, "allowed_content_types"},
	}
	leaks := regexp.MustCompile(`createBody|tokenBody|Settings|CORSRule|Limits\b|meta\.|admin\.|Go struct|Go value|keypat|\[\]string|reflect|json:|InvalidBucketName|InvalidArgument|InvalidTag|2006-01-02`)
	for _, c := range cases {
		code, out := n.admin(c.method, c.path, c.body)
		if code != 400 {
			t.Errorf("%s %s %v: %d %v", c.method, c.path, c.body, code, out)
			continue
		}
		text, _ := json.Marshal(out)
		if m := leaks.Find(text); m != nil {
			t.Errorf("%s %v leaks %q: %s", c.method, c.body, m, text)
		}
		if c.field != "" {
			if f, _ := out["fields"].(map[string]any); f[c.field] == nil {
				t.Errorf("%v: the problem is not attributed to %q: %s", c.body, c.field, text)
			}
		}
	}
}

// ?force=1 used to be read as false without a word (spec §6.1): the switches are true or false.
func TestAdminBooleanParametersAreStrict(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("strictbool", nil)
	c := n.token("strictbool", all, nil)
	n.must(c, 200, "PUT", "/strictbool/k", []byte("x"))
	for _, q := range []string{"?force=1", "?force=yes", "?force=", "?force=TRUE", "?stats=1", "?force=true&force=1"} {
		path := "/buckets/strictbool" + q
		method := "DELETE"
		if strings.HasPrefix(q, "?stats") {
			path, method = "/buckets"+q, "GET"
		}
		if code, out := n.admin(method, path, nil); code != 400 || out["error"] != "invalid_request" {
			t.Errorf("%s %s: %d %v, want 400", method, path, code, out)
		}
	}
	if code, _ := n.admin("GET", "/buckets/strictbool", nil); code != 200 {
		t.Fatal("the bucket must have survived the refused deletes")
	}
	n.mustAdmin(200, "GET", "/buckets?stats=false", nil)
	n.mustAdmin(200, "GET", "/buckets?stats=true", nil)
	if code, _ := n.admin("DELETE", "/buckets/strictbool?force=false", nil); code != 409 {
		t.Errorf("force=false on a bucket with objects: %d, want 409", code)
	}
	n.mustAdmin(204, "DELETE", "/buckets/strictbool?force=true", nil)
}

// BINVAULT_METRICS_PER_BUCKET=false keeps the three per-bucket families as node-wide sums instead of
// dropping them, and the lifecycle counter loses its bucket label (spec §9.2).
func TestMetricsWithoutPerBucketLabels(t *testing.T) {
	n := startNode(t, func(c *config.Config) { c.MetricsPerBucket = false })
	for _, name := range []string{"sumone", "sumtwo"} {
		n.bucket(name, nil)
		c := n.token(name, all, nil)
		n.must(c, 200, "PUT", "/"+name+"/a", []byte("12345"))
		n.must(c, 200, "PUT", "/"+name+"/b", []byte("123"))
	}
	m := n.metrics()
	for series, want := range map[string]float64{"binvault_objects": 4, "binvault_object_versions": 4, "binvault_stored_bytes": 16} {
		if got := metricValue(t, m, series); got != want {
			t.Errorf("%s = %v, want %v", series, got, want)
		}
	}
	if strings.Contains(m, `bucket="`) {
		t.Errorf("a bucket label is left with BINVAULT_METRICS_PER_BUCKET=false:\n%s", m)
	}

	// and with it on, the per-bucket series are there
	n2 := startNode(t, nil)
	n2.bucket("perone", nil)
	if m := n2.metrics(); !strings.Contains(m, `binvault_objects{bucket="perone"} 0`) {
		t.Errorf("per-bucket series missing:\n%s", m)
	}
}

// /_healthz is unauthenticated: it names the failing check and nothing else (no paths, no driver
// text), the detail goes to the log (spec §9.3).
func TestHealthzNamesOnlyTheFailingCheck(t *testing.T) {
	// low disk space: a node that insists on more free space than any disk has
	cfg := cfgFor(t.TempDir(), key32())
	cfg.MinFreeMB = 1 << 40
	low, _ := runNode(t, cfg, io.Discard)
	r := low.s3(cred{}, "GET", "/_healthz", nil)
	if r.status != 503 || strings.TrimSpace(string(r.body)) != "low disk space" {
		t.Fatalf("low disk space: %d %q", r.status, r.body)
	}

	// a data dir the process cannot write to (root can write anywhere: skipped there)
	if os.Geteuid() == 0 {
		t.Skip("root writes to a read-only directory")
	}
	dir := t.TempDir()
	cfg = cfgFor(dir, key32())
	cfg.MinFreeMB = 1
	logs := &syncBuf{}
	n, _ := runNode(t, cfg, logs)
	if r := n.s3(cred{}, "GET", "/_healthz", nil); r.status != 200 {
		t.Fatalf("%d %s", r.status, r.body)
	}
	if err := os.Chmod(dir, 0o500); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(dir, 0o700) })
	r = n.s3(cred{}, "GET", "/_healthz", nil)
	if r.status != 503 || strings.TrimSpace(string(r.body)) != "data dir not writable" {
		t.Fatalf("data dir not writable: %d %q", r.status, r.body)
	}
	if strings.Contains(string(r.body), dir) || strings.Contains(string(r.body), ".probe") {
		t.Fatalf("the health answer leaks a path: %q", r.body)
	}
	if l := logs.String(); !strings.Contains(l, "the data dir is not writable") || !strings.Contains(l, ".probe-") {
		t.Errorf("the detail must be logged:\n%s", l)
	}
}

// Only the exact paths are the service endpoints; an anonymous GET / is AccessDenied as on S3; /_version
// reports the Go version `binvault version` prints (spec §2.4).
func TestReservedPathsAreExact(t *testing.T) {
	n := startNode(t, nil)
	for _, p := range []string{"/_healthz/anything", "/_version/anything", "/_healthz/", "/_nothing"} {
		if r := n.s3(cred{}, "GET", p, nil); r.status != 404 {
			t.Errorf("GET %s: %d, want 404", p, r.status)
		}
	}
	for _, p := range []string{"/_healthz", "/_version", "/_healthz?probe=1"} {
		if r := n.s3(cred{}, "GET", p, nil); r.status != 200 {
			t.Errorf("GET %s: %d, want 200", p, r.status)
		}
	}
	r := n.s3(cred{}, "GET", "/_version", nil)
	var v map[string]string
	if err := json.Unmarshal(r.body, &v); err != nil || v["version"] != "test" || !strings.HasPrefix(v["go"], "go1.") {
		t.Fatalf("/_version: %s %v", r.body, err)
	}
	r = n.s3(cred{}, "GET", "/", nil)
	if r.status != 403 || r.code() != "AccessDenied" {
		t.Fatalf("an anonymous GET /: %d %s, want 403 AccessDenied", r.status, r.code())
	}
}

// In a cluster GET /config adds the cluster settings, and never a key (spec §6.2).
func TestAdminConfigShowsTheClusterSettingsButNoKeys(t *testing.T) {
	tc := startCluster(t, 2, nil)
	a := tc.nodes[0]
	code, cfg := a.admin("GET", "/config", nil)
	if code != 200 || cfg["cluster"] != true {
		t.Fatalf("%d %v", code, cfg)
	}
	if cfg["node_name"] != a.name || len(cfg["cluster_urls"].([]any)) != 2 || cfg["cluster_insecure_http"] != true ||
		cfg["cluster_pull_interval"] != "25ms" || cfg["cluster_startup_fence"] != "3s" || cfg["move_streams"] == nil || cfg["cluster_listen"] == nil {
		t.Errorf("cluster settings: %v", cfg)
	}
	raw, _ := json.Marshal(cfg)
	for _, secret := range []string{tc.key, tc.adminTok} {
		if bytes.Contains(raw, []byte(secret)) {
			t.Errorf("GET /config shows a secret: %s", raw)
		}
	}
}
