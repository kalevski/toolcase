package server

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/webmail/internal/config"
	"github.com/kalevski/toolcase/webmail/internal/fakes"
)

const origin = "https://mail.example.test"

type env struct {
	t     *testing.T
	s     *Server
	world *fakes.World
	base  string
}

func newEnv(t *testing.T) *env {
	t.Helper()
	w := fakes.NewWorld()
	pl := httptest.NewServer(w.PlatformHandler())
	jm := httptest.NewServer(w.JMAPHandler())
	w.JMAPPublic = "https://mail.public.invalid"
	t.Cleanup(pl.Close)
	t.Cleanup(jm.Close)
	key := base64.StdEncoding.EncodeToString([]byte("0123456789abcdef0123456789ABCDEF"))
	cfg, _, err := config.Load(func(k string) (string, bool) {
		m := map[string]string{
			"WEBMAIL_LISTEN": "127.0.0.1:0", "WEBMAIL_ADMIN_LISTEN": "127.0.0.1:0", "WEBMAIL_PUBLIC_URL": origin,
			"WEBMAIL_JMAP_URL": jm.URL, "WEBMAIL_PLATFORM_URL": pl.URL, "WEBMAIL_PLATFORM_TOKEN": w.PlatformToken,
			"WEBMAIL_SESSION_KEY": key, "WEBMAIL_DATA_DIR": t.TempDir(), "WEBMAIL_MAX_UPLOAD_MB": "1",
			"WEBMAIL_LOGIN_FAIL_LIMIT": "6", "WEBMAIL_ADDRESS_FAIL_LIMIT": "4",
		}
		v, ok := m[k]
		return v, ok
	})
	if err != nil {
		t.Fatal(err)
	}
	s, err := New(context.Background(), cfg, slog.New(slog.NewTextHandler(io.Discard, nil)), Build{Version: "test"}, WithMinFailDelay(0))
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { s.Run(ctx); close(done) }()
	t.Cleanup(func() { cancel(); <-done })
	return &env{t: t, s: s, world: w, base: "http://" + s.Addr()}
}

type client struct {
	e      *env
	cookie *http.Cookie
	csrf   string
}

func (c *client) do(method, path string, body any, hdr map[string]string) (*http.Response, []byte) {
	c.e.t.Helper()
	var rd io.Reader
	switch b := body.(type) {
	case nil:
	case []byte:
		rd = bytes.NewReader(b)
	case string:
		rd = strings.NewReader(b)
	default:
		j, _ := json.Marshal(b)
		rd = bytes.NewReader(j)
	}
	req, _ := http.NewRequest(method, c.e.base+path, rd)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if method != "GET" {
		req.Header.Set("Origin", origin)
	}
	if c.cookie != nil {
		req.AddCookie(c.cookie)
	}
	if c.csrf != "" && method != "GET" {
		req.Header.Set("X-Webmail-CSRF", c.csrf)
	}
	for k, v := range hdr {
		if v == "" {
			req.Header.Del(k)
		} else {
			req.Header.Set(k, v)
		}
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		c.e.t.Fatal(err)
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	return resp, data
}

func (c *client) login(email, password string) (*http.Response, []byte) {
	resp, data := c.do("POST", "/api/login", map[string]any{"email": email, "password": password}, nil)
	for _, ck := range resp.Cookies() {
		if ck.Name == "__Host-webmail_session" && ck.MaxAge >= 0 {
			c.cookie = ck
		}
	}
	return resp, data
}

func (e *env) signedIn() *client {
	e.t.Helper()
	c := &client{e: e}
	resp, data := c.login("Ann@Example.test", "correct-horse")
	if resp.StatusCode != 200 {
		e.t.Fatalf("login: %d %s", resp.StatusCode, data)
	}
	_, body := c.do("GET", "/api/session", nil, nil)
	var sr struct {
		CSRF string `json:"csrf"`
	}
	json.Unmarshal(body, &sr)
	c.csrf = sr.CSRF
	return c
}

func errCode(data []byte) string {
	var e struct{ Error struct{ Code string } }
	json.Unmarshal(data, &e)
	return e.Error.Code
}

func TestLoginFlow(t *testing.T) {
	e := newEnv(t)
	c := &client{e: e}

	// wrong password and unknown address look identical
	r1, b1 := c.login("ann@example.test", "nope")
	r2, b2 := c.login("ghost@example.test", "nope")
	if r1.StatusCode != 401 || r2.StatusCode != 401 || string(b1) != string(b2) || errCode(b1) != "invalid_credentials" {
		t.Fatalf("not uniform: %d %q / %d %q", r1.StatusCode, b1, r2.StatusCode, b2)
	}
	if c.cookie != nil {
		t.Fatal("cookie set on failure")
	}
	resp, data := c.login("ann@example.test", "correct-horse")
	if resp.StatusCode != 200 || c.cookie == nil {
		t.Fatalf("login: %d %s", resp.StatusCode, data)
	}
	ck := c.cookie
	if !ck.Secure || !ck.HttpOnly || ck.Path != "/" || ck.SameSite != http.SameSiteLaxMode || ck.Domain != "" {
		t.Fatalf("cookie attrs: %+v", ck)
	}
	// the real password is never stored: the DB holds only a sealed credential
	rows, _ := e.s.store.ListSessions(context.Background(), "ann@example.test", time.Now())
	if len(rows) != 1 || bytes.Contains(rows[0].CredSealed, []byte("correct-horse")) || bytes.Contains(rows[0].CredSealed, []byte("tmp_")) {
		t.Fatalf("session row: %+v", rows)
	}
	if rows[0].AccountID != "acc1" {
		t.Fatalf("account id %q", rows[0].AccountID)
	}
}

func TestSessionDocument(t *testing.T) {
	e := newEnv(t)
	c := e.signedIn()
	resp, body := c.do("GET", "/api/session", nil, nil)
	if resp.StatusCode != 200 {
		t.Fatalf("%d %s", resp.StatusCode, body)
	}
	s := string(body)
	for _, bad := range []string{"public.invalid", "shared1", "stalwart", "tmp_"} {
		if strings.Contains(s, bad) {
			t.Errorf("session leaks %q: %s", bad, s)
		}
	}
	var sr struct {
		Address  string
		CSRF     string
		JMAP     struct{ APIURL string }
		Branding struct {
			Known bool
			Name  string
		}
		Prefs struct{ Theme string }
	}
	json.Unmarshal(body, &sr)
	if sr.Address != "ann@example.test" || sr.CSRF == "" || sr.JMAP.APIURL != "/api/jmap" || !sr.Branding.Known || sr.Branding.Name != "Example Co" || sr.Prefs.Theme != "system" {
		t.Fatalf("%+v", sr)
	}
}

func TestUnauthenticatedRoutesAnswer401(t *testing.T) {
	e := newEnv(t)
	c := &client{e: e}
	for _, rt := range [][2]string{
		{"GET", "/api/session"}, {"PUT", "/api/prefs"}, {"POST", "/api/jmap"}, {"GET", "/api/download/acc1/b/n"},
		{"POST", "/api/upload/acc1"}, {"GET", "/api/eventsource"}, {"GET", "/api/message-html/e1"},
		{"GET", "/api/sessions"}, {"DELETE", "/api/sessions/x"}, {"POST", "/api/password"},
	} {
		resp, data := c.do(rt[0], rt[1], "{}", nil)
		if resp.StatusCode != 401 || errCode(data) != "unauthenticated" {
			t.Errorf("%s %s: %d %s", rt[0], rt[1], resp.StatusCode, data)
		}
	}
}

func TestSecurityHeaders(t *testing.T) {
	e := newEnv(t)
	c := &client{e: e}
	for _, p := range []string{"/", "/_healthz", "/_version", "/api/session", "/some/route"} {
		resp, _ := c.do("GET", p, nil, nil)
		h := resp.Header
		if !strings.Contains(h.Get("Content-Security-Policy"), "default-src 'self'") || !strings.Contains(h.Get("Content-Security-Policy"), "frame-ancestors 'none'") ||
			h.Get("Referrer-Policy") != "no-referrer" || h.Get("X-Content-Type-Options") != "nosniff" || !strings.HasPrefix(h.Get("Strict-Transport-Security"), "max-age=") {
			t.Errorf("%s: headers %v", p, h)
		}
	}
	resp, body := c.do("GET", "/some/client/route", nil, nil)
	if resp.StatusCode != 200 || !strings.Contains(string(body), "<html") {
		t.Fatalf("SPA fallback: %d", resp.StatusCode)
	}
	resp, _ = c.do("GET", "/api/nope", nil, nil)
	if resp.StatusCode != 404 {
		t.Fatalf("unknown api route: %d", resp.StatusCode)
	}
}

func TestCSRFRequired(t *testing.T) {
	e := newEnv(t)
	c := e.signedIn()
	body := `{"using":["urn:ietf:params:jmap:core"],"methodCalls":[["Core/echo",{"x":1},"a"]]}`
	for name, h := range map[string]map[string]string{
		"no csrf":      {"X-Webmail-CSRF": ""},
		"bad csrf":     {"X-Webmail-CSRF": "zzz"},
		"no origin":    {"Origin": ""},
		"other origin": {"Origin": "https://evil.test"},
	} {
		resp, data := c.do("POST", "/api/jmap", body, h)
		if resp.StatusCode != 403 || errCode(data) != "csrf" {
			t.Errorf("%s: %d %s", name, resp.StatusCode, data)
		}
	}
	if resp, data := c.do("POST", "/api/jmap", body, nil); resp.StatusCode != 200 {
		t.Fatalf("valid: %d %s", resp.StatusCode, data)
	}
}

func TestGatewayJMAPContract(t *testing.T) {
	e := newEnv(t)
	c := e.signedIn()
	// account forced even if the client asks for another one
	body := `{"using":["urn:ietf:params:jmap:core","urn:ietf:params:jmap:mail"],"methodCalls":[["Mailbox/get",{"accountId":"shared1"},"a"],["Email/query",{},"b"]]}`
	resp, data := c.do("POST", "/api/jmap", body, nil)
	if resp.StatusCode != 200 || !strings.Contains(string(data), `"accountId":"acc1"`) || strings.Contains(string(data), "shared1") {
		t.Fatalf("%d %s", resp.StatusCode, data)
	}
	if !strings.Contains(string(data), "Inbox") {
		t.Fatalf("no mailboxes: %s", data)
	}
	// allow-list
	for _, tc := range []struct{ body, code string }{
		{`{"using":["urn:ietf:params:jmap:core"],"methodCalls":[["Email/import",{},"a"]]}`, "method_not_allowed"},
		{`{"using":["urn:ietf:params:jmap:principals"],"methodCalls":[["Core/echo",{},"a"]]}`, "capability_not_allowed"},
	} {
		resp, data := c.do("POST", "/api/jmap", tc.body, nil)
		if resp.StatusCode != 403 || errCode(data) != tc.code {
			t.Errorf("%s: %d %s", tc.code, resp.StatusCode, data)
		}
	}
	// too many calls and too large
	calls := strings.TrimSuffix(strings.Repeat(`["Core/echo",{},"c"],`, 33), ",")
	if resp, _ := c.do("POST", "/api/jmap", `{"using":["urn:ietf:params:jmap:core"],"methodCalls":[`+calls+`]}`, nil); resp.StatusCode != 403 {
		t.Errorf("33 calls: %d", resp.StatusCode)
	}
	big := `{"using":["urn:ietf:params:jmap:core"],"methodCalls":[["Core/echo",{"p":"` + strings.Repeat("a", 1<<20) + `"},"a"]]}`
	if resp, _ := c.do("POST", "/api/jmap", big, nil); resp.StatusCode != 413 {
		t.Errorf("big: %d", resp.StatusCode)
	}
	// real client address is forwarded upstream
	if e.world.LastForwarded == "" {
		t.Error("X-Forwarded-For not sent upstream")
	}
}

func TestMessageHTML(t *testing.T) {
	e := newEnv(t)
	c := e.signedIn()
	resp, data := c.do("GET", "/api/message-html/e1", nil, nil)
	if resp.StatusCode != 200 {
		t.Fatalf("%d %s", resp.StatusCode, data)
	}
	var m struct {
		HTML          string
		HasRemote     bool
		RemoteBlocked int
		Plain         bool
	}
	json.Unmarshal(data, &m)
	if strings.Contains(m.HTML, "<script") || strings.Contains(m.HTML, "javascript:") || strings.Contains(m.HTML, "tracker.example") {
		t.Fatalf("unsafe html: %s", m.HTML)
	}
	if !m.HasRemote || m.RemoteBlocked != 1 || m.Plain || !strings.Contains(m.HTML, "data:image/png;base64,") {
		t.Fatalf("%+v", m)
	}
	_, data = c.do("GET", "/api/message-html/e1?images=1", nil, nil)
	json.Unmarshal(data, &m)
	if !strings.Contains(m.HTML, "tracker.example") || m.RemoteBlocked != 0 {
		t.Fatalf("images=1: %+v", m)
	}
	_, data = c.do("GET", "/api/message-html/e2", nil, nil)
	json.Unmarshal(data, &m)
	if !m.Plain || !strings.Contains(m.HTML, `href="https://example.org/x"`) {
		t.Fatalf("plain: %+v", m)
	}
	if resp, _ := c.do("GET", "/api/message-html/nope", nil, nil); resp.StatusCode != 404 {
		t.Fatalf("missing: %d", resp.StatusCode)
	}
	if resp, _ := c.do("GET", "/api/message-html/a%2Fb", nil, nil); resp.StatusCode != 400 && resp.StatusCode != 404 {
		t.Fatalf("bad id: %d", resp.StatusCode)
	}
}

func TestDownloadUploadEventSource(t *testing.T) {
	e := newEnv(t)
	c := e.signedIn()
	resp, data := c.do("GET", "/api/download/acc1/blob-att/report.pdf?type=application/pdf", nil, nil)
	if resp.StatusCode != 200 || string(data) != "attachment-bytes" {
		t.Fatalf("%d %q", resp.StatusCode, data)
	}
	if !strings.HasPrefix(resp.Header.Get("Content-Disposition"), "attachment") || resp.Header.Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("headers %v", resp.Header)
	}
	resp, _ = c.do("GET", "/api/download/acc1/blob-logo-x/p.png?type=image/png", nil, nil)
	if resp.StatusCode != 200 || !strings.HasPrefix(resp.Header.Get("Content-Disposition"), "inline") {
		t.Fatalf("image: %d %v", resp.StatusCode, resp.Header)
	}
	resp, _ = c.do("GET", "/api/download/acc1/blob-logo-x/p.svg?type=image/svg%2Bxml", nil, nil)
	if !strings.HasPrefix(resp.Header.Get("Content-Disposition"), "attachment") {
		t.Fatalf("svg must be attachment: %v", resp.Header)
	}
	if resp, _ := c.do("GET", "/api/download/shared1/blob-att/x", nil, nil); resp.StatusCode != 403 {
		t.Fatalf("other account: %d", resp.StatusCode)
	}
	resp, data = c.do("POST", "/api/upload/acc1", []byte("hello"), map[string]string{"Content-Type": "text/plain"})
	if resp.StatusCode != 201 || !strings.Contains(string(data), `"size":5`) {
		t.Fatalf("upload: %d %s", resp.StatusCode, data)
	}
	if resp, _ := c.do("POST", "/api/upload/acc1", bytes.Repeat([]byte("x"), 1<<20+10), map[string]string{"Content-Type": "application/octet-stream"}); resp.StatusCode != 413 {
		t.Fatalf("oversize upload: %d", resp.StatusCode)
	}
	if resp, _ := c.do("POST", "/api/upload/shared1", []byte("x"), nil); resp.StatusCode != 403 {
		t.Fatalf("upload other account: %d", resp.StatusCode)
	}
	resp, data = c.do("GET", "/api/eventsource?types=*&ping=30", nil, nil)
	if resp.StatusCode != 200 || resp.Header.Get("Content-Type") != "text/event-stream" || !strings.Contains(string(data), "StateChange") {
		t.Fatalf("sse: %d %q", resp.StatusCode, data)
	}
	if resp, _ := c.do("GET", "/api/eventsource?types=a%20b", nil, nil); resp.StatusCode != 400 {
		t.Fatalf("bad types: %d", resp.StatusCode)
	}
}

func TestUpstream401EndsSession(t *testing.T) {
	e := newEnv(t)
	c := e.signedIn()
	e.world.RevokeAllFor("ann@example.test") // e.g. an admin password change
	resp, data := c.do("POST", "/api/jmap", `{"using":["urn:ietf:params:jmap:core"],"methodCalls":[["Core/echo",{},"a"]]}`, nil)
	if resp.StatusCode != 401 {
		t.Fatalf("%d %s", resp.StatusCode, data)
	}
	if resp, _ := c.do("GET", "/api/session", nil, nil); resp.StatusCode != 401 {
		t.Fatalf("session should be gone: %d", resp.StatusCode)
	}
	n, _ := e.s.store.CountSessions(context.Background())
	if n != 0 {
		t.Fatalf("%d sessions left", n)
	}
}

func TestLogoutRevokesCredential(t *testing.T) {
	e := newEnv(t)
	c := e.signedIn()
	if e.world.Credentials() != 1 {
		t.Fatal("no credential")
	}
	if resp, _ := c.do("POST", "/api/logout", "{}", nil); resp.StatusCode != 200 {
		t.Fatal(resp.StatusCode)
	}
	e.s.sessions.Wait()
	if e.world.Credentials() != 0 || len(e.world.Revoked) != 1 {
		t.Fatalf("credential not revoked: %d %v", e.world.Credentials(), e.world.Revoked)
	}
	if resp, _ := c.do("GET", "/api/session", nil, nil); resp.StatusCode != 401 {
		t.Fatalf("%d", resp.StatusCode)
	}
}

func TestSessionsListAndEnd(t *testing.T) {
	e := newEnv(t)
	a := e.signedIn()
	b := e.signedIn()
	_, data := a.do("GET", "/api/sessions", nil, nil)
	var list []struct {
		ID      string
		Current bool
	}
	json.Unmarshal(data, &list)
	if len(list) != 2 {
		t.Fatalf("%s", data)
	}
	var other, cur string
	for _, s := range list {
		if s.Current {
			cur = s.ID
		} else {
			other = s.ID
		}
	}
	if resp, d := a.do("DELETE", "/api/sessions/"+cur, nil, nil); resp.StatusCode != 400 {
		t.Fatalf("ending current: %d %s", resp.StatusCode, d)
	}
	if resp, _ := a.do("DELETE", "/api/sessions/"+other, nil, nil); resp.StatusCode != 200 {
		t.Fatalf("end other: %d", resp.StatusCode)
	}
	e.s.sessions.Wait()
	if resp, _ := b.do("GET", "/api/session", nil, nil); resp.StatusCode != 401 {
		t.Fatalf("ended session still works: %d", resp.StatusCode)
	}
	if resp, _ := a.do("GET", "/api/session", nil, nil); resp.StatusCode != 200 {
		t.Fatalf("current session broken: %d", resp.StatusCode)
	}
}

func TestPasswordChangeEndsSessions(t *testing.T) {
	e := newEnv(t)
	a := e.signedIn()
	b := e.signedIn()
	resp, data := a.do("POST", "/api/password", map[string]string{"current": "wrong", "next": "new-password-1"}, nil)
	if resp.StatusCode != 401 {
		t.Fatalf("wrong current: %d %s", resp.StatusCode, data)
	}
	resp, data = a.do("POST", "/api/password", map[string]string{"current": "correct-horse", "next": "short"}, nil)
	if resp.StatusCode != 400 || errCode(data) != "password_policy" {
		t.Fatalf("policy: %d %s", resp.StatusCode, data)
	}
	resp, data = a.do("POST", "/api/password", map[string]string{"current": "correct-horse", "next": "new-password-1"}, nil)
	if resp.StatusCode != 200 {
		t.Fatalf("change: %d %s", resp.StatusCode, data)
	}
	for _, c := range []*client{a, b} {
		if resp, _ := c.do("GET", "/api/session", nil, nil); resp.StatusCode != 401 {
			t.Fatalf("session survived password change: %d", resp.StatusCode)
		}
	}
	n := &client{e: e}
	if resp, _ := n.login("ann@example.test", "correct-horse"); resp.StatusCode != 401 {
		t.Fatal("old password works")
	}
	if resp, _ := n.login("ann@example.test", "new-password-1"); resp.StatusCode != 200 {
		t.Fatal("new password rejected")
	}
}

func TestLoginRateLimits(t *testing.T) {
	e := newEnv(t)
	c := &client{e: e}
	got429 := false
	for i := 0; i < 8; i++ {
		resp, data := c.login("ann@example.test", "bad")
		if resp.StatusCode == 429 {
			got429 = true
			if errCode(data) != "rate_limited" || resp.Header.Get("Retry-After") == "" {
				t.Fatalf("429 shape: %v %s", resp.Header, data)
			}
			break
		}
	}
	if !got429 {
		t.Fatal("never rate limited")
	}
	// even the right password is refused while blocked: the platform is not asked
	before := e.world.Credentials()
	if resp, _ := c.login("ann@example.test", "correct-horse"); resp.StatusCode != 429 || e.world.Credentials() != before {
		t.Fatalf("blocked login got through: %d", resp.StatusCode)
	}
}

func TestBrandingEndpoint(t *testing.T) {
	e := newEnv(t)
	c := &client{e: e}
	_, data := c.do("GET", "/api/branding?domain=example.test", nil, nil)
	var b struct {
		Known  bool
		Name   string
		Accent string
	}
	json.Unmarshal(data, &b)
	if !b.Known || b.Name != "Example Co" || b.Accent != "#336699" {
		t.Fatalf("%s", data)
	}
	resp, data := c.do("GET", "/api/branding?domain=nowhere.test", nil, nil)
	json.Unmarshal(data, &b)
	if resp.StatusCode != 200 || b.Known || b.Name != "Webmail" {
		t.Fatalf("unknown domain must be neutral, not an error: %d %s", resp.StatusCode, data)
	}
	if resp, _ := c.do("GET", "/api/branding?domain=../../x", nil, nil); resp.StatusCode != 200 {
		t.Fatalf("junk domain: %d", resp.StatusCode)
	}
}

func TestPrefs(t *testing.T) {
	e := newEnv(t)
	c := e.signedIn()
	resp, data := c.do("PUT", "/api/prefs", map[string]any{"theme": "dark", "density": "compact", "trustedSenders": []string{"Boss@Example.test", "boss@example.test"}}, nil)
	if resp.StatusCode != 200 {
		t.Fatalf("%d %s", resp.StatusCode, data)
	}
	if resp, _ := c.do("PUT", "/api/prefs", map[string]any{"theme": "<script>"}, nil); resp.StatusCode != 400 {
		t.Fatalf("invalid prefs: %d", resp.StatusCode)
	}
	_, data = c.do("GET", "/api/session", nil, nil)
	var sr struct {
		Prefs struct {
			Theme          string
			TrustedSenders []string
		}
	}
	json.Unmarshal(data, &sr)
	if sr.Prefs.Theme != "dark" || len(sr.Prefs.TrustedSenders) != 1 || sr.Prefs.TrustedSenders[0] != "boss@example.test" {
		t.Fatalf("%s", data)
	}
}

func TestInviteRedeem(t *testing.T) {
	e := newEnv(t)
	c := &client{e: e}
	if resp, data := c.do("POST", "/api/invite", map[string]string{"token": "bad", "password": "longenough1"}, nil); resp.StatusCode != 400 || errCode(data) != "invalid_token" {
		t.Fatalf("%d %s", resp.StatusCode, data)
	}
	if resp, data := c.do("POST", "/api/invite", map[string]string{"token": "good-invite", "password": "short"}, nil); errCode(data) != "password_policy" {
		t.Fatalf("%d %s", resp.StatusCode, data)
	}
	if resp, _ := c.do("POST", "/api/invite", map[string]string{"token": "good-invite", "password": "longenough1"}, nil); resp.StatusCode != 200 {
		t.Fatalf("%d", resp.StatusCode)
	}
	if resp, _ := c.do("POST", "/api/invite", map[string]string{"token": "good-invite", "password": "longenough1"}, nil); resp.StatusCode != 400 {
		t.Fatal("invite reusable")
	}
}

func TestHealthVersionMetrics(t *testing.T) {
	e := newEnv(t)
	c := e.signedIn()
	if resp, _ := c.do("GET", "/_healthz", nil, nil); resp.StatusCode != 200 {
		t.Fatal(resp.StatusCode)
	}
	_, data := c.do("GET", "/_version", nil, nil)
	if !strings.Contains(string(data), `"version":"test"`) {
		t.Fatalf("%s", data)
	}
	// metrics live only on the admin listener
	if resp, _ := c.do("GET", "/_metrics", nil, nil); resp.StatusCode == 200 && strings.Contains(string(data), "webmail_http") {
		t.Fatal("metrics on public listener")
	}
	resp, err := http.Get("http://" + e.s.AdminAddr() + "/_metrics")
	if err != nil {
		t.Fatal(err)
	}
	m, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	for _, want := range []string{"webmail_http_requests_total", "webmail_logins_total", "webmail_sessions", "webmail_upstream_requests_total"} {
		if !strings.Contains(string(m), want) {
			t.Errorf("metrics lack %s", want)
		}
	}
}

func TestReapEndsExpiredAndRevokes(t *testing.T) {
	e := newEnv(t)
	now := time.Now()
	e.s.now = func() time.Time { return now }
	e.s.sessions.Now = e.s.now
	c := e.signedIn()
	now = now.Add(13 * time.Hour) // past the 12h idle expiry
	if resp, _ := c.do("GET", "/api/session", nil, nil); resp.StatusCode != 401 {
		t.Fatalf("idle-expired session works: %d", resp.StatusCode)
	}
	e.s.Reap(context.Background())
	e.s.sessions.Wait()
	if len(e.world.Revoked) != 1 {
		t.Fatalf("credential not revoked on expiry: %v", e.world.Revoked)
	}
}
