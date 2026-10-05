package pipeline

import (
	"context"
	"errors"

	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/ulid"
)

// Run and event id prefixes (spec §6.7).
const (
	runPrefix   = "run_"
	eventPrefix = "evt_"
)

// Skip reasons, cancel reasons and held reasons of run records (spec §7.12).
const (
	ReasonSuperseded      = "superseded"
	ReasonEarlierFailed   = "earlier_step_failed"
	ReasonDepthLimit      = "depth_limit"
	ReasonChainAborted    = "chain_aborted"
	ReasonBudgetExhausted = "budget_exhausted"

	ReasonPipelineRemoved   = "pipeline_removed"
	ReasonAttachmentRemoved = "attachment_removed"
	ReasonBucketRemoved     = "bucket_removed"
	ReasonAdmin             = "admin"

	ReasonPaused   = "paused"
	ReasonDisabled = "disabled"
)

// pick is a pipeline chosen to run for an event, with its attachment.
type pick struct {
	p   *Pipe
	att *attEntry
}

// selectAfter chooses the after pipelines of an event: the bucket's enabled
// after attachments, in order, whose pipeline is enabled, subscribes to the
// event, matches the object (pipeline AND attachment filter, spec §7.3) and is
// not already in the event's causal chain (spec §7.11).
func (m *Manager) selectAfter(ctx context.Context, q meta.Q, set *attSet, ev *engine.Event, f Facts) ([]pick, error) {
	var out []pick
	for i := range set.items {
		att := &set.items[i]
		if !att.Enabled {
			continue
		}
		p, err := m.pipe(ctx, q, att.Pipeline)
		if err != nil {
			return nil, err
		}
		if p == nil || p.Before() || !p.Def.Enabled || p.Generation != att.Generation || !p.Subscribes(ev.Type) {
			continue
		}
		if contains(ev.Actor.Chain, p.Name()) {
			continue
		}
		if !matchBoth(p.matcher, att.matcher, f) {
			continue
		}
		out = append(out, pick{p: p, att: att})
	}
	return out, nil
}

// Outbox is the engine's transactional outbox (spec §3.5 step 6, §7.10): it runs
// inside the commit transaction of every change that raised an event and
// inserts one event group with a run per matching after pipeline, so an event
// can neither be lost nor emitted for a write that did not commit. The
// matching is evaluated here, once; the runs wait for the scheduler.
func (m *Manager) Outbox(ctx context.Context, tx *meta.Tx, ev *engine.Event) error {
	// the revision as this transaction sees it: an attachments change that
	// committed earlier in the same batch is not in the cache yet, and a run
	// queued for a pipeline that was just detached would never be cancelled
	rev, err := tx.AttachmentsRevision(ctx, ev.Bucket)
	if errors.Is(err, meta.ErrNotFound) {
		return nil // the bucket is gone
	}
	if err != nil {
		return err
	}
	set, err := m.attachments(ctx, tx.Q, ev.Bucket, rev)
	if err != nil {
		return err
	}
	if len(set.items) == 0 {
		return nil
	}
	info := eventInfoOf(ev)
	picks, err := m.selectAfter(ctx, tx.Q, set, ev, info.facts())
	if err != nil || len(picks) == 0 {
		return err
	}
	runs, err := m.newGroup(ctx, tx, info, picks, "")
	if err != nil {
		return err
	}
	if err := tx.InsertRuns(ctx, runs...); err != nil {
		return err
	}
	var skipped []string
	if ev.Actor.Depth > m.cfg.PipelineMaxDepth {
		for _, r := range runs {
			skipped = append(skipped, r.Pipeline)
		}
	}
	tx.AfterCommit(func() {
		for _, name := range skipped {
			m.mt.runs.Inc(name, StageAfter, meta.RunSkipped)
		}
		m.notify()
	})
	return nil
}

// newGroup builds the runs of one event group (one per pick, steps in order).
// Past the depth limit (spec §7.11) the runs are kept as skipped records
// instead of being queued. backfill is the id of the backfill that raised the
// event ("" for ordinary events).
func (m *Manager) newGroup(ctx context.Context, tx *meta.Tx, info *eventInfo, picks []pick, backfill string) ([]*meta.Run, error) {
	seq, err := tx.NextGroupSeq(ctx)
	if err != nil {
		return nil, err
	}
	now := tx.Now()
	evtID := eventPrefix + ulid.New()
	snap := mustJSON(info.snapshot(info.Bucket))
	actor := mustJSON(actorOf(info.Actor))
	lineage := mustJSON(lineageOf(info.Actor))
	version := info.objectVersion()
	tooDeep := info.Actor.Depth > m.cfg.PipelineMaxDepth
	runs := make([]*meta.Run, len(picks))
	for i, pk := range picks {
		r := &meta.Run{
			ID: runPrefix + ulid.New(), GroupSeq: seq, EventID: evtID, Pipeline: pk.p.Name(), Generation: pk.p.Generation,
			Stage: StageAfter, Bucket: info.Bucket, Key: info.Key, Event: info.Type, Operation: info.Operation,
			ObjectVersion: version, Actor: actor, Lineage: lineage, Payload: snap, State: meta.RunQueued,
			Step: i + 1, Steps: len(picks), MaxAttempts: pk.p.MaxAttempts(), QueuedAt: now, BackfillID: backfill,
		}
		if tooDeep {
			r.State, r.Reason, r.MaxAttempts = meta.RunSkipped, ReasonDepthLimit, 0
			fin := now
			r.FinishedAt = &fin
		}
		runs[i] = r
	}
	return runs, nil
}
