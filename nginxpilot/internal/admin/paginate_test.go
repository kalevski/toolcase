package admin

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

type sitesPage struct {
	Sites      []map[string]any `json:"sites"`
	NextCursor *string          `json:"next_cursor"`
	Total      *int             `json:"total"`
}

func domainsOf(p sitesPage) []string {
	var out []string
	for _, s := range p.Sites {
		out = append(out, s["domain"].(string))
	}
	return out
}

func getPage(t *testing.T, env sitesEnv, url string) sitesPage {
	t.Helper()
	rec := do(env, http.MethodGet, url, "", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET %s: want 200, got %d: %s", url, rec.Code, rec.Body.String())
	}
	var p sitesPage
	if err := json.Unmarshal(rec.Body.Bytes(), &p); err != nil {
		t.Fatalf("decode %s: %v", url, err)
	}
	return p
}

// five sites, seeded out of order so the stable key order is observable.
func pagedEnv(t *testing.T) sitesEnv {
	var seed []config.Site
	for _, d := range []string{"d.example.com", "a.example.com", "e.example.com", "c.example.com", "b.example.com"} {
		seed = append(seed, config.Site{Domain: d, Source: config.Source{Type: config.SourceGit, URL: "https://x/y.git"}})
	}
	return newSitesEnv(t, "", seed...)
}

func TestPaginationWalksAllPages(t *testing.T) {
	env := pagedEnv(t)

	first := getPage(t, env, "/sites?limit=2")
	if got := strings.Join(domainsOf(first), ","); got != "a.example.com,b.example.com" {
		t.Fatalf("first page: %s", got)
	}
	if first.NextCursor == nil || first.Total == nil || *first.Total != 5 {
		t.Fatalf("first page envelope: %+v", first)
	}
	mid := getPage(t, env, "/sites?limit=2&cursor="+*first.NextCursor)
	if got := strings.Join(domainsOf(mid), ","); got != "c.example.com,d.example.com" || mid.NextCursor == nil {
		t.Fatalf("middle page: %s next=%v", got, mid.NextCursor)
	}
	last := getPage(t, env, "/sites?limit=2&cursor="+*mid.NextCursor)
	if got := strings.Join(domainsOf(last), ","); got != "e.example.com" {
		t.Fatalf("last page: %s", got)
	}
	if last.NextCursor != nil || *last.Total != 5 {
		t.Fatalf("last page must have null next_cursor and total 5: %+v", last)
	}
	// An exact multiple ends with a null cursor, not an empty extra page.
	exact := getPage(t, env, "/sites?limit=5")
	if exact.NextCursor != nil || len(exact.Sites) != 5 {
		t.Fatalf("limit == total: %+v", exact)
	}
}

// A cursor is "everything after this key", so a site inserted before or after
// the cursor between pages neither repeats nor skips an item.
func TestPaginationStableAcrossInserts(t *testing.T) {
	env := pagedEnv(t)
	first := getPage(t, env, "/sites?limit=2") // a, b
	env.cfg.Sites = append(env.cfg.Sites,
		config.Site{Domain: "aa.example.com"}, // sorts before the cursor: not seen again
		config.Site{Domain: "bb.example.com"}, // sorts after the cursor: must appear
	)
	rest := getPage(t, env, "/sites?limit=10&cursor="+*first.NextCursor)
	if got := strings.Join(domainsOf(rest), ","); got != "bb.example.com,c.example.com,d.example.com,e.example.com" {
		t.Fatalf("after insert: %s", got)
	}
	if *rest.Total != 7 {
		t.Fatalf("total: %d", *rest.Total)
	}
}

func TestPaginationNoParamsUnchanged(t *testing.T) {
	env := pagedEnv(t)
	rec := do(env, http.MethodGet, "/sites", "", "")
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(rec.Body.Bytes(), &raw); err != nil {
		t.Fatal(err)
	}
	if len(raw) != 1 {
		t.Fatalf("unpaged body must only hold the list: %s", rec.Body.String())
	}
	var sites []config.Site
	if err := json.Unmarshal(raw["sites"], &sites); err != nil || len(sites) != 5 || sites[0].Domain != "d.example.com" {
		t.Fatalf("unpaged must keep config order and all items: %s", rec.Body.String())
	}
	// Empty list stays an array, never null.
	empty := newSitesEnv(t, "")
	if body := do(empty, http.MethodGet, "/sites", "", "").Body.String(); body != "{\"sites\":[]}\n" {
		t.Fatalf("empty body: %q", body)
	}
	if p := getPage(t, empty, "/sites?limit=3"); p.Sites == nil || p.NextCursor != nil || *p.Total != 0 {
		t.Fatalf("empty paged: %+v", p)
	}
}

func TestPaginationSummary(t *testing.T) {
	env := pagedEnv(t)
	p := getPage(t, env, "/sites?limit=1&fields=summary")
	if len(p.Sites) != 1 || len(p.Sites[0]) != 3 || p.Sites[0]["domain"] != "a.example.com" ||
		p.Sites[0]["type"] != config.SourceGit || p.Sites[0]["routing"] == "" {
		t.Fatalf("summary item: %+v", p.Sites)
	}
	if full := getPage(t, env, "/sites?limit=1&fields=full"); full.Sites[0]["source"] == nil {
		t.Fatalf("fields=full must be the whole object: %+v", full.Sites[0])
	}
}

func TestPaginationBadParams(t *testing.T) {
	env := pagedEnv(t)
	badCursor := base64.RawURLEncoding.EncodeToString([]byte("not json"))
	for _, url := range []string{
		"/sites?limit=0", "/sites?limit=501", "/sites?limit=-1", "/sites?limit=abc", "/sites?limit=",
		"/sites?limit=2&cursor=!!!", "/sites?limit=2&cursor=" + badCursor, "/sites?cursor=e30",
		"/sites?fields=bogus", "/upstreams?fields=summary", "/proxies?limit=1000",
	} {
		rec := do(env, http.MethodGet, url, "", "")
		if rec.Code != http.StatusBadRequest {
			t.Errorf("GET %s: want 400, got %d: %s", url, rec.Code, rec.Body.String())
		}
	}
}

func TestPaginationOtherRoutes(t *testing.T) {
	env := newSitesEnv(t, "")
	for i := 0; i < 3; i++ {
		env.cfg.Upstreams = append(env.cfg.Upstreams, config.Upstream{Name: fmt.Sprintf("u%d", 2-i)})
		env.cfg.Proxies = append(env.cfg.Proxies, config.Proxy{Domain: fmt.Sprintf("p%d.example.com", 2-i)})
	}
	var ups struct {
		Upstreams  []config.Upstream `json:"upstreams"`
		NextCursor *string           `json:"next_cursor"`
		Total      int               `json:"total"`
	}
	rec := do(env, http.MethodGet, "/upstreams?limit=2", "", "")
	if err := json.Unmarshal(rec.Body.Bytes(), &ups); err != nil {
		t.Fatal(err)
	}
	if len(ups.Upstreams) != 2 || ups.Upstreams[0].Name != "u0" || ups.NextCursor == nil || ups.Total != 3 {
		t.Fatalf("upstreams page: %s", rec.Body.String())
	}
	for _, url := range []string{"/proxies", "/redirects", "/dead-hosts", "/streams", "/stream-upstreams", "/apps", "/access-lists", "/certs"} {
		if rec := do(env, http.MethodGet, url+"?limit=1", "", ""); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"total":`) {
			t.Errorf("GET %s?limit=1: %d %s", url, rec.Code, rec.Body.String())
		}
	}
}

func TestJSONCompactByDefaultPrettyOnRequest(t *testing.T) {
	env := pagedEnv(t)
	compact := do(env, http.MethodGet, "/sites?limit=1&fields=summary", "", "").Body.String()
	if strings.Contains(compact, "\n  ") || strings.Count(compact, "\n") != 1 {
		t.Fatalf("default must be compact: %q", compact)
	}
	pretty := do(env, http.MethodGet, "/sites?limit=1&fields=summary&pretty=1", "", "").Body.String()
	if !strings.Contains(pretty, "\n  \"sites\": [") {
		t.Fatalf("pretty=1 must indent: %q", pretty)
	}
	var a, b any
	if json.Unmarshal([]byte(compact), &a) != nil || json.Unmarshal([]byte(pretty), &b) != nil || fmt.Sprint(a) != fmt.Sprint(b) {
		t.Fatalf("compact and pretty must carry the same document")
	}
	// /status goes through the same encoder.
	if st := do(env, http.MethodGet, "/status", "", "").Body.String(); strings.Contains(st, "\n  ") {
		t.Fatalf("/status must be compact: %q", st)
	}
	if st := do(env, http.MethodGet, "/status?pretty=1", "", "").Body.String(); !strings.Contains(st, "\n  \"") {
		t.Fatalf("/status?pretty=1 must indent")
	}
}

// /schema is a pre-encoded document people read: it stays indented and
// ignores ?pretty.
func TestSchemaStaysIndentedAndDocumentsPaging(t *testing.T) {
	env := pagedEnv(t)
	body := do(env, http.MethodGet, "/schema", "", "").Body.String()
	if !strings.Contains(body, "\n  \"openapi\"") {
		t.Fatalf("/schema must stay indented")
	}
	var doc struct {
		Paths map[string]map[string]struct {
			Parameters []struct {
				Name string `json:"name"`
			} `json:"parameters"`
		} `json:"paths"`
	}
	if err := json.Unmarshal([]byte(body), &doc); err != nil {
		t.Fatal(err)
	}
	got := map[string]bool{}
	for _, p := range doc.Paths["/sites"]["get"].Parameters {
		got[p.Name] = true
	}
	if !got["limit"] || !got["cursor"] || !got["fields"] || !got["pretty"] {
		t.Fatalf("GET /sites parameters: %v", got)
	}
}
