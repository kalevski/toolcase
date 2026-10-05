package pipeline

import (
	"encoding/json"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// The invocation request body (spec §7.6).

type invocation struct {
	Run        runBlock         `json:"run"`
	Pipeline   string           `json:"pipeline"`
	Stage      string           `json:"stage"`
	Event      string           `json:"event"`
	Operation  string           `json:"operation"`
	Bucket     string           `json:"bucket"`
	Key        string           `json:"key"`
	Object     *objectBlock     `json:"object"`
	Previous   *previousBlock   `json:"previous,omitempty"`
	CopySource *copySourceBlock `json:"copy_source"`
	Actor      actorBlock       `json:"actor"`
	Lineage    lineageBlock     `json:"lineage"`
	S3         *s3Block         `json:"s3,omitempty"`
}

type runBlock struct {
	ID       string    `json:"id"`
	Attempt  int       `json:"attempt"`
	Deadline time.Time `json:"deadline"`
	Test     bool      `json:"test"`
}

type objectBlock struct {
	Version      string            `json:"version"`
	Size         int64             `json:"size"`
	ETag         string            `json:"etag"`
	SHA256       string            `json:"sha256"`
	ContentType  string            `json:"content_type"`
	LastModified time.Time         `json:"last_modified"`
	Metadata     map[string]string `json:"metadata"`
	Tags         map[string]string `json:"tags"`
	DeleteMarker bool              `json:"delete_marker,omitempty"`
}

type previousBlock struct {
	Version      string    `json:"version"`
	Size         int64     `json:"size"`
	ETag         string    `json:"etag"`
	LastModified time.Time `json:"last_modified"`
}

type copySourceBlock struct {
	Bucket  string `json:"bucket"`
	Key     string `json:"key"`
	Version string `json:"version,omitempty"`
}

type actorBlock struct {
	Kind     string `json:"kind"`
	ID       string `json:"id,omitempty"`
	Name     string `json:"name,omitempty"`
	Pipeline string `json:"pipeline,omitempty"`
	Run      string `json:"run,omitempty"`
}

type lineageBlock struct {
	Depth int      `json:"depth"`
	Chain []string `json:"chain"`
}

type s3Block struct {
	Endpoint        string       `json:"endpoint"`
	Region          string       `json:"region"`
	PathStyle       bool         `json:"path_style"`
	AccessKeyID     string       `json:"access_key_id"`
	SecretAccessKey string       `json:"secret_access_key"`
	Bearer          string       `json:"bearer"`
	ExpiresAt       time.Time    `json:"expires_at"`
	Grants          []meta.Grant `json:"grants"`
}

// snapshot is what a run keeps of its event: the object blocks as of the
// moment the event was raised (spec §7.6: "the committed object for after, and
// the snapshot of the removed object for object.deleted").
type snapshot struct {
	Object     *objectBlock     `json:"object"`
	Previous   *previousBlock   `json:"previous,omitempty"`
	CopySource *copySourceBlock `json:"copy_source,omitempty"`
}

func sec(t time.Time) time.Time { return t.UTC().Truncate(time.Second) }

func orEmptyMap(m map[string]string) map[string]string {
	if m == nil {
		return map[string]string{}
	}
	return m
}

func objectBlockOf(o *meta.Object) *objectBlock {
	return &objectBlock{
		Version: o.Version, Size: o.Size, ETag: o.ETag, SHA256: o.SHA256, ContentType: o.ContentType,
		LastModified: sec(o.CreatedAt), Metadata: orEmptyMap(o.Metadata), Tags: orEmptyMap(o.Tags),
	}
}

func previousBlockOf(o *meta.Object) *previousBlock {
	if o == nil {
		return nil
	}
	return &previousBlock{Version: o.Version, Size: o.Size, ETag: o.ETag, LastModified: sec(o.CreatedAt)}
}

// eventInfo is everything the pipeline package needs of an event, whether it
// came from the commit transaction (the outbox) or from a backfill.
type eventInfo struct {
	Type      string
	Operation string
	Bucket    string
	Key       string
	// Obj is the new visible object (created, updated) or, for a deleted event,
	// the object that was removed.
	Obj      *meta.Object
	Previous *meta.Object
	// Marker is the delete marker of a delete in a versioned bucket.
	Marker     *meta.Object
	CopySource *engine.CopySource
	Actor      engine.Actor
	Sniffed    string
	At         time.Time
	BackfillID string
}

func eventInfoOf(ev *engine.Event) *eventInfo {
	info := &eventInfo{Type: ev.Type, Operation: ev.Operation, Bucket: ev.Bucket, Key: ev.Key, Previous: ev.Previous,
		Marker: ev.Marker, CopySource: ev.CopySource, Actor: ev.Actor, Sniffed: ev.Sniffed, At: ev.At}
	if ev.Type == EventDeleted {
		info.Obj = ev.Previous
		info.Previous = nil
	} else {
		info.Obj = ev.Object
	}
	return info
}

// facts are the matching facts of the event's object.
func (e *eventInfo) facts() Facts {
	f := Facts{Key: e.Key, Operation: e.Operation, SniffedType: e.Sniffed}
	if e.Obj != nil {
		f.Size, f.DeclaredType = e.Obj.Size, e.Obj.ContentType
	}
	// no bytes were read for this event (a copy that keeps the blob, an uncovered
	// version): the declared type must not stand in for the sniffed one, or
	// relabelling through a copy would dodge a gate. A deleted event has no bytes by
	// nature and keeps the stored declared type (spec §7.3).
	f.SniffUnknown = e.Sniffed == "" && e.Type != EventDeleted
	return f
}

// objectVersion is the version the event is about: the new version for created
// and updated events, the marker's (or the removed version) for deleted ones.
func (e *eventInfo) objectVersion() string {
	switch {
	case e.Type == EventDeleted && e.Marker != nil:
		return e.Marker.Version
	case e.Obj != nil:
		return e.Obj.Version
	}
	return ""
}

func (e *eventInfo) snapshot(bucket string) snapshot {
	var s snapshot
	if e.Obj != nil {
		s.Object = objectBlockOf(e.Obj)
		if e.Type == EventDeleted && e.Marker != nil {
			s.Object.DeleteMarker = true
			s.Object.Version = e.Marker.Version
			s.Object.LastModified = sec(e.Marker.CreatedAt)
		}
	}
	if e.Type == EventUpdated {
		s.Previous = previousBlockOf(e.Previous)
	}
	if e.CopySource != nil {
		s.CopySource = &copySourceBlock{Bucket: bucket, Key: e.CopySource.Key, Version: e.CopySource.Version}
	}
	return s
}

// actorOf renders an event's actor as the invocation shows it (spec §7.6) and
// as runs record it.
func actorOf(a engine.Actor) actorBlock {
	switch a.Kind {
	case "pipeline":
		return actorBlock{Kind: "pipeline", Pipeline: a.Name, Run: a.RunID}
	case "token":
		return actorBlock{Kind: "token", ID: a.ID, Name: a.Name}
	case "backfill":
		return actorBlock{Kind: "backfill", ID: a.ID}
	case "":
		return actorBlock{Kind: "anonymous"}
	}
	return actorBlock{Kind: a.Kind}
}

func lineageOf(a engine.Actor) lineageBlock {
	chain := a.Chain
	if chain == nil {
		chain = []string{}
	}
	return lineageBlock{Depth: a.Depth, Chain: chain}
}

func mustJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// callSpec is everything an invocation body is made of.
type callSpec struct {
	Pipe        *Pipe
	Run         string
	Attempt     int
	Deadline    time.Time
	Test        bool
	Event       string
	Operation   string
	Bucket, Key string
	Snap        snapshot
	Actor       actorBlock
	Lineage     lineageBlock
	// Token is the attempt's token; nil when the pipeline has no grants.
	Token *token
}

// invocationBody renders the JSON request body of one attempt (spec §7.6).
func (m *Manager) invocationBody(c *callSpec) ([]byte, error) {
	inv := invocation{
		Run:      runBlock{ID: c.Run, Attempt: c.Attempt, Deadline: c.Deadline.UTC().Truncate(time.Millisecond), Test: c.Test},
		Pipeline: c.Pipe.Name(), Stage: c.Pipe.Def.Stage, Event: c.Event, Operation: c.Operation,
		Bucket: c.Bucket, Key: c.Key, Object: c.Snap.Object, Previous: c.Snap.Previous, CopySource: c.Snap.CopySource,
		Actor: c.Actor, Lineage: c.Lineage,
	}
	if t := c.Token; t != nil {
		endpoint := c.Pipe.Def.Service.S3Endpoint
		if endpoint == "" {
			endpoint = m.cfg.EndpointURL
		}
		inv.S3 = &s3Block{
			Endpoint: endpoint, Region: m.cfg.Region, PathStyle: true, AccessKeyID: t.id, SecretAccessKey: t.secret,
			Bearer: t.id + "." + t.secret, ExpiresAt: t.expires.UTC().Truncate(time.Millisecond), Grants: t.grants,
		}
	}
	return json.Marshal(inv)
}
