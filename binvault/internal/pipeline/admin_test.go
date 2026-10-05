package pipeline_test

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestPipelineCreateAndShape(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	out := n.createPipe(svc, "compress-images", "before", map[string]any{
		"description": "Recompress JPEG/PNG",
		"match":       map[string]any{"keys": []string{"uploads/**"}, "content_type": []string{"image/jpeg"}},
		"service": map[string]any{
			"headers": map[string]any{"Authorization": "Bearer service-secret"}, "signing_secret": strings.Repeat("s", 40), "timeout": "20s",
		},
	})
	if out["name"] != "compress-images" || out["stage"] != "before" || out["enabled"] != true || out["paused"] != false {
		t.Fatalf("shape: %v", out)
	}
	if out["revision"].(float64) != 1 || out["created_at"] == nil || out["updated_at"] == nil {
		t.Fatalf("read-only fields: %v", out)
	}
	svcm := out["service"].(map[string]any)
	if svcm["headers"].(map[string]any)["Authorization"] != "***" || svcm["has_signing_secret"] != true || svcm["signing_secret"] != nil {
		t.Fatalf("secrets must be redacted: %v", svcm)
	}
	if strings.Contains(fmt.Sprint(out), "service-secret") || strings.Contains(fmt.Sprint(out), strings.Repeat("s", 40)) {
		t.Fatalf("a secret leaked into the response: %v", out)
	}
	evs := out["events"].([]any)
	if len(evs) != 2 || out["on_error"] != "reject" || out["limits"].(map[string]any)["queue_timeout"] != "5s" {
		t.Fatalf("defaults: %v", out)
	}
	got := n.mustAdmin(200, "GET", "/pipelines/compress-images", nil)
	if fmt.Sprint(got["service"]) != fmt.Sprint(svcm) || got["attached_to"] == nil {
		t.Fatalf("detail: %v", got)
	}

	// errors
	code, body := n.admin("POST", "/pipelines", n.pipe(svc, "compress-images", "before", nil))
	if code != 409 || body["error"] != "conflict" {
		t.Fatalf("duplicate: %d %v", code, body)
	}
	code, body = n.admin("POST", "/pipelines", map[string]any{"name": "Bad Name", "stage": "after", "service": map[string]any{"url": "ftp://x"}})
	f, _ := body["fields"].(map[string]any)
	if code != 400 || body["error"] != "invalid_request" || f["name"] == nil || f["service.url"] == nil {
		t.Fatalf("validation: %d %v", code, body)
	}
	if code, _ := n.admin("POST", "/pipelines", `{"name":"x","stage":"after","bogus":1,"service":{"url":"http://x"}}`); code != 400 {
		t.Fatalf("unknown field must be 400: %d", code)
	}
	if code, _ := n.admin("POST", "/pipelines", `{not json`); code != 400 {
		t.Fatalf("bad json: %d", code)
	}
	// values stated outright are validated, not defaulted
	for name, extra := range map[string]map[string]any{
		"events":          {"events": []string{}},
		"max_concurrency": {"limits": map[string]any{"max_concurrency": 0}},
		"max_attempts":    {"retry": map[string]any{"max_attempts": 0}},
	} {
		code, body := n.admin("POST", "/pipelines", n.pipe(svc, "explicit-"+strings.ReplaceAll(name, "_", "-"), "after", extra))
		if code != 400 || body["fields"] == nil {
			t.Fatalf("%s: %d %v", name, code, body)
		}
	}
	n.mustAdmin(400, "PATCH", "/pipelines/compress-images", map[string]any{"events": []string{}})
	n.mustAdmin(404, "GET", "/pipelines/nope", nil)
	n.mustAdmin(404, "PUT", "/pipelines/nope", n.pipe(svc, "nope", "after", nil))
	n.mustAdmin(404, "PATCH", "/pipelines/nope", map[string]any{"paused": true})
}

func TestPipelineSecretsAreSealedAtRest(t *testing.T) {
	dir := t.TempDir()
	n := startNode(t, dir, nil)
	svc := newService(t)
	n.createPipe(svc, "sealed", "after", map[string]any{
		"service": map[string]any{"headers": map[string]any{"Authorization": "Bearer top-secret-value"}, "signing_secret": "signing-secret-" + strings.Repeat("z", 30)},
	})
	n.stop()
	var all []byte
	for _, name := range []string{"meta.db", "meta.db-wal"} {
		b, _ := os.ReadFile(filepath.Join(dir, name))
		all = append(all, b...)
	}
	for _, secret := range []string{"top-secret-value", "signing-secret-"} {
		if strings.Contains(string(all), secret) {
			t.Fatalf("%q is stored in clear text", secret)
		}
	}
	if !strings.Contains(string(all), "sealed") {
		t.Fatal("the definition itself should be stored")
	}
}

func TestPipelineReplaceKeepsSecrets(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	created := n.createPipe(svc, "p", "after", map[string]any{
		"token": map[string]any{"grants": []any{}},
		"service": map[string]any{
			"headers":        map[string]any{"Authorization": "Bearer original", "X-Gone": "bye"},
			"signing_secret": strings.Repeat("k", 32),
		},
	})
	n.attach("bkt", "p")
	put := func(want int, mod func(map[string]any)) map[string]any {
		t.Helper()
		def := n.pipe(svc, "p", "after", map[string]any{"token": map[string]any{"grants": []any{}}})
		mod(def)
		return n.mustAdmin(want, "PUT", "/pipelines/p", def)
	}
	// "***" keeps a stored header value, an omitted signing_secret keeps the secret
	out := put(200, func(d map[string]any) {
		d["service"].(map[string]any)["headers"] = map[string]any{"Authorization": "***", "X-New": "added"}
	})
	if out["revision"].(float64) != 2 {
		t.Fatalf("revision: %v", out["revision"])
	}
	h := out["service"].(map[string]any)["headers"].(map[string]any)
	if len(h) != 2 || h["Authorization"] != "***" || h["X-New"] != "***" || out["service"].(map[string]any)["has_signing_secret"] != true {
		t.Fatalf("after replace: %v", out["service"])
	}
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("x"))
	n.waitRunState("pipeline=p", "succeeded")
	cl := svc.callsOf("p")[0]
	if cl.Header.Get("Authorization") != "Bearer original" || cl.Header.Get("X-New") != "added" || cl.Header.Get("X-Gone") != "" {
		t.Fatalf("headers sent: %v", cl.Header)
	}
	if !strings.HasPrefix(cl.Header.Get("X-Binvault-Signature"), "v1=") {
		t.Fatal("the kept signing secret must still sign")
	}
	// a "***" for a header that has no stored value is an error
	put(400, func(d map[string]any) { d["service"].(map[string]any)["headers"] = map[string]any{"Never-Set": "***"} })
	// null removes the signing secret
	out = put(200, func(d map[string]any) {
		d["service"].(map[string]any)["signing_secret"] = nil
		d["service"].(map[string]any)["headers"] = map[string]any{}
	})
	if out["service"].(map[string]any)["has_signing_secret"] == true || len(out["service"].(map[string]any)["headers"].(map[string]any)) != 0 {
		t.Fatalf("null must remove the secret and PUT replaces the headers: %v", out["service"])
	}
	n.must(c, 200, "PUT", objPath("bkt", "k2"), []byte("x"))
	eventually(t, 10*time.Second, "the second call", func() bool { return len(svc.callsOf("p")) == 2 })
	cl = svc.callsOf("p")[1]
	if cl.Header.Get("X-Binvault-Signature") != "" || cl.Header.Get("Authorization") != "" {
		t.Fatalf("a removed secret and header must not be sent: %v", cl.Header)
	}
	// a new secret replaces
	put(200, func(d map[string]any) { d["service"].(map[string]any)["signing_secret"] = strings.Repeat("n", 33) })
	// immutable name and stage
	put(400, func(d map[string]any) { d["name"] = "other" })
	put(400, func(d map[string]any) { d["stage"] = "before" })
	// what GET returns can be sent back as it is
	_ = created
	back := n.mustAdmin(200, "GET", "/pipelines/p", nil)
	back["description"] = "edited"
	out = n.mustAdmin(200, "PUT", "/pipelines/p", back)
	if out["description"] != "edited" {
		t.Fatalf("round trip: %v", out)
	}
}

func TestPipelinePatch(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.createPipe(svc, "p", "after", map[string]any{
		"match":   map[string]any{"keys": []string{"a/**"}, "content_type": []string{"image/*"}},
		"service": map[string]any{"headers": map[string]any{"A": "1", "B": "2"}, "signing_secret": strings.Repeat("k", 32)},
	})
	out := n.mustAdmin(200, "PATCH", "/pipelines/p", map[string]any{"paused": true})
	if out["paused"] != true || out["revision"].(float64) != 2 {
		t.Fatalf("paused: %v", out)
	}
	// nested merge: only the named member changes
	out = n.mustAdmin(200, "PATCH", "/pipelines/p", map[string]any{"match": map[string]any{"content_type": nil, "exclude_keys": []string{"a/raw/**"}}})
	m := out["match"].(map[string]any)
	if m["content_type"] != nil || len(m["keys"].([]any)) != 1 || len(m["exclude_keys"].([]any)) != 1 {
		t.Fatalf("merge patch: %v", m)
	}
	// header null removes one, others keep their (stored) values
	out = n.mustAdmin(200, "PATCH", "/pipelines/p", map[string]any{"service": map[string]any{"headers": map[string]any{"A": nil, "C": "3"}}})
	h := out["service"].(map[string]any)["headers"].(map[string]any)
	if len(h) != 2 || h["B"] != "***" || h["C"] != "***" || out["service"].(map[string]any)["has_signing_secret"] != true {
		t.Fatalf("headers: %v", out["service"])
	}
	// null signing secret removes it
	out = n.mustAdmin(200, "PATCH", "/pipelines/p", map[string]any{"service": map[string]any{"signing_secret": nil}})
	if out["service"].(map[string]any)["has_signing_secret"] == true {
		t.Fatalf("signing secret must be gone: %v", out["service"])
	}
	// invalid results are rejected and nothing changes
	n.mustAdmin(400, "PATCH", "/pipelines/p", map[string]any{"retry": map[string]any{"max_attempts": 99}})
	n.mustAdmin(400, "PATCH", "/pipelines/p", map[string]any{"name": "q"})
	n.mustAdmin(400, "PATCH", "/pipelines/p", map[string]any{"stage": "before"})
	n.mustAdmin(400, "PATCH", "/pipelines/p", map[string]any{"bogus": 1})
	if got := n.mustAdmin(200, "GET", "/pipelines/p", nil); got["revision"].(float64) != 5 {
		t.Fatalf("revision after rejected patches: %v", got["revision"])
	}
	// a before pipeline cannot be paused
	n.createPipe(svc, "gate", "before", nil)
	n.mustAdmin(400, "PATCH", "/pipelines/gate", map[string]any{"paused": true})
}

func TestPipelineRevisionIfMatch(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.createPipe(svc, "p", "after", nil)
	n.mustAdmin(412, "PATCH", "/pipelines/p", map[string]any{"paused": true}, "If-Match", `"7"`)
	n.mustAdmin(200, "PATCH", "/pipelines/p", map[string]any{"paused": true}, "If-Match", `"1"`)
	n.mustAdmin(412, "PATCH", "/pipelines/p", map[string]any{"paused": false}, "If-Match", `"1"`)
	n.mustAdmin(200, "PUT", "/pipelines/p", n.pipe(svc, "p", "after", nil), "If-Match", `2`)
	n.mustAdmin(400, "PUT", "/pipelines/p", n.pipe(svc, "p", "after", nil), "If-Match", `"abc"`)
}

func TestPipelineListAndPaging(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	for _, name := range []string{"delta", "alpha", "charlie", "bravo", "echo"} {
		n.createPipe(svc, name, "after", nil)
	}
	var names []string
	cursor := ""
	for {
		path := "/pipelines?limit=2"
		if cursor != "" {
			path += "&cursor=" + cursor
		}
		page := n.mustAdmin(200, "GET", path, nil)
		for _, it := range page["items"].([]any) {
			names = append(names, it.(map[string]any)["name"].(string))
		}
		next, _ := page["next_cursor"].(string)
		if next == "" {
			break
		}
		cursor = next
	}
	if strings.Join(names, ",") != "alpha,bravo,charlie,delta,echo" {
		t.Fatalf("names = %v", names)
	}
}

func TestPipelineLimit(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	for i := 0; i < 256; i++ {
		n.mustAdmin(201, "POST", "/pipelines", n.pipe(svc, fmt.Sprintf("p%03d", i), "after", nil))
	}
	code, body := n.admin("POST", "/pipelines", n.pipe(svc, "one-too-many", "after", nil))
	if code != 409 {
		t.Fatalf("the 257th pipeline: %d %v", code, body)
	}
}

func TestAttachmentsAPI(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	for _, p := range []string{"a1", "a2", "a3"} {
		n.createPipe(svc, p, "after", nil)
	}
	for i := 0; i < 9; i++ {
		n.createPipe(svc, fmt.Sprintf("g%d", i), "before", nil)
	}
	empty := n.mustAdmin(200, "GET", "/buckets/bkt/pipelines", nil)
	if len(empty["items"].([]any)) != 0 || empty["revision"].(float64) != 0 {
		t.Fatalf("empty: %v", empty)
	}
	n.mustAdmin(404, "GET", "/buckets/nope/pipelines", nil)
	n.mustAdmin(404, "PUT", "/buckets/nope/pipelines", map[string]any{"items": []any{}})

	put := n.mustAdmin(200, "PUT", "/buckets/bkt/pipelines", map[string]any{"items": []map[string]any{
		{"pipeline": "a2", "enabled": true},
		{"pipeline": "g0"},
		{"pipeline": "a1", "enabled": false, "match": map[string]any{"keys": []string{"uploads/**"}}},
	}})
	if put["revision"].(float64) != 1 {
		t.Fatalf("revision: %v", put)
	}
	items := put["items"].([]any)
	if len(items) != 3 || items[0].(map[string]any)["pipeline"] != "a2" || items[1].(map[string]any)["stage"] != "before" ||
		items[1].(map[string]any)["enabled"] != true || items[2].(map[string]any)["enabled"] != false {
		t.Fatalf("items: %v", items)
	}
	if m := items[2].(map[string]any)["match"].(map[string]any); len(m["keys"].([]any)) != 1 {
		t.Fatalf("match: %v", m)
	}
	// what GET returns can be sent back
	got := n.mustAdmin(200, "GET", "/buckets/bkt/pipelines", nil)
	n.mustAdmin(200, "PUT", "/buckets/bkt/pipelines", got)
	// and GET /buckets/{name} lists the attachments
	b := n.mustAdmin(200, "GET", "/buckets/bkt", nil)
	if ps, _ := b["pipelines"].([]any); len(ps) != 3 {
		t.Fatalf("bucket detail pipelines: %v", b["pipelines"])
	}

	bad := func(items ...map[string]any) map[string]any {
		t.Helper()
		code, body := n.admin("PUT", "/buckets/bkt/pipelines", map[string]any{"items": items})
		if code != 400 || body["error"] != "invalid_request" || body["fields"] == nil {
			t.Fatalf("want a 400 with fields, got %d %v", code, body)
		}
		return body["fields"].(map[string]any)
	}
	if f := bad(map[string]any{"pipeline": "nope"}); f["items[0].pipeline"] == nil {
		t.Fatalf("unknown pipeline: %v", f)
	}
	if f := bad(map[string]any{"pipeline": "a1"}, map[string]any{"pipeline": "a1"}); f["items[1].pipeline"] == nil {
		t.Fatalf("repeat: %v", f)
	}
	if f := bad(map[string]any{"pipeline": "a1", "match": map[string]any{"keys": []string{"[a-"}}}); f["items[0].match.keys[0]"] == nil {
		t.Fatalf("bad filter: %v", f)
	}
	if f := bad(map[string]any{"pipeline": "g1", "match": map[string]any{"operations": []string{"lifecycle"}}}); f["items[0].match.operations"] == nil {
		t.Fatalf("a before attachment cannot select lifecycle: %v", f)
	}
	var nine []map[string]any
	for i := 0; i < 9; i++ {
		nine = append(nine, map[string]any{"pipeline": fmt.Sprintf("g%d", i)})
	}
	if f := bad(nine...); f["items"] == nil {
		t.Fatalf("nine enabled before attachments: %v", f)
	}
	// eight enabled plus a disabled ninth is fine
	nine[8]["enabled"] = false
	n.mustAdmin(200, "PUT", "/buckets/bkt/pipelines", map[string]any{"items": nine})
	// the 32 attachment cap
	var many []map[string]any
	for i := 0; i < 33; i++ {
		many = append(many, map[string]any{"pipeline": "a1"})
	}
	if f := bad(many...); f["items"] == nil {
		t.Fatalf("33 attachments: %v", f)
	}
	// revisions
	cur := n.mustAdmin(200, "GET", "/buckets/bkt/pipelines", nil)["revision"].(float64)
	n.mustAdmin(412, "PUT", "/buckets/bkt/pipelines", map[string]any{"items": []any{}}, "If-Match", fmt.Sprintf(`"%d"`, int(cur)+5))
	n.mustAdmin(200, "PUT", "/buckets/bkt/pipelines", map[string]any{"items": []any{}}, "If-Match", fmt.Sprintf(`"%d"`, int(cur)))
	if code, _ := n.admin("PUT", "/buckets/bkt/pipelines", `{"items":[],"bogus":1}`); code != 400 {
		t.Fatalf("unknown field: %d", code)
	}
}

// Attachment changes take effect for the next event, and an attachment's
// match narrows its pipeline.
func TestAttachmentMatchNarrowsAndChangesApply(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "p", "after", map[string]any{
		"match": map[string]any{"keys": []string{"uploads/**"}}, "token": map[string]any{"grants": []any{}},
	})
	n.mustAdmin(200, "PUT", "/buckets/bkt/pipelines", map[string]any{"items": []map[string]any{
		{"pipeline": "p", "match": map[string]any{"keys": []string{"uploads/img/**"}, "operations": []string{"put"}}},
	}})
	n.must(c, 200, "PUT", objPath("bkt", "uploads/img/a"), []byte("x"))
	n.must(c, 200, "PUT", objPath("bkt", "uploads/doc/b"), []byte("x"))                                       // pipeline matches, attachment does not
	n.must(c, 200, "PUT", objPath("bkt", "other/img/c"), []byte("x"))                                         // attachment matches, pipeline does not
	n.must(c, 200, "PUT", objPath("bkt", "uploads/img/copy"), nil, "x-amz-copy-source", "/bkt/uploads/img/a") // copy: operation excluded
	n.waitRunState("pipeline=p&key=uploads/img/a", "succeeded")
	time.Sleep(200 * time.Millisecond)
	if rs := n.runs("pipeline=p"); len(rs) != 1 {
		t.Fatalf("only the doubly matching object: %v", rs)
	}
	// detach everything: the next event raises nothing
	n.attach("bkt")
	n.must(c, 200, "PUT", objPath("bkt", "uploads/img/z"), []byte("x"))
	time.Sleep(200 * time.Millisecond)
	if rs := n.runs("pipeline=p"); len(rs) != 1 {
		t.Fatalf("detached: %v", rs)
	}
}

// Concurrent edits without If-Match never overwrite each other.
func TestPipelineConcurrentPatchesAreNotLost(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.createPipe(svc, "p", "after", nil)
	const writers = 12
	var wg sync.WaitGroup
	for i := 0; i < writers; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			code, body := n.admin("PATCH", "/pipelines/p", map[string]any{"service": map[string]any{"headers": map[string]any{fmt.Sprintf("X-H%02d", i): "v"}}})
			if code != 200 {
				t.Errorf("patch %d: %d %v", i, code, body)
			}
		}(i)
	}
	wg.Wait()
	got := n.mustAdmin(200, "GET", "/pipelines/p", nil)
	h := got["service"].(map[string]any)["headers"].(map[string]any)
	if len(h) != writers {
		t.Fatalf("lost updates: %d of %d headers survived: %v", len(h), writers, h)
	}
	if got["revision"].(float64) != float64(1+writers) {
		t.Fatalf("revision = %v", got["revision"])
	}
}
