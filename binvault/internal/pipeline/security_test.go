package pipeline_test

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/config"
)

// A before token sees and changes only the staged object; everything else it
// might try is refused.
func TestBeforeTokenIsConfined(t *testing.T) {
	grants := map[string]any{"grants": []map[string]any{
		{"actions": []string{"read", "write", "delete", "tag"}, "keys": []string{"{key}"}},
		{"actions": []string{"read", "list"}, "keys": []string{"rules/*"}},
	}}
	e := newGate(t, map[string]any{"versioning": "enabled"}, map[string]any{"token": grants}, nil)
	e.n.bucket("other", nil)
	e.n.must(e.c, 200, "PUT", objPath("bkt", "rules/main.json"), []byte(`{"max":10}`))
	oc := e.n.token("other", allGrants)
	e.n.must(oc, 200, "PUT", objPath("other", "k"), []byte("other bucket"))
	e.n.must(e.c, 200, "PUT", objPath("bkt", "secret"), []byte("secret"))

	results := map[string]int{}
	var tokenForLater string
	e.svc.on("gate", func(cl *call) reply {
		if cl.str("key") != "target" {
			return reply{}
		}
		tok := cl.bearer()
		tokenForLater = tok
		try := func(name, method, path string, body []byte, hdr ...string) {
			results[name] = e.n.s3b(tok, method, path, body, hdr...).status
		}
		try("read staged", "GET", objPath("bkt", "target"), nil)
		try("head staged", "HEAD", objPath("bkt", "target"), nil)
		try("read rules", "GET", objPath("bkt", "rules/main.json"), nil)
		try("read other key", "GET", objPath("bkt", "secret"), nil)
		try("read other bucket", "GET", objPath("other", "k"), nil)
		try("list rules", "GET", "/bkt?list-type=2&prefix=rules/", nil)
		try("list everything", "GET", "/bkt?list-type=2", nil)
		try("list versions", "GET", "/bkt?versions", nil)
		try("write other key", "PUT", objPath("bkt", "elsewhere"), []byte("x"))
		try("write rules", "PUT", objPath("bkt", "rules/new"), []byte("x"))
		try("delete other key", "DELETE", objPath("bkt", "secret"), nil)
		try("tag other key", "PUT", objPath("bkt", "secret")+"?tagging", []byte(`<Tagging><TagSet></TagSet></Tagging>`))
		try("multipart create", "POST", objPath("bkt", "target")+"?uploads", nil)
		try("copy onto the key", "PUT", objPath("bkt", "target"), nil, "x-amz-copy-source", "/bkt/rules/main.json")
		try("copy from rules to elsewhere", "PUT", objPath("bkt", "elsewhere"), nil, "x-amz-copy-source", "/bkt/rules/main.json")
		try("read with versionId", "GET", objPath("bkt", "rules/main.json")+"?versionId=null", nil)
		try("read staged with versionId", "GET", objPath("bkt", "target")+"?versionId="+cl.str("object", "version"), nil)
		try("delete with versionId", "DELETE", objPath("bkt", "target")+"?versionId="+cl.str("object", "version"), nil)
		try("delete objects", "POST", "/bkt?delete", []byte(`<Delete><Object><Key>target</Key></Object></Delete>`))
		try("acl put", "PUT", objPath("bkt", "target")+"?acl", nil, "x-amz-acl", "private")
		return reply{}
	})
	e.n.must(e.c, 200, "PUT", objPath("bkt", "target"), []byte("staged bytes"))
	want := map[string]int{
		"read staged": 200, "head staged": 200, "read rules": 200,
		"read other key": 403, "read other bucket": 403,
		"list rules": 200, "list everything": 403, "list versions": 403,
		"write other key": 403, "write rules": 403, "delete other key": 403, "tag other key": 403,
		"multipart create": 403, "copy onto the key": 403, "copy from rules to elsewhere": 403,
		"read with versionId": 403, "read staged with versionId": 403, "delete with versionId": 403,
		"delete objects": 403, "acl put": 403,
	}
	for k, w := range want {
		if results[k] != w {
			t.Errorf("%s: status %d, want %d", k, results[k], w)
		}
	}
	// the other objects are untouched
	if got := e.n.must(e.c, 200, "GET", objPath("bkt", "secret"), nil); string(got.body) != "secret" {
		t.Fatal("secret was touched")
	}
	e.n.must(e.c, 404, "GET", objPath("bkt", "elsewhere"), nil)
	// the token is dead once the call ended
	if st := e.n.s3b(tokenForLater, "GET", objPath("bkt", "rules/main.json"), nil).status; st != 403 {
		t.Fatalf("a token used after its call ended: %d", st)
	}
	// and the admin API is not for it
	req, _ := http.NewRequest("GET", e.n.adminURL+"/_admin/v1/buckets", nil)
	req.Header.Set("Authorization", "Bearer "+tokenForLater)
	if r := e.n.do(req); r.status != 401 {
		t.Fatalf("admin API with a pipeline token: %d", r.status)
	}
}

func TestAfterTokenIsConfined(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	n.bucket("other", nil)
	c := n.token("bkt", allGrants)
	oc := n.token("other", allGrants)
	n.must(oc, 200, "PUT", objPath("other", "k"), []byte("x"))
	n.must(c, 200, "PUT", objPath("bkt", "private"), []byte("x"))
	n.createPipe(svc, "p", "after", map[string]any{"token": map[string]any{"grants": []map[string]any{
		{"actions": []string{"read"}, "keys": []string{"{key}"}},
		{"actions": []string{"write"}, "keys": []string{"derived/{key}/*"}},
	}}})
	n.attach("bkt", "p")
	results := map[string]int{}
	var tok string
	svc.on("p", func(cl *call) reply {
		if cl.str("key") != "doc" {
			return reply{}
		}
		tok = cl.bearer()
		try := func(name, method, path string, body []byte, hdr ...string) {
			results[name] = n.s3b(tok, method, path, body, hdr...).status
		}
		try("read own", "GET", objPath("bkt", "doc"), nil)
		try("read other key", "GET", objPath("bkt", "private"), nil)
		try("read other bucket", "GET", objPath("other", "k"), nil)
		try("write derivative", "PUT", objPath("bkt", "derived/doc/a"), []byte("x"))
		try("write elsewhere", "PUT", objPath("bkt", "x"), []byte("x"))
		try("overwrite own key", "PUT", objPath("bkt", "doc"), []byte("x"))
		try("delete own key", "DELETE", objPath("bkt", "doc"), nil)
		try("list", "GET", "/bkt?list-type=2", nil)
		try("list buckets", "GET", "/", nil)
		try("put other bucket", "PUT", objPath("other", "k2"), []byte("x"))
		try("create bucket", "PUT", "/brandnew", nil)
		try("lifecycle put", "PUT", "/bkt?lifecycle", []byte("<x/>"))
		return reply{}
	})
	n.must(c, 200, "PUT", objPath("bkt", "doc"), []byte("body"))
	n.waitRunState("pipeline=p&key=doc", "succeeded")
	want := map[string]int{
		"read own": 200, "read other key": 403, "read other bucket": 403, "write derivative": 200, "write elsewhere": 403,
		"overwrite own key": 403, "delete own key": 403, "list": 403, "put other bucket": 403, "lifecycle put": 403,
	}
	for k, w := range want {
		if results[k] != w {
			t.Errorf("%s: status %d, want %d", k, results[k], w)
		}
	}
	if results["create bucket"] == 200 {
		t.Errorf("a pipeline token must not create buckets: %d", results["create bucket"])
	}
	if results["list buckets"] != 200 {
		// ListBuckets answers the credential's own bucket only
		t.Errorf("list buckets: %d", results["list buckets"])
	}
	// after the call ended the token is gone
	if st := n.s3b(tok, "GET", objPath("bkt", "doc"), nil).status; st != 403 {
		t.Fatalf("a token used after its call ended: %d", st)
	}
	req, _ := http.NewRequest("GET", n.adminURL+"/_admin/v1/status", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	if r := n.do(req); r.status != 401 {
		t.Fatalf("admin API with a pipeline token: %d", r.status)
	}
	// the derivative the service wrote exists, written under the pipeline's name
	n.must(c, 200, "GET", objPath("bkt", "derived/doc/a"), nil)
}

// A pipeline token also works as SigV4 credentials (boto3, the Go SDK, aws cli).
func TestPipelineTokenSigV4(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "p", "after", map[string]any{"token": map[string]any{"grants": []map[string]any{
		{"actions": []string{"read", "write"}, "keys": []string{"{key}", "out/*"}},
	}}})
	n.attach("bkt", "p")
	var got, wrote int
	svc.on("p", func(cl *call) reply {
		sc := cred{cl.str("s3", "access_key_id"), cl.str("s3", "secret_access_key")}
		got = n.s3(sc, "GET", objPath("bkt", cl.str("key")), nil).status
		wrote = n.s3(sc, "PUT", objPath("bkt", "out/x"), []byte("signed")).status
		// a wrong secret is rejected
		if st := n.s3(cred{sc.ak, strings.Repeat("x", 40)}, "GET", objPath("bkt", cl.str("key")), nil).status; st != 403 {
			t.Errorf("wrong secret: %d", st)
		}
		return reply{}
	})
	n.must(c, 200, "PUT", objPath("bkt", "doc"), []byte("body"))
	n.waitRunState("pipeline=p", "succeeded")
	if got != 200 || wrote != 200 {
		t.Fatalf("SigV4 with a pipeline token: read %d write %d", got, wrote)
	}
}

// Failed authentications of pipeline keys are never counted against the client
// address (spec §4.8), so a service calling with a revoked token cannot lock
// itself or its neighbours out.
func TestPipelineKeyFailuresAreNotThrottled(t *testing.T) {
	n := startNode(t, "", func(c *config.Config) { c.AuthFailLimit = 3 })
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	for i := 0; i < 20; i++ {
		bad := fmt.Sprintf("BVPAAAAAAAAAAAAAAAA%d.%s", i%10, strings.Repeat("x", 40))
		if st := n.s3b(bad, "GET", objPath("bkt", "k"), nil).status; st != 403 {
			t.Fatalf("bad pipeline token: %d", st)
		}
	}
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("x")) // not throttled
	// a bucket key as bearer is AccessDenied, the admin token is just an invalid bearer
	if st := n.s3b(c.ak+"."+c.sk, "GET", objPath("bkt", "k"), nil).status; st != 403 {
		t.Fatalf("bucket token as bearer: %d", st)
	}
	if st := n.s3b(n.adminTok, "GET", objPath("bkt", "k"), nil).status; st != 403 {
		t.Fatalf("admin token as bearer: %d", st)
	}
}

func TestBeforeStagedObjectIsInvisibleToOthers(t *testing.T) {
	e := newGate(t, nil, nil, nil)
	var block atomic.Bool
	hold := make(chan struct{})
	in := make(chan struct{}, 2)
	e.svc.on("gate", func(cl *call) reply {
		if block.Load() {
			in <- struct{}{}
			<-hold
		}
		return reply{}
	})
	e.n.must(e.c, 200, "PUT", objPath("bkt", "existing"), []byte("committed v1"))
	block.Store(true)
	done := make(chan int, 2)
	go func() { done <- e.n.s3(e.c, "PUT", objPath("bkt", "existing"), []byte("staged v2")).status }()
	go func() { done <- e.n.s3(e.c, "PUT", objPath("bkt", "brand-new"), []byte("staged")).status }()
	<-in
	<-in
	// while both chains run: the committed object is still v1, the new key does not exist
	if got := e.n.must(e.c, 200, "GET", objPath("bkt", "existing"), nil); string(got.body) != "committed v1" {
		t.Fatalf("the previous committed object stays visible: %q", got.body)
	}
	e.n.must(e.c, 404, "GET", objPath("bkt", "brand-new"), nil)
	e.n.must(e.c, 404, "HEAD", objPath("bkt", "brand-new"), nil)
	list := e.n.must(e.c, 200, "GET", "/bkt?list-type=2", nil)
	if strings.Contains(string(list.body), "brand-new") {
		t.Fatalf("a staged object is never listed: %s", list.body)
	}
	close(hold)
	if a, b := <-done, <-done; a != 200 || b != 200 {
		t.Fatalf("%d %d", a, b)
	}
	if got := e.n.must(e.c, 200, "GET", objPath("bkt", "existing"), nil); string(got.body) != "staged v2" {
		t.Fatalf("after the chain: %q", got.body)
	}
}

// A key containing '*' (or other pattern characters) can never widen the grant
// a template expands to (spec §7.8).
func TestGrantTemplatesAreLiteralForOddKeys(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "p", "after", nil) // read on {key}
	n.attach("bkt", "p")
	keys := []string{"a*", `we\ird`, "uni/ünï cödé.txt", "sp ace/{x}.txt", "plus+and%25.txt"}
	n.must(c, 200, "PUT", objPath("bkt", "abc"), []byte("neighbour")) // what "a*" would match if it widened
	n.must(c, 200, "PUT", objPath("bkt", "wex"), []byte("neighbour"))
	results := map[string][2]int{}
	var mu sync.Mutex
	svc.on("p", func(cl *call) reply {
		key := cl.str("key")
		own := n.s3b(cl.bearer(), "GET", objPath("bkt", key), nil).status
		other := 0
		switch key {
		case "a*":
			other = n.s3b(cl.bearer(), "GET", objPath("bkt", "abc"), nil).status
		case `we\ird`:
			other = n.s3b(cl.bearer(), "GET", objPath("bkt", "wex"), nil).status
		}
		mu.Lock()
		results[key] = [2]int{own, other}
		mu.Unlock()
		return reply{}
	})
	for _, k := range keys {
		n.must(c, 200, "PUT", objPath("bkt", k), []byte("x"))
	}
	eventually(t, 15*time.Second, "the runs", func() bool { return len(n.runs("state=succeeded&limit=100")) >= len(keys)+2 })
	mu.Lock()
	defer mu.Unlock()
	for _, k := range keys {
		if results[k][0] != 200 {
			t.Errorf("key %q: the token must read its own object, got %d", k, results[k][0])
		}
	}
	if results["a*"][1] != 403 || results[`we\ird`][1] != 403 {
		t.Errorf("a pattern character in a key widened the grant: %v", results)
	}
}
