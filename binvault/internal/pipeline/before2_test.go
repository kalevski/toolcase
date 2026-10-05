package pipeline_test

import (
	"encoding/xml"
	"fmt"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/config"
)

// ---- multipart helpers ----------------------------------------------------------------------

type mpu struct {
	n        *node
	c        cred
	bucket   string
	key      string
	uploadID string
	etag     string
}

func (n *node) startMultipart(c cred, bucket, key string, data []byte, hdr ...string) *mpu {
	n.t.Helper()
	r := n.must(c, 200, "POST", objPath(bucket, key)+"?uploads", nil, hdr...)
	var out struct {
		UploadID string `xml:"UploadId"`
	}
	if err := xml.Unmarshal(r.body, &out); err != nil || out.UploadID == "" {
		n.t.Fatalf("initiate: %s", r.body)
	}
	part := n.must(c, 200, "PUT", objPath(bucket, key)+"?partNumber=1&uploadId="+out.UploadID, data)
	return &mpu{n: n, c: c, bucket: bucket, key: key, uploadID: out.UploadID, etag: part.header.Get("ETag")}
}

func (u *mpu) complete() *resp {
	body := fmt.Sprintf(`<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>%s</ETag></Part></CompleteMultipartUpload>`, u.etag)
	return u.n.s3(u.c, "POST", objPath(u.bucket, u.key)+"?uploadId="+u.uploadID, []byte(body))
}

func (u *mpu) listed() bool {
	r := u.n.s3(u.c, "GET", "/"+u.bucket+"?uploads", nil)
	return strings.Contains(string(r.body), u.uploadID)
}

func TestBeforeOnMultipartComplete(t *testing.T) {
	e := newGate(t, nil, nil, nil)
	var mode atomic.Value
	mode.Store("pass")
	e.svc.on("gate", func(cl *call) reply {
		if cl.str("operation") != "multipart" {
			t.Errorf("operation = %s", cl.str("operation"))
		}
		switch mode.Load() {
		case "reject":
			return reply{Status: 422, Body: `{"message":"no"}`}
		case "fail":
			return reply{Status: 500}
		case "replace":
			e.n.s3b(cl.bearer(), "PUT", objPath("bkt", cl.str("key")), []byte("replaced bytes"))
		}
		return reply{}
	})
	// pass: the multipart ETag survives, the object is committed
	u := e.n.startMultipart(e.c, "bkt", "mp/pass", []byte("multipart body"), "Content-Type", "text/plain")
	r := u.complete()
	if r.status != 200 || !strings.Contains(string(r.body), "-1&quot;") && !strings.Contains(string(r.body), "-1\"") {
		t.Fatalf("complete: %d %s", r.status, r.body)
	}
	if got := e.n.must(e.c, 200, "GET", objPath("bkt", "mp/pass"), nil); string(got.body) != "multipart body" || got.header.Get("Content-Type") != "text/plain" || !strings.HasSuffix(got.header.Get("ETag"), `-1"`) {
		t.Fatalf("object: %q %v", got.body, got.header)
	}
	if cl := e.svc.callsOf("gate")[0]; !strings.HasSuffix(cl.str("object", "etag"), "-1") {
		t.Fatalf("the pipeline sees the multipart ETag: %s", cl.Raw)
	}

	// a failure leaves the upload open so Complete can be retried
	mode.Store("fail")
	u = e.n.startMultipart(e.c, "bkt", "mp/fail", []byte("data"))
	if r := u.complete(); r.status != 502 || r.code() != "PipelineFailed" {
		t.Fatalf("complete with a failing pipeline: %d %s", r.status, r.code())
	}
	if !u.listed() {
		t.Fatal("after a pipeline failure the upload must stay open")
	}
	e.n.must(e.c, 404, "GET", objPath("bkt", "mp/fail"), nil)
	mode.Store("pass")
	if r := u.complete(); r.status != 200 {
		t.Fatalf("retry of Complete: %d %s", r.status, r.code())
	}
	e.n.must(e.c, 200, "GET", objPath("bkt", "mp/fail"), nil)

	// a rejection aborts the upload and deletes its parts
	mode.Store("reject")
	u = e.n.startMultipart(e.c, "bkt", "mp/reject", []byte("data"))
	if r := u.complete(); r.status != 422 || r.code() != "PipelineRejected" {
		t.Fatalf("complete with a rejecting pipeline: %d %s", r.status, r.code())
	}
	if u.listed() {
		t.Fatal("a rejected upload must be aborted")
	}
	e.n.must(e.c, 404, "GET", objPath("bkt", "mp/reject"), nil)

	// a replacement makes the object single-part
	mode.Store("replace")
	u = e.n.startMultipart(e.c, "bkt", "mp/replace", []byte("original"))
	if r := u.complete(); r.status != 200 {
		t.Fatalf("complete with a replacing pipeline: %d %s", r.status, r.code())
	}
	got := e.n.must(e.c, 200, "GET", objPath("bkt", "mp/replace"), nil)
	if string(got.body) != "replaced bytes" || got.header.Get("ETag") != `"`+md5hex([]byte("replaced bytes"))+`"` {
		t.Fatalf("replaced multipart object: %q %v", got.body, got.header)
	}
	if e.n.s3(e.c, "GET", objPath("bkt", "mp/replace")+"?partNumber=2", nil).status != 416 {
		t.Fatal("a replaced object is single-part")
	}
}

func TestBeforeOnCopy(t *testing.T) {
	e := newGate(t, nil, map[string]any{"match": map[string]any{"keys": []string{"dst/**"}}}, nil)
	e.n.must(e.c, 200, "PUT", objPath("bkt", "src/a"), []byte("source bytes"), "Content-Type", "text/plain")
	var mode atomic.Value
	mode.Store("replace")
	e.svc.on("gate", func(cl *call) reply {
		if cl.str("operation") != "copy" || cl.Inv["copy_source"].(map[string]any)["key"] != "src/a" {
			t.Errorf("copy invocation: %s", cl.Raw)
		}
		switch mode.Load() {
		case "reject":
			return reply{Status: 422}
		case "replace":
			got := e.n.s3b(cl.bearer(), "GET", objPath("bkt", cl.str("key")), nil)
			e.n.s3b(cl.bearer(), "PUT", objPath("bkt", cl.str("key")), []byte(strings.ToUpper(string(got.body))))
		}
		return reply{}
	})
	r := e.n.must(e.c, 200, "PUT", objPath("bkt", "dst/b"), nil, "x-amz-copy-source", "/bkt/src/a")
	if r.header.Get("x-binvault-modified") != "true" {
		t.Fatalf("copy through a replacing pipeline: %v", r.header)
	}
	if got := e.n.must(e.c, 200, "GET", objPath("bkt", "dst/b"), nil); string(got.body) != "SOURCE BYTES" || got.header.Get("Content-Type") != "text/plain" {
		t.Fatalf("destination: %q %v", got.body, got.header)
	}
	if got := e.n.must(e.c, 200, "GET", objPath("bkt", "src/a"), nil); string(got.body) != "source bytes" {
		t.Fatalf("the source must be untouched: %q", got.body)
	}
	mode.Store("reject")
	if r := e.n.s3(e.c, "PUT", objPath("bkt", "dst/c"), nil, "x-amz-copy-source", "/bkt/src/a"); r.status != 422 {
		t.Fatalf("rejected copy: %d %s", r.status, r.code())
	}
	e.n.must(e.c, 404, "GET", objPath("bkt", "dst/c"), nil)
	// a copy no chain matches stays a plain O(1) copy and never calls the service
	calls := len(e.svc.callsOf("gate"))
	e.n.must(e.c, 200, "PUT", objPath("bkt", "plain/d"), nil, "x-amz-copy-source", "/bkt/src/a")
	if len(e.svc.callsOf("gate")) != calls {
		t.Fatal("no chain matched: the service must not be called")
	}
	if got := e.n.must(e.c, 200, "GET", objPath("bkt", "plain/d"), nil); string(got.body) != "source bytes" {
		t.Fatalf("plain copy: %q", got.body)
	}
}

func TestBeforeChainSelection(t *testing.T) {
	png := append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 64)...)
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	mk := func(name string, match map[string]any, extra map[string]any) {
		def := map[string]any{"token": map[string]any{"grants": []any{}}, "match": match}
		for k, v := range extra {
			def[k] = v
		}
		n.createPipe(svc, name, "before", def)
	}
	mk("keys", map[string]any{"keys": []string{"uploads/**"}, "exclude_keys": []string{"uploads/raw/**"}}, nil)
	mk("declared", map[string]any{"content_type": []string{"image/png"}}, nil)
	mk("sniffed", map[string]any{"content_type": []string{"image/png"}, "content_type_source": "sniffed"}, nil)
	mk("sized", map[string]any{"min_size": 100, "max_size": 150}, nil)
	mk("puts", map[string]any{"operations": []string{"put"}}, nil)
	mk("updates", map[string]any{}, map[string]any{"events": []string{"object.updated"}})
	mk("creates", map[string]any{}, map[string]any{"events": []string{"object.created"}})
	n.createPipe(svc, "disabled", "before", map[string]any{"token": map[string]any{"grants": []any{}}, "enabled": false})
	n.mustAdmin(200, "PUT", "/buckets/bkt/pipelines", map[string]any{"items": []map[string]any{
		{"pipeline": "keys"}, {"pipeline": "declared"}, {"pipeline": "sniffed"}, {"pipeline": "sized"},
		{"pipeline": "puts"}, {"pipeline": "updates"}, {"pipeline": "creates"}, {"pipeline": "disabled"},
	}})
	called := func() string {
		var names []string
		for _, cl := range svc.allCalls() {
			names = append(names, cl.Pipeline)
		}
		svc.mu.Lock()
		svc.calls = nil
		svc.mu.Unlock()
		return strings.Join(names, ",")
	}
	n.must(c, 200, "PUT", objPath("bkt", "uploads/a.txt"), []byte("12345"), "Content-Type", "text/plain")
	if got := called(); got != "keys,puts,creates" {
		t.Fatalf("small text under uploads: %s", got)
	}
	n.must(c, 200, "PUT", objPath("bkt", "uploads/raw/a.txt"), make([]byte, 120), "Content-Type", "text/plain")
	if got := called(); got != "sized,puts,creates" {
		t.Fatalf("exclude_keys, size window: %s", got)
	}
	// declared versus sniffed type
	n.must(c, 200, "PUT", objPath("bkt", "x/claims-png"), []byte("plain text, 60 bytes: not an image at all, honestly......"), "Content-Type", "image/png")
	if got := called(); got != "declared,puts,creates" {
		t.Fatalf("claimed png: %s", got)
	}
	n.must(c, 200, "PUT", objPath("bkt", "x/real-png"), png, "Content-Type", "application/octet-stream")
	if got := called(); got != "sniffed,puts,creates" {
		t.Fatalf("real png: %s", got)
	}
	// an update runs the update-only pipeline instead of the create-only one
	n.must(c, 200, "PUT", objPath("bkt", "uploads/a.txt"), []byte("12345"), "Content-Type", "text/plain")
	if got := called(); got != "keys,puts,updates" {
		t.Fatalf("update: %s", got)
	}
	// a copy is not a put
	n.must(c, 200, "PUT", objPath("bkt", "uploads/copied"), nil, "x-amz-copy-source", "/bkt/uploads/a.txt")
	if got := called(); got != "keys,creates" {
		t.Fatalf("copy: %s", got)
	}
}

func TestBeforeAttachmentMatchAndOrder(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	for _, name := range []string{"a", "b", "c"} {
		n.createPipe(svc, name, "before", map[string]any{"token": map[string]any{"grants": []any{}}})
	}
	n.mustAdmin(200, "PUT", "/buckets/bkt/pipelines", map[string]any{"items": []map[string]any{
		{"pipeline": "c"}, {"pipeline": "a", "match": map[string]any{"keys": []string{"only-a/**"}}}, {"pipeline": "b", "enabled": false},
	}})
	n.must(c, 200, "PUT", objPath("bkt", "plain"), []byte("x"))
	n.must(c, 200, "PUT", objPath("bkt", "only-a/x"), []byte("x"))
	var order []string
	for _, cl := range svc.allCalls() {
		order = append(order, cl.Pipeline)
	}
	if strings.Join(order, ",") != "c,c,a" {
		t.Fatalf("attachment order, narrowing and the disabled flag: %v", order)
	}
}

func TestBeforeChainStopsAtTheFirstRejection(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	for _, name := range []string{"one", "two", "three"} {
		n.createPipe(svc, name, "before", map[string]any{"token": map[string]any{"grants": []any{}}})
	}
	n.attach("bkt", "one", "two", "three")
	svc.on("two", func(*call) reply { return reply{Status: 422} })
	if r := n.s3(c, "PUT", objPath("bkt", "k"), []byte("x")); r.status != 422 || !strings.Contains(r.message(), `"two"`) {
		t.Fatalf("%d %s", r.status, r.message())
	}
	if len(svc.callsOf("three")) != 0 {
		t.Fatal("a rejection stops the chain")
	}
	n.waitRunState("pipeline=one", "succeeded")
	n.waitRunState("pipeline=two", "rejected")
	three := n.waitRunState("pipeline=three", "skipped")
	if three["reason"] != "chain_aborted" || three["stage"] != "before" {
		t.Fatalf("three: %v", three)
	}
	runs := n.runs("event_id=" + n.runs("pipeline=one")[0]["event_id"].(string))
	if len(runs) != 3 {
		t.Fatalf("one record per pipeline of the chain: %d", len(runs))
	}
}

// A gate sees every write, whatever its depth, and the write of a pipeline's own
// token is gated like any other.
func TestBeforeGateSeesPipelineWrites(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "gate", "before", map[string]any{"token": map[string]any{"grants": []any{}}, "match": map[string]any{"keys": []string{"derived/**"}}})
	n.createPipe(svc, "maker", "after", map[string]any{"token": map[string]any{"grants": []map[string]any{{"actions": []string{"write"}, "keys": []string{"derived/*"}}}}})
	n.attach("bkt", "gate", "maker")
	var gateSaw atomic.Value
	svc.on("gate", func(cl *call) reply {
		gateSaw.Store(cl.Raw)
		return reply{Status: 422, Body: `{"message":"no derivatives"}`}
	})
	var status atomic.Int32
	svc.on("maker", func(cl *call) reply {
		status.Store(int32(n.s3b(cl.bearer(), "PUT", objPath("bkt", "derived/d"), []byte("d")).status))
		return reply{}
	})
	n.must(c, 200, "PUT", objPath("bkt", "source"), []byte("x"))
	n.waitRunState("pipeline=maker", "succeeded")
	if status.Load() != 422 {
		t.Fatalf("the pipeline's write must pass the gate: %d", status.Load())
	}
	raw, _ := gateSaw.Load().([]byte)
	var cl call
	cl.Raw = raw
	if !strings.Contains(string(raw), `"kind":"pipeline"`) || !strings.Contains(string(raw), `"depth":1`) || !strings.Contains(string(raw), `"chain":["maker"]`) {
		t.Fatalf("the gate sees the write's lineage: %s", raw)
	}
}

func TestBeforeDeleteChain(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "del-gate", "before", map[string]any{
		"events": []string{"object.deleted"}, "match": map[string]any{"keys": []string{"protected/**"}},
		"token": map[string]any{"grants": []map[string]any{{"actions": []string{"read", "delete", "write"}, "keys": []string{"{key}"}}}},
	})
	n.attach("bkt", "del-gate")
	var mode atomic.Value
	mode.Store("allow")
	var seen atomic.Value
	svc.on("del-gate", func(cl *call) reply {
		tok := cl.bearer()
		grants := cl.Inv["s3"].(map[string]any)["grants"].([]any)
		seen.Store(fmt.Sprint(grants))
		// the token is read-only: it can look at the object but not change anything
		if st := n.s3b(tok, "GET", objPath("bkt", cl.str("key")), nil).status; st != 200 {
			t.Errorf("delete chain read: %d", st)
		}
		if st := n.s3b(tok, "DELETE", objPath("bkt", cl.str("key")), nil).status; st != 403 {
			t.Errorf("a delete chain token must not delete: %d", st)
		}
		if st := n.s3b(tok, "PUT", objPath("bkt", cl.str("key")), []byte("x")).status; st != 403 {
			t.Errorf("a delete chain token must not write: %d", st)
		}
		switch mode.Load() {
		case "veto":
			return reply{Status: 422, Body: `{"message":"retention"}`}
		case "fail":
			return reply{Status: 500}
		}
		return reply{}
	})
	n.must(c, 200, "PUT", objPath("bkt", "protected/a"), []byte("keep me"))
	n.must(c, 200, "PUT", objPath("bkt", "free/b"), []byte("x"))

	// allowed
	n.must(c, 204, "DELETE", objPath("bkt", "protected/a"), nil)
	n.must(c, 404, "GET", objPath("bkt", "protected/a"), nil)
	if s, _ := seen.Load().(string); !strings.Contains(s, "[read]") || strings.Contains(s, "delete") || strings.Contains(s, "write") {
		t.Fatalf("grants shown to a delete chain: %s", s)
	}
	cl := svc.callsOf("del-gate")[0]
	if cl.str("event") != "object.deleted" || cl.str("operation") != "delete" || cl.str("object", "etag") != md5hex([]byte("keep me")) {
		t.Fatalf("invocation: %s", cl.Raw)
	}
	// vetoed
	n.must(c, 200, "PUT", objPath("bkt", "protected/a"), []byte("again"))
	mode.Store("veto")
	r := n.s3(c, "DELETE", objPath("bkt", "protected/a"), nil)
	if r.status != 422 || r.code() != "PipelineRejected" || r.message() != `rejected by pipeline "del-gate": retention` {
		t.Fatalf("veto: %d %s %q", r.status, r.code(), r.message())
	}
	n.must(c, 200, "GET", objPath("bkt", "protected/a"), nil)
	// failure follows on_error (reject by default)
	mode.Store("fail")
	if r := n.s3(c, "DELETE", objPath("bkt", "protected/a"), nil); r.status != 502 || r.code() != "PipelineFailed" {
		t.Fatalf("failure: %d %s", r.status, r.code())
	}
	n.must(c, 200, "GET", objPath("bkt", "protected/a"), nil)
	// keys outside the match are not gated, and a delete of a missing key runs no chain
	calls := len(svc.callsOf("del-gate"))
	n.must(c, 204, "DELETE", objPath("bkt", "free/b"), nil)
	n.must(c, 204, "DELETE", objPath("bkt", "protected/missing"), nil)
	if len(svc.callsOf("del-gate")) != calls {
		t.Fatal("no chain applies")
	}
}

func TestBeforeDeleteChainVersioning(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", map[string]any{"versioning": "enabled"})
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "del-gate", "before", map[string]any{"events": []string{"object.deleted"}})
	n.attach("bkt", "del-gate")
	svc.on("del-gate", func(cl *call) reply { return reply{Status: 422} })
	put := n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("v1"))
	ver := put.header.Get("x-amz-version-id")
	// a plain delete (which would add a marker) is gated
	if r := n.s3(c, "DELETE", objPath("bkt", "k"), nil); r.status != 422 {
		t.Fatalf("plain delete: %d", r.status)
	}
	// a delete with a version id runs no before chain (purge)
	n.must(c, 204, "DELETE", objPath("bkt", "k")+"?versionId="+ver, nil)
	if len(svc.callsOf("del-gate")) != 1 {
		t.Fatalf("a purge runs no chain: %d calls", len(svc.callsOf("del-gate")))
	}
}

func TestBeforeDeleteChainConflict(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "del-gate", "before", map[string]any{"events": []string{"object.deleted"}})
	n.attach("bkt", "del-gate")
	in := make(chan struct{}, 1)
	release := make(chan struct{})
	svc.on("del-gate", func(cl *call) reply {
		in <- struct{}{}
		<-release
		return reply{}
	})
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("vetted"))
	done := make(chan *resp, 1)
	go func() { done <- n.s3(c, "DELETE", objPath("bkt", "k"), nil) }()
	<-in
	// the object is replaced while the chain vets the old one
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("replaced"))
	close(release)
	r := <-done
	if r.status != 409 || r.code() != "ConditionalRequestConflict" {
		t.Fatalf("a vetted object must never be swapped for an unvetted one: %d %s", r.status, r.code())
	}
	if got := n.must(c, 200, "GET", objPath("bkt", "k"), nil); string(got.body) != "replaced" {
		t.Fatalf("%q", got.body)
	}
}

func TestBeforeDeleteObjectsBatch(t *testing.T) {
	tight := func(c *config.Config) { c.PipelineBeforeTotalTimeout = 2 * time.Second }
	run := func(t *testing.T, onError string) (*node, cred, string) {
		n := startNode(t, "", tight)
		svc := newService(t)
		n.bucket("bkt", nil)
		c := n.token("bkt", allGrants)
		n.createPipe(svc, "del-gate", "before", map[string]any{
			"events": []string{"object.deleted"}, "on_error": onError, "match": map[string]any{"keys": []string{"gated/**"}},
			"service": map[string]any{"timeout": "2s"},
		})
		n.attach("bkt", "del-gate")
		svc.on("del-gate", func(cl *call) reply {
			switch cl.str("key") {
			case "gated/veto":
				return reply{Status: 422}
			case "gated/slow1", "gated/slow2", "gated/slow3":
				return reply{Delay: 1200 * time.Millisecond}
			}
			return reply{}
		})
		for _, k := range []string{"gated/ok", "gated/veto", "gated/slow1", "gated/slow2", "gated/slow3", "free/1", "free/2"} {
			n.must(c, 200, "PUT", objPath("bkt", k), []byte("x"))
		}
		body := `<Delete>`
		for _, k := range []string{"free/1", "gated/ok", "gated/veto", "gated/slow1", "gated/slow2", "free/2", "gated/slow3"} {
			body += "<Object><Key>" + k + "</Key></Object>"
		}
		body += `</Delete>`
		r := n.must(c, 200, "POST", "/bkt?delete", []byte(body))
		return n, c, string(r.body)
	}
	t.Run("reject", func(t *testing.T) {
		n, c, body := run(t, "reject")
		var res struct {
			Deleted []struct{ Key string } `xml:"Deleted"`
			Errors  []struct{ Key, Code string }
		}
		res.Errors = nil
		type errEntry struct {
			Key  string `xml:"Key"`
			Code string `xml:"Code"`
		}
		var full struct {
			Deleted []struct {
				Key string `xml:"Key"`
			} `xml:"Deleted"`
			Error []errEntry `xml:"Error"`
		}
		if err := xml.Unmarshal([]byte(body), &full); err != nil {
			t.Fatal(err)
		}
		deleted := map[string]bool{}
		for _, d := range full.Deleted {
			deleted[d.Key] = true
		}
		codes := map[string]string{}
		for _, e := range full.Error {
			codes[e.Key] = e.Code
		}
		// entries without a chain are not held up; the veto is that entry's error only;
		// when the shared budget runs out the waiting entries time out
		if !deleted["free/1"] || !deleted["free/2"] || !deleted["gated/ok"] || !deleted["gated/slow1"] {
			t.Errorf("deleted = %v codes = %v", deleted, codes)
		}
		if codes["gated/veto"] != "PipelineRejected" || codes["gated/slow2"] != "PipelineTimeout" || codes["gated/slow3"] != "PipelineTimeout" {
			t.Errorf("codes = %v", codes)
		}
		for _, k := range []string{"gated/veto", "gated/slow2", "gated/slow3"} {
			n.must(c, 200, "GET", objPath("bkt", k), nil) // not deleted
		}
		for _, k := range []string{"free/1", "gated/ok", "gated/slow1"} {
			n.must(c, 404, "GET", objPath("bkt", k), nil)
		}
	})
	t.Run("continue", func(t *testing.T) {
		n, c, body := run(t, "continue")
		// with on_error continue the entries that ran out of budget are deleted anyway
		for _, k := range []string{"gated/slow2", "gated/slow3", "gated/slow1", "gated/ok"} {
			n.must(c, 404, "GET", objPath("bkt", k), nil)
		}
		n.must(c, 200, "GET", objPath("bkt", "gated/veto"), nil) // a veto is final
		if !strings.Contains(body, "PipelineRejected") {
			t.Errorf("the veto is reported: %s", body)
		}
	})
}

func TestBeforeDrainingRefusesNewChains(t *testing.T) {
	e := newGate(t, nil, nil, nil)
	e.n.must(e.c, 200, "PUT", objPath("bkt", "a"), []byte("x"))
	e.n.app.Pipes.Drain()
	r := e.n.s3(e.c, "PUT", objPath("bkt", "b"), []byte("x"))
	if r.status != 503 || r.code() != "ServiceUnavailable" {
		t.Fatalf("a write that needs a chain while shutting down: %d %s", r.status, r.code())
	}
	// writes without a chain are not affected
	e.n.bucket("plain", nil)
	pc := e.n.token("plain", allGrants)
	e.n.must(pc, 200, "PUT", objPath("plain", "k"), []byte("x"))
}
