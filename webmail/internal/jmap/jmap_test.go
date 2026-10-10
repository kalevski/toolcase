package jmap

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func call(t *testing.T, out []byte, i int) (string, map[string]any) {
	t.Helper()
	var req struct {
		MethodCalls [][]json.RawMessage `json:"methodCalls"`
	}
	if err := json.Unmarshal(out, &req); err != nil {
		t.Fatal(err)
	}
	var name string
	json.Unmarshal(req.MethodCalls[i][0], &name)
	var args map[string]any
	json.Unmarshal(req.MethodCalls[i][1], &args)
	return name, args
}

func TestFilterForcesAccountID(t *testing.T) {
	body := `{"using":["urn:ietf:params:jmap:core","urn:ietf:params:jmap:mail"],"methodCalls":[
		["Mailbox/get",{"accountId":"victim","ids":null},"a"],
		["Email/query",{"#accountId":{"resultOf":"a","name":"Mailbox/get","path":"/accountId"},"limit":5},"b"],
		["Email/get",{"ids":["x"]},"c"]],"createdIds":{"k":"v"}}`
	out, v := Filter([]byte(body), "u1")
	if v != nil {
		t.Fatal(v)
	}
	for i := 0; i < 3; i++ {
		_, args := call(t, out, i)
		if args["accountId"] != "u1" {
			t.Errorf("call %d accountId = %v", i, args["accountId"])
		}
		if _, has := args["#accountId"]; has {
			t.Errorf("call %d kept #accountId", i)
		}
	}
	if strings.Contains(string(out), "createdIds") || strings.Contains(string(out), "victim") {
		t.Fatalf("leaked: %s", out)
	}
	// ids survive
	_, args := call(t, out, 2)
	if ids, _ := args["ids"].([]any); len(ids) != 1 {
		t.Fatalf("args lost: %v", args)
	}
}

func TestFilterRejects(t *testing.T) {
	ok := func(method string) string {
		return `{"using":["urn:ietf:params:jmap:core","urn:ietf:params:jmap:mail"],"methodCalls":[["` + method + `",{},"a"]]}`
	}
	cases := []struct {
		name, body string
		status     int
		code       string
	}{
		{"email copy", ok("Email/copy"), 403, "method_not_allowed"},
		{"email import", ok("Email/import"), 403, "method_not_allowed"},
		{"blob copy", ok("Blob/copy"), 403, "method_not_allowed"},
		{"principal", ok("Principal/get"), 403, "method_not_allowed"},
		{"vendor", ok("x-stalwart/admin"), 403, "method_not_allowed"},
		{"bad capability", `{"using":["urn:ietf:params:jmap:core","urn:ietf:params:jmap:principals"],"methodCalls":[["Core/echo",{},"a"]]}`, 403, "capability_not_allowed"},
		{"vendor capability", `{"using":["urn:com:stalwart:jmap"],"methodCalls":[["Core/echo",{},"a"]]}`, 403, "capability_not_allowed"},
		{"not json", `nope`, 400, "bad_request"},
		{"no calls", `{"using":["urn:ietf:params:jmap:core"],"methodCalls":[]}`, 400, "bad_request"},
		{"no using", `{"methodCalls":[["Core/echo",{},"a"]]}`, 400, "bad_request"},
		{"bad triple", `{"using":["urn:ietf:params:jmap:core"],"methodCalls":[["Core/echo",{}]]}`, 400, "bad_request"},
		{"args not object", `{"using":["urn:ietf:params:jmap:core"],"methodCalls":[["Core/echo",[],"a"]]}`, 400, "bad_request"},
		{"cross account", `{"using":["urn:ietf:params:jmap:core"],"methodCalls":[["Core/echo",{"fromAccountId":"z"},"a"]]}`, 403, "account_not_allowed"},
	}
	for _, c := range cases {
		out, v := Filter([]byte(c.body), "u1")
		if v == nil || out != nil {
			t.Errorf("%s: not rejected", c.name)
			continue
		}
		if v.Status != c.status || v.Code != c.code {
			t.Errorf("%s: got %d %s, want %d %s", c.name, v.Status, v.Code, c.status, c.code)
		}
	}
}

func TestFilterLimits(t *testing.T) {
	calls := make([]string, 33)
	for i := range calls {
		calls[i] = `["Core/echo",{},"c"]`
	}
	body := `{"using":["urn:ietf:params:jmap:core"],"methodCalls":[` + strings.Join(calls[:32], ",") + `]}`
	if _, v := Filter([]byte(body), "u"); v != nil {
		t.Fatalf("32 calls must pass: %v", v)
	}
	body = `{"using":["urn:ietf:params:jmap:core"],"methodCalls":[` + strings.Join(calls, ",") + `]}`
	if _, v := Filter([]byte(body), "u"); v == nil || v.Code != "too_many_calls" {
		t.Fatalf("33 calls: %v", v)
	}
	big := `{"using":["urn:ietf:params:jmap:core"],"methodCalls":[["Core/echo",{"p":"` + strings.Repeat("a", MaxBodyBytes) + `"},"a"]]}`
	if _, v := Filter([]byte(big), "u"); v == nil || v.Status != 413 {
		t.Fatalf("oversize: %v", v)
	}
}

func TestEveryAllowedMethodHasCapability(t *testing.T) {
	for m := range AllowedMethods {
		if strings.Contains(m, "copy") || strings.Contains(m, "import") {
			t.Errorf("%s must not be allowed", m)
		}
	}
}

const upstreamDoc = `{
 "capabilities":{"urn:ietf:params:jmap:core":{"maxCallsInRequest":16},"urn:ietf:params:jmap:mail":{},
   "urn:ietf:params:jmap:submission":{},"urn:ietf:params:jmap:principals":{},"urn:com:stalwart:jmap":{}},
 "accounts":{"u1":{"name":"ann@example.test","isPersonal":true,"isReadOnly":false,
    "accountCapabilities":{"urn:ietf:params:jmap:mail":{},"urn:ietf:params:jmap:principals":{}}},
   "shared9":{"name":"Shared","isPersonal":false,"accountCapabilities":{"urn:ietf:params:jmap:mail":{}}}},
 "primaryAccounts":{"urn:ietf:params:jmap:mail":"u1","urn:ietf:params:jmap:principals":"u1"},
 "username":"ann@example.test",
 "apiUrl":"https://mail.internal.example/jmap/","downloadUrl":"https://mail.internal.example/jmap/download/{accountId}/{blobId}/{name}?accept={type}",
 "uploadUrl":"https://mail.internal.example/jmap/upload/{accountId}/","eventSourceUrl":"https://mail.internal.example/jmap/eventsource/?types={types}",
 "state":"s1"}`

func TestSessionRewrite(t *testing.T) {
	var d SessionDoc
	if err := json.Unmarshal([]byte(upstreamDoc), &d); err != nil {
		t.Fatal(err)
	}
	if d.OwnAccountID() != "u1" {
		t.Fatalf("own account %q", d.OwnAccountID())
	}
	r := d.Rewrite("u1", "ann@example.test")
	b, _ := json.Marshal(r)
	s := string(b)
	for _, bad := range []string{"mail.internal.example", "shared9", "principals", "stalwart"} {
		if strings.Contains(s, bad) {
			t.Errorf("rewritten document leaks %q: %s", bad, s)
		}
	}
	if r.APIURL != "/api/jmap" || !strings.HasPrefix(r.DownloadURL, "/api/download/") {
		t.Fatalf("urls: %+v", r)
	}
	if _, ok := r.Capabilities[CapSubmission]; !ok || r.PrimaryAccounts[CapMail] != "u1" {
		t.Fatalf("lost allowed data: %s", s)
	}
}

func TestOwnAccountFallback(t *testing.T) {
	d := SessionDoc{Accounts: map[string]Account{"b": {IsPersonal: true}, "a": {IsPersonal: false}}}
	if d.OwnAccountID() != "b" {
		t.Fatal(d.OwnAccountID())
	}
	if (&SessionDoc{}).OwnAccountID() != "" {
		t.Fatal("empty doc")
	}
}

func TestResolveRerootsOnBase(t *testing.T) {
	c := New("http://jmap.internal:8080", 0)
	got, err := c.Resolve("https://mail.public.example/jmap/download/a/b/n?accept=x")
	if err != nil || got != "http://jmap.internal:8080/jmap/download/a/b/n?accept=x" {
		t.Fatalf("%q %v", got, err)
	}
	got, _ = c.Resolve("/jmap/")
	if got != "http://jmap.internal:8080/jmap/" {
		t.Fatalf("relative: %q", got)
	}
}

func TestExpandTemplate(t *testing.T) {
	got := ExpandTemplate("/d/{accountId}/{blobId}/{name}?type={type}", map[string]string{
		"accountId": "u1", "blobId": "B/../x", "name": "a b.pdf", "type": "application/pdf"})
	want := "/d/u1/B%2F..%2Fx/a%20b.pdf?type=application%2Fpdf"
	if got != want {
		t.Fatalf("%q != %q", got, want)
	}
}

func TestResolveRefusesSchemeRelativeAndForeignHosts(t *testing.T) {
	c := New("http://jmap.internal:8080", 0)
	for _, in := range []string{"//evil.example/jmap/", "///evil.example/x", "http:/other.example/x"} {
		if got, err := c.Resolve(in); err == nil && !strings.HasPrefix(got, "http://jmap.internal:8080/") {
			t.Fatalf("%q resolved to %q", in, got)
		}
	}
	if _, err := c.Resolve("//evil.example/jmap/"); err == nil {
		t.Fatal("scheme-relative URL must be refused")
	}
}

type fakeStalwart struct {
	password      string
	jmap          bool // offers urn:stalwart:jmap and x:Account/set to the user
	jmapIgnores   bool // acknowledges x:Account/set without changing anything
	legacyIgnores bool // answers the 0.15 endpoint 200 with an HTML page and changes nothing
	setCalls      int
	legacyCalls   int
}

func (f *fakeStalwart) handler(t *testing.T) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, pass, _ := r.BasicAuth()
		if pass != f.password {
			w.WriteHeader(401)
			return
		}
		switch r.URL.Path {
		case SessionPath:
			caps := `{"urn:ietf:params:jmap:core":{},"urn:ietf:params:jmap:mail":{}`
			primary := `{"urn:ietf:params:jmap:mail":"u1"`
			if f.jmap {
				caps += `,"urn:stalwart:jmap":{}`
				primary += `,"urn:stalwart:jmap":"u1"`
			}
			w.Write([]byte(`{"capabilities":` + caps + `},"accounts":{"u1":{"name":"a@x.test","isPersonal":true}},"primaryAccounts":` + primary + `},"apiUrl":"/jmap/"}`))
		case "/jmap/":
			body, _ := io.ReadAll(r.Body)
			name, args := call(t, body, 0)
			if !f.jmap {
				w.Write([]byte(`{"methodResponses":[["error",{"type":"forbidden"},"c0"]]}`))
				return
			}
			switch name {
			case "x:Domain/query":
				w.Write([]byte(`{"methodResponses":[["x:Domain/query",{"ids":["d1"]},"c0"]]}`))
			case "x:Account/query":
				w.Write([]byte(`{"methodResponses":[["x:Account/query",{"ids":["acc1"]},"c0"]]}`))
			case "x:Account/get":
				w.Write([]byte(`{"methodResponses":[["x:Account/get",{"list":[{"id":"acc1","credentials":{"7":{"@type":"Password"}}}]},"c0"]]}`))
			case "x:Account/set":
				f.setCalls++
				update := args["update"].(map[string]any)["acc1"].(map[string]any)
				next, _ := update["credentials/7/secret"].(string)
				if next == "short" {
					w.Write([]byte(`{"methodResponses":[["x:Account/set",{"notUpdated":{"acc1":{"type":"invalidProperties","description":"Too short."}}},"c0"]]}`))
					return
				}
				if !f.jmapIgnores {
					f.password = next
				}
				w.Write([]byte(`{"methodResponses":[["x:Account/set",{"updated":{"acc1":null}},"c0"]]}`))
			}
		case AccountAuthPath:
			f.legacyCalls++
			if f.legacyIgnores {
				w.Header().Set("Content-Type", "text/html")
				w.Write([]byte("<!doctype html><title>Stalwart</title>"))
				return
			}
			var body []map[string]string
			json.NewDecoder(r.Body).Decode(&body)
			if body[0]["password"] == "boom" {
				w.WriteHeader(500)
				return
			}
			f.password = body[0]["password"]
			w.WriteHeader(204)
		default:
			w.WriteHeader(404)
		}
	}
}

func TestChangePassword(t *testing.T) {
	ctx := context.Background()
	run := func(f *fakeStalwart, current, next string) error {
		srv := httptest.NewServer(f.handler(t))
		defer srv.Close()
		return New(srv.URL, time.Second).ChangePassword(ctx, "a@x.test", current, next, "")
	}

	f := &fakeStalwart{password: "old", jmap: true}
	if err := run(f, "old", "new-password"); err != nil || f.password != "new-password" || f.setCalls != 1 || f.legacyCalls != 0 {
		t.Fatalf("jmap: err=%v password=%q set=%d legacy=%d", err, f.password, f.setCalls, f.legacyCalls)
	}

	f = &fakeStalwart{password: "old"}
	if err := run(f, "old", "new-password"); err != nil || f.password != "new-password" || f.legacyCalls != 1 {
		t.Fatalf("legacy fallback: err=%v password=%q legacy=%d", err, f.password, f.legacyCalls)
	}

	f = &fakeStalwart{password: "old", jmap: true}
	if err := run(f, "wrong", "new-password"); !errors.Is(err, ErrUnauthorized) || f.password != "old" {
		t.Fatalf("wrong current: %v", err)
	}

	f = &fakeStalwart{password: "old", jmap: true}
	var pe *PolicyError
	if err := run(f, "old", "short"); !errors.As(err, &pe) || pe.Message != "Too short." || f.password != "old" {
		t.Fatalf("policy: %v", err)
	}

	f = &fakeStalwart{password: "old", legacyIgnores: true}
	if err := run(f, "old", "new-password"); !errors.Is(err, ErrNotApplied) || !errors.Is(err, ErrUnavailable) || f.password != "old" {
		t.Fatalf("acknowledged but ignored (legacy): %v", err)
	}

	f = &fakeStalwart{password: "old", jmap: true, jmapIgnores: true}
	if err := run(f, "old", "new-password"); !errors.Is(err, ErrNotApplied) {
		t.Fatalf("acknowledged but ignored (jmap): %v", err)
	}

	f = &fakeStalwart{password: "old"}
	if err := run(f, "old", "boom"); !errors.Is(err, ErrUnavailable) || errors.Is(err, ErrNotApplied) {
		t.Fatalf("5xx: %v", err)
	}
}
