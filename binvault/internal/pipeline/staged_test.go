package pipeline_test

import (
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
)

func TestStagedReadsSupportRangeAndConditionals(t *testing.T) {
	e := newGate(t, nil, nil, nil)
	var okRange, okHead, okIfMatch atomic.Bool
	e.svc.on("gate", func(cl *call) reply {
		tok, path := cl.bearer(), objPath("bkt", cl.str("key"))
		r := e.n.s3b(tok, "GET", path, nil, "Range", "bytes=2-4")
		okRange.Store(r.status == 206 && string(r.body) == "cde" && r.header.Get("Content-Range") == "bytes 2-4/10")
		h := e.n.s3b(tok, "HEAD", path, nil)
		okHead.Store(h.status == 200 && h.header.Get("Content-Length") == "10" && h.header.Get("ETag") == `"`+md5hex([]byte("abcdefghij"))+`"`)
		// If-Match on the staged PUT is checked against the staged ETag
		bad := e.n.s3b(tok, "PUT", path, []byte("x"), "If-Match", `"deadbeef"`)
		good := e.n.s3b(tok, "PUT", path, []byte("abcdefghij"), "If-Match", `"`+md5hex([]byte("abcdefghij"))+`"`)
		okIfMatch.Store(bad.status == 412 && good.status == 200)
		return reply{}
	})
	e.n.must(e.c, 200, "PUT", objPath("bkt", "k"), []byte("abcdefghij"))
	if !okRange.Load() || !okHead.Load() || !okIfMatch.Load() {
		t.Fatalf("range %v head %v if-match %v", okRange.Load(), okHead.Load(), okIfMatch.Load())
	}
	e.n.assertNoStaged()
}

func TestStagedReplacementObeysTheBucketRules(t *testing.T) {
	e := newGate(t, map[string]any{"allowed_content_types": []string{"text/*"}, "max_object_bytes": 64}, nil, nil)
	var typeStatus, sizeStatus, goodStatus atomic.Int32
	e.svc.on("gate", func(cl *call) reply {
		tok, path := cl.bearer(), objPath("bkt", cl.str("key"))
		png := append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 20)...)
		typeStatus.Store(int32(e.n.s3b(tok, "PUT", path, png).status))
		sizeStatus.Store(int32(e.n.s3b(tok, "PUT", path, []byte(strings.Repeat("x", 100))).status))
		goodStatus.Store(int32(e.n.s3b(tok, "PUT", path, []byte("fine")).status))
		return reply{}
	})
	e.n.must(e.c, 200, "PUT", objPath("bkt", "k"), []byte("text"), "Content-Type", "text/plain")
	if typeStatus.Load() != 415 || sizeStatus.Load() != 400 || goodStatus.Load() != 200 {
		t.Fatalf("content-type rule %d, size cap %d, ok %d", typeStatus.Load(), sizeStatus.Load(), goodStatus.Load())
	}
	if got := e.n.must(e.c, 200, "GET", objPath("bkt", "k"), nil); string(got.body) != "fine" {
		t.Fatalf("%q", got.body)
	}
	e.n.assertNoStaged()
}

func TestStagedReplacementOfEncryptedBucket(t *testing.T) {
	e := newGate(t, map[string]any{"encryption": "sse-s3"}, nil, nil)
	e.svc.on("gate", func(cl *call) reply {
		got := e.n.s3b(cl.bearer(), "GET", objPath("bkt", cl.str("key")), nil)
		if string(got.body) != "plain text" {
			t.Errorf("the token sees plaintext: %q", got.body)
		}
		e.n.s3b(cl.bearer(), "PUT", objPath("bkt", cl.str("key")), []byte("transformed"))
		return reply{}
	})
	r := e.n.must(e.c, 200, "PUT", objPath("bkt", "k"), []byte("plain text"))
	if r.header.Get("x-binvault-modified") != "true" || r.header.Get("x-amz-server-side-encryption") != "AES256" {
		t.Fatalf("headers: %v", r.header)
	}
	got := e.n.must(e.c, 200, "GET", objPath("bkt", "k"), nil)
	if string(got.body) != "transformed" || got.header.Get("x-amz-server-side-encryption") != "AES256" {
		t.Fatalf("a replacement inherits the object's encryption: %q %v", got.body, got.header)
	}
	// on disk the bytes are not readable
	e.n.assertNoStaged()
}

func TestBeforeCleansUpStagedFiles(t *testing.T) {
	// every way a chain can end leaves tmp/ empty
	for name, mode := range map[string]struct {
		status int
		put    bool
	}{"rejected": {422, true}, "failed": {500, true}, "passed": {204, true}, "failed-no-put": {500, false}} {
		t.Run(name, func(t *testing.T) {
			e := newGate(t, nil, nil, nil)
			e.svc.on("gate", func(cl *call) reply {
				if mode.put {
					e.n.s3b(cl.bearer(), "PUT", objPath("bkt", cl.str("key")), []byte("replacement"))
				}
				return reply{Status: mode.status}
			})
			e.n.s3(e.c, "PUT", objPath("bkt", "k"), []byte("original"))
			e.n.assertNoStaged()
		})
	}
}

func TestBeforeDoubleReplacement(t *testing.T) {
	// two pipelines replace in turn; the second sees the first's bytes, and the
	// intermediate file is discarded
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "first", "before", map[string]any{"token": stagedGrants})
	n.createPipe(svc, "second", "before", map[string]any{"token": stagedGrants})
	n.attach("bkt", "first", "second")
	svc.on("first", func(cl *call) reply {
		got := n.s3b(cl.bearer(), "GET", objPath("bkt", cl.str("key")), nil)
		n.s3b(cl.bearer(), "PUT", objPath("bkt", cl.str("key")), append(got.body, []byte("+first")...))
		return reply{}
	})
	svc.on("second", func(cl *call) reply {
		got := n.s3b(cl.bearer(), "GET", objPath("bkt", cl.str("key")), nil)
		if cl.str("object", "etag") != md5hex([]byte("orig+first")) {
			t.Errorf("the next pipeline is told the new ETag: %s", cl.Raw)
		}
		n.s3b(cl.bearer(), "PUT", objPath("bkt", cl.str("key")), append(got.body, []byte("+second")...))
		return reply{}
	})
	r := n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("orig"))
	if got := n.must(c, 200, "GET", objPath("bkt", "k"), nil); string(got.body) != "orig+first+second" {
		t.Fatalf("%q", got.body)
	}
	if r.header.Get("ETag") != `"`+md5hex([]byte("orig+first+second"))+`"` {
		t.Fatalf("ETag %s", r.header.Get("ETag"))
	}
	n.assertNoStaged()
}

func TestBeforeDeleteThenPutLastWins(t *testing.T) {
	e := newGate(t, nil, nil, nil)
	e.svc.on("gate", func(cl *call) reply {
		tok, path := cl.bearer(), objPath("bkt", cl.str("key"))
		e.n.s3b(tok, "DELETE", path, nil)
		if st := e.n.s3b(tok, "GET", path, nil).status; st != 404 {
			t.Errorf("a deleted staged object reads as absent to the token: %d", st)
		}
		e.n.s3b(tok, "PUT", path, []byte("revived"))
		return reply{}
	})
	e.n.must(e.c, 200, "PUT", objPath("bkt", "k"), []byte("orig"))
	if got := e.n.must(e.c, 200, "GET", objPath("bkt", "k"), nil); string(got.body) != "revived" {
		t.Fatalf("delete then PUT: the final state wins: %q", got.body)
	}
	// and PUT then DELETE rejects
	e.svc.on("gate", func(cl *call) reply {
		tok, path := cl.bearer(), objPath("bkt", cl.str("key"))
		e.n.s3b(tok, "PUT", path, []byte("replaced"))
		e.n.s3b(tok, "DELETE", path, nil)
		return reply{}
	})
	if r := e.n.s3(e.c, "PUT", objPath("bkt", "k2"), []byte("orig")); r.status != 422 {
		t.Fatalf("PUT then DELETE: %d", r.status)
	}
	e.n.must(e.c, 404, "GET", objPath("bkt", "k2"), nil)
	e.n.assertNoStaged()
}

func TestBeforeDefaultGrantsReadTheStagedObject(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "scan", "before", nil) // default grants: read on {key}
	n.attach("bkt", "scan")
	var read, write atomic.Int32
	svc.on("scan", func(cl *call) reply {
		read.Store(int32(n.s3b(cl.bearer(), "GET", objPath("bkt", cl.str("key")), nil).status))
		write.Store(int32(n.s3b(cl.bearer(), "PUT", objPath("bkt", cl.str("key")), []byte("x")).status))
		return reply{}
	})
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("data"))
	if read.Load() != 200 || write.Load() != 403 {
		t.Fatalf("read %d write %d", read.Load(), write.Load())
	}
}

func TestBeforeConcurrentReplacementsLeaveOneWinner(t *testing.T) {
	e := newGate(t, nil, nil, nil)
	e.svc.on("gate", func(cl *call) reply {
		var wg sync.WaitGroup
		for i := 0; i < 6; i++ {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				e.n.s3b(cl.bearer(), "PUT", objPath("bkt", cl.str("key")), []byte(fmt.Sprintf("candidate-%d", i)))
			}(i)
		}
		wg.Wait()
		return reply{}
	})
	e.n.must(e.c, 200, "PUT", objPath("bkt", "k"), []byte("original"))
	got := e.n.must(e.c, 200, "GET", objPath("bkt", "k"), nil)
	if !strings.HasPrefix(string(got.body), "candidate-") {
		t.Fatalf("committed %q", got.body)
	}
	e.n.assertNoStaged() // the losers' files are gone
}

// versionId=null in an unversioned bucket counts as no version id, so it cannot
// be used to get around a delete gate (spec §3.10).
func TestBeforeDeleteGateCannotBeSkippedWithNullVersionId(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "veto", "before", map[string]any{"events": []string{"object.deleted"}, "token": map[string]any{"grants": []any{}}})
	n.attach("bkt", "veto")
	svc.on("veto", func(*call) reply { return reply{Status: 422} })
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("x"))
	if r := n.s3(c, "DELETE", objPath("bkt", "k")+"?versionId=null", nil); r.status != 422 {
		t.Fatalf("DELETE ?versionId=null: %d %s", r.status, r.code())
	}
	r := n.must(c, 200, "POST", "/bkt?delete", []byte(`<Delete><Object><Key>k</Key><VersionId>null</VersionId></Object></Delete>`))
	if !strings.Contains(string(r.body), "PipelineRejected") {
		t.Fatalf("DeleteObjects entry with VersionId null: %s", r.body)
	}
	n.must(c, 200, "GET", objPath("bkt", "k"), nil)
	// any other version id is invalid in an unversioned bucket
	if r := n.s3(c, "DELETE", objPath("bkt", "k")+"?versionId=abc", nil); r.status != 400 {
		t.Fatalf("other version id: %d", r.status)
	}
}

func TestBeforeEmptyObjects(t *testing.T) {
	e := newGate(t, nil, nil, nil)
	e.svc.on("gate", func(cl *call) reply {
		got := e.n.s3b(cl.bearer(), "GET", objPath("bkt", cl.str("key")), nil)
		if cl.str("key") == "empty" && (got.status != 200 || len(got.body) != 0) {
			t.Errorf("empty staged object: %d %q", got.status, got.body)
		}
		if cl.str("key") == "to-empty" {
			e.n.s3b(cl.bearer(), "PUT", objPath("bkt", cl.str("key")), nil)
		}
		return reply{}
	})
	e.n.must(e.c, 200, "PUT", objPath("bkt", "empty"), nil)
	if got := e.n.must(e.c, 200, "GET", objPath("bkt", "empty"), nil); len(got.body) != 0 || got.header.Get("ETag") != `"d41d8cd98f00b204e9800998ecf8427e"` {
		t.Fatalf("%q %v", got.body, got.header)
	}
	r := e.n.must(e.c, 200, "PUT", objPath("bkt", "to-empty"), []byte("had content"))
	if r.header.Get("x-binvault-modified") != "true" {
		t.Fatal("replaced by an empty object")
	}
	if got := e.n.must(e.c, 200, "GET", objPath("bkt", "to-empty"), nil); len(got.body) != 0 {
		t.Fatalf("%q", got.body)
	}
}
