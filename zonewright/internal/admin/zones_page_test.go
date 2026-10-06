package admin

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/zonewright/internal/config"
)

// mkZones creates replicated zones z<name>.test with n records each.
func mkZones(t *testing.T, h *harness, names ...string) {
	t.Helper()
	for _, n := range names {
		body := "zones:\n  - name: " + n + "\n    records:\n      - {name: www, type: A, value: 192.0.2.1}\n      - {name: www, type: A, value: 192.0.2.2}\n      - {name: api, type: A, value: 192.0.2.3}\n"
		if code, out := h.do("POST", "/zones", body); code != http.StatusCreated {
			t.Fatalf("create %s: %d %s", n, code, out)
		}
	}
}

type zonesPage struct {
	Zones      []map[string]any `json:"zones"`
	NextCursor *string          `json:"next_cursor"`
	Total      *int             `json:"total"`
}

func getPage(t *testing.T, h *harness, path string) zonesPage {
	t.Helper()
	code, body := h.do("GET", path, "")
	if code != http.StatusOK {
		t.Fatalf("%s: %d %s", path, code, body)
	}
	var p zonesPage
	if err := json.Unmarshal([]byte(body), &p); err != nil {
		t.Fatal(err)
	}
	return p
}

func names(p zonesPage) []string {
	var out []string
	for _, z := range p.Zones {
		out = append(out, z["name"].(string))
	}
	return out
}

func TestZonesPagination(t *testing.T) {
	h := newHarness(t, "")
	mkZones(t, h, "d.test", "b.test", "e.test", "a.test") // plus static.org

	// First page: stable name order, not config order.
	p1 := getPage(t, h, "/zones?view=summary&limit=2")
	if got := strings.Join(names(p1), ","); got != "a.test,b.test" || p1.NextCursor == nil || p1.Total == nil || *p1.Total != 5 {
		t.Fatalf("page 1: %s next=%v total=%v", got, p1.NextCursor, p1.Total)
	}
	// Middle page, with a zone inserted between pages: sorts before the
	// cursor, so it must not shift the page.
	mkZones(t, h, "aa.test")
	p2 := getPage(t, h, "/zones?view=summary&limit=2&cursor="+*p1.NextCursor)
	if got := strings.Join(names(p2), ","); got != "d.test,e.test" || p2.NextCursor == nil || *p2.Total != 6 {
		t.Fatalf("page 2: %s next=%v", got, p2.NextCursor)
	}
	// Insert before the next cursor (dd < e): nothing repeats or is skipped.
	mkZones(t, h, "dd.test")
	p3 := getPage(t, h, "/zones?view=summary&limit=2&cursor="+*p2.NextCursor)
	// Order: a, aa, b, d, dd, e, static.org: after "e.test" only static.org is left.
	if got := strings.Join(names(p3), ","); got != "static.org" || p3.NextCursor != nil {
		t.Fatalf("last page: %s next=%v", got, p3.NextCursor)
	}
	// null on the last page is explicit in the JSON.
	if _, body := h.do("GET", "/zones?view=summary&limit=500", ""); !strings.Contains(body, `"next_cursor":null`) || !strings.Contains(body, `"total":7`) {
		t.Fatalf("limit=500: %s", body)
	}
	// cursor without limit: everything after it, no next page.
	all := getPage(t, h, "/zones?view=summary&cursor="+*p1.NextCursor)
	if len(all.Zones) != 4 || all.NextCursor != nil {
		t.Fatalf("cursor only: %v", names(all))
	}
	// Full view pages too, and keeps the records.
	full := getPage(t, h, "/zones?limit=1")
	if _, ok := full.Zones[0]["records"]; !ok || len(full.Zones) != 1 {
		t.Fatalf("full page: %v", full.Zones)
	}
}

func TestZonesBadParams(t *testing.T) {
	h := newHarness(t, "")
	for _, q := range []string{
		"/zones?limit=0", "/zones?limit=501", "/zones?limit=x", "/zones?limit=",
		"/zones?cursor=!!!", "/zones?cursor=e30", // not base64 / no "after"
		"/zones?view=tiny",
		"/zones/static.org/records?limit=0", "/zones/static.org/records?cursor=e30",
		// a zone cursor is not a record cursor (key arity differs)
		"/zones/static.org/records?cursor=eyJhZnRlciI6WyJhIl19",
	} {
		code, body := h.do("GET", q, "")
		if code != http.StatusBadRequest || !strings.Contains(body, `"error"`) {
			t.Errorf("%s: %d %s", q, code, body)
		}
	}
}

func TestZonesSummaryView(t *testing.T) {
	h := newHarness(t, "")
	mkZones(t, h, "a.test")
	code, body := h.do("GET", "/zones?view=summary", "")
	if code != 200 || strings.Contains(body, `"records"`) || strings.Contains(body, "next_cursor") || strings.Contains(body, `"total"`) {
		t.Fatalf("summary: %d %s", code, body)
	}
	var p zonesPage
	_ = json.Unmarshal([]byte(body), &p)
	if len(p.Zones) != 2 {
		t.Fatalf("zones: %s", body)
	}
	byName := map[string]map[string]any{}
	for _, z := range p.Zones {
		byName[z["name"].(string)] = z
	}
	z := byName["a.test"]
	if z["record_count"] != float64(3) || z["state"] != "active" || z["source"] != "replicated" || z["managed"] != true || z["serial"] == nil || z["etag"] == "" {
		t.Fatalf("a.test summary: %v", z)
	}
	if s := byName["static.org"]; s["source"] != "local" || s["managed"] != false || s["record_count"] != float64(1) {
		t.Fatalf("static.org summary: %v", s)
	}
	// The summary ETag is the zone's own ETag, replicated and local.
	for name, z := range byName {
		_, one := h.do("GET", "/zones/"+name, "")
		var v map[string]any
		_ = json.Unmarshal([]byte(one), &v)
		if v["etag"] != z["etag"] || v["serial"] != z["serial"] {
			t.Errorf("%s: summary %v vs zone %v/%v", name, z["etag"], v["etag"], v["serial"])
		}
	}
}

func TestSummaryETagCacheInvalidation(t *testing.T) {
	h := newHarness(t, "")
	mkZones(t, h, "a.test", "b.test")
	etags := func() map[string]string {
		p := getPage(t, h, "/zones?view=summary")
		out := map[string]string{}
		for _, z := range p.Zones {
			out[z["name"].(string)] = z["etag"].(string)
		}
		return out
	}
	e1, e2 := etags(), etags()
	for n, e := range e1 {
		if e2[n] != e {
			t.Fatalf("%s: etag unstable across calls", n)
		}
	}
	// Cached values equal the uncached definition.
	eff, _ := h.mgr.Effective()
	for i := range eff.Zones {
		if want := h.mgr.ETag(&eff.Zones[i]); e1[eff.Zones[i].Name] != want {
			t.Fatalf("%s: cached %s, ETag() %s", eff.Zones[i].Name, e1[eff.Zones[i].Name], want)
		}
	}
	// A write to a.test changes only a.test's ETag.
	if code, body := h.do("POST", "/zones/a.test/records", `{"name":"new","type":"A","value":"192.0.2.9"}`); code != 201 {
		t.Fatalf("add: %d %s", code, body)
	}
	e3 := etags()
	if e3["a.test"] == e1["a.test"] || e3["b.test"] != e1["b.test"] || e3["static.org"] != e1["static.org"] {
		t.Fatalf("after write: %v -> %v", e1, e3)
	}
	// Replacing a.test back (delete the record) restores the old content hash.
	if code, body := h.do("DELETE", "/zones/a.test/records/new/A", ""); code != 200 {
		t.Fatalf("delete: %d %s", code, body)
	}
	if e4 := etags(); e4["a.test"] != e1["a.test"] {
		t.Fatalf("content-addressed etag should return: %v vs %v", e4["a.test"], e1["a.test"])
	}
	// A zone deleted over the API drops out.
	h.do("DELETE", "/zones/b.test", "")
	if _, ok := etags()["b.test"]; ok {
		t.Fatal("b.test still listed")
	}
	// Config reload swaps the file config: the local zone's etag follows it.
	before := etags()["static.org"]
	h.mgr.SetConfig(withDefaultsTTL(h))
	if after := etags()["static.org"]; after == before {
		t.Fatal("local zone etag did not follow the config change")
	}
}

type recPage struct {
	Zone       string           `json:"zone"`
	Records    []map[string]any `json:"records"`
	NextCursor *string          `json:"next_cursor"`
	Total      *int             `json:"total"`
}

func getRecs(t *testing.T, h *harness, path string) recPage {
	t.Helper()
	code, body := h.do("GET", path, "")
	if code != 200 {
		t.Fatalf("%s: %d %s", path, code, body)
	}
	var p recPage
	if err := json.Unmarshal([]byte(body), &p); err != nil {
		t.Fatal(err)
	}
	return p
}

func recKeys(p recPage) string {
	var out []string
	for _, r := range p.Records {
		out = append(out, r["name"].(string)+"/"+r["value"].(string))
	}
	return strings.Join(out, " ")
}

func TestRecordsPagination(t *testing.T) {
	h := newHarness(t, "")
	mkZones(t, h, "a.test") // api A .3, www A .1, www A .2

	p1 := getRecs(t, h, "/zones/a.test/records?limit=2")
	if recKeys(p1) != "api/192.0.2.3 www/192.0.2.1" || p1.NextCursor == nil || *p1.Total != 3 {
		t.Fatalf("first: %s %v", recKeys(p1), p1.NextCursor)
	}
	// Insert before the cursor between pages: the next page is unchanged.
	h.do("POST", "/zones/a.test/records", `{"name":"aaa","type":"A","value":"192.0.2.8"}`)
	p2 := getRecs(t, h, "/zones/a.test/records?limit=2&cursor="+*p1.NextCursor)
	if recKeys(p2) != "www/192.0.2.2" || p2.NextCursor != nil || *p2.Total != 4 {
		t.Fatalf("last: %s %v", recKeys(p2), p2.NextCursor)
	}
	// Middle page.
	p := getRecs(t, h, "/zones/a.test/records?limit=1&cursor="+*getRecs(t, h, "/zones/a.test/records?limit=1").NextCursor)
	if recKeys(p) != "api/192.0.2.3" || p.NextCursor == nil {
		t.Fatalf("middle: %s", recKeys(p))
	}
	// Filters still apply and total counts the filtered set.
	f := getRecs(t, h, "/zones/a.test/records?name=www&type=a&limit=1")
	if recKeys(f) != "www/192.0.2.1" || f.NextCursor == nil || *f.Total != 2 {
		t.Fatalf("filtered: %s total=%v", recKeys(f), f.Total)
	}
}

func TestNoParamsShapeUnchanged(t *testing.T) {
	h := newHarness(t, "")
	mkZones(t, h, "z.test", "a.test")
	_, body := h.do("GET", "/zones", "")
	var v struct {
		Zones []map[string]any `json:"zones"`
	}
	var raw map[string]json.RawMessage
	_ = json.Unmarshal([]byte(body), &raw)
	_ = json.Unmarshal([]byte(body), &v)
	if len(raw) != 1 || len(v.Zones) != 3 {
		t.Fatalf("keys/zones: %s", body)
	}
	// Config order (file zones first, then replicated), so not globally sorted.
	if v.Zones[0]["name"] != "static.org" || v.Zones[1]["name"] != "a.test" {
		t.Fatalf("order changed: %s", body)
	}
	for _, k := range []string{"name", "records", "serial", "state", "source", "managed", "etag"} {
		if _, ok := v.Zones[1][k]; !ok {
			t.Errorf("missing %s", k)
		}
	}
	_, body = h.do("GET", "/zones/z.test/records", "")
	raw = nil
	_ = json.Unmarshal([]byte(body), &raw)
	if len(raw) != 2 || raw["zone"] == nil || raw["records"] == nil {
		t.Fatalf("records shape: %s", body)
	}
	// ?view=full is the default.
	_, full := h.do("GET", "/zones?view=full", "")
	if full != body && !strings.Contains(full, `"records"`) {
		t.Fatalf("view=full: %s", full)
	}
}

func TestCompactAndPrettyJSON(t *testing.T) {
	h := newHarness(t, "")
	for _, path := range []string{"/status", "/zones", "/zones/static.org", "/zones/static.org/records", "/tokens", "/lookup?name=www.static.org"} {
		_, compact := h.do("GET", path, "")
		if strings.Contains(strings.TrimSuffix(compact, "\n"), "\n") || strings.Contains(compact, `": `) {
			t.Errorf("%s not compact: %q", path, compact)
		}
		sep := "?"
		if strings.Contains(path, "?") {
			sep = "&"
		}
		_, pretty := h.do("GET", path+sep+"pretty=1", "")
		if !strings.Contains(pretty, "\n  \"") {
			t.Errorf("%s?pretty=1 not indented: %q", path, pretty)
		}
		var a, b any
		if json.Unmarshal([]byte(compact), &a) != nil || json.Unmarshal([]byte(pretty), &b) != nil {
			t.Fatalf("%s: invalid JSON", path)
		}
		ja, _ := json.Marshal(a)
		jb, _ := json.Marshal(b)
		if string(ja) != string(jb) {
			t.Errorf("%s: pretty and compact differ", path)
		}
	}
	// Writes honour it too; errors stay compact.
	_, body := h.do("POST", "/zones?pretty=1", "zones:\n  - name: p.test\n")
	if !strings.Contains(body, "\n  \"status\"") {
		t.Errorf("write pretty: %q", body)
	}
	if _, body := h.do("GET", "/zones/missing.test?pretty=1", ""); strings.Count(body, "\n") != 1 {
		t.Errorf("error body: %q", body)
	}
}

// withDefaultsTTL is the running config with another default TTL, as a reload
// would produce.
func withDefaultsTTL(h *harness) *config.Config {
	c := *h.mgr.Config()
	c.Defaults.TTL = c.Defaults.TTL + 60
	return &c
}
