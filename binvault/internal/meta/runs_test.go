package meta

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"
)

func mkRun(id string, group int64, event string, step, steps int, pipeline, key string) *Run {
	return &Run{
		ID: id, GroupSeq: group, EventID: event, Pipeline: pipeline, Generation: "g", Stage: "after", Bucket: "b", Key: key,
		Event: "object.created", Operation: "put", ObjectVersion: "v", State: RunQueued, Step: step, Steps: steps, MaxAttempts: 3,
	}
}

func insertRuns(t *testing.T, d *DB, runs ...*Run) {
	t.Helper()
	mustUpdate(t, d, func(tx *Tx) error { return tx.InsertRuns(context.Background(), runs...) })
}

func ids(rs []*Run) string {
	s := ""
	for i, r := range rs {
		if i > 0 {
			s += ","
		}
		s += r.ID
	}
	return s
}

func TestRunnableRunsRules(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	newBucket(t, d, "b")
	now := time.Now()

	// group 1 (key a): two steps; group 2 (key a): one step; group 3 (key c): one step
	insertRuns(t, d,
		mkRun("r1", 1, "e1", 1, 2, "p1", "a"),
		mkRun("r2", 1, "e1", 2, 2, "p2", "a"),
		mkRun("r3", 2, "e2", 1, 1, "p1", "a"),
		mkRun("r4", 3, "e3", 1, 1, "p1", "c"),
	)
	got, err := d.Read().RunnableRuns(ctx, now, nil, 10)
	if err != nil {
		t.Fatal(err)
	}
	// r2 waits for r1 (earlier step), r3 waits for group 1 (same key)
	if ids(got) != "r1,r4" {
		t.Fatalf("runnable = %s, want r1,r4", ids(got))
	}

	// excluded pipelines are skipped
	got, _ = d.Read().RunnableRuns(ctx, now, []string{"p1"}, 10)
	if len(got) != 0 {
		t.Fatalf("excluded p1 should leave nothing runnable (r2 waits for r1), got %s", ids(got))
	}

	// running runs still hold their key and their group
	mustUpdate(t, d, func(tx *Tx) error {
		ok, err := tx.MarkRunning(ctx, got0(t, d, "r1"), now)
		if !ok || err != nil {
			t.Fatalf("mark running: %v %v", ok, err)
		}
		return nil
	})
	got, _ = d.Read().RunnableRuns(ctx, now, nil, 10)
	if ids(got) != "r4" {
		t.Fatalf("runnable with r1 running = %s, want r4", ids(got))
	}

	// r1 succeeds: r2 (next step) becomes runnable, r3 still waits for r2
	r1 := got0(t, d, "r1")
	r1.State = RunSucceeded
	fin := now
	r1.FinishedAt = &fin
	mustUpdate(t, d, func(tx *Tx) error { return tx.SaveRun(ctx, r1) })
	got, _ = d.Read().RunnableRuns(ctx, now, nil, 10)
	if ids(got) != "r2,r4" {
		t.Fatalf("runnable after r1 = %s, want r2,r4", ids(got))
	}

	// backoff: not_before in the future hides a run until then
	r2 := got0(t, d, "r2")
	r2.NotBefore = now.Add(time.Hour)
	mustUpdate(t, d, func(tx *Tx) error { return tx.SaveRun(ctx, r2) })
	got, _ = d.Read().RunnableRuns(ctx, now, nil, 10)
	if ids(got) != "r4" {
		t.Fatalf("runnable with r2 backing off = %s, want r4", ids(got))
	}
	nb, _ := d.Read().NextNotBefore(ctx, now)
	if nb.IsZero() || nb.Before(now.Add(59*time.Minute)) {
		t.Fatalf("next not_before = %v", nb)
	}
}

func got0(t *testing.T, d *DB, id string) *Run {
	t.Helper()
	r, err := d.Read().GetRun(context.Background(), id)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func TestDisabledAttachmentHoldsRuns(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	newBucket(t, d, "b")
	mustUpdate(t, d, func(tx *Tx) error {
		_, err := tx.ReplaceAttachments(ctx, "b", []Attachment{{Pipeline: "p1", Generation: "g", Enabled: false}}, 0)
		return err
	})
	insertRuns(t, d, mkRun("r1", 1, "e1", 1, 1, "p1", "a"))
	got, _ := d.Read().RunnableRuns(ctx, time.Now(), nil, 10)
	if len(got) != 0 {
		t.Fatalf("a disabled attachment must hold its runs, got %s", ids(got))
	}
	mustUpdate(t, d, func(tx *Tx) error {
		_, err := tx.ReplaceAttachments(ctx, "b", []Attachment{{Pipeline: "p1", Generation: "g", Enabled: true}}, 0)
		return err
	})
	got, _ = d.Read().RunnableRuns(ctx, time.Now(), nil, 10)
	if ids(got) != "r1" {
		t.Fatalf("enabled attachment should release the run, got %s", ids(got))
	}
}

func TestCancelSkipRequeue(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	newBucket(t, d, "b")
	now := time.Now()
	insertRuns(t, d,
		mkRun("r1", 1, "e1", 1, 3, "p1", "a"),
		mkRun("r2", 1, "e1", 2, 3, "p2", "a"),
		mkRun("r3", 1, "e1", 3, 3, "p3", "a"),
		mkRun("r4", 2, "e2", 1, 1, "p2", "z"),
	)
	var refs []RunRef
	mustUpdate(t, d, func(tx *Tx) error {
		var err error
		refs, err = tx.SkipRemaining(ctx, "e1", 1, "earlier_step_failed", now)
		return err
	})
	if len(refs) != 2 {
		t.Fatalf("skipped %d, want 2", len(refs))
	}
	if r := got0(t, d, "r2"); r.State != RunSkipped || r.Reason != "earlier_step_failed" || r.FinishedAt == nil {
		t.Fatalf("r2 = %+v", r)
	}
	// the failed step is retried: it and the steps skipped because of it go back
	mustUpdate(t, d, func(tx *Tx) error {
		if err := tx.Requeue(ctx, "r1", now); err != nil {
			return err
		}
		var err error
		refs, err = tx.RequeueSkippedAfter(ctx, "e1", 1, now)
		return err
	})
	if len(refs) != 2 || got0(t, d, "r3").State != RunQueued {
		t.Fatalf("requeued %d, r3 = %+v", len(refs), got0(t, d, "r3"))
	}
	// cancel by pipeline
	mustUpdate(t, d, func(tx *Tx) error {
		var err error
		refs, err = tx.CancelRuns(ctx, RunFilter{Pipeline: "p2"}, "pipeline_removed", now)
		return err
	})
	if len(refs) != 2 {
		t.Fatalf("cancelled %d, want 2 (r2, r4)", len(refs))
	}
	if r := got0(t, d, "r4"); r.State != RunCancelled || r.Reason != "pipeline_removed" {
		t.Fatalf("r4 = %+v", r)
	}
	// a bare filter must never cancel everything
	mustUpdate(t, d, func(tx *Tx) error {
		var err error
		refs, err = tx.CancelRuns(ctx, RunFilter{}, "admin", now)
		return err
	})
	if len(refs) != 0 {
		t.Fatalf("an empty filter cancelled %d runs", len(refs))
	}
}

func TestListRunsFiltersAndPaging(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	newBucket(t, d, "b")
	var runs []*Run
	for i := 0; i < 7; i++ {
		r := mkRun(fmt.Sprintf("run_%02d", i), int64(i+1), fmt.Sprintf("e%d", i), 1, 1, "p1", fmt.Sprintf("dir/f%d", i))
		if i%2 == 1 {
			r.Pipeline = "p2"
			r.State = RunFailed
		}
		runs = append(runs, r)
	}
	runs = append(runs, mkRun("run_99", 99, "e99", 1, 1, "p1", "other/100%_x"))
	insertRuns(t, d, runs...)

	q := d.Read()
	all, _ := q.ListRuns(ctx, RunFilter{}, "", 100)
	if len(all) != 8 || all[0].ID != "run_99" {
		t.Fatalf("newest first: %s", ids(all))
	}
	page1, _ := q.ListRuns(ctx, RunFilter{}, "", 3)
	page2, _ := q.ListRuns(ctx, RunFilter{}, page1[2].ID, 3)
	if ids(page1) != "run_99,run_06,run_05" || ids(page2) != "run_04,run_03,run_02" {
		t.Fatalf("paging: %s | %s", ids(page1), ids(page2))
	}
	if got, _ := q.ListRuns(ctx, RunFilter{Pipeline: "p2", State: RunFailed}, "", 100); len(got) != 3 {
		t.Fatalf("pipeline+state filter: %s", ids(got))
	}
	if got, _ := q.ListRuns(ctx, RunFilter{KeyPrefix: "dir/"}, "", 100); len(got) != 7 {
		t.Fatalf("key_prefix: %s", ids(got))
	}
	// LIKE wildcards in a key are literal
	if got, _ := q.ListRuns(ctx, RunFilter{KeyPrefix: "other/100%"}, "", 100); len(got) != 1 {
		t.Fatalf("literal %% in prefix: %s", ids(got))
	}
	if got, _ := q.ListRuns(ctx, RunFilter{Key: "dir/f3"}, "", 100); len(got) != 1 || got[0].ID != "run_03" {
		t.Fatalf("key filter: %s", ids(got))
	}
	if got, _ := q.ListRuns(ctx, RunFilter{EventID: "e5"}, "", 100); len(got) != 1 {
		t.Fatalf("event filter: %s", ids(got))
	}
	future := time.Now().Add(time.Hour)
	if got, _ := q.ListRuns(ctx, RunFilter{Since: &future}, "", 100); len(got) != 0 {
		t.Fatalf("since filter: %s", ids(got))
	}
}

func TestGroupSeqIncreases(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	var a, b int64
	mustUpdate(t, d, func(tx *Tx) error {
		a, _ = tx.NextGroupSeq(ctx)
		b, _ = tx.NextGroupSeq(ctx)
		return nil
	})
	if a != 1 || b != 2 {
		t.Fatalf("group seq %d %d", a, b)
	}
}

func TestAttachmentsRevisionAndDetach(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	newBucket(t, d, "b")
	newBucket(t, d, "c")
	list := []Attachment{
		{Pipeline: "p1", Generation: "g", Enabled: true, Match: `{"keys":["a/**"]}`},
		{Pipeline: "p2", Generation: "g", Enabled: true},
		{Pipeline: "p3", Generation: "g", Enabled: false},
	}
	var rev int64
	mustUpdate(t, d, func(tx *Tx) error {
		var err error
		rev, err = tx.ReplaceAttachments(ctx, "b", list, 0)
		return err
	})
	if rev != 1 {
		t.Fatalf("revision %d", rev)
	}
	if r, _ := d.Read().AttachmentsRevision(ctx, "b"); r != 1 {
		t.Fatalf("stored revision %d", r)
	}
	got, _ := d.Read().ListAttachments(ctx, "b")
	if len(got) != 3 || got[0].Pipeline != "p1" || got[2].Enabled || got[0].Match != `{"keys":["a/**"]}` || got[1].Match != "{}" {
		t.Fatalf("attachments %+v", got)
	}
	// If-Match
	err := d.Update(ctx, func(tx *Tx) error { _, err := tx.ReplaceAttachments(ctx, "b", list[:1], 5); return err })
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("stale revision: %v", err)
	}
	if err := d.Update(ctx, func(tx *Tx) error { _, err := tx.ReplaceAttachments(ctx, "zz", list, 0); return err }); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing bucket: %v", err)
	}
	// detaching p2 closes the gap and bumps the revision
	var buckets []string
	mustUpdate(t, d, func(tx *Tx) error {
		_, _ = tx.ReplaceAttachments(ctx, "c", list[1:2], 0)
		var err error
		buckets, err = tx.DeleteAttachmentsOfPipeline(ctx, "p2")
		return err
	})
	if len(buckets) != 2 {
		t.Fatalf("detached from %v", buckets)
	}
	got, _ = d.Read().ListAttachments(ctx, "b")
	if len(got) != 2 || got[0].Position != 0 || got[1].Position != 1 || got[1].Pipeline != "p3" {
		t.Fatalf("after detach %+v", got)
	}
	if r, _ := d.Read().AttachmentsRevision(ctx, "b"); r != 2 {
		t.Fatalf("revision after detach %d", r)
	}
}

func TestPipelineRows(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	p := &Pipeline{Name: "p", Generation: "g1", Stage: "after", Definition: `{"name":"p"}`, HeadersSealed: []byte{1}, SigningSealed: nil}
	mustUpdate(t, d, func(tx *Tx) error { return tx.CreatePipeline(ctx, p) })
	if err := d.Update(ctx, func(tx *Tx) error {
		return tx.CreatePipeline(ctx, &Pipeline{Name: "p", Generation: "g2", Stage: "after", Definition: "{}"})
	}); !errors.Is(err, ErrExists) {
		t.Fatalf("duplicate: %v", err)
	}
	got, err := d.Read().GetPipeline(ctx, "p")
	if err != nil || got.Revision != 1 || got.Generation != "g1" || len(got.HeadersSealed) != 1 {
		t.Fatalf("get: %+v %v", got, err)
	}
	got.Definition = `{"name":"p","description":"x"}`
	mustUpdate(t, d, func(tx *Tx) error { return tx.UpdatePipeline(ctx, got, 1) })
	if got.Revision != 2 {
		t.Fatalf("revision %d", got.Revision)
	}
	if err := d.Update(ctx, func(tx *Tx) error { return tx.UpdatePipeline(ctx, got, 1) }); !errors.Is(err, ErrConflict) {
		t.Fatalf("stale: %v", err)
	}
	list, _ := d.Read().ListPipelines(ctx, "", 0)
	if len(list) != 1 {
		t.Fatalf("list %d", len(list))
	}
	mustUpdate(t, d, func(tx *Tx) error { return tx.DeletePipeline(ctx, "p") })
	if _, err := d.Read().GetPipeline(ctx, "p"); !errors.Is(err, ErrNotFound) {
		t.Fatal("not deleted")
	}
}

func TestBackfillRows(t *testing.T) {
	d := openTest(t)
	ctx := context.Background()
	after := time.Now().Add(-time.Hour)
	b := &Backfill{ID: "bf_1", Bucket: "b", Pipeline: "p", Prefix: "x/", ModifiedAfter: &after}
	mustUpdate(t, d, func(tx *Tx) error { return tx.CreateBackfill(ctx, b) })
	run, _ := d.Read().RunningBackfills(ctx)
	if len(run) != 1 || run[0].ModifiedAfter == nil || run[0].Prefix != "x/" {
		t.Fatalf("running %+v", run)
	}
	b.Scanned, b.Enqueued, b.Cursor = 10, 4, "x/k"
	var running bool
	mustUpdate(t, d, func(tx *Tx) error {
		var err error
		running, err = tx.SaveBackfill(ctx, b)
		return err
	})
	if !running {
		t.Fatal("a running backfill reported not running")
	}
	var cancelled bool
	mustUpdate(t, d, func(tx *Tx) error {
		var err error
		cancelled, err = tx.CancelBackfill(ctx, "bf_1", time.Now())
		return err
	})
	if !cancelled {
		t.Fatal("cancel reported not running")
	}
	// a late progress write must not resurrect a cancelled backfill
	b.State = BackfillRunning
	b.Scanned = 99
	mustUpdate(t, d, func(tx *Tx) error {
		var err error
		running, err = tx.SaveBackfill(ctx, b)
		return err
	})
	if running {
		t.Fatal("a cancelled backfill reported running")
	}
	got, _ := d.Read().GetBackfill(ctx, "bf_1")
	if got.State != BackfillCancelled || got.Scanned != 10 || got.Cursor != "x/k" {
		t.Fatalf("backfill %+v", got)
	}
}
