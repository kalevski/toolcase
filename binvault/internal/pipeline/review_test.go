package pipeline_test

import (
	"context"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/engine"
)

// Regression tests for the findings of the pipelines security review.

// A delete that observed "no object" must not delete an object created before
// its write transaction runs: the delete gate was never consulted for it.
func TestDeleteConditionsOnTheObservedState(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "gate", "before", map[string]any{
		"events": []string{"object.deleted"},
		"token":  map[string]any{"grants": []map[string]any{{"actions": []string{"read"}, "keys": []string{"{key}"}}}},
	})
	n.attach("bkt", "gate")
	svc.on("gate", func(*call) reply { return reply{Status: 422} }) // vetoes every delete

	ctx := context.Background()
	b, err := n.app.Eng.Bucket(ctx, "bkt")
	if err != nil {
		t.Fatal(err)
	}
	actor := engine.Actor{Kind: "token", ID: c.ak}

	// 1. nothing is there: the observation is "absent" (-1), not "unconditional"
	seq, err := n.app.Eng.BeforeDelete(ctx, &engine.BeforeDeleteCall{Bucket: b, Key: "k", Actor: actor})
	if err != nil || seq != -1 {
		t.Fatalf("absent key: seq=%d err=%v, want -1", seq, err)
	}
	// 2. an object appears before that delete is applied
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("new record"))
	res, err := n.app.Eng.Delete(ctx, &engine.DeleteRequest{Bucket: "bkt", Key: "k", IfSeq: seq, Actor: actor})
	if err != nil {
		t.Fatal(err)
	}
	if !res.Skipped {
		t.Fatal("the stale delete went through: an unvetted object was deleted")
	}
	if g := n.s3(c, "GET", objPath("bkt", "k"), nil); g.status != 200 || string(g.body) != "new record" {
		t.Fatalf("the object must survive: %d %q", g.status, g.body)
	}
	// 3. through the S3 API the same delete reaches the gate, which vetoes it
	if r := n.s3(c, "DELETE", objPath("bkt", "k"), nil); r.status != 422 || r.code() != "PipelineRejected" {
		t.Fatalf("%d %s", r.status, r.code())
	}
	// 4. an object that matches no gate is still deleted only if unchanged
	n.createPipe(svc, "narrow", "before", map[string]any{
		"events": []string{"object.deleted"}, "match": map[string]any{"keys": []string{"never/**"}},
	})
	n.attach("bkt", "narrow")
	live, _ := n.app.Eng.DB.Read().GetLatest(ctx, "bkt", "k")
	seq, err = n.app.Eng.BeforeDelete(ctx, &engine.BeforeDeleteCall{Bucket: b, Key: "k", Actor: actor})
	if err != nil || seq != live.Seq {
		t.Fatalf("an unmatched object is observed, not ignored: seq=%d want %d err=%v", seq, live.Seq, err)
	}
}

// With no before pipeline subscribed to deletes there is nothing to condition on.
func TestDeleteIsUnconditionalWithoutADeleteGate(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	n.createPipe(svc, "created-only", "before", map[string]any{"events": []string{"object.created"}})
	n.attach("bkt", "created-only")
	b, _ := n.app.Eng.Bucket(context.Background(), "bkt")
	seq, err := n.app.Eng.BeforeDelete(context.Background(), &engine.BeforeDeleteCall{Bucket: b, Key: "k", Actor: engine.Actor{Kind: "token"}})
	if err != nil || seq != 0 {
		t.Fatalf("seq=%d err=%v, want 0", seq, err)
	}
}

// Field names in a pipeline document are matched exactly: encoding/json alone
// would take "Enabled" for "enabled", and in a merge patch the edit would then
// silently do nothing (both spellings end up in the merged document).
func TestDefinitionKeysAreExact(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.createPipe(svc, "p", "after", nil)
	rev := n.mustAdmin(200, "GET", "/pipelines/p", nil)["revision"]

	for name, patch := range map[string]map[string]any{
		"top level": {"Paused": true},
		"nested":    {"service": map[string]any{"URL": "http://example.test/"}},
		"deeper":    {"match": map[string]any{"Keys": []string{"a/**"}}},
	} {
		code, out := n.admin("PATCH", "/pipelines/p", patch)
		if code != 400 {
			t.Fatalf("%s: PATCH %v answered %d, want 400: %v", name, patch, code, out)
		}
	}
	code, out := n.admin("PATCH", "/pipelines/p", map[string]any{"Paused": true})
	if f, _ := out["fields"].(map[string]any); code != 400 || f["Paused"] != "unknown field" {
		t.Fatalf("the offending key is named: %d %v", code, out)
	}
	// the same on a replacement and on a creation
	body := n.pipe(svc, "q", "after", nil)
	body["Enabled"] = false
	n.mustAdmin(400, "POST", "/pipelines", body)
	body = n.pipe(svc, "p", "after", nil)
	body["Enabled"] = false
	n.mustAdmin(400, "PUT", "/pipelines/p", body)

	if got := n.mustAdmin(200, "GET", "/pipelines/p", nil); got["revision"] != rev || got["paused"] == true {
		t.Fatalf("a refused edit changed the pipeline: %v", got)
	}
	// the exact spelling is applied
	if out := n.mustAdmin(200, "PATCH", "/pipelines/p", map[string]any{"paused": true}); out["paused"] != true {
		t.Fatalf("paused: %v", out)
	}
}

// A condition on the sniffed type is taken as met where no bytes were read:
// relabelling an object through a copy must not dodge a scanner, and a backfill
// cannot tell what a mislabelled object holds.
func TestSniffedFilterIsNotDodgedWhereNoBytesWereRead(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "scan", "after", map[string]any{
		"match": map[string]any{"content_type": []string{"application/vnd.sqlite3"}, "content_type_source": "sniffed"},
		"token": map[string]any{"grants": []any{}},
	})
	n.attach("bkt", "scan")
	database := append([]byte("SQLite format 3\x00"), make([]byte, 100)...)
	n.must(c, 200, "PUT", objPath("bkt", "a.txt"), database, "Content-Type", "text/plain")
	n.must(c, 200, "PUT", objPath("bkt", "plain.txt"), []byte("hello"), "Content-Type", "text/plain")
	n.waitRunState("pipeline=scan&key=a.txt", "succeeded")

	// the same bytes under a harmless label, by a copy
	n.must(c, 200, "PUT", objPath("bkt", "b.txt"), nil,
		"x-amz-copy-source", "/bkt/a.txt", "x-amz-metadata-directive", "REPLACE", "Content-Type", "text/plain")
	n.waitRunState("pipeline=scan&key=b.txt", "succeeded")

	// a backfill does not read bytes either
	n.must(c, 200, "PUT", objPath("bkt", "old.png"), []byte("not a picture"), "Content-Type", "image/png")
	out := n.mustAdmin(202, "POST", "/backfills", map[string]any{"bucket": "bkt", "pipeline": "scan"})
	eventually(t, 15*time.Second, "the backfill to finish", func() bool {
		return n.mustAdmin(200, "GET", "/backfills/"+out["id"].(string), nil)["state"] == "completed"
	})
	n.waitRunState("pipeline=scan&key=old.png", "succeeded")

	// the bytes of a plain write were read, and are not a database
	for _, r := range n.runs("pipeline=scan&key=plain.txt&limit=100") {
		if r["operation"] != "backfill" {
			t.Fatalf("a text write must not match a sniffed database filter: %v", r)
		}
	}
}

// A POST Object form is authenticated inside its handler, past the point where a
// pipeline token's request is bound to its attempt: the upload could outlive the
// token. Services use PUT; browser forms are for people.
func TestPipelineTokenCannotPostObject(t *testing.T) {
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "p", "after", map[string]any{"token": map[string]any{"grants": []map[string]any{
		{"actions": []string{"read", "write"}, "keys": []string{"{key}", "up/*"}},
	}}})
	n.attach("bkt", "p")
	posted := make(chan int, 1)
	svc.on("p", func(cl *call) reply {
		sc := cred{cl.str("s3", "access_key_id"), cl.str("s3", "secret_access_key")}
		posted <- n.postForm(sc, "bkt", "up/from-service", []byte("late")).status
		return reply{}
	})
	n.must(c, 200, "PUT", objPath("bkt", "doc"), []byte("body"))
	if st := <-posted; st != 403 {
		t.Fatalf("POST Object with a pipeline token: %d", st)
	}
	n.waitRunState("pipeline=p", "succeeded")
	n.must(c, 404, "GET", objPath("bkt", "up/from-service"), nil)
}
