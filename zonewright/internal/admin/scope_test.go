package admin

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const (
	adminToken  = "admin-s3cret"
	acmeToken   = "acme-s3cret"
	acmeAnyZone = "acme-any-s3cret"
	acmeNoZone  = "acme-none-s3cret"
)

// newScopedHarness is a harness whose API has an admin token plus two acme
// tokens: one limited to example.com and sub.example.com, one with all_zones,
// and one with no zones (which reaches nothing).
func newScopedHarness(t *testing.T) *harness {
	t.Helper()
	h := newHarness(t, adminToken)
	srv := New(h.mgr, adminToken, slog.New(slog.NewTextHandler(io.Discard, nil)), nil)
	srv.SetScopedTokens([]ScopedToken{
		{Name: "realm-fra", Token: acmeToken, Scope: "acme", Zones: []string{"example.com", "sub.example.com"}},
		{Name: "acme-any", Token: acmeAnyZone, Scope: "acme", AllZones: true},
		{Name: "acme-none", Token: acmeNoZone, Scope: "acme"},
	})
	h.handler = srv.Routes()
	for _, zone := range []string{"example.com", "sub.example.com", "other.org"} {
		body := "zones:\n  - name: " + zone + "\n    records:\n      - {name: www, type: A, value: 192.0.2.1}\n"
		if code, resp := h.as(adminToken, "POST", "/zones", body); code != http.StatusCreated {
			t.Fatalf("create %s: %d %s", zone, code, resp)
		}
	}
	return h
}

func (h *harness) as(token, method, path, body string) (int, string) {
	h.t.Helper()
	var r io.Reader
	if body != "" {
		r = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, r)
	req.Host = "zonewright:9053"
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	h.handler.ServeHTTP(rec, req)
	return rec.Code, rec.Body.String()
}

func txt(name, value string) string {
	return `{"name":"` + name + `","type":"TXT","value":"` + value + `","ttl":60}`
}

func TestACMETokenWritesChallenges(t *testing.T) {
	h := newScopedHarness(t)

	for _, name := range []string{"_acme-challenge", "_acme-challenge.www", "_acme-challenge.api.example.com."} {
		if code, body := h.as(acmeToken, "POST", "/zones/example.com/records?wait=replicated", txt(name, "tok-"+strings.ReplaceAll(name, ".", "-"))); code != http.StatusCreated {
			t.Fatalf("POST %s: %d %s", name, code, body)
		}
	}
	file := h.zoneFile("example.com")
	for _, want := range []string{"_acme-challenge\t60\tIN\tTXT", "_acme-challenge.www\t60\tIN\tTXT", "_acme-challenge.api\t60\tIN\tTXT"} {
		if !strings.Contains(file, want) {
			t.Fatalf("zone file lacks %q:\n%s", want, file)
		}
	}

	// A second value on the same name (apex + wildcard issuance) is added,
	// not replaced.
	if code, body := h.as(acmeToken, "POST", "/zones/example.com/records", txt("_acme-challenge", "second")); code != http.StatusCreated {
		t.Fatalf("second value: %d %s", code, body)
	}
	if code, body := h.as(acmeToken, "DELETE", "/zones/example.com/records/_acme-challenge/TXT?value=second", ""); code != http.StatusOK {
		t.Fatalf("DELETE one value: %d %s", code, body)
	}
	if !strings.Contains(h.zoneFile("example.com"), `"tok-_acme-challenge"`) {
		t.Fatal("deleting one value removed the other")
	}

	if code, body := h.as(acmeToken, "PUT", "/zones/sub.example.com/records/_acme-challenge/TXT", `{"records":[{"value":"put-tok","ttl":60}]}`); code != http.StatusOK && code != http.StatusCreated {
		t.Fatalf("PUT challenge RRset: %d %s", code, body)
	}
	if code, body := h.as(acmeToken, "DELETE", "/zones/sub.example.com/records/_acme-challenge/TXT", ""); code != http.StatusOK {
		t.Fatalf("DELETE challenge RRset: %d %s", code, body)
	}
}

func TestACMETokenRefusedOutsideScope(t *testing.T) {
	h := newScopedHarness(t)
	before := h.zoneFile("example.com")

	refused := []struct{ method, path, body string }{
		{"POST", "/zones/example.com/records", `{"name":"evil","type":"A","value":"203.0.113.66"}`},
		{"POST", "/zones/example.com/records", txt("www", "x")},
		{"POST", "/zones/example.com/records", txt("_acme-challenge-evil", "x")},
		{"POST", "/zones/example.com/records", txt("x._acme-challenge", "x")},
		{"POST", "/zones/example.com/records", `{"name":"_acme-challenge","type":"CNAME","value":"attacker.net."}`},
		{"PUT", "/zones/example.com/records/www/A", `{"records":[{"value":"203.0.113.66"}]}`},
		{"PUT", "/zones/example.com/records/_acme-challenge/CNAME", `{"records":[{"value":"attacker.net."}]}`},
		{"DELETE", "/zones/example.com/records/www/A", ""},
		{"POST", "/zones/other.org/records", txt("_acme-challenge", "x")},
		{"DELETE", "/zones/other.org/records/www/A", ""},
		{"GET", "/zones", ""},
		{"GET", "/zones/example.com", ""},
		{"GET", "/zones/example.com/records", ""},
		{"GET", "/zones/example.com/file", ""},
		{"PUT", "/zones/example.com", "records: []\n"},
		{"DELETE", "/zones/example.com", ""},
		{"POST", "/zones", "zones:\n  - name: new.net\n"},
		{"GET", "/status", ""},
		{"POST", "/reload", ""},
		{"GET", "/cluster/status", ""},
		{"DELETE", "/cluster/peers/n-1", ""},
	}
	for _, c := range refused {
		if code, body := h.as(acmeToken, c.method, c.path, c.body); code != http.StatusForbidden {
			t.Errorf("%s %s %s: got %d %s, want 403", c.method, c.path, c.body, code, body)
		}
	}
	if after := h.zoneFile("example.com"); after != before {
		t.Fatalf("a refused request changed the zone:\n%s", after)
	}
	if _, ok, _ := h.repl.Zone("example.com"); !ok {
		t.Fatal("example.com was deleted by a scoped token")
	}

	// A token with no zones reaches nothing — no zone list is not "every zone".
	for _, zone := range []string{"example.com", "other.org"} {
		if code, _ := h.as(acmeNoZone, "POST", "/zones/"+zone+"/records", txt("_acme-challenge", "x")); code != http.StatusForbidden {
			t.Errorf("zone-less token wrote a challenge in %s: %d", zone, code)
		}
	}
	if code, _ := h.as(acmeNoZone, "GET", "/lookup?name=_acme-challenge.example.com", ""); code != http.StatusNotFound {
		t.Errorf("zone-less token looked up a zone: %d", code)
	}

	// The all_zones acme token reaches every zone, still only for challenges.
	if code, body := h.as(acmeAnyZone, "POST", "/zones/other.org/records", txt("_acme-challenge", "any")); code != http.StatusCreated {
		t.Fatalf("unrestricted token, other.org challenge: %d %s", code, body)
	}
	if code, _ := h.as(acmeAnyZone, "POST", "/zones/other.org/records", `{"name":"x","type":"A","value":"203.0.113.66"}`); code != http.StatusForbidden {
		t.Fatalf("unrestricted token wrote an A record: %d", code)
	}

	for _, token := range []string{"", "wrong", acmeToken + "x"} {
		if code, _ := h.as(token, "POST", "/zones/example.com/records", txt("_acme-challenge", "x")); code != http.StatusUnauthorized {
			t.Errorf("token %q: got %d, want 401", token, code)
		}
	}

	// The admin token is unaffected by scoped tokens.
	if code, body := h.as(adminToken, "GET", "/status", ""); code != http.StatusOK {
		t.Fatalf("admin token /status: %d %s", code, body)
	}
}

func TestLookup(t *testing.T) {
	h := newScopedHarness(t)
	get := func(token, name string) (int, Lookup) {
		t.Helper()
		code, body := h.as(token, "GET", "/lookup?name="+name, "")
		var out Lookup
		if code == http.StatusOK {
			if err := json.Unmarshal([]byte(body), &out); err != nil {
				t.Fatalf("lookup %s: %v %s", name, err, body)
			}
		}
		return code, out
	}

	cases := []struct {
		token, name string
		code        int
		zone, rel   string
	}{
		{acmeToken, "_acme-challenge.www.example.com", 200, "example.com", "_acme-challenge.www"},
		{acmeToken, "_acme-challenge.EXAMPLE.com.", 200, "example.com", "_acme-challenge"},
		{acmeToken, "_acme-challenge.a.sub.example.com", 200, "sub.example.com", "_acme-challenge.a"},
		{acmeToken, "sub.example.com", 200, "sub.example.com", "@"},
		{acmeToken, "_acme-challenge.other.org", 404, "", ""},
		{acmeToken, "_acme-challenge.notexample.com", 404, "", ""},
		{acmeAnyZone, "_acme-challenge.other.org", 200, "other.org", "_acme-challenge"},
		{adminToken, "www.static.org", 200, "static.org", "www"},
	}
	for _, c := range cases {
		code, got := get(c.token, c.name)
		if code != c.code || got.Zone != c.zone || got.Name != c.rel {
			t.Errorf("lookup %s: %d %+v, want %d %s %s", c.name, code, got, c.code, c.zone, c.rel)
		}
	}
	if _, got := get(adminToken, "www.static.org"); got.Writable || got.Source != "local" {
		t.Errorf("local zone reported writable: %+v", got)
	}
	if _, got := get(adminToken, "www.example.com"); !got.Writable || got.Source != "replicated" {
		t.Errorf("replicated zone reported read-only: %+v", got)
	}
	if code, _ := h.as(acmeToken, "GET", "/lookup", ""); code != http.StatusBadRequest {
		t.Errorf("lookup without name: %d, want 400", code)
	}
}
