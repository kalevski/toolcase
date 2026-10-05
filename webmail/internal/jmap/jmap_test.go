package jmap

import (
	"encoding/json"
	"strings"
	"testing"
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
