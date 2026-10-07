package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
)

func (e *env) admin(method, path string, body any, ctype string) (*http.Response, []byte) {
	e.t.Helper()
	var rd io.Reader
	switch b := body.(type) {
	case nil:
	case []byte:
		rd = bytes.NewReader(b)
	default:
		j, _ := json.Marshal(b)
		rd = bytes.NewReader(j)
	}
	req, _ := http.NewRequest(method, e.base+path, rd)
	req.Header.Set("Authorization", "Bearer "+apiToken)
	if ctype != "" {
		req.Header.Set("Content-Type", ctype)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		e.t.Fatal(err)
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	return resp, data
}

func TestAdminAPIRequiresTheToken(t *testing.T) {
	e := newEnv(t)
	for _, auth := range []string{"", "Bearer wrong-token", "Bearer ", "Basic " + apiToken, apiToken} {
		req, _ := http.NewRequest("GET", e.base+"/admin/v1/health", nil)
		if auth != "" {
			req.Header.Set("Authorization", auth)
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		data, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode != 401 || errCode(data) != "unauthorized" {
			t.Errorf("%q: %d %s", auth, resp.StatusCode, data)
		}
	}
	if resp, data := e.admin("GET", "/admin/v1/health", nil, ""); resp.StatusCode != 200 || !strings.Contains(string(data), `"ok":true`) || !strings.Contains(string(data), `"domains":1`) {
		t.Fatalf("health: %d %s", resp.StatusCode, data)
	}
}

func TestAdminAPIGuessingIsThrottled(t *testing.T) {
	e := newEnv(t)
	got429 := false
	for i := 0; i < 12; i++ {
		req, _ := http.NewRequest("GET", e.base+"/admin/v1/health", nil)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer guess-%d", i))
		resp, _ := http.DefaultClient.Do(req)
		resp.Body.Close()
		if resp.StatusCode == 429 {
			got429 = true
			break
		}
	}
	if !got429 {
		t.Fatal("wrong tokens were never throttled")
	}
	if resp, _ := e.admin("GET", "/admin/v1/health", nil, ""); resp.StatusCode != 429 {
		t.Fatalf("even the right token waits out the block: %d", resp.StatusCode)
	}
}

func TestAdminBrandingLifecycle(t *testing.T) {
	e := newEnv(t)
	resp, data := e.admin("POST", "/admin/v1/brandings", map[string]any{
		"domain": "Acme.COM", "displayName": "Acme Mail", "theme": "forest", "accent": "#123456", "mailboxCount": 7,
		"footerLinks": []map[string]string{{"label": "Terms", "url": "https://acme.com/terms"}},
	}, "application/json")
	if resp.StatusCode != 201 {
		t.Fatalf("create: %d %s", resp.StatusCode, data)
	}
	var b struct {
		Domain       string
		DisplayName  string
		MailboxCount int
		UpdatedAt    string
		FooterLinks  []struct{ Label, URL string }
	}
	json.Unmarshal(data, &b)
	if b.Domain != "acme.com" || b.DisplayName != "Acme Mail" || b.MailboxCount != 7 || b.UpdatedAt == "" || len(b.FooterLinks) != 1 {
		t.Fatalf("%s", data)
	}
	if resp, data := e.admin("POST", "/admin/v1/brandings", map[string]any{"domain": "acme.com"}, "application/json"); resp.StatusCode != 409 || errCode(data) != "exists" {
		t.Fatalf("duplicate: %d %s", resp.StatusCode, data)
	}
	if resp, data := e.admin("POST", "/admin/v1/brandings", map[string]any{"domain": "bad.test", "accent": "red"}, "application/json"); resp.StatusCode != 422 || errCode(data) != "invalid_branding" || !strings.Contains(string(data), "accent") {
		t.Fatalf("invalid: %d %s", resp.StatusCode, data)
	}
	if resp, data := e.admin("POST", "/admin/v1/brandings", map[string]any{"displayName": "no domain"}, "application/json"); resp.StatusCode != 422 {
		t.Fatalf("missing domain: %d %s", resp.StatusCode, data)
	}

	resp, data = e.admin("PUT", "/admin/v1/brandings/acme.com", map[string]any{"displayName": "Acme", "mailboxCount": 9}, "application/json")
	if resp.StatusCode != 200 {
		t.Fatalf("put: %d %s", resp.StatusCode, data)
	}
	json.Unmarshal(data, &b)
	if b.DisplayName != "Acme" || b.MailboxCount != 9 || len(b.FooterLinks) != 0 {
		t.Fatalf("put must replace every editable field: %s", data)
	}
	if resp, _ := e.admin("PUT", "/admin/v1/brandings/acme.com", map[string]any{"domain": "other.com"}, "application/json"); resp.StatusCode != 422 {
		t.Fatalf("mismatched domain: %d", resp.StatusCode)
	}
	if resp, data := e.admin("PUT", "/admin/v1/brandings/ghost.test", map[string]any{}, "application/json"); resp.StatusCode != 404 || errCode(data) != "not_found" {
		t.Fatalf("put missing: %d %s", resp.StatusCode, data)
	}
	if resp, data := e.admin("GET", "/admin/v1/brandings/acme.com", nil, ""); resp.StatusCode != 200 || !strings.Contains(string(data), `"displayName":"Acme"`) {
		t.Fatalf("get: %d %s", resp.StatusCode, data)
	}

	c := &client{e: e}
	_, pub := c.do("GET", "/api/branding", nil, map[string]string{"Host": "acme.com"})
	if !strings.Contains(string(pub), `"known":true`) || !strings.Contains(string(pub), `"name":"Acme"`) {
		t.Fatalf("the browser reads what was pushed: %s", pub)
	}

	if resp, _ := e.admin("DELETE", "/admin/v1/brandings/acme.com", nil, ""); resp.StatusCode != 204 {
		t.Fatalf("delete: %d", resp.StatusCode)
	}
	if resp, _ := e.admin("DELETE", "/admin/v1/brandings/acme.com", nil, ""); resp.StatusCode != 204 {
		t.Fatalf("delete twice: %d", resp.StatusCode)
	}
	if resp, _ := e.admin("GET", "/admin/v1/brandings/acme.com", nil, ""); resp.StatusCode != 404 {
		t.Fatalf("get after delete: %d", resp.StatusCode)
	}
	_, pub = c.do("GET", "/api/branding?domain=acme.com", nil, nil)
	if !strings.Contains(string(pub), `"known":false`) {
		t.Fatalf("a deleted domain is neutral again: %s", pub)
	}
}

func TestAdminBrandingListPages(t *testing.T) {
	e := newEnv(t)
	for _, d := range []string{"b.test", "c.test", "d.test", "other.example"} {
		if resp, data := e.admin("POST", "/admin/v1/brandings", map[string]any{"domain": d}, "application/json"); resp.StatusCode != 201 {
			t.Fatalf("%s: %d %s", d, resp.StatusCode, data)
		}
	}
	type page struct {
		Items []struct{ Domain string }
		Total int
		Next  string `json:"nextCursor"`
	}
	var seen []string
	cursor := ""
	for i := 0; i < 5; i++ {
		var p page
		_, data := e.admin("GET", "/admin/v1/brandings?limit=2&cursor="+cursor, nil, "")
		if err := json.Unmarshal(data, &p); err != nil || p.Total != 5 {
			t.Fatalf("%v %s", err, data)
		}
		for _, it := range p.Items {
			seen = append(seen, it.Domain)
		}
		if p.Next == "" {
			break
		}
		cursor = p.Next
	}
	if strings.Join(seen, ",") != "b.test,c.test,d.test,example.test,other.example" {
		t.Fatalf("paging order or coverage: %v", seen)
	}
	var p page
	_, data := e.admin("GET", "/admin/v1/brandings?q=EXAMPLE", nil, "")
	json.Unmarshal(data, &p)
	if p.Total != 2 || len(p.Items) != 2 || p.Next != "" {
		t.Fatalf("filter: %s", data)
	}
	_, data = e.admin("GET", "/admin/v1/brandings?cursor=!!not-a-cursor!!", nil, "")
	json.Unmarshal(data, &p)
	if len(p.Items) == 0 || p.Items[0].Domain != "b.test" {
		t.Fatalf("a bad cursor starts over: %s", data)
	}
	for _, limit := range []string{"0", "101", "x"} {
		if resp, _ := e.admin("GET", "/admin/v1/brandings?limit="+limit, nil, ""); resp.StatusCode != 400 {
			t.Errorf("limit %s: %d", limit, resp.StatusCode)
		}
	}
}

func TestThereIsNoLogoUpload(t *testing.T) {
	e := newEnv(t)
	png := append([]byte("\x89PNG\r\n\x1a\n"), bytes.Repeat([]byte{1}, 64)...)
	if resp, _ := e.admin("PUT", "/admin/v1/brandings/example.test/logo", png, "image/png"); resp.StatusCode != 404 && resp.StatusCode != 405 {
		t.Fatalf("a logo upload must not exist: %d", resp.StatusCode)
	}
	if resp, _ := e.admin("DELETE", "/admin/v1/brandings/example.test/logo", nil, ""); resp.StatusCode != 404 && resp.StatusCode != 405 {
		t.Fatalf("a logo delete must not exist: %d", resp.StatusCode)
	}
	c := &client{e: e}
	if resp, _ := c.do("GET", "/api/logo?domain=example.test", nil, nil); resp.StatusCode != 404 {
		t.Fatalf("no logo is served: %d", resp.StatusCode)
	}
	_, pub := c.do("GET", "/api/branding?domain=example.test", nil, nil)
	if strings.Contains(string(pub), "logo") {
		t.Fatalf("the public branding carries no logo: %s", pub)
	}
	_, data := e.admin("GET", "/admin/v1/brandings/example.test", nil, "")
	if strings.Contains(string(data), "hasLogo") {
		t.Fatalf("the admin view carries no logo: %s", data)
	}
}
