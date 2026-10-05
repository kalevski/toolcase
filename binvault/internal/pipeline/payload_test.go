package pipeline

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

func sampleObject() *meta.Object {
	return &meta.Object{
		Seq: 7, Bucket: "photos", Key: "uploads/u/42/photo.png", Version: "01J9Z4J", Size: 482113,
		ETag: "9b2cf535f27731c974343645a3985328", SHA256: "2c26b4", ContentType: "image/png",
		CreatedAt: time.Date(2026, 10, 2, 12, 0, 0, 999_000_000, time.UTC),
		Metadata:  map[string]string{"uploaded-by": "42"}, Tags: map[string]string{"kind": "avatar"}, IsLatest: true,
	}
}

func decodeMap(t *testing.T, raw []byte) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatal(err)
	}
	return m
}

func TestInvocationBody(t *testing.T) {
	cfg := config.ForTest(func(c *config.Config) { c.EndpointURL = "http://binvault:9000"; c.Region = "eu-west-1" })
	m := &Manager{cfg: cfg}
	p := &Pipe{Def: Definition{Name: "compress-images", Stage: StageBefore}}
	obj := sampleObject()
	prev := sampleObject()
	prev.Version, prev.Size = "01J9OLD", 10
	ev := &engine.Event{Type: EventUpdated, Operation: "copy", Bucket: "photos", Key: obj.Key, Object: obj, Previous: prev,
		CopySource: &engine.CopySource{Key: "src/a.png"}, Actor: engine.Actor{Kind: "token", ID: "BVK3F7", Name: "web-app"}}
	info := eventInfoOf(ev)
	reg := newTokenRegistry(time.Now)
	deadline := time.Date(2026, 10, 2, 12, 0, 20, 0, time.UTC)
	tok, _ := reg.mint(mintSpec{Pipeline: "compress-images", Run: "run_1", Bucket: "photos", Deadline: deadline,
		Grants: []meta.Grant{{Actions: []string{"read", "write"}, Keys: []string{obj.Key}}}})
	body, err := m.invocationBody(&callSpec{
		Pipe: p, Run: "run_01J9Z4K", Attempt: 2, Deadline: deadline, Event: info.Type, Operation: info.Operation,
		Bucket: "photos", Key: obj.Key, Snap: info.snapshot("photos"), Actor: actorOf(ev.Actor), Lineage: lineageOf(ev.Actor), Token: tok,
	})
	if err != nil {
		t.Fatal(err)
	}
	got := decodeMap(t, body)
	run := got["run"].(map[string]any)
	if run["id"] != "run_01J9Z4K" || run["attempt"].(float64) != 2 || run["test"] != false || run["deadline"] != "2026-10-02T12:00:20Z" {
		t.Fatalf("run: %v", run)
	}
	for k, want := range map[string]any{
		"pipeline": "compress-images", "stage": "before", "event": "object.updated", "operation": "copy", "bucket": "photos", "key": obj.Key,
	} {
		if got[k] != want {
			t.Errorf("%s = %v, want %v", k, got[k], want)
		}
	}
	o := got["object"].(map[string]any)
	if o["version"] != "01J9Z4J" || o["size"].(float64) != 482113 || o["etag"] != obj.ETag || o["content_type"] != "image/png" ||
		o["last_modified"] != "2026-10-02T12:00:00Z" || o["metadata"].(map[string]any)["uploaded-by"] != "42" || o["tags"].(map[string]any)["kind"] != "avatar" {
		t.Fatalf("object: %v", o)
	}
	if _, has := o["delete_marker"]; has {
		t.Error("delete_marker only appears for delete markers")
	}
	pv := got["previous"].(map[string]any)
	if pv["version"] != "01J9OLD" || pv["size"].(float64) != 10 {
		t.Fatalf("previous: %v", pv)
	}
	if cs := got["copy_source"].(map[string]any); cs["bucket"] != "photos" || cs["key"] != "src/a.png" {
		t.Fatalf("copy_source: %v", cs)
	}
	if a := got["actor"].(map[string]any); a["kind"] != "token" || a["id"] != "BVK3F7" || a["name"] != "web-app" {
		t.Fatalf("actor: %v", a)
	}
	if l := got["lineage"].(map[string]any); l["depth"].(float64) != 0 || len(l["chain"].([]any)) != 0 {
		t.Fatalf("lineage: %v", l)
	}
	s3 := got["s3"].(map[string]any)
	if s3["endpoint"] != "http://binvault:9000" || s3["region"] != "eu-west-1" || s3["path_style"] != true ||
		s3["access_key_id"] != tok.id || s3["secret_access_key"] != tok.secret || s3["bearer"] != tok.id+"."+tok.secret ||
		s3["expires_at"] != "2026-10-02T12:00:50Z" {
		t.Fatalf("s3: %v", s3)
	}
	g := s3["grants"].([]any)[0].(map[string]any)
	if g["keys"].([]any)[0] != obj.Key || len(g["actions"].([]any)) != 2 {
		t.Fatalf("grants: %v", g)
	}

	// no token: no s3 block; the pipeline's own S3 endpoint wins
	body, _ = m.invocationBody(&callSpec{Pipe: p, Run: "r", Attempt: 1, Deadline: deadline, Snap: snapshot{Object: &objectBlock{}}, Lineage: lineageBlock{Chain: []string{}}})
	if _, has := decodeMap(t, body)["s3"]; has {
		t.Error("no grants, no s3 block")
	}
	if decodeMap(t, body)["previous"] != nil {
		t.Error("previous is absent for creates")
	}
	p.Def.Service.S3Endpoint = "https://s3.internal"
	body, _ = m.invocationBody(&callSpec{Pipe: p, Run: "r", Attempt: 1, Deadline: deadline, Snap: snapshot{Object: &objectBlock{}}, Token: tok, Lineage: lineageBlock{Chain: []string{}}})
	if decodeMap(t, body)["s3"].(map[string]any)["endpoint"] != "https://s3.internal" {
		t.Error("service.s3_endpoint overrides BINVAULT_ENDPOINT_URL")
	}
}

func TestEventInfoForDeletes(t *testing.T) {
	removed := sampleObject()
	marker := &meta.Object{Version: "01MARKER", DeleteMarker: true, CreatedAt: time.Date(2026, 10, 3, 1, 2, 3, 0, time.UTC)}
	ev := &engine.Event{Type: EventDeleted, Operation: "delete", Bucket: "photos", Key: removed.Key, Previous: removed, Marker: marker,
		Actor: engine.Actor{Kind: "token", ID: "BVK1"}}
	info := eventInfoOf(ev)
	if info.Obj != removed || info.Previous != nil || info.objectVersion() != "01MARKER" {
		t.Fatalf("info: %+v", info)
	}
	f := info.facts()
	if f.Size != 482113 || f.DeclaredType != "image/png" || f.Operation != "delete" {
		t.Fatalf("facts: %+v", f)
	}
	snap := info.snapshot("photos")
	if !snap.Object.DeleteMarker || snap.Object.Version != "01MARKER" || snap.Object.LastModified.Day() != 3 || snap.Previous != nil {
		t.Fatalf("snapshot of a versioned delete: %+v", snap.Object)
	}
	// unversioned: the removed object itself, no marker
	ev.Marker = nil
	info = eventInfoOf(ev)
	if info.objectVersion() != "01J9Z4J" || info.snapshot("photos").Object.DeleteMarker {
		t.Fatal("an unversioned delete describes the removed version")
	}
}

func TestActorBlocks(t *testing.T) {
	cases := []struct {
		in   engine.Actor
		want actorBlock
	}{
		{engine.Actor{Kind: "token", ID: "BVK1", Name: "web"}, actorBlock{Kind: "token", ID: "BVK1", Name: "web"}},
		{engine.Actor{Kind: "pipeline", ID: "BVPXXXX", Name: "thumbs", RunID: "run_9"}, actorBlock{Kind: "pipeline", Pipeline: "thumbs", Run: "run_9"}},
		{engine.Actor{Kind: "backfill", ID: "bf_1"}, actorBlock{Kind: "backfill", ID: "bf_1"}},
		{engine.Actor{Kind: "lifecycle", ID: "lifecycle"}, actorBlock{Kind: "lifecycle"}},
		{engine.Actor{}, actorBlock{Kind: "anonymous"}},
	}
	for _, c := range cases {
		if got := actorOf(c.in); got != c.want {
			t.Errorf("actorOf(%+v) = %+v, want %+v", c.in, got, c.want)
		}
	}
	if l := lineageOf(engine.Actor{Depth: 3, Chain: []string{"a"}}); l.Depth != 3 || len(l.Chain) != 1 {
		t.Fatal("lineage")
	}
	if l := lineageOf(engine.Actor{}); l.Chain == nil {
		t.Fatal("an empty chain renders as [], not null")
	}
}

func TestSyntheticObject(t *testing.T) {
	o := syntheticObject(time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC))
	if o.Size != 0 || o.ETag != "d41d8cd98f00b204e9800998ecf8427e" || o.Metadata == nil || o.Tags == nil || o.Version == "" {
		t.Fatalf("%+v", o)
	}
}
