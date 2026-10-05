package pipeline

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/admin"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// runJSON is a run as the API shows it (spec §6.7).
type runJSON struct {
	ID            string          `json:"id"`
	EventID       string          `json:"event_id"`
	Pipeline      string          `json:"pipeline"`
	Stage         string          `json:"stage"`
	Bucket        string          `json:"bucket"`
	Node          string          `json:"node"`
	Key           string          `json:"key"`
	Event         string          `json:"event"`
	Operation     string          `json:"operation"`
	ObjectVersion string          `json:"object_version"`
	Actor         json.RawMessage `json:"actor"`
	Lineage       json.RawMessage `json:"lineage"`
	State         string          `json:"state"`
	Reason        *string         `json:"reason"`
	Step          int             `json:"step"`
	Steps         int             `json:"steps"`
	Attempt       int             `json:"attempt"`
	MaxAttempts   int             `json:"max_attempts"`
	HTTPStatus    *int            `json:"http_status"`
	Message       *string         `json:"message"`
	Error         *string         `json:"error"`
	QueuedAt      time.Time       `json:"queued_at"`
	StartedAt     *time.Time      `json:"started_at"`
	FinishedAt    *time.Time      `json:"finished_at"`
	DurationMS    int64           `json:"duration_ms"`
	NextAttemptAt *time.Time      `json:"next_attempt_at,omitempty"`
	BackfillID    string          `json:"backfill_id,omitempty"`
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func jsonOr(s, def string) json.RawMessage {
	if s == "" || !json.Valid([]byte(s)) {
		return json.RawMessage(def)
	}
	return json.RawMessage(s)
}

func (m *Manager) runView(r *meta.Run) runJSON {
	v := runJSON{
		ID: r.ID, EventID: r.EventID, Pipeline: r.Pipeline, Stage: r.Stage, Bucket: r.Bucket, Node: m.node, Key: r.Key,
		Event: r.Event, Operation: r.Operation, ObjectVersion: r.ObjectVersion,
		Actor: jsonOr(r.Actor, "{}"), Lineage: jsonOr(r.Lineage, `{"depth":0,"chain":[]}`),
		State: r.State, Reason: nilIfEmpty(r.Reason), Step: r.Step, Steps: r.Steps, Attempt: r.Attempt, MaxAttempts: r.MaxAttempts,
		Message: nilIfEmpty(r.Message), Error: nilIfEmpty(r.Error), QueuedAt: r.QueuedAt, StartedAt: r.StartedAt,
		FinishedAt: r.FinishedAt, DurationMS: r.DurationMS, BackfillID: r.BackfillID,
	}
	if r.HTTPStatus != 0 {
		s := r.HTTPStatus
		v.HTTPStatus = &s
	}
	if r.State == meta.RunQueued {
		// why a queued run is not moving, when it is the pipeline that holds it
		if p := m.pipes.get(r.Pipeline); p != nil {
			switch {
			case !p.Def.Enabled:
				v.Reason = nilIfEmpty(ReasonDisabled)
			case p.Def.Paused:
				v.Reason = nilIfEmpty(ReasonPaused)
			}
		}
		if v.Reason == nil {
			if set := m.atts.get(r.Bucket); set != nil {
				for _, a := range set.items {
					if a.Pipeline == r.Pipeline && !a.Enabled {
						v.Reason = nilIfEmpty(ReasonDisabled)
					}
				}
			}
		}
		if !r.NotBefore.IsZero() && r.NotBefore.After(m.Now()) {
			t := r.NotBefore
			v.NextAttemptAt = &t
		}
	}
	return v
}

// ---- filters ----------------------------------------------------------------------------------

var runStates = []string{meta.RunQueued, meta.RunRunning, meta.RunSucceeded, meta.RunRejected, meta.RunFailed, meta.RunSkipped, meta.RunCancelled}

// filterBody is the body of the bulk calls: the GET /runs filters (spec §6.7).
type filterBody struct {
	Bucket    string     `json:"bucket"`
	Pipeline  string     `json:"pipeline"`
	Stage     string     `json:"stage"`
	State     string     `json:"state"`
	Key       string     `json:"key"`
	KeyPrefix string     `json:"key_prefix"`
	EventID   string     `json:"event_id"`
	Since     *time.Time `json:"since"`
	Until     *time.Time `json:"until"`
	Limit     int        `json:"limit"`
}

func (b filterBody) filter() (meta.RunFilter, error) {
	f := meta.RunFilter{
		Bucket: b.Bucket, Pipeline: b.Pipeline, Stage: b.Stage, State: b.State, Key: b.Key, KeyPrefix: b.KeyPrefix,
		EventID: b.EventID, Since: b.Since, Until: b.Until,
	}
	fields := map[string]string{}
	if b.Stage != "" && b.Stage != StageBefore && b.Stage != StageAfter {
		fields["stage"] = `must be "before" or "after"`
	}
	if b.State != "" && !contains(runStates, b.State) {
		fields["state"] = "must be one of " + strings.Join(runStates, ", ")
	}
	if len(fields) > 0 {
		return f, admin.Invalid("invalid run filter", fields)
	}
	return f, nil
}

func filterFromQuery(r *http.Request) (meta.RunFilter, error) {
	q := r.URL.Query()
	b := filterBody{
		Bucket: q.Get("bucket"), Pipeline: q.Get("pipeline"), Stage: q.Get("stage"), State: q.Get("state"), Key: q.Get("key"),
		KeyPrefix: q.Get("key_prefix"), EventID: q.Get("event_id"),
	}
	fields := map[string]string{}
	parse := func(name string) *time.Time {
		v := q.Get(name)
		if v == "" {
			return nil
		}
		t, err := time.Parse(time.RFC3339Nano, v)
		if err != nil {
			fields[name] = "must be an RFC 3339 time"
			return nil
		}
		return &t
	}
	b.Since, b.Until = parse("since"), parse("until")
	if len(fields) > 0 {
		return meta.RunFilter{}, admin.Invalid("invalid run filter", fields)
	}
	return b.filter()
}

// ---- list and detail --------------------------------------------------------------------------

func (m *Manager) listRuns(rc *admin.Ctx) error {
	limit, cursor, err := admin.PageParams(rc.R)
	if err != nil {
		return err
	}
	f, err := filterFromQuery(rc.R)
	if err != nil {
		return err
	}
	runs, err := m.db.Read().ListRuns(rc.Ctx, f, cursor, limit+1)
	if err != nil {
		return admin.Internal(err)
	}
	var next any
	if len(runs) > limit {
		runs = runs[:limit]
		next = runs[len(runs)-1].ID
	}
	items := make([]runJSON, len(runs))
	for i, r := range runs {
		items[i] = m.runView(r)
	}
	admin.WriteJSON(rc.W, http.StatusOK, map[string]any{"items": items, "next_cursor": next})
	return nil
}

func (m *Manager) getRun(rc *admin.Ctx, id string) error {
	r, err := m.db.Read().GetRun(rc.Ctx, id)
	if err != nil {
		return runErr(err, id)
	}
	admin.WriteJSON(rc.W, http.StatusOK, m.runView(r))
	return nil
}

func runErr(err error, id string) error {
	if errors.Is(err, meta.ErrNotFound) {
		return admin.NotFound(fmt.Sprintf("run %q does not exist", id))
	}
	return admin.Internal(err)
}

// ---- retry -----------------------------------------------------------------------------------------

var (
	errNotRetryable = errors.New("not retryable")
	errNotQueued    = errors.New("not queued")
)

// requeueFailed re-queues one failed after run with a fresh series of attempts,
// together with the steps of its event that were skipped because of it; but a
// retry never undoes newer work: when a later event for the same key has
// already started (or, for a delete, the key has an object again), the run
// becomes skipped (superseded) instead (spec §6.7).
// It reports how many runs went back to the queue.
func requeueFailed(ctx context.Context, tx *meta.Tx, run *meta.Run) (int, error) {
	now := tx.Now()
	later, err := tx.LaterGroupStarted(ctx, run.Bucket, run.Key, run.GroupSeq)
	if err != nil {
		return 0, err
	}
	if !later && run.Event == EventDeleted {
		// the key may have been uploaded again without any run for this pipeline
		// (it listens to deletes only): retrying the delete would remove what the
		// new object's runs derived
		switch live, err := tx.GetLatest(ctx, run.Bucket, run.Key); {
		case err == nil:
			later = !live.DeleteMarker
		case !errors.Is(err, meta.ErrNotFound):
			return 0, err
		}
	}
	if later {
		run.State, run.Reason = meta.RunSkipped, ReasonSuperseded
		run.FinishedAt = &now
		return 0, tx.SaveRun(ctx, run)
	}
	if err := tx.Requeue(ctx, run.ID, now); err != nil {
		return 0, err
	}
	refs, err := tx.RequeueSkippedAfter(ctx, run.EventID, run.Step, now)
	return 1 + len(refs), err
}

func (m *Manager) retryRun(rc *admin.Ctx, id string) error {
	end, err := m.gatedRun(rc, id)
	if err != nil {
		return err
	}
	defer end()
	err = m.db.Update(rc.Ctx, func(tx *meta.Tx) error {
		run, err := tx.GetRun(rc.Ctx, id)
		if err != nil {
			return err
		}
		if run.Stage != StageAfter || run.State != meta.RunFailed {
			return errNotRetryable
		}
		_, err = requeueFailed(rc.Ctx, tx, run)
		return err
	})
	switch {
	case errors.Is(err, errNotRetryable):
		return admin.Conflict("only a failed after run can be retried")
	case err != nil:
		return runErr(err, id)
	}
	m.notify()
	return m.getRun(rc, id)
}

func (m *Manager) bulkRetry(rc *admin.Ctx) error {
	var body filterBody
	if err := rc.Decode(&body); err != nil {
		return err
	}
	if body.Pipeline == "" && body.Bucket == "" {
		return admin.Invalid("a bulk retry needs a pipeline or a bucket", map[string]string{"pipeline": "pipeline or bucket is required"})
	}
	if body.State == "" {
		body.State = meta.RunFailed
	}
	if body.State != meta.RunFailed {
		return admin.Invalid("only failed runs can be retried", map[string]string{"state": `must be "failed"`})
	}
	if body.Stage == StageBefore {
		return admin.Invalid("only after runs can be retried", map[string]string{"stage": `must be "after"`})
	}
	body.Stage = StageAfter
	f, err := body.filter()
	if err != nil {
		return err
	}
	limit := body.Limit
	if limit <= 0 {
		limit = 1 << 30
	}
	requeued, handled := 0, 0
	// retry requeues the failed runs of one bucket (f names it), under that bucket's gate
	retry := func(ctx context.Context, f meta.RunFilter) (bool, error) {
		after := ""
		for handled < limit {
			page := 200
			if rest := limit - handled; rest < page {
				page = rest
			}
			runs, err := m.db.Read().ListRunsAsc(ctx, f, after, page)
			if err != nil {
				return false, err
			}
			if len(runs) == 0 {
				break
			}
			n := 0
			err = m.db.Update(ctx, func(tx *meta.Tx) error {
				n = 0
				for _, r := range runs {
					// the state may have moved on since the page was read
					cur, err := tx.GetRun(ctx, r.ID)
					if err != nil {
						if errors.Is(err, meta.ErrNotFound) {
							continue
						}
						return err
					}
					if cur.State != meta.RunFailed {
						continue
					}
					k, err := requeueFailed(ctx, tx, cur)
					if err != nil {
						return err
					}
					n += k
				}
				return nil
			})
			if err != nil {
				return false, err
			}
			requeued += n
			handled += len(runs)
			after = runs[len(runs)-1].ID
			if len(runs) < page {
				break
			}
		}
		return handled >= limit, nil
	}
	skipped, err := m.bulkByBucket(rc, f, retry)
	if err != nil {
		return err
	}
	m.notify()
	out := map[string]any{"requeued": requeued}
	if skipped > 0 {
		out["skipped"] = skipped
	}
	admin.WriteJSON(rc.W, http.StatusOK, out)
	return nil
}

// bulkByBucket applies a bulk run call, one bucket at a time, to the buckets that
// have runs matching f, each under the gate of its own bucket (spec §8.8): the runs
// of a bucket that is frozen or paused for a move are left alone and counted as
// skipped — the rows of such a bucket have been exported or are being, and a change
// made here now would not travel with them, so that the new home would run again
// what was cancelled. A bucket that freezes while it is being changed ends the call
// for that bucket, which is skipped from there on (what was done in the transactions
// before stays done). A call that names a bucket is refused instead, with 503, when
// that bucket is closed. apply makes the change in one bucket (f names it) and says
// whether the call is complete (a limit was reached).
func (m *Manager) bulkByBucket(rc *admin.Ctx, f meta.RunFilter, apply func(ctx context.Context, f meta.RunFilter) (done bool, err error)) (skipped int64, err error) {
	if f.Bucket != "" {
		end, err := gated(rc, f.Bucket)
		if err != nil {
			return 0, err
		}
		defer end()
		if _, err := apply(rc.Ctx, f); err != nil {
			return 0, admin.Internal(err)
		}
		return 0, nil
	}
	buckets, err := m.db.Read().RunBuckets(rc.Ctx, f)
	if err != nil {
		return 0, admin.Internal(err)
	}
	for _, bucket := range buckets {
		fb := f
		fb.Bucket = bucket
		ctx, end, ok, err := rc.TryGateWrite(bucket)
		if err != nil {
			return skipped, admin.Internal(err)
		}
		left := func() int64 {
			n, _ := m.db.Read().CountRuns(rc.Ctx, fb)
			return n
		}
		if !ok {
			skipped += left()
			continue
		}
		done, err := apply(ctx, fb)
		end()
		switch {
		case err != nil && (errors.Is(err, engine.ErrFrozen) || engine.FrozenCause(ctx, err) == engine.ErrFrozen):
			skipped += left() // it froze while the call was at it
			continue
		case err != nil:
			return skipped, admin.Internal(err)
		}
		if done {
			break
		}
	}
	return skipped, nil
}

// ---- cancel ------------------------------------------------------------------------------------------

func (m *Manager) cancelRun(rc *admin.Ctx, id string) error {
	end, err := m.gatedRun(rc, id)
	if err != nil {
		return err
	}
	defer end()
	err = m.db.Update(rc.Ctx, func(tx *meta.Tx) error {
		run, err := tx.GetRun(rc.Ctx, id)
		if err != nil {
			return err
		}
		if run.State != meta.RunQueued {
			return errNotQueued
		}
		now := tx.Now()
		run.State, run.Reason, run.FinishedAt = meta.RunCancelled, ReasonAdmin, &now
		return tx.SaveRun(rc.Ctx, run)
	})
	switch {
	case errors.Is(err, errNotQueued):
		return admin.Conflict("only a queued run can be cancelled")
	case err != nil:
		return runErr(err, id)
	}
	m.mt.runs.Inc(m.pipelineOf(rc.Ctx, id), StageAfter, meta.RunCancelled)
	m.notify()
	return m.getRun(rc, id)
}

// pipelineOf names the pipeline of a run, "" if it cannot be read.
func (m *Manager) pipelineOf(ctx context.Context, id string) string {
	r, err := m.db.Read().GetRun(ctx, id)
	if err != nil {
		return ""
	}
	return r.Pipeline
}

func (m *Manager) bulkCancel(rc *admin.Ctx) error {
	var body filterBody
	if err := rc.Decode(&body); err != nil {
		return err
	}
	if body.Pipeline == "" && body.Bucket == "" {
		return admin.Invalid("a bulk cancel needs a pipeline or a bucket", map[string]string{"pipeline": "pipeline or bucket is required"})
	}
	if body.State == "" {
		body.State = meta.RunQueued
	}
	if body.State != meta.RunQueued {
		return admin.Invalid("only queued runs can be cancelled", map[string]string{"state": `must be "queued"`})
	}
	f, err := body.filter()
	if err != nil {
		return err
	}
	limit := body.Limit
	if limit <= 0 {
		limit = 1 << 30
	}
	var refs []meta.RunRef
	cancel := func(ctx context.Context, f meta.RunFilter) (bool, error) {
		var got []meta.RunRef
		err := m.db.Update(ctx, func(tx *meta.Tx) (err error) {
			got, err = tx.CancelRunsLimited(ctx, f, ReasonAdmin, tx.Now(), limit-len(refs))
			return err
		})
		if err != nil {
			return false, err
		}
		refs = append(refs, got...)
		return len(refs) >= limit, nil
	}
	skipped, err := m.bulkByBucket(rc, f, cancel)
	if err != nil {
		return err
	}
	for _, r := range refs {
		m.mt.runs.Inc(r.Pipeline, r.Stage, meta.RunCancelled)
	}
	m.notify()
	out := map[string]any{"cancelled": len(refs)}
	if skipped > 0 {
		out["skipped"] = skipped
	}
	admin.WriteJSON(rc.W, http.StatusOK, out)
	return nil
}

// gated admits an admin change of a bucket's pipeline state: it is refused while the
// bucket is frozen or paused for a move (spec §8.8).
func gated(rc *admin.Ctx, bucket string) (func(), error) {
	ctx, end, err := rc.GateWrite(bucket)
	if err != nil {
		return nil, err
	}
	rc.Ctx = ctx
	return end, nil
}

// gatedRun is gated for the bucket of a run; a run that does not exist is let
// through, for the handler to answer 404.
func (m *Manager) gatedRun(rc *admin.Ctx, id string) (func(), error) {
	r, err := m.db.Read().GetRun(rc.Ctx, id)
	if err != nil {
		return func() {}, nil
	}
	return gated(rc, r.Bucket)
}
