package pipeline

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"strings"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/admin"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/ulid"
)

// ---- list and detail ------------------------------------------------------------------

func (m *Manager) listPipelines(rc *admin.Ctx) error {
	limit, cursor, err := admin.PageParams(rc.R)
	if err != nil {
		return err
	}
	recs, err := m.db.Read().ListPipelines(rc.Ctx, cursor, limit+1)
	if err != nil {
		return admin.Internal(err)
	}
	var next any
	if len(recs) > limit {
		recs = recs[:limit]
		next = recs[len(recs)-1].Name
	}
	items := make([]Definition, 0, len(recs))
	for _, rec := range recs {
		p, err := m.pipe(rc.Ctx, m.db.Read(), rec.Name)
		if err != nil || p == nil {
			return admin.Internal(fmt.Errorf("pipeline %q cannot be read: %v", rec.Name, err))
		}
		items = append(items, p.view())
	}
	admin.WriteJSON(rc.W, http.StatusOK, map[string]any{"items": items, "next_cursor": next})
	return nil
}

func (m *Manager) getPipeline(rc *admin.Ctx, name string) error {
	p, err := m.pipe(rc.Ctx, m.db.Read(), name)
	if err != nil {
		return admin.Internal(err)
	}
	if p == nil {
		return admin.NotFound(fmt.Sprintf("pipeline %q does not exist", name))
	}
	d := p.view()
	attached, err := m.attachedTo(rc.Ctx, name)
	if err != nil {
		return admin.Internal(err)
	}
	d.AttachedTo = attached
	admin.WriteJSON(rc.W, http.StatusOK, d)
	return nil
}

// ---- create, replace, patch --------------------------------------------------------------

// readBody reads a JSON request body, bounded as every admin body is.
func readBody(rc *admin.Ctx) ([]byte, error) {
	body, err := io.ReadAll(io.LimitReader(rc.R.Body, admin.MaxBody+1))
	if err != nil {
		return nil, admin.Invalid("could not read the request body", nil)
	}
	if len(body) > admin.MaxBody {
		return nil, &admin.APIError{Status: http.StatusRequestEntityTooLarge, Code: "payload_too_large", Detail: "request body exceeds 256 KiB"}
	}
	return body, nil
}

func (m *Manager) createPipeline(rc *admin.Ctx) error {
	raw, err := readBody(rc)
	if err != nil {
		return err
	}
	def := NewDefinition()
	if err := decodeDefinition(raw, &def); err != nil {
		return err
	}
	p, err := m.writePipeline(rc, def, raw, nil, 0)
	if err != nil {
		return err
	}
	rc.WriteReplicated(http.StatusCreated, p.view())
	return nil
}

func (m *Manager) updatePipeline(rc *admin.Ctx, name string, patch bool) error {
	rev, err := ifMatch(rc.R)
	if err != nil {
		return err
	}
	body, err := readBody(rc)
	if err != nil {
		return err
	}
	var doc map[string]any
	if patch {
		if err := admin.DecodeStrict(body, &doc); err != nil {
			return err
		}
		if f := unknownKeys(doc); len(f) > 0 {
			return admin.Invalid("invalid pipeline", f)
		}
	}
	// Without If-Match the edit is still applied to the revision it was read at, so
	// that a concurrent edit is never overwritten (stored secrets are kept or
	// removed according to what this edit saw): when the pipeline changed in
	// between, the edit is made again on the fresh state.
	// edits are admin-rate: serialising them makes the loop below a fallback
	m.editMu.Lock()
	defer m.editMu.Unlock()
	for attempt := 0; ; attempt++ {
		cur, err := m.pipe(rc.Ctx, m.db.Read(), name)
		if err != nil {
			return admin.Internal(err)
		}
		if cur == nil {
			return admin.NotFound(fmt.Sprintf("pipeline %q does not exist", name))
		}
		def, raw, err := m.editedDefinition(cur, body, doc, patch)
		if err != nil {
			return err
		}
		at := rev
		if at == 0 {
			at = cur.Def.Revision
		}
		p, err := m.writePipeline(rc, def, raw, cur, at)
		if errors.Is(err, errPipelineChanged) {
			if rev == 0 && attempt < 4 {
				continue
			}
			return admin.Precondition("the pipeline was changed by someone else; read it again")
		}
		if err != nil {
			return err
		}
		rc.WriteReplicated(http.StatusOK, p.view())
		return nil
	}
}

// editedDefinition applies a PUT body or a merge patch to the current pipeline.
func (m *Manager) editedDefinition(cur *Pipe, body []byte, doc map[string]any, patch bool) (Definition, []byte, error) {
	def := NewDefinition()
	if !patch {
		return def, body, decodeDefinition(body, &def)
	}
	// the patch applies to the definition as responses show it: stored header
	// values read "***" and so keep their value, and an absent signing_secret
	// keeps the secret; an explicit null removes it
	base, err := toMap(cur.view())
	if err != nil {
		return def, nil, admin.Internal(err)
	}
	MergePatch(base, doc)
	if svc, ok := doc["service"].(map[string]any); ok {
		if v, present := svc["signing_secret"]; present && v == nil {
			if bs, _ := base["service"].(map[string]any); bs != nil {
				bs["signing_secret"] = nil
			}
		}
	}
	merged, err := json.Marshal(base)
	if err != nil {
		return def, nil, admin.Internal(err)
	}
	return def, merged, admin.DecodeStrict(merged, &def)
}

// decodeDefinition decodes a whole definition; field names must be spelled
// exactly (encoding/json would also match "Enabled" to "enabled").
func decodeDefinition(body []byte, def *Definition) error {
	if err := admin.DecodeStrict(body, def); err != nil {
		return err
	}
	var doc map[string]any
	if json.Unmarshal(body, &doc) == nil {
		if f := unknownKeys(doc); len(f) > 0 {
			return admin.Invalid("invalid pipeline", f)
		}
	}
	return nil
}

// unknownKeys lists the keys of a definition document that are not a field of
// Definition spelled exactly as in its JSON form. A merge patch needs this: with
// "Enabled" next to "enabled" in the merged document, encoding/json applies one of
// the two (the later in key order) and the edit silently does nothing.
func unknownKeys(doc map[string]any) map[string]string {
	f := map[string]string{}
	checkKeys(doc, reflect.TypeOf(Definition{}), "", f)
	return f
}

func checkKeys(doc map[string]any, t reflect.Type, prefix string, f map[string]string) {
	known := make(map[string]reflect.Type, t.NumField())
	for i := 0; i < t.NumField(); i++ {
		sf := t.Field(i)
		if name, _, _ := strings.Cut(sf.Tag.Get("json"), ","); name != "" && name != "-" {
			known[name] = sf.Type
		}
	}
	for k, v := range doc {
		ft, ok := known[k]
		if !ok {
			f[prefix+k] = "unknown field"
			continue
		}
		if sub, isMap := v.(map[string]any); isMap && ft.Kind() == reflect.Struct {
			checkKeys(sub, ft, prefix+k+".", f)
		}
	}
}

// errPipelineChanged: the pipeline's revision is not the one the edit was based on.
var errPipelineChanged = errors.New("pipeline changed")

func toMap(v any) (map[string]any, error) {
	raw, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	var out map[string]any
	return out, json.Unmarshal(raw, &out)
}

// writePipeline validates a definition and stores it: a creation when cur is
// nil, otherwise a replacement of cur (If-Match revision rev when non-zero).
func (m *Manager) writePipeline(rc *admin.Ctx, def Definition, raw []byte, cur *Pipe, rev int64) (*Pipe, error) {
	fields := map[string]string{}
	checkExplicit(raw, fields)
	if cur != nil {
		if def.Name != "" && def.Name != cur.Name() {
			fields["name"] = "the name is immutable"
		}
		def.Name = cur.Name()
		switch def.Stage {
		case "":
			def.Stage = cur.Def.Stage
		case cur.Def.Stage:
		default:
			fields["stage"] = "the stage is immutable"
		}
	}

	// secrets: "***" keeps the stored header value, an absent signing_secret
	// keeps the stored one, null removes it (spec §6.5)
	headers := make(map[string]string, len(def.Service.Headers))
	for name, v := range def.Service.Headers {
		if v != Redacted {
			headers[name] = v
			continue
		}
		stored, ok := "", false
		if cur != nil {
			stored, ok = lookupHeader(cur.Headers, name)
		}
		if !ok {
			fields["service.headers."+name] = `"***" keeps a stored value, and there is none for this header`
			continue
		}
		headers[name] = stored
	}
	secret := ""
	switch {
	case !def.Service.SigningSecret.Set:
		if cur != nil {
			secret = cur.Secret
		}
	case def.Service.SigningSecret.Null:
	default:
		secret = def.Service.SigningSecret.V
	}

	for k, v := range def.Normalize(m.env()) {
		fields[k] = v
	}
	if len(fields) > 0 {
		return nil, admin.Invalid("invalid pipeline", fields)
	}
	def.Service.Headers = headers // the clear values; Public redacts them again
	enc, err := encode(m.ring, def, headers, secret)
	if err != nil {
		return nil, admin.Internal(err)
	}
	if m.cl != nil {
		// a cluster: the definition is catalog data (cluster.go)
		return m.writePipelineCluster(rc, def, enc, cur, rev)
	}

	rec := &meta.Pipeline{
		Name: def.Name, Stage: def.Stage, Definition: enc.definition, HeadersSealed: enc.headers, SigningSealed: enc.signing,
	}
	if cur == nil {
		rec.Generation = ulid.New()
		err = m.db.Update(rc.Ctx, func(tx *meta.Tx) error {
			n, err := tx.CountPipelines(rc.Ctx)
			if err != nil {
				return err
			}
			if n >= MaxPipelines {
				return errTooManyPipelines
			}
			if err := tx.CreatePipeline(rc.Ctx, rec); err != nil {
				return err
			}
			return m.settlePipelineHold(rc.Ctx, tx, def)
		})
	} else {
		rec.Generation = cur.Generation
		err = m.db.Update(rc.Ctx, func(tx *meta.Tx) error {
			if err := tx.UpdatePipeline(rc.Ctx, rec, rev); err != nil {
				return err
			}
			// a pipeline released after being held: the time it was held does not
			// count toward its queued runs' 24 hours of retrying (spec §7.10)
			return m.settlePipelineHold(rc.Ctx, tx, def)
		})
	}
	switch {
	case errors.Is(err, meta.ErrExists):
		return nil, admin.Conflict(fmt.Sprintf("pipeline %q already exists", def.Name))
	case errors.Is(err, errTooManyPipelines):
		return nil, admin.Conflict(fmt.Sprintf("at most %d pipelines can be defined", MaxPipelines))
	case errors.Is(err, meta.ErrConflict):
		return nil, errPipelineChanged
	case errors.Is(err, meta.ErrNotFound):
		return nil, admin.NotFound(fmt.Sprintf("pipeline %q does not exist", def.Name))
	case err != nil:
		return nil, admin.Internal(err)
	}
	fresh, err := m.db.Read().GetPipeline(rc.Ctx, def.Name)
	if err != nil {
		return nil, admin.Internal(err)
	}
	p, err := open(m.ring, fresh)
	if err != nil {
		return nil, admin.Internal(err)
	}
	m.pipes.set(p)
	m.sems.of(p) // applies a changed max_concurrency
	m.notify()
	return p, nil
}

var errTooManyPipelines = errors.New("too many pipelines")

// checkExplicit flags values the body states outright that Normalize would
// otherwise take for "absent" and silently default: an empty events list, a
// zero max_concurrency or max_attempts.
func checkExplicit(raw []byte, f map[string]string) {
	var doc struct {
		Events *[]string `json:"events"`
		Limits struct {
			MaxConcurrency *int `json:"max_concurrency"`
		} `json:"limits"`
		Retry struct {
			MaxAttempts *int `json:"max_attempts"`
		} `json:"retry"`
	}
	if len(raw) == 0 || json.Unmarshal(raw, &doc) != nil {
		return
	}
	if doc.Events != nil && len(*doc.Events) == 0 {
		f["events"] = "must not be empty (omit it for object.created and object.updated)"
	}
	if doc.Limits.MaxConcurrency != nil && *doc.Limits.MaxConcurrency < 1 {
		f["limits.max_concurrency"] = "between 1 and 256"
	}
	if doc.Retry.MaxAttempts != nil && *doc.Retry.MaxAttempts < 1 {
		f["retry.max_attempts"] = "at least 1"
	}
}

func lookupHeader(h map[string]string, name string) (string, bool) {
	if v, ok := h[name]; ok {
		return v, true
	}
	for k, v := range h {
		if strings.EqualFold(k, name) {
			return v, true
		}
	}
	return "", false
}

// ---- delete -------------------------------------------------------------------------------

var errAttached = errors.New("pipeline is attached")

func (m *Manager) deletePipeline(rc *admin.Ctx, name string) error {
	if m.cl != nil {
		return m.deletePipelineCluster(rc, name)
	}
	detach := rc.R.URL.Query().Get("detach") == "true"
	var buckets, cancelledBackfills []string
	var refs []meta.RunRef
	var attachedTo []string
	err := m.db.Update(rc.Ctx, func(tx *meta.Tx) error {
		if _, err := tx.GetPipeline(rc.Ctx, name); err != nil {
			return err
		}
		atts, err := tx.AttachmentsOfPipeline(rc.Ctx, name)
		if err != nil {
			return err
		}
		if len(atts) > 0 && !detach {
			for _, a := range atts {
				attachedTo = append(attachedTo, a.Bucket)
			}
			return errAttached
		}
		if buckets, err = tx.DeleteAttachmentsOfPipeline(rc.Ctx, name); err != nil {
			return err
		}
		if err := tx.KVDelete(rc.Ctx, pipelineHoldKey(name)); err != nil {
			return err
		}
		for _, b := range buckets {
			if err := tx.KVDelete(rc.Ctx, attachmentHoldKey(b, name)); err != nil {
				return err
			}
		}
		if refs, err = tx.CancelRuns(rc.Ctx, meta.RunFilter{Pipeline: name}, ReasonPipelineRemoved, tx.Now()); err != nil {
			return err
		}
		bfs, err := tx.RunningBackfills(rc.Ctx)
		if err != nil {
			return err
		}
		for _, b := range bfs {
			if b.Pipeline == name {
				cancelledBackfills = append(cancelledBackfills, b.ID)
			}
		}
		if err := tx.CancelBackfillsOf(rc.Ctx, "", name, tx.Now()); err != nil {
			return err
		}
		return tx.DeletePipeline(rc.Ctx, name)
	})
	switch {
	case errors.Is(err, meta.ErrNotFound):
		return admin.NotFound(fmt.Sprintf("pipeline %q does not exist", name))
	case errors.Is(err, errAttached):
		return admin.Conflict(fmt.Sprintf("pipeline %q is attached to %s; detach it first or use ?detach=true", name, strings.Join(attachedTo, ", ")))
	case err != nil:
		return admin.Internal(err)
	}
	m.pipes.remove(name)
	m.sems.forget(name)
	for _, b := range buckets {
		m.atts.forget(b)
	}
	for _, id := range cancelledBackfills {
		m.bf.cancel(id)
	}
	for _, r := range refs {
		m.mt.runs.Inc(r.Pipeline, r.Stage, meta.RunCancelled)
	}
	m.notify()
	rc.W.WriteHeader(http.StatusNoContent)
	return nil
}

// ---- test --------------------------------------------------------------------------------

type testBody struct {
	Bucket string `json:"bucket"`
	Key    string `json:"key"`
	Event  string `json:"event"`
}

type testResult struct {
	HTTPStatus int     `json:"http_status"`
	LatencyMS  int64   `json:"latency_ms"`
	Message    *string `json:"message"`
	Error      *string `json:"error"`
}

// testPipeline makes one synthetic invocation (spec §6.5): a normal request with
// run.test set, a real token minted from the pipeline's grants for the bucket
// and key, one call and no retries, and no run record. There is no staged view
// in a test: the token acts on live data.
func (m *Manager) testPipeline(rc *admin.Ctx, name string) error {
	var body testBody
	if err := rc.Decode(&body); err != nil {
		return err
	}
	p, err := m.pipe(rc.Ctx, m.db.Read(), name)
	if err != nil {
		return admin.Internal(err)
	}
	if p == nil {
		return admin.NotFound(fmt.Sprintf("pipeline %q does not exist", name))
	}
	fields := map[string]string{}
	if body.Bucket == "" {
		fields["bucket"] = "required"
	}
	if err := engine.ValidateKey(body.Key); err != nil {
		fields["key"] = "must be a valid object key"
	}
	event := body.Event
	if event == "" {
		event = p.Def.Events[0]
	}
	if !contains(allEvents, event) {
		fields["event"] = fmt.Sprintf("unknown event %q", event)
	}
	if len(fields) > 0 {
		return admin.Invalid("invalid test request", fields)
	}
	if _, err := m.db.Read().GetBucket(rc.Ctx, body.Bucket); err != nil {
		if errors.Is(err, meta.ErrNotFound) {
			return admin.NotFound(fmt.Sprintf("bucket %q does not exist", body.Bucket))
		}
		return admin.Internal(err)
	}

	snap := snapshot{Object: syntheticObject(m.Now())}
	op := "put"
	if event == EventDeleted {
		op = "delete"
	}
	if live, err := m.db.Read().GetLatest(rc.Ctx, body.Bucket, body.Key); err == nil && !live.DeleteMarker {
		snap.Object = objectBlockOf(live)
	}
	start := m.Now()
	timeout := p.timeout
	deadline := start.Add(timeout)
	spec := &callSpec{
		Pipe: p, Run: runPrefix + ulid.New(), Attempt: 1, Deadline: deadline, Test: true, Event: event, Operation: op,
		Bucket: body.Bucket, Key: body.Key, Snap: snap,
		Actor: actorBlock{Kind: "admin"}, Lineage: lineageBlock{Chain: []string{}},
	}
	if grants := ExpandGrants(p.Def.Token.Grants, body.Key, false); len(grants) > 0 {
		tok, err := m.toks.mint(mintSpec{Pipeline: p.Name(), Run: spec.Run, Bucket: body.Bucket, Grants: grants, Deadline: deadline})
		if err != nil {
			return admin.Invalid("invalid pipeline token grants", map[string]string{"token.grants": err.Error()})
		}
		spec.Token = tok
		defer tok.revoke()
	}
	raw, err := m.invocationBody(spec)
	if err != nil {
		return admin.Internal(err)
	}
	m.inflight.Add(1)
	defer m.inflight.Done()
	res := m.inv.Do(rc.Ctx, Call{
		URL: p.Def.Service.URL, Headers: p.Headers, Secret: p.Secret, Body: raw, Run: spec.Run, Attempt: 1,
		Pipeline: p.Name(), Stage: p.Def.Stage, Event: event, Timeout: timeout,
	})
	if spec.Token != nil {
		spec.Token.revoke()
	}
	out := testResult{HTTPStatus: res.Status, LatencyMS: res.Latency.Milliseconds()}
	if res.Message != "" {
		msg := res.Message
		out.Message = &msg
	}
	if res.Outcome != OutcomeOK {
		e := res.Err
		if e == "" {
			e = "the service did not answer with 200, 201 or 204"
		}
		out.Error = &e
	}
	admin.WriteJSON(rc.W, http.StatusOK, out)
	return nil
}

// syntheticObject describes a key that holds no object: an empty one.
func syntheticObject(now time.Time) *objectBlock {
	return &objectBlock{
		Version: ulid.New(), Size: 0, ETag: "d41d8cd98f00b204e9800998ecf8427e",
		SHA256:      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		ContentType: engine.DefaultContentType, LastModified: sec(now), Metadata: map[string]string{}, Tags: map[string]string{},
	}
}
