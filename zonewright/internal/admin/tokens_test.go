package admin

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

type tokenResp struct {
	Status   string   `json:"status"`
	Name     string   `json:"name"`
	Scope    string   `json:"scope"`
	Zones    []string `json:"zones"`
	Source   string   `json:"source"`
	Created  string   `json:"created_at"`
	Token    string   `json:"token"`
	Replicat *bool    `json:"replicated"`
}

func decodeToken(t *testing.T, body string) tokenResp {
	t.Helper()
	var out tokenResp
	if err := json.Unmarshal([]byte(body), &out); err != nil {
		t.Fatalf("decode %s: %v", body, err)
	}
	return out
}

func TestAPITokenLifecycle(t *testing.T) {
	h := newScopedHarness(t)
	challenge := txt("_acme-challenge", "tok")

	code, body := h.as(adminToken, "POST", "/tokens?wait=replicated", `{"name":"edge-fra","scope":"acme","zones":["Example.COM."]}`)
	if code != http.StatusCreated {
		t.Fatalf("create: %d %s", code, body)
	}
	created := decodeToken(t, body)
	if !strings.HasPrefix(created.Token, "zwt_") || len(created.Token) != 68 || created.Source != "api" ||
		len(created.Zones) != 1 || created.Zones[0] != "example.com" || created.Created == "" || created.Replicat == nil || !*created.Replicat {
		t.Fatalf("create response: %+v", created)
	}
	secret := created.Token

	// Listed, but never with its secret or hash.
	code, body = h.as(adminToken, "GET", "/tokens", "")
	if code != http.StatusOK || !strings.Contains(body, `"edge-fra"`) || !strings.Contains(body, `"realm-fra"`) || strings.Contains(body, secret) || strings.Contains(body, hashToken(secret)) {
		t.Fatalf("list: %d %s", code, body)
	}

	// It works exactly like a config acme token.
	if code, body := h.as(secret, "POST", "/zones/example.com/records", challenge); code != http.StatusCreated {
		t.Fatalf("API token challenge: %d %s", code, body)
	}
	if code, _ := h.as(secret, "POST", "/zones/other.org/records", challenge); code != http.StatusForbidden {
		t.Fatalf("API token outside its zones: %d", code)
	}
	if code, _ := h.as(secret, "POST", "/zones/example.com/records", `{"name":"x","type":"A","value":"203.0.113.66"}`); code != http.StatusForbidden {
		t.Fatalf("API token wrote an A record: %d", code)
	}
	if code, body := h.as(secret, "GET", "/lookup?name=_acme-challenge.example.com", ""); code != http.StatusOK {
		t.Fatalf("API token lookup: %d %s", code, body)
	}

	// Widen its zones; the secret stays the same.
	code, body = h.as(adminToken, "PUT", "/tokens/edge-fra", `{"zones":["example.com","other.org"]}`)
	if code != http.StatusOK || decodeToken(t, body).Token != "" {
		t.Fatalf("update: %d %s", code, body)
	}
	if code, body := h.as(secret, "POST", "/zones/other.org/records", challenge); code != http.StatusCreated {
		t.Fatalf("after widening zones: %d %s", code, body)
	}

	// Rotate: the old secret stops working, the new one works.
	code, body = h.as(adminToken, "POST", "/tokens/edge-fra/rotate", "")
	if code != http.StatusOK {
		t.Fatalf("rotate: %d %s", code, body)
	}
	rotated := decodeToken(t, body)
	if rotated.Token == "" || rotated.Token == secret || rotated.Created != created.Created || len(rotated.Zones) != 2 {
		t.Fatalf("rotate response: %+v", rotated)
	}
	if code, _ := h.as(secret, "GET", "/lookup?name=example.com", ""); code != http.StatusUnauthorized {
		t.Fatalf("old secret after rotation: %d, want 401", code)
	}
	if code, _ := h.as(rotated.Token, "GET", "/lookup?name=example.com", ""); code != http.StatusOK {
		t.Fatalf("new secret after rotation: %d", code)
	}

	// Delete: revoked immediately.
	if code, body := h.as(adminToken, "DELETE", "/tokens/edge-fra", ""); code != http.StatusOK {
		t.Fatalf("delete: %d %s", code, body)
	}
	if code, _ := h.as(rotated.Token, "GET", "/lookup?name=example.com", ""); code != http.StatusUnauthorized {
		t.Fatalf("deleted token: %d, want 401", code)
	}
	if code, _ := h.as(adminToken, "DELETE", "/tokens/edge-fra", ""); code != http.StatusNotFound {
		t.Fatalf("second delete: %d, want 404", code)
	}

	// The name can be reused after deletion, with a new secret.
	code, body = h.as(adminToken, "POST", "/tokens", `{"name":"edge-fra"}`)
	if code != http.StatusCreated || decodeToken(t, body).Token == rotated.Token {
		t.Fatalf("re-create: %d %s", code, body)
	}
}

func TestAPITokenRefusals(t *testing.T) {
	h := newScopedHarness(t)
	if code, _ := h.as(adminToken, "POST", "/tokens", `{"name":"dup"}`); code != http.StatusCreated {
		t.Fatal("setup")
	}
	cases := []struct {
		token, method, path, body string
		want                      int
	}{
		{adminToken, "POST", "/tokens", `{"name":"dup"}`, http.StatusConflict},
		{adminToken, "POST", "/tokens", `{"name":"realm-fra"}`, http.StatusConflict},
		{adminToken, "POST", "/tokens", `{"name":"Bad Name"}`, http.StatusBadRequest},
		{adminToken, "POST", "/tokens", `{"name":""}`, http.StatusBadRequest},
		{adminToken, "POST", "/tokens", `{"name":"x","scope":"admin"}`, http.StatusBadRequest},
		{adminToken, "POST", "/tokens", `{"name":"x","zones":["a..b"]}`, http.StatusBadRequest},
		{adminToken, "POST", "/tokens", `{"name":"x","zones":["example.com","EXAMPLE.com."]}`, http.StatusBadRequest},
		{adminToken, "POST", "/tokens", `{"name":"x","token":"chosen-by-client"}`, http.StatusBadRequest},
		{adminToken, "POST", "/tokens", `{"name":"x","zones":["example.com"],"all_zones":true}`, http.StatusBadRequest},
		{adminToken, "PUT", "/tokens/dup", `{"zones":["example.com"],"all_zones":true}`, http.StatusBadRequest},
		{adminToken, "PUT", "/tokens/realm-fra", `{"zones":[]}`, http.StatusConflict},
		{adminToken, "POST", "/tokens/realm-fra/rotate", "", http.StatusConflict},
		{adminToken, "DELETE", "/tokens/realm-fra", "", http.StatusConflict},
		{adminToken, "PUT", "/tokens/nope", `{"zones":[]}`, http.StatusNotFound},
		{adminToken, "PUT", "/tokens/dup", `{"name":"other","zones":[]}`, http.StatusBadRequest},
		// Scoped tokens cannot manage tokens — not even their own.
		{acmeToken, "GET", "/tokens", "", http.StatusForbidden},
		{acmeToken, "POST", "/tokens", `{"name":"escalate"}`, http.StatusForbidden},
		{acmeAnyZone, "PUT", "/tokens/dup", `{"zones":[]}`, http.StatusForbidden},
		{acmeToken, "DELETE", "/tokens/dup", "", http.StatusForbidden},
		{"", "GET", "/tokens", "", http.StatusUnauthorized},
	}
	for _, c := range cases {
		if code, body := h.as(c.token, c.method, c.path, c.body); code != c.want {
			t.Errorf("%s %s %s: %d %s, want %d", c.method, c.path, c.body, code, body, c.want)
		}
	}
	// An API token cannot manage tokens either.
	_, body := h.as(adminToken, "POST", "/tokens", `{"name":"api-acme"}`)
	secret := decodeToken(t, body).Token
	if code, _ := h.as(secret, "POST", "/tokens", `{"name":"escalate"}`); code != http.StatusForbidden {
		t.Errorf("API token created a token: %d", code)
	}
}

// No zones means no zones: a token created without zones or all_zones can
// change nothing until it is given some, and all_zones must be explicit.
func TestAPITokenZoneScope(t *testing.T) {
	h := newScopedHarness(t)
	challenge := txt("_acme-challenge", "tok")

	code, body := h.as(adminToken, "POST", "/tokens", `{"name":"node-1"}`)
	created := decodeToken(t, body)
	if code != http.StatusCreated || len(created.Zones) != 0 || strings.Contains(body, `"all_zones": true`) {
		t.Fatalf("create without zones: %d %s", code, body)
	}
	secret := created.Token
	for _, zone := range []string{"example.com", "other.org"} {
		if code, _ := h.as(secret, "POST", "/zones/"+zone+"/records", challenge); code != http.StatusForbidden {
			t.Fatalf("zone-less API token wrote in %s: %d", zone, code)
		}
	}

	if code, body := h.as(adminToken, "PUT", "/tokens/node-1", `{"zones":["example.com"]}`); code != http.StatusOK {
		t.Fatalf("give it a zone: %d %s", code, body)
	}
	if code, _ := h.as(secret, "POST", "/zones/example.com/records", challenge); code != http.StatusCreated {
		t.Fatalf("after adding example.com: %d", code)
	}
	if code, _ := h.as(secret, "POST", "/zones/other.org/records", challenge); code != http.StatusForbidden {
		t.Fatalf("other.org still refused: %d", code)
	}

	code, body = h.as(adminToken, "PUT", "/tokens/node-1", `{"all_zones":true}`)
	if code != http.StatusOK || !strings.Contains(body, `"all_zones": true`) {
		t.Fatalf("switch to all_zones: %d %s", code, body)
	}
	if code, _ := h.as(secret, "POST", "/zones/other.org/records", challenge); code != http.StatusCreated {
		t.Fatalf("all_zones token in other.org: %d", code)
	}
	if _, body := h.as(adminToken, "GET", "/tokens", ""); !strings.Contains(body, `"all_zones": true`) {
		t.Fatalf("list does not show all_zones: %s", body)
	}

	// PUT replaces: dropping all_zones without listing zones leaves none.
	if code, _ := h.as(adminToken, "PUT", "/tokens/node-1", `{}`); code != http.StatusOK {
		t.Fatal("clear scope")
	}
	if code, _ := h.as(secret, "POST", "/zones/example.com/records", txt("_acme-challenge", "again")); code != http.StatusForbidden {
		t.Fatalf("cleared token still writes: %d", code)
	}
}

// Without an admin token the API is unauthenticated, so an API token would
// protect nothing: creating one is refused.
func TestAPITokensNeedAdminToken(t *testing.T) {
	h := newHarness(t, "")
	if code, body := h.do("POST", "/tokens", `{"name":"x"}`); code != http.StatusConflict {
		t.Fatalf("create without admin token: %d %s", code, body)
	}
}
