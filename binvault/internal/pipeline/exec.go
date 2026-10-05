package pipeline

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// executeAfter runs one claimed after run (spec §7.10 step 3 and 4): the run is
// already marked running and its attempt counted. It checks that the run still
// makes sense, mints the token, calls the service and records how it ended.
func (m *Manager) executeAfter(ctx context.Context, run *meta.Run) {
	q := m.db.Read()
	p, err := m.pipe(ctx, q, run.Pipeline)
	if err != nil {
		m.requeueOnError(run, err)
		return
	}
	if p == nil || p.Generation != run.Generation {
		m.endUncalled(run, meta.RunCancelled, ReasonPipelineRemoved, "")
		return
	}
	if _, err := q.GetAttachment(ctx, run.Bucket, run.Pipeline); err != nil {
		if errors.Is(err, meta.ErrNotFound) {
			m.endUncalled(run, meta.RunCancelled, ReasonAttachmentRemoved, "")
		} else {
			m.requeueOnError(run, err)
		}
		return
	}
	// created and updated events act on the object they describe: if the key has
	// moved on, the run and the rest of its group are skipped (spec §7.10). A
	// deleted event is not superseded: per-key ordering runs it before any later
	// event of the key.
	if run.Event != EventDeleted {
		latest, err := q.GetLatest(ctx, run.Bucket, run.Key)
		switch {
		case err != nil && !errors.Is(err, meta.ErrNotFound):
			m.requeueOnError(run, err)
			return
		case err != nil || latest.DeleteMarker || latest.Version != run.ObjectVersion:
			m.endUncalled(run, meta.RunSkipped, ReasonSuperseded, ReasonSuperseded)
			return
		}
	}

	var snap snapshot
	var actor actorBlock
	var lin lineageBlock
	_ = json.Unmarshal([]byte(run.Payload), &snap)
	_ = json.Unmarshal([]byte(run.Actor), &actor)
	_ = json.Unmarshal([]byte(run.Lineage), &lin)

	start := m.Now()
	deadline := start.Add(p.timeout)
	spec := &callSpec{
		Pipe: p, Run: run.ID, Attempt: run.Attempt, Deadline: deadline, Event: run.Event, Operation: run.Operation,
		Bucket: run.Bucket, Key: run.Key, Snap: snap, Actor: actor, Lineage: lin,
	}
	if grants := ExpandGrants(p.Def.Token.Grants, run.Key, false); len(grants) > 0 {
		tok, err := m.toks.mint(mintSpec{
			Pipeline: p.Name(), Run: run.ID, Bucket: run.Bucket, Grants: grants, Deadline: deadline,
			Depth: lin.Depth, Chain: lin.Chain,
			Guard: &engine.Guard{Key: run.Key, Version: run.ObjectVersion, Absent: run.Event == EventDeleted},
		})
		if err != nil {
			m.finishAfter(run, p, CallResult{Outcome: OutcomeFailed, Err: "the pipeline's token grants are invalid: " + err.Error()})
			return
		}
		spec.Token = tok
		defer tok.revoke()
	}
	body, err := m.invocationBody(spec)
	if err != nil {
		m.finishAfter(run, p, CallResult{Outcome: OutcomeFailed, Err: "cannot build the invocation: " + err.Error()})
		return
	}
	res := m.inv.Do(ctx, Call{
		URL: p.Def.Service.URL, Headers: p.Headers, Secret: p.Secret, Body: body, Run: run.ID, Attempt: run.Attempt,
		Pipeline: p.Name(), Stage: StageAfter, Event: run.Event, Timeout: p.timeout,
	})
	// the token ends with the call, before the outcome is looked at (spec §7.8)
	if spec.Token != nil {
		spec.Token.revoke()
	}
	m.finishAfter(run, p, res)
}

// finishAfter records the outcome of an attempt and applies on_error.
func (m *Manager) finishAfter(run *meta.Run, p *Pipe, res CallResult) {
	now := m.Now()
	var since time.Time
	if run.RunnableSince != nil {
		since = *run.RunnableSince
	}
	v := decideAfter(res, run.Attempt, p.MaxAttempts(), p.backoff, since, now, m.rnd)
	run.MaxAttempts = p.MaxAttempts()
	run.HTTPStatus = res.Status
	run.Message = res.Message
	run.Error = v.Error
	run.DurationMS = res.Latency.Milliseconds()
	if res.Outcome != OutcomeCanceled {
		m.mt.duration.Observe(res.Latency.Seconds(), p.Name(), StageAfter)
	}
	skip := ""
	switch v.State {
	case meta.RunSucceeded:
		run.State, run.Error = meta.RunSucceeded, ""
		run.FinishedAt = &now
		m.log.Info("pipeline run succeeded", "run", run.ID, "pipeline", p.Name(), "bucket", run.Bucket, "key", run.Key,
			"attempt", run.Attempt, "status", res.Status, "ms", run.DurationMS)
	case meta.RunQueued:
		run.State = meta.RunQueued
		run.FinishedAt = nil
		run.NotBefore = v.NotBefore
		if v.Uncounted {
			run.Attempt--
			run.StartedAt = nil
			run.Error = ""
		} else {
			m.mt.retries.Inc(p.Name())
			m.log.Warn("pipeline run will be retried", "run", run.ID, "pipeline", p.Name(), "attempt", run.Attempt,
				"status", res.Status, "error", v.Error, "retry_at", v.NotBefore.Format(time.RFC3339))
		}
	default:
		run.State = meta.RunFailed
		run.FinishedAt = &now
		if p.Def.OnError == "stop" {
			skip = ReasonEarlierFailed
		}
		m.log.Warn("pipeline run failed", "run", run.ID, "pipeline", p.Name(), "bucket", run.Bucket, "key", run.Key,
			"attempt", run.Attempt, "status", res.Status, "error", v.Error)
	}
	m.saveRun(run, skip)
}

// endUncalled ends a run that was claimed but never called: cancelled because
// its pipeline or attachment is gone, or skipped as superseded. skipRest is the
// reason the group's remaining steps are skipped with ("" = they stay).
func (m *Manager) endUncalled(run *meta.Run, state, reason, skipRest string) {
	now := m.Now()
	run.State, run.Reason = state, reason
	run.FinishedAt = &now
	if run.Attempt > 0 {
		run.Attempt-- // no call was made
	}
	m.saveRun(run, skipRest)
}

// requeueOnError puts a claimed run back in the queue after a database error
// that kept it from being checked.
func (m *Manager) requeueOnError(run *meta.Run, cause error) {
	m.log.Warn("pipeline run requeued", "run", run.ID, "pipeline", run.Pipeline, "error", cause)
	run.State = meta.RunQueued
	run.StartedAt, run.FinishedAt = nil, nil
	if run.Attempt > 0 {
		run.Attempt--
	}
	run.NotBefore = m.Now().Add(time.Second)
	m.saveRun(run, "")
}

// finishInternalError ends a run whose execution panicked: failed, so that an
// operator sees it, and never retried automatically.
func (m *Manager) finishInternalError(run *meta.Run) {
	now := m.Now()
	run.State, run.Error = meta.RunFailed, "internal error while executing the run"
	run.FinishedAt = &now
	m.saveRun(run, "")
}

// saveRun writes the run's state and, in the same transaction, skips the
// remaining steps of its group when skipRest is set.
//
// A write that fails is tried again for as long as the node runs: the run would
// stay running, and hold its key, until the next start.
func (m *Manager) saveRun(run *meta.Run, skipRest string) {
	var refs []meta.RunRef
	for attempt := 0; ; attempt++ {
		pctx, cancel := m.persistCtx()
		refs = nil
		err := m.db.Update(pctx, func(tx *meta.Tx) (err error) {
			if err := tx.SaveRun(pctx, run); err != nil {
				return err
			}
			if skipRest != "" {
				refs, err = tx.SkipRemaining(pctx, run.EventID, run.Step, skipRest, tx.Now())
			}
			return err
		})
		cancel()
		if err == nil {
			break
		}
		m.log.Error("cannot record the state of a pipeline run", "run", run.ID, "state", run.State, "attempt", attempt+1, "error", err)
		delay := time.NewTimer(persistRetry << min(attempt, 5))
		select {
		case <-m.ctx.Done():
			delay.Stop()
			return // shutting down: the next start requeues what was running (spec §7.10 step 5)
		case <-delay.C:
		}
	}
	switch run.State {
	case meta.RunSucceeded, meta.RunFailed, meta.RunSkipped, meta.RunCancelled, meta.RunRejected:
		m.mt.runs.Inc(run.Pipeline, run.Stage, run.State)
	}
	for _, r := range refs {
		m.mt.runs.Inc(r.Pipeline, r.Stage, meta.RunSkipped)
	}
	m.notify()
}
