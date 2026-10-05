package pipeline

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/ulid"
)

// MaxChain is the longest before chain of one write (spec §7.9).
const MaxChain = 8

// The before chain (spec §7.9). A write is held open while the pipelines of its
// chain are called one after another against the staged object; a delete is
// held while its chain is asked for a veto. The chain is chosen once, when the
// upload is staged.

// beforeCandidates returns the bucket's enabled before attachments whose
// pipeline is enabled, in order. Their absence is the fast path: a bucket
// without a before pipeline pays for one cache lookup.
func (m *Manager) beforeCandidates(ctx context.Context, b *meta.Bucket) ([]pick, error) {
	set, err := m.attachments(ctx, m.db.Read(), b.Name, b.AttachmentsRevision)
	if err != nil || len(set.items) == 0 {
		return nil, err
	}
	var out []pick
	for i := range set.items {
		att := &set.items[i]
		if !att.Enabled {
			continue
		}
		p, err := m.pipe(ctx, m.db.Read(), att.Pipeline)
		if err != nil {
			return nil, err
		}
		if p == nil || !p.Before() || !p.Def.Enabled || p.Generation != att.Generation {
			continue
		}
		out = append(out, pick{p: p, att: att})
	}
	return out, nil
}

// chooseChain filters candidates to the pipelines that subscribe to the event,
// match the object and are not in the event's causal chain, at most MaxChain.
func chooseChain(cands []pick, events []string, actor engine.Actor, f Facts) []pick {
	var out []pick
	for _, pk := range cands {
		sub := false
		for _, e := range events {
			if pk.p.Subscribes(e) {
				sub = true
				break
			}
		}
		if !sub || contains(actor.Chain, pk.p.Name()) || !matchBoth(pk.p.matcher, pk.att.matcher, f) {
			continue
		}
		out = append(out, pk)
		if len(out) == MaxChain {
			break
		}
	}
	return out
}

// BeforeMatches reports whether a before chain might run for a copy that is not
// staged yet (the engine materialises a shared blob only then). It errs on the
// side of yes: the chain is chosen again, with the bytes sniffed, once the copy
// is staged.
func (m *Manager) BeforeMatches(ctx context.Context, c *engine.BeforeCall) (bool, error) {
	cands, err := m.beforeCandidates(ctx, c.Req.Bucket)
	if err != nil || len(cands) == 0 {
		return false, err
	}
	f := Facts{Key: c.Req.Key, Operation: opOf(c.Req), Size: c.Req.Size, DeclaredType: declaredType(c.Req), SniffUnknown: true}
	return len(chooseChain(cands, []string{EventCreated, EventUpdated}, c.Req.Actor, f)) > 0, nil
}

func opOf(r *engine.PutRequest) string {
	if r.Op == "" {
		return "put"
	}
	return r.Op
}

func declaredType(r *engine.PutRequest) string {
	if r.Headers.ContentType == "" {
		return engine.DefaultContentType
	}
	return r.Headers.ContentType
}

// ---- results ----------------------------------------------------------------------------------

type stepKind int

const (
	stepOK        stepKind = iota // the pipeline passed the object
	stepRejected                  // 422, or the staged object was deleted
	stepFailed                    // a failure, with on_error: reject
	stepContinued                 // a failure, with on_error: continue
	stepBudget                    // the chain's time ran out in or before this pipeline
	stepCanceled                  // the client went away
)

// step is how one pipeline of a chain ended.
type step struct {
	kind     stepKind
	run      *meta.Run // the record, completed
	res      CallResult
	timedOut bool
	message  string
}

// chain carries one before chain through its pipelines.
type chain struct {
	m        *Manager
	bucket   *meta.Bucket
	key      string
	event    string
	op       string
	actor    engine.Actor
	picks    []pick
	deadline time.Time
	evtID    string
	version  string

	// slot is the staged object of a write chain; nil for a delete chain, whose
	// token is read-only.
	slot      *slot
	liveObj   *meta.Object // delete chains: the object whose delete is being vetted
	previous  *meta.Object // writes that replace a visible object
	copySrc   *meta.Object
	startedAt time.Time
}

// batchState is the shared budget of the delete chains of one DeleteObjects
// request (spec §5.4.4).
type batchState struct {
	mu       sync.Mutex
	deadline time.Time
}

func (m *Manager) chainDeadline(b *engine.BeforeBatch) time.Time {
	if b == nil {
		return m.Now().Add(m.cfg.PipelineBeforeTotalTimeout)
	}
	st, _ := b.State.(*batchState)
	if st == nil {
		st = &batchState{}
		b.State = st
	}
	st.mu.Lock()
	defer st.mu.Unlock()
	if st.deadline.IsZero() {
		st.deadline = m.Now().Add(m.cfg.PipelineBeforeTotalTimeout)
	}
	return st.deadline
}

func unavailableErr() error {
	return apierr.New("ServiceUnavailable", "The server is shutting down; try again.")
}

// Before runs the bucket's before chain on a staged write (engine.Before). It
// returns the replacement of the staged object when a pipeline replaced it, nil
// when the object is unchanged, and an error to fail the write.
func (m *Manager) Before(ctx context.Context, c *engine.BeforeCall) (*engine.BeforeOutcome, error) {
	b := c.Req.Bucket
	cands, err := m.beforeCandidates(ctx, b)
	if err != nil {
		return nil, engine.WrapError(err)
	}
	if len(cands) == 0 {
		return nil, nil
	}
	// created or updated is decided now, as the chain is chosen (spec §7.5)
	event, prev := EventCreated, (*meta.Object)(nil)
	switch live, err := m.db.Read().GetLatest(ctx, b.Name, c.Req.Key); {
	case err == nil && !live.DeleteMarker:
		event, prev = EventUpdated, live
	case err != nil && !errors.Is(err, meta.ErrNotFound):
		return nil, engine.WrapError(err)
	}
	f := Facts{Key: c.Req.Key, Operation: opOf(c.Req), Size: c.Rec.Size, DeclaredType: declaredType(c.Req), SniffedType: c.Rec.Sniffed}
	picks := chooseChain(cands, []string{event}, c.Req.Actor, f)
	if len(picks) == 0 {
		return nil, nil
	}
	if m.draining.Load() {
		return nil, unavailableErr()
	}
	maxBytes := c.Adm.Max
	if maxBytes <= 0 {
		maxBytes = m.cfg.MaxObjectBytes()
	}
	now := m.Now()
	sl := newSlot(m.eng, b, c.Req.Key, c.Adm.Version, c.Rec, c.ETag, c.Req.Headers, c.Req.Metadata, c.Req.Tags, maxBytes, now)
	ch := &chain{
		m: m, bucket: b, key: c.Req.Key, event: event, op: opOf(c.Req), actor: c.Req.Actor, picks: picks,
		deadline: m.chainDeadline(nil), evtID: eventPrefix + ulid.New(), version: c.Adm.Version,
		slot: sl, previous: prev, copySrc: c.CopySrc, startedAt: now,
	}
	defer sl.cleanup()
	if err := m.runChain(ctx, ch); err != nil {
		return nil, err
	}
	st := sl.state()
	c.Req.Headers, c.Req.Metadata, c.Req.Tags = st.headers, st.metadata, st.tags
	if rec := sl.replacement(); rec != nil {
		return &engine.BeforeOutcome{Replaced: rec}, nil
	}
	return nil, nil
}

// BeforeDelete runs the bucket's before chain for a delete without a version id
// (engine.BeforeDelete): the chain gets the object and a read-only token and may
// veto the delete. The result conditions the delete on the state that was
// observed (spec §7.9: "a vetted object is never swapped"):
//
//   - 0: no before pipeline subscribes to object.deleted, so nothing can veto and
//     the delete is unconditional;
//   - seq > 0: the visible version that was seen (and vetted, if a chain ran); the
//     delete goes ahead only if that version is still the latest;
//   - -1: no visible object was seen (none, or a delete marker); the delete goes
//     ahead only if there still is none. Without this, an object created between
//     the sample and the delete would be deleted without its gate ever running.
func (m *Manager) BeforeDelete(ctx context.Context, c *engine.BeforeDeleteCall) (int64, error) {
	cands, err := m.beforeCandidates(ctx, c.Bucket)
	if err != nil {
		return 0, engine.WrapError(err)
	}
	gated := false // does any before pipeline subscribe to deletes (and may it run for this actor)?
	for _, pk := range cands {
		if pk.p.Subscribes(EventDeleted) && !contains(c.Actor.Chain, pk.p.Name()) {
			gated = true
			break
		}
	}
	if !gated {
		return 0, nil
	}
	live, err := m.db.Read().GetLatest(ctx, c.Bucket.Name, c.Key)
	if err != nil {
		if errors.Is(err, meta.ErrNotFound) {
			return -1, nil // nothing visible to vet: the delete must still find nothing
		}
		return 0, engine.WrapError(err)
	}
	if live.DeleteMarker {
		return -1, nil
	}
	f := Facts{Key: c.Key, Operation: "delete", Size: live.Size, DeclaredType: live.ContentType}
	picks := chooseChain(cands, []string{EventDeleted}, c.Actor, f)
	if len(picks) == 0 {
		return live.Seq, nil // no gate matched this object; the delete still needs it to be unchanged
	}
	if m.draining.Load() {
		return 0, unavailableErr()
	}
	ch := &chain{
		m: m, bucket: c.Bucket, key: c.Key, event: EventDeleted, op: "delete", actor: c.Actor, picks: picks,
		deadline: m.chainDeadline(c.Batch), evtID: eventPrefix + ulid.New(), version: live.Version, liveObj: live,
		startedAt: m.Now(),
	}
	if err := m.runChain(ctx, ch); err != nil {
		return 0, err
	}
	return live.Seq, nil
}

// runChain calls the pipelines of the chain in order and records their runs.
// It returns nil when the write or delete may go ahead.
func (m *Manager) runChain(ctx context.Context, ch *chain) error {
	m.inflight.Add(1)
	defer m.inflight.Done()
	// the chain ends with the client, and with the node (spec §7.9)
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	stop := context.AfterFunc(m.ctx, cancel)
	defer stop()

	steps := make([]*step, 0, len(ch.picks))
	var result error
	for i, pk := range ch.picks {
		st := m.runStep(ctx, ch, i, pk)
		steps = append(steps, st)
		if st.kind == stepOK || st.kind == stepContinued {
			continue
		}
		result = m.chainError(ch, i, st)
		if st.kind == stepBudget && result == nil {
			// every unfinished pipeline carries on_error: continue: the rest are
			// skipped and the write goes ahead (spec §7.9 step 4)
			steps = append(steps, m.skipRest(ch, i+1, ReasonBudgetExhausted)...)
			break
		}
		steps = append(steps, m.skipRest(ch, i+1, ReasonChainAborted)...)
		break
	}
	m.recordChain(ch, steps)
	return result
}

// chainError turns the step that ended the chain into the error the client
// sees, nil when the chain may still go ahead (spec §7.9 step 4).
func (m *Manager) chainError(ch *chain, i int, st *step) error {
	name := ch.picks[i].p.Name()
	switch st.kind {
	case stepRejected:
		m.mt.rejections.Inc(name)
		text := fmt.Sprintf("rejected by pipeline %q", name)
		if st.message != "" {
			text += ": " + st.message
		}
		return apierr.New("PipelineRejected", text)
	case stepFailed:
		if st.timedOut {
			return apierr.Newf("PipelineTimeout", "pipeline %q timed out", name)
		}
		// the cause (an address, a refused connection) is for the operator: it is in the
		// run record, not in the answer to whoever wrote the object
		return apierr.Newf("PipelineFailed", "pipeline %q failed", name)
	case stepBudget:
		for _, pk := range ch.picks[i:] {
			if pk.p.Def.OnError != "continue" {
				return apierr.Newf("PipelineTimeout", "the before chain ran out of time in pipeline %q", pk.p.Name())
			}
		}
		return nil
	case stepCanceled:
		return context.Canceled
	}
	return nil
}

// skipRest builds skipped records for the pipelines from index from on.
func (m *Manager) skipRest(ch *chain, from int, reason string) []*step {
	var out []*step
	for i := from; i < len(ch.picks); i++ {
		now := m.Now()
		r := m.newBeforeRun(ch, i, ch.picks[i].p, runPrefix+ulid.New())
		r.State, r.Reason, r.QueuedAt, r.FinishedAt = meta.RunSkipped, reason, now, &now
		out = append(out, &step{run: r})
	}
	return out
}

// newBeforeRun starts the record of a before run.
func (m *Manager) newBeforeRun(ch *chain, i int, p *Pipe, id string) *meta.Run {
	var obj *objectBlock
	if ch.slot != nil {
		obj = objectBlockOf(ch.slot.view())
	} else if ch.liveObj != nil {
		obj = objectBlockOf(ch.liveObj)
	}
	snap := snapshot{Object: obj, Previous: previousBlockOf(ch.previous)}
	if ch.copySrc != nil {
		snap.CopySource = &copySourceBlock{Bucket: ch.bucket.Name, Key: ch.copySrc.Key, Version: ch.copySrc.Version}
	}
	return &meta.Run{
		ID: id, EventID: ch.evtID, Pipeline: p.Name(), Generation: p.Generation, Stage: StageBefore,
		Bucket: ch.bucket.Name, Key: ch.key, Event: ch.event, Operation: ch.op, ObjectVersion: ch.version,
		Actor: mustJSON(actorOf(ch.actor)), Lineage: mustJSON(lineageOf(ch.actor)), Payload: mustJSON(snap),
		State: meta.RunRunning, Step: i + 1, Steps: len(ch.picks), MaxAttempts: p.MaxAttempts(),
		QueuedAt: ch.startedAt,
	}
}

// recordChain writes the chain's run records (spec §7.12: before runs are
// recorded when they finish) and counts their states.
func (m *Manager) recordChain(ch *chain, steps []*step) {
	runs := make([]*meta.Run, 0, len(steps))
	for _, st := range steps {
		if st.run != nil {
			runs = append(runs, st.run)
		}
	}
	if len(runs) == 0 {
		return
	}
	pctx, cancel := m.persistCtx()
	defer cancel()
	if err := m.db.Update(pctx, func(tx *meta.Tx) error { return tx.InsertRuns(pctx, runs...) }); err != nil {
		m.log.Error("cannot record before runs", "event", ch.evtID, "error", err)
	}
	for _, r := range runs {
		m.mt.runs.Inc(r.Pipeline, StageBefore, r.State)
	}
}

// runStep calls one pipeline of the chain, with retries, and decides how it
// ended (spec §7.9 step 3 and 4).
func (m *Manager) runStep(ctx context.Context, ch *chain, i int, pk pick) *step {
	p := pk.p
	run := m.newBeforeRun(ch, i, p, runPrefix+ulid.New())
	started := m.Now()
	run.StartedAt = &started
	st := &step{run: run}
	// end completes the record
	end := func(kind stepKind, state, reason, errText string) *step {
		now := m.Now()
		st.kind = kind
		run.State, run.Reason, run.Error, run.FinishedAt = state, reason, errText, &now
		run.DurationMS = now.Sub(started).Milliseconds()
		run.HTTPStatus, run.Message = st.res.Status, st.res.Message
		return st
	}
	// outOfTime: the chain's budget ran out in this pipeline
	outOfTime := func(why string) *step {
		if run.Attempt == 0 { // never called
			now := m.Now()
			st.kind = stepBudget
			run.State, run.Reason, run.FinishedAt = meta.RunSkipped, ReasonBudgetExhausted, &now
			return st
		}
		return end(stepBudget, meta.RunFailed, "", why)
	}
	gone := func() *step {
		return end(stepCanceled, meta.RunFailed, "", "the request ended before the pipeline finished")
	}

	var (
		res         CallResult
		deleted     bool
		budgetBound bool
	)
	for n := 1; ; n++ {
		remaining := ch.deadline.Sub(m.Now())
		if remaining <= 0 {
			return outOfTime("the chain's time ran out")
		}
		// one of the pipeline's max_concurrency slots, within queue_timeout
		sm := m.sems.of(p)
		wait := p.queueWait
		if wait > remaining {
			wait = remaining
		}
		if err := sm.acquire(ctx, wait); err != nil {
			switch {
			case ctx.Err() != nil:
				return gone()
			case p.queueWait >= remaining: // the chain's budget ran out, not the queue's patience
				return outOfTime("the chain's time ran out waiting for a free slot")
			}
			res = CallResult{Outcome: OutcomeFailed, Err: "no capacity: all of the pipeline's slots are busy"}
			break
		}
		run.Attempt = n
		res, deleted, budgetBound = m.beforeCall(ctx, ch, p, run, n, remaining)
		sm.release()

		if res.Outcome == OutcomeCanceled {
			return gone()
		}
		if res.Outcome == OutcomeTransient && n < p.MaxAttempts() {
			delay := Backoff(p.backoff, n, m.rnd)
			if delay >= ch.deadline.Sub(m.Now()) {
				return outOfTime("the chain's time ran out before the pipeline could be retried")
			}
			m.mt.retries.Inc(p.Name())
			if !sleepOrDone(ctx, delay) {
				return gone()
			}
			continue
		}
		break
	}
	st.res = res
	st.message = res.Message
	st.timedOut = res.TimedOut

	switch res.Outcome {
	case OutcomeOK:
		if deleted { // the service deleted the staged object: a rejection
			return end(stepRejected, meta.RunRejected, "", "")
		}
		return end(stepOK, meta.RunSucceeded, "", "")
	case OutcomeRejected:
		return end(stepRejected, meta.RunRejected, "", "")
	}
	// a failure, after the retries
	if res.TimedOut && budgetBound {
		return end(stepBudget, meta.RunFailed, "", res.Err)
	}
	m.log.Warn("before pipeline failed", "pipeline", p.Name(), "run", run.ID, "status", res.Status, "error", res.Err,
		"on_error", p.Def.OnError)
	if p.Def.OnError == "continue" {
		return end(stepContinued, meta.RunFailed, "", res.Err)
	}
	return end(stepFailed, meta.RunFailed, "", res.Err)
}

// sleepOrDone waits d; false when ctx ended first.
func sleepOrDone(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return true
	case <-ctx.Done():
		return false
	}
}

// beforeCall makes one attempt: mint the token, call the service, end the
// token, and apply the attempt's pending changes to the slot only if the call
// succeeded. The token ends, and its requests are aborted, before the slot is
// looked at (spec §7.8, §7.9). deleted reports that a successful attempt left
// the staged object deleted; budgetBound that the call's time was the chain's
// remaining budget rather than the pipeline's own timeout.
func (m *Manager) beforeCall(ctx context.Context, ch *chain, p *Pipe, run *meta.Run, n int, remaining time.Duration) (res CallResult, deleted, budgetBound bool) {
	timeout := p.timeout
	if remaining <= timeout {
		timeout, budgetBound = remaining, true
	}
	start := m.Now()
	deadline := start.Add(timeout)
	readOnly := ch.slot == nil
	spec := &callSpec{
		Pipe: p, Run: run.ID, Attempt: n, Deadline: deadline, Event: ch.event, Operation: ch.op,
		Bucket: ch.bucket.Name, Key: ch.key, Actor: actorOf(ch.actor), Lineage: lineageOf(ch.actor),
	}
	var att *attempt
	if ch.slot != nil {
		att = ch.slot.begin()
		spec.Snap.Object = objectBlockOf(ch.slot.view())
	} else {
		spec.Snap.Object = objectBlockOf(ch.liveObj)
	}
	spec.Snap.Previous = previousBlockOf(ch.previous)
	if ch.copySrc != nil {
		spec.Snap.CopySource = &copySourceBlock{Bucket: ch.bucket.Name, Key: ch.copySrc.Key, Version: ch.copySrc.Version}
	}
	abort := func(err string) (CallResult, bool, bool) {
		if att != nil {
			att.finish(false)
		}
		return CallResult{Outcome: OutcomeFailed, Err: err}, false, budgetBound
	}
	var tok *token
	if grants := ExpandGrants(p.Def.Token.Grants, ch.key, readOnly); len(grants) > 0 {
		var err error
		tok, err = m.toks.mint(mintSpec{
			Pipeline: p.Name(), Run: run.ID, Bucket: ch.bucket.Name, Grants: grants, Deadline: deadline,
			Depth: ch.actor.Depth, Chain: ch.actor.Chain, Staged: att,
		})
		if err != nil {
			return abort("the pipeline's token grants are invalid: " + err.Error())
		}
		spec.Token = tok
	}
	body, err := m.invocationBody(spec)
	if err != nil {
		if tok != nil {
			tok.revoke()
		}
		return abort("cannot build the invocation: " + err.Error())
	}
	res = m.inv.Do(ctx, Call{
		URL: p.Def.Service.URL, Headers: p.Headers, Secret: p.Secret, Body: body, Run: run.ID, Attempt: n,
		Pipeline: p.Name(), Stage: StageBefore, Event: ch.event, Timeout: timeout,
	})
	// the attempt is over: end the token (aborting what it still has in flight),
	// and only then decide what its changes amount to
	if tok != nil {
		tok.revoke()
	}
	if res.Outcome != OutcomeCanceled {
		m.mt.duration.Observe(res.Latency.Seconds(), p.Name(), StageBefore)
	}
	if att != nil {
		ok := res.Outcome == OutcomeOK
		if ok {
			_, deleted = att.object()
		}
		att.finish(ok)
	}
	return res, deleted, budgetBound
}
