package admin

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/zonewright/internal/bindctl"
	"github.com/kalevski/toolcase/zonewright/internal/config"
	"github.com/kalevski/toolcase/zonewright/internal/manager"
	"github.com/kalevski/toolcase/zonewright/internal/state"
	"github.com/kalevski/toolcase/zonewright/internal/store"
	"github.com/kalevski/toolcase/zonewright/internal/zonefile"
)

// harness is a full daemon minus named: real config files on disk, the real
// engine, and a fake command runner standing in for named-checkzone / rndc.
type harness struct {
	t       *testing.T
	dir     string
	handler http.Handler
	mgr     *manager.Manager
	repl    *store.Store
	// rejectValue makes the fake named-checkzone fail any zone whose file
	// contains this string.
	rejectValue string
}

const mainConfig = `
data_dir: %DIR%
bind:
  check_zone_cmd: [checkzone]
  check_conf_cmd: []
  reload_cmd: [reload]
defaults:
  nameservers: [ns1.example.net, ns2.example.net]
include:
  - zones.d/*.yml
zones:
  - name: static.org
    records:
      - {name: www, type: A, value: 192.0.2.50}
`

func newHarness(t *testing.T, token string) *harness {
	t.Helper()
	h := &harness{t: t, dir: t.TempDir()}
	if err := os.MkdirAll(filepath.Join(h.dir, "zones.d"), 0o750); err != nil {
		t.Fatal(err)
	}
	cfgPath := filepath.Join(h.dir, "config.yml")
	if err := os.WriteFile(cfgPath, []byte(strings.ReplaceAll(mainConfig, "%DIR%", h.dir)), 0o640); err != nil {
		t.Fatal(err)
	}
	res, err := config.Load(cfgPath)
	if err != nil {
		t.Fatal(err)
	}
	serials, err := state.NewStore(h.dir)
	if err != nil {
		t.Fatal(err)
	}
	// Pinned clock: zone serials start at the day's YYYYMMDD00, and the
	// assertions below spell out serials for this date.
	repl, err := store.Open(filepath.Join(h.dir, "zonewright.db"), func() time.Time {
		return time.Date(2026, 9, 25, 12, 0, 0, 0, time.UTC)
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { repl.Close() })
	h.repl = repl
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	run := func(_ context.Context, argv []string) (string, error) {
		if argv[0] == "checkzone" && h.rejectValue != "" {
			body, _ := os.ReadFile(argv[2])
			if strings.Contains(string(body), h.rejectValue) {
				return "zone " + argv[1] + "/IN: loading from master file failed", errors.New("exit status 1")
			}
		}
		return "", nil
	}
	eng := bindctl.NewWithRunner(log, run, func() time.Time { return time.Date(2026, 9, 25, 0, 0, 0, 0, time.UTC) })
	h.mgr = manager.New(res.Config, serials, repl, eng, log)
	h.mgr.Apply(context.Background())
	reload := func(ctx context.Context) (bindctl.ApplyResult, error) {
		r, err := config.Load(cfgPath)
		if err != nil {
			return bindctl.ApplyResult{}, err
		}
		return h.mgr.Reload(ctx, r.Config), nil
	}
	h.handler = New(h.mgr, token, log, reload).Routes()
	return h
}

func (h *harness) do(method, path, body string) (int, string) {
	h.t.Helper()
	var r io.Reader
	if body != "" {
		r = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, r)
	req.Host = "127.0.0.1:9053"
	rec := httptest.NewRecorder()
	h.handler.ServeHTTP(rec, req)
	return rec.Code, rec.Body.String()
}

func (h *harness) zoneFile(zone string) string {
	body, _ := os.ReadFile(zonefile.Path(h.mgr.Config(), zone))
	return string(body)
}

const exampleZone = `
zones:
  - name: example.com
    records:
      - {name: "@", type: A, value: 192.0.2.1}
      - {name: www, type: CNAME, value: "@"}
`

func TestZoneLifecycle(t *testing.T) {
	h := newHarness(t, "")

	// serial = base + one per change: create + 2 RRsets.
	code, body := h.do("POST", "/zones", exampleZone)
	if code != http.StatusCreated || !strings.Contains(body, `"serial": 2026092503`) {
		t.Fatalf("create: %d %s", code, body)
	}
	if !strings.Contains(h.zoneFile("example.com"), "www\t3600\tIN\tCNAME\t@") {
		t.Fatalf("zone file:\n%s", h.zoneFile("example.com"))
	}
	if _, ok, _ := h.repl.Zone("example.com"); !ok {
		t.Fatal("zone not in the replicated store")
	}

	code, body = h.do("GET", "/zones/example.com", "")
	if code != 200 || !strings.Contains(body, `"managed": true`) || !strings.Contains(body, `"state": "active"`) {
		t.Fatalf("get: %d %s", code, body)
	}

	// Re-POST of identical content → 200 unchanged: nothing is committed
	// and the serial does not move (idempotent for sync clients).
	code, body = h.do("POST", "/zones", exampleZone)
	if code != http.StatusOK || !strings.Contains(body, `"unchanged"`) || !strings.Contains(body, `"serial": 2026092503`) {
		t.Fatalf("replace: %d %s", code, body)
	}

	code, body = h.do("GET", "/zones/example.com/file", "")
	if code != 200 || !strings.Contains(body, "2026092503\t; serial") {
		t.Fatalf("file: %d %s", code, body)
	}

	code, _ = h.do("DELETE", "/zones/example.com", "")
	if code != 200 {
		t.Fatalf("delete: %d", code)
	}
	if _, err := os.Stat(zonefile.Path(h.mgr.Config(), "example.com")); !os.IsNotExist(err) {
		t.Fatal("zone file should be removed")
	}
	if code, _ = h.do("DELETE", "/zones/example.com", ""); code != 404 {
		t.Fatalf("second delete: %d", code)
	}
}

func TestCreateZoneRejectsInvalid(t *testing.T) {
	h := newHarness(t, "")
	cases := map[string]string{
		"two zones":   "zones:\n  - name: a.com\n  - name: b.com\n",
		"unknown key": "zones:\n  - name: a.com\n    bogus: 1\n",
		"bad record":  "zones:\n  - name: a.com\n    records:\n      - {name: www, type: A, value: nope}\n",
		"cname apex":  "zones:\n  - name: a.com\n    records:\n      - {name: \"@\", type: CNAME, value: x.org}\n",
		"ambiguous":   "zones:\n  - name: a.com\n    records:\n      - {name: www.a.com, type: A, value: 192.0.2.1}\n",
		"main config": "zones:\n  - name: static.org\n",
	}
	for name, body := range cases {
		code, resp := h.do("POST", "/zones", body)
		if code < 400 || code >= 500 {
			t.Errorf("%s: want 4xx, got %d %s", name, code, resp)
		}
	}
	if n := h.repl.Stats().Ops; n != 0 {
		t.Fatalf("rejected writes must never be committed: %d ops in the log", n)
	}
}

// When named-checkzone refuses the zone, the fragment is rolled back, the
// previous content keeps serving and the caller sees the checker's reason.
func TestBindRejectionRollsBack(t *testing.T) {
	h := newHarness(t, "")
	if code, body := h.do("POST", "/zones", exampleZone); code != 201 {
		t.Fatalf("%d %s", code, body)
	}
	before := h.repl.Stats().Ops

	h.rejectValue = "192.0.2.66"
	code, body := h.do("POST", "/zones/example.com/records", `{"name":"api","type":"A","value":"192.0.2.66"}`)
	if code != http.StatusUnprocessableEntity || !strings.Contains(body, "loading from master file failed") {
		t.Fatalf("want 422 with checker output, got %d %s", code, body)
	}
	if after := h.repl.Stats().Ops; after != before {
		t.Fatalf("a change BIND rejected was committed: %d → %d ops", before, after)
	}
	if strings.Contains(h.zoneFile("example.com"), "192.0.2.66") {
		t.Fatal("rejected content went live")
	}
	if z, _, _ := h.repl.Zone("example.com"); len(z.Records) != 2 {
		t.Fatalf("stored zone changed: %+v", z.Records)
	}
	// And the zone is healthy again, not left "stale".
	_, st := h.do("GET", "/status", "")
	if !strings.Contains(st, `"state": "active"`) || strings.Contains(st, "stale") {
		t.Fatalf("status after rollback: %s", st)
	}

	// A brand-new zone BIND refuses is not created at all.
	code, _ = h.do("POST", "/zones", "zones:\n  - name: bad.com\n    records:\n      - {name: x, type: A, value: 192.0.2.66}\n")
	if code != 422 {
		t.Fatalf("new rejected zone: %d", code)
	}
	if _, ok, _ := h.repl.Zone("bad.com"); ok {
		t.Fatal("rejected new zone was created")
	}
}

func TestRecordEndpoints(t *testing.T) {
	h := newHarness(t, "")
	h.do("POST", "/zones", exampleZone)

	// Add.
	code, body := h.do("POST", "/zones/example.com/records", `{"name":"api","type":"a","value":"192.0.2.10","ttl":"5m"}`)
	if code != 201 || !strings.Contains(body, `"serial": 2026092504`) {
		t.Fatalf("add: %d %s", code, body)
	}
	if !strings.Contains(h.zoneFile("example.com"), "api\t300\tIN\tA\t192.0.2.10") {
		t.Fatalf("zone file:\n%s", h.zoneFile("example.com"))
	}
	// Duplicate → 409.
	if code, _ = h.do("POST", "/zones/example.com/records", `{"name":"api","type":"A","value":"192.0.2.10","ttl":300}`); code != 409 {
		t.Fatalf("dup: %d", code)
	}
	// Unknown field → 400.
	if code, _ = h.do("POST", "/zones/example.com/records", `{"name":"x","type":"A","value":"192.0.2.1","prio":1}`); code != 400 {
		t.Fatalf("unknown field: %d", code)
	}
	// Adding an A where a CNAME lives → 400 via full validation.
	if code, _ = h.do("POST", "/zones/example.com/records", `{"name":"www","type":"A","value":"192.0.2.1"}`); code != 400 {
		t.Fatalf("cname conflict: %d", code)
	}

	// Replace the RRset with two records (name/type from the path).
	code, body = h.do("PUT", "/zones/example.com/records/api/A", `{"records":[{"value":"192.0.2.20","ttl":60},{"value":"192.0.2.21","ttl":60}]}`)
	if code != 200 {
		t.Fatalf("put: %d %s", code, body)
	}
	zf := h.zoneFile("example.com")
	if strings.Contains(zf, "192.0.2.10") || !strings.Contains(zf, "api\t60\tIN\tA\t192.0.2.20") || !strings.Contains(zf, "api\t60\tIN\tA\t192.0.2.21") {
		t.Fatalf("put result:\n%s", zf)
	}
	// Path/body mismatch → 400.
	if code, _ = h.do("PUT", "/zones/example.com/records/api/A", `{"records":[{"name":"other","value":"192.0.2.1"}]}`); code != 400 {
		t.Fatalf("mismatch: %d", code)
	}

	// Filtered list.
	code, body = h.do("GET", "/zones/example.com/records?name=api&type=a", "")
	var list struct {
		Records []config.Record `json:"records"`
	}
	_ = json.Unmarshal([]byte(body), &list)
	if code != 200 || len(list.Records) != 2 {
		t.Fatalf("list: %d %s", code, body)
	}

	// Delete one value, then the rest of the RRset.
	if code, body = h.do("DELETE", "/zones/example.com/records/api/A?value=192.0.2.20", ""); code != 200 {
		t.Fatalf("delete value: %d %s", code, body)
	}
	if strings.Contains(h.zoneFile("example.com"), "192.0.2.20") {
		t.Fatal("value not deleted")
	}
	if code, _ = h.do("DELETE", "/zones/example.com/records/api/A", ""); code != 200 {
		t.Fatalf("delete rrset: %d", code)
	}
	if code, _ = h.do("DELETE", "/zones/example.com/records/api/A", ""); code != 404 {
		t.Fatalf("delete missing: %d", code)
	}

	// TXT via PUT on the apex ("@" in the path) — the ACME DNS-01 shape.
	code, body = h.do("PUT", "/zones/example.com/records/_acme-challenge/TXT", `{"records":[{"value":"tok\"en"}]}`)
	if code != 200 || !strings.Contains(h.zoneFile("example.com"), `_acme-challenge	3600	IN	TXT	"tok\"en"`) {
		t.Fatalf("txt: %d %s\n%s", code, body, h.zoneFile("example.com"))
	}

	// A re-sent identical RRset commits nothing (idempotent sync).
	ops := h.repl.Stats().Ops
	if code, body = h.do("PUT", "/zones/example.com/records/_acme-challenge/TXT", `{"records":[{"value":"tok\"en"}]}`); code != 200 || !strings.Contains(body, `"unchanged"`) {
		t.Fatalf("idempotent put: %d %s", code, body)
	}
	if h.repl.Stats().Ops != ops {
		t.Fatal("an identical PUT created ops")
	}
}

func TestMainConfigZonesAreReadOnly(t *testing.T) {
	h := newHarness(t, "")
	code, body := h.do("GET", "/zones/static.org", "")
	if code != 200 || !strings.Contains(body, `"managed": false`) {
		t.Fatalf("%d %s", code, body)
	}
	if code, _ = h.do("POST", "/zones/static.org/records", `{"name":"x","type":"A","value":"192.0.2.1"}`); code != 409 {
		t.Fatalf("records on main-config zone: %d", code)
	}
	if code, _ = h.do("DELETE", "/zones/static.org", ""); code != 409 {
		t.Fatalf("delete main-config zone: %d", code)
	}
}

func TestAuth(t *testing.T) {
	h := newHarness(t, "s3cret")
	if code, _ := h.do("GET", "/healthz", ""); code != 200 {
		t.Fatalf("healthz must be open: %d", code)
	}
	if code, _ := h.do("GET", "/zones", ""); code != 401 {
		t.Fatalf("no token: %d", code)
	}
	req := httptest.NewRequest("GET", "/zones", nil)
	req.Host = "zonewright:9053" // any Host is fine once a token is required
	req.Header.Set("Authorization", "Bearer s3cret")
	rec := httptest.NewRecorder()
	h.handler.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("with token: %d", rec.Code)
	}
}

func TestUnknownZone404(t *testing.T) {
	h := newHarness(t, "")
	for _, p := range []string{"/zones/nope.com", "/zones/nope.com/file", "/zones/nope.com/records"} {
		if code, _ := h.do("GET", p, ""); code != 404 {
			t.Errorf("%s: %d", p, code)
		}
	}
}

// A browser can send a cross-site text/plain POST without a CORS preflight;
// any request carrying browser fetch metadata must be refused before it
// reaches a handler (CSRF).
func TestRejectsBrowserRequests(t *testing.T) {
	h := newHarness(t, "")
	for _, hdr := range [][2]string{{"Origin", "https://evil.example"}, {"Sec-Fetch-Site", "cross-site"}, {"Sec-Fetch-Mode", "no-cors"}} {
		req := httptest.NewRequest("POST", "/zones", strings.NewReader(exampleZone))
		req.Host = "127.0.0.1:9053"
		req.Header.Set("Content-Type", "text/plain")
		req.Header.Set(hdr[0], hdr[1])
		rec := httptest.NewRecorder()
		h.handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Errorf("%s: want 403, got %d", hdr[0], rec.Code)
		}
	}
	if h.mgr.Config().FindZone("example.com") >= 0 {
		t.Fatal("a forged request created a zone")
	}
}

// Without a token, a foreign Host header (DNS rebinding) is refused; loopback
// spellings are accepted.
func TestTokenlessHostPinning(t *testing.T) {
	h := newHarness(t, "")
	cases := map[string]int{
		"rebind.evil.example:9053": 403, "10.0.0.5:9053": 403,
		"127.0.0.1:9053": 200, "localhost:9053": 200, "[::1]:9053": 200, "localhost": 200,
	}
	for host, want := range cases {
		req := httptest.NewRequest("GET", "/zones", nil)
		req.Host = host
		rec := httptest.NewRecorder()
		h.handler.ServeHTTP(rec, req)
		if rec.Code != want {
			t.Errorf("Host %s: want %d, got %d", host, want, rec.Code)
		}
	}
}

func TestPutZone(t *testing.T) {
	h := newHarness(t, "")
	// Create from a bare zone object (name comes from the path), JSON body.
	code, body := h.do("PUT", "/zones/example.org", `{"ttl":"10m","records":[{"name":"@","type":"A","value":"192.0.2.1"},{"name":"old","type":"A","value":"192.0.2.2"}]}`)
	if code != 201 {
		t.Fatalf("create: %d %s", code, body)
	}
	// Replace: "old" disappears (tombstone), "new" appears, TTL changes.
	code, body = h.do("PUT", "/zones/example.org", "ttl: 20m\nrecords:\n  - {name: \"@\", type: A, value: 192.0.2.1}\n  - {name: new, type: A, value: 192.0.2.3}\n")
	if code != 200 || !strings.Contains(body, `"updated"`) {
		t.Fatalf("replace: %d %s", code, body)
	}
	zf := h.zoneFile("example.org")
	if strings.Contains(zf, "old\t") || !strings.Contains(zf, "new\t1200\tIN\tA\t192.0.2.3") || !strings.Contains(zf, "$TTL 1200") {
		t.Fatalf("zone file after replace:\n%s", zf)
	}
	if code, _ = h.do("PUT", "/zones/example.org", `{"name":"other.org"}`); code != 400 {
		t.Fatalf("name mismatch: %d", code)
	}
	if code, _ = h.do("PUT", "/zones/static.org", `{}`); code != 409 {
		t.Fatalf("PUT on a local zone: %d", code)
	}
}

func TestETagIfMatch(t *testing.T) {
	h := newHarness(t, "")
	h.do("POST", "/zones", exampleZone)
	req := httptest.NewRequest("GET", "/zones/example.com", nil)
	req.Host = "127.0.0.1"
	rec := httptest.NewRecorder()
	h.handler.ServeHTTP(rec, req)
	etag := rec.Header().Get("ETag")
	if etag == "" {
		t.Fatal("GET /zones/{zone} must return an ETag")
	}
	write := func(match string) int {
		req := httptest.NewRequest("POST", "/zones/example.com/records", strings.NewReader(`{"name":"n`+strconv.Itoa(len(match))+`","type":"A","value":"192.0.2.1"}`))
		req.Host = "127.0.0.1"
		req.Header.Set("If-Match", match)
		rec := httptest.NewRecorder()
		h.handler.ServeHTTP(rec, req)
		return rec.Code
	}
	if c := write(etag); c != 201 {
		t.Fatalf("matching If-Match: %d", c)
	}
	if c := write(etag); c != 412 { // the first write changed the zone
		t.Fatalf("stale If-Match: %d", c)
	}
	if c := write("*"); c != 201 {
		t.Fatalf("If-Match *: %d", c)
	}
}

func TestWaitReplicatedSingleNode(t *testing.T) {
	h := newHarness(t, "")
	code, body := h.do("POST", "/zones?wait=replicated", exampleZone)
	if code != 201 || !strings.Contains(body, `"replicated": true`) || !strings.Contains(body, `"op": "n-`) {
		t.Fatalf("%d %s", code, body)
	}
}
