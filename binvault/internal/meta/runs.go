package meta

import (
	"context"
	"database/sql"
	"strings"
	"time"
)

// Run states (spec §7.12).
const (
	RunQueued    = "queued"
	RunRunning   = "running"
	RunSucceeded = "succeeded"
	RunRejected  = "rejected"
	RunFailed    = "failed"
	RunSkipped   = "skipped"
	RunCancelled = "cancelled"
)

// Run is one execution of one pipeline for one event (spec §7.12). The runs of
// one event form a group (EventID) of Steps runs, numbered 1..Steps in
// attachment order; GroupSeq orders groups by commit.
type Run struct {
	ID            string
	GroupSeq      int64
	EventID       string
	Pipeline      string
	Generation    string
	Stage         string
	Bucket        string
	Key           string
	Event         string
	Operation     string
	ObjectVersion string
	Actor         string // JSON
	Lineage       string // JSON
	Payload       string // JSON: the event's object snapshot
	State         string
	Reason        string
	Step          int
	Steps         int
	Attempt       int
	MaxAttempts   int
	HTTPStatus    int
	Message       string
	Error         string
	QueuedAt      time.Time
	StartedAt     *time.Time
	FinishedAt    *time.Time
	DurationMS    int64
	NotBefore     time.Time // zero = runnable now
	RunnableSince *time.Time
	BackfillID    string
}

const runCols = `id, group_seq, event_id, pipeline, generation, stage, bucket, key, event, operation, object_version,
actor, lineage, payload, state, reason, step, steps, attempt, max_attempts, http_status, message, error,
queued_at, started_at, finished_at, duration_ms, not_before, runnable_since, backfill_id`

func scanRun(s rowScanner) (*Run, error) {
	var r Run
	var queued, notBefore int64
	var started, finished, since sql.NullInt64
	if err := s.Scan(&r.ID, &r.GroupSeq, &r.EventID, &r.Pipeline, &r.Generation, &r.Stage, &r.Bucket, &r.Key, &r.Event,
		&r.Operation, &r.ObjectVersion, &r.Actor, &r.Lineage, &r.Payload, &r.State, &r.Reason, &r.Step, &r.Steps,
		&r.Attempt, &r.MaxAttempts, &r.HTTPStatus, &r.Message, &r.Error, &queued, &started, &finished, &r.DurationMS,
		&notBefore, &since, &r.BackfillID); err != nil {
		return nil, err
	}
	r.QueuedAt = fromMS(queued)
	if started.Valid {
		v := fromMS(started.Int64)
		r.StartedAt = &v
	}
	if finished.Valid {
		v := fromMS(finished.Int64)
		r.FinishedAt = &v
	}
	if since.Valid {
		v := fromMS(since.Int64)
		r.RunnableSince = &v
	}
	if notBefore > 0 {
		r.NotBefore = fromMS(notBefore)
	}
	return &r, nil
}

func msOrZero(t time.Time) int64 {
	if t.IsZero() {
		return 0
	}
	return t.UnixMilli()
}

func (r *Run) insertArgs() []any {
	return []any{r.ID, r.GroupSeq, r.EventID, r.Pipeline, r.Generation, r.Stage, r.Bucket, r.Key, r.Event, r.Operation,
		r.ObjectVersion, orJSON(r.Actor), orJSON(r.Lineage), orJSON(r.Payload), r.State, r.Reason, r.Step, r.Steps,
		r.Attempt, r.MaxAttempts, r.HTTPStatus, r.Message, r.Error, ms(r.QueuedAt), msPtr(r.StartedAt), msPtr(r.FinishedAt),
		r.DurationMS, msOrZero(r.NotBefore), msPtr(r.RunnableSince), r.BackfillID}
}

// NextGroupSeq allocates the next event-group sequence: a counter that only
// grows, so the order of groups is the order they were committed in.
func (t *Tx) NextGroupSeq(ctx context.Context) (int64, error) {
	var n int64
	err := t.q.QueryRowContext(ctx, `INSERT INTO kv (key, value) VALUES ('run_group_seq', '1')
ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1 RETURNING CAST(value AS INTEGER)`).Scan(&n)
	return n, err
}

// InsertRuns adds run rows.
func (t *Tx) InsertRuns(ctx context.Context, runs ...*Run) error {
	for _, r := range runs {
		if r.QueuedAt.IsZero() {
			r.QueuedAt = t.now
		}
		if _, err := t.q.ExecContext(ctx, `INSERT INTO runs (`+runCols+`) VALUES (`+placeholders(30)+`)`, r.insertArgs()...); err != nil {
			return err
		}
	}
	return nil
}

func placeholders(n int) string {
	return strings.TrimSuffix(strings.Repeat("?,", n), ",")
}

// GetRun loads a run (ErrNotFound if absent).
func (q Q) GetRun(ctx context.Context, id string) (*Run, error) {
	r, err := scanRun(q.q.QueryRowContext(ctx, `SELECT `+runCols+` FROM runs WHERE id=?`, id))
	if isNoRows(err) {
		return nil, ErrNotFound
	}
	return r, err
}

// SaveRun writes the mutable columns of a run.
func (t *Tx) SaveRun(ctx context.Context, r *Run) error {
	_, err := t.q.ExecContext(ctx, `UPDATE runs SET generation=?, state=?, reason=?, attempt=?, max_attempts=?, http_status=?,
message=?, error=?, started_at=?, finished_at=?, duration_ms=?, not_before=?, runnable_since=? WHERE id=?`,
		r.Generation, r.State, r.Reason, r.Attempt, r.MaxAttempts, r.HTTPStatus, r.Message, r.Error, msPtr(r.StartedAt),
		msPtr(r.FinishedAt), r.DurationMS, msOrZero(r.NotBefore), msPtr(r.RunnableSince), r.ID)
	return err
}

// MarkRunning moves a queued run to running for its next attempt; it reports
// false when the run is no longer queued (cancelled meanwhile).
func (t *Tx) MarkRunning(ctx context.Context, r *Run, now time.Time) (bool, error) {
	res, err := t.q.ExecContext(ctx, `UPDATE runs SET state='running', attempt=attempt+1, started_at=?, finished_at=NULL,
runnable_since=COALESCE(runnable_since, ?), reason='' WHERE id=? AND state='queued'`, ms(now), ms(now), r.ID)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	if err != nil || n == 0 {
		return false, err
	}
	r.State, r.Attempt = RunRunning, r.Attempt+1
	r.StartedAt = &now
	if r.RunnableSince == nil {
		r.RunnableSince = &now
	}
	return true, nil
}

// RunnableRuns lists queued runs that may start now (spec §7.10): the first
// unfinished step of their group, their backoff passed, their attachment
// enabled, and no earlier group for the same (bucket, key) still open.
// Pipelines in exclude (paused, disabled or at capacity) are skipped. Oldest
// group first.
func (q Q) RunnableRuns(ctx context.Context, now time.Time, exclude []string, limit int) ([]*Run, error) {
	return q.RunnableRunsOutside(ctx, now, exclude, nil, limit)
}

// RunnableRunsOutside is RunnableRuns that also skips the runs of the buckets in
// excludeBuckets (buckets being moved, spec §8.8).
func (q Q) RunnableRunsOutside(ctx context.Context, now time.Time, exclude, excludeBuckets []string, limit int) ([]*Run, error) {
	args := []any{ms(now)}
	where := ""
	if len(exclude) > 0 {
		where = ` AND r.pipeline NOT IN (` + placeholders(len(exclude)) + `)`
		for _, n := range exclude {
			args = append(args, n)
		}
	}
	if len(excludeBuckets) > 0 {
		where += ` AND r.bucket NOT IN (` + placeholders(len(excludeBuckets)) + `)`
		for _, n := range excludeBuckets {
			args = append(args, n)
		}
	}
	args = append(args, limit)
	rows, err := q.q.QueryContext(ctx, `SELECT `+prefixCols("r", runCols)+` FROM runs r
WHERE r.state='queued' AND r.not_before <= ?`+where+`
AND NOT EXISTS (SELECT 1 FROM attachments a WHERE a.bucket=r.bucket AND a.pipeline=r.pipeline AND a.enabled=0)
AND NOT EXISTS (SELECT 1 FROM runs e WHERE e.event_id=r.event_id AND e.step<r.step AND e.state IN ('queued','running'))
AND NOT EXISTS (SELECT 1 FROM runs k WHERE k.bucket=r.bucket AND k.key=r.key AND k.group_seq<r.group_seq AND k.state IN ('queued','running'))
ORDER BY r.group_seq, r.step LIMIT ?`, args...)
	if err != nil {
		return nil, err
	}
	return collectRuns(rows)
}

func prefixCols(alias, cols string) string {
	parts := strings.Split(cols, ",")
	for i, p := range parts {
		parts[i] = alias + "." + strings.TrimSpace(p)
	}
	return strings.Join(parts, ", ")
}

func collectRuns(rows *sql.Rows) ([]*Run, error) {
	defer rows.Close()
	var out []*Run
	for rows.Next() {
		r, err := scanRun(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// NextNotBefore is the earliest not_before after now among queued runs
// (zero when none): when the scheduler should look again.
func (q Q) NextNotBefore(ctx context.Context, now time.Time) (time.Time, error) {
	var v sql.NullInt64
	err := q.q.QueryRowContext(ctx, `SELECT MIN(not_before) FROM runs WHERE state='queued' AND not_before > ?`, ms(now)).Scan(&v)
	if err != nil || !v.Valid {
		return time.Time{}, err
	}
	return fromMS(v.Int64), nil
}

// RequeueRunning puts runs that were running at a crash or shutdown back in
// the queue (spec §7.10 item 5); their attempt is not counted.
func (t *Tx) RequeueRunning(ctx context.Context) (int64, error) {
	res, err := t.q.ExecContext(ctx, `UPDATE runs SET state='queued', attempt=MAX(attempt-1, 0), started_at=NULL WHERE state='running'`)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// RunFilter selects runs for listing and bulk operations (spec §6.7).
type RunFilter struct {
	Bucket     string
	Pipeline   string
	Stage      string
	State      string
	Key        string
	KeyPrefix  string
	EventID    string
	Since      *time.Time // queued at or after
	Until      *time.Time // queued before
	BackfillID string
}

func (f RunFilter) where(alias string) (string, []any) {
	var conds []string
	var args []any
	col := func(c string) string {
		if alias == "" {
			return c
		}
		return alias + "." + c
	}
	add := func(cond string, v any) {
		conds = append(conds, col(cond))
		args = append(args, v)
	}
	if f.Bucket != "" {
		add("bucket=?", f.Bucket)
	}
	if f.Pipeline != "" {
		add("pipeline=?", f.Pipeline)
	}
	if f.Stage != "" {
		add("stage=?", f.Stage)
	}
	if f.State != "" {
		add("state=?", f.State)
	}
	if f.Key != "" {
		add("key=?", f.Key)
	}
	if f.KeyPrefix != "" {
		// a range scan rather than LIKE, so a '%' or '_' in a key stays literal
		if up := PrefixUpper(f.KeyPrefix); up != "" {
			conds = append(conds, col("key")+" >= ? AND "+col("key")+" < ?")
			args = append(args, f.KeyPrefix, up)
		} else {
			conds = append(conds, col("key")+" >= ?")
			args = append(args, f.KeyPrefix)
		}
	}
	if f.EventID != "" {
		add("event_id=?", f.EventID)
	}
	if f.BackfillID != "" {
		add("backfill_id=?", f.BackfillID)
	}
	if f.Since != nil {
		add("queued_at>=?", ms(*f.Since))
	}
	if f.Until != nil {
		add("queued_at<?", ms(*f.Until))
	}
	if len(conds) == 0 {
		return "", nil
	}
	return " WHERE " + strings.Join(conds, " AND "), args
}

// ListRuns lists runs newest first (by id). before is an exclusive upper
// bound on the id for paging ("" = from the newest).
func (q Q) ListRuns(ctx context.Context, f RunFilter, before string, limit int) ([]*Run, error) {
	w, args := f.where("")
	if before != "" {
		if w == "" {
			w = " WHERE id < ?"
		} else {
			w += " AND id < ?"
		}
		args = append(args, before)
	}
	args = append(args, limit)
	rows, err := q.q.QueryContext(ctx, `SELECT `+runCols+` FROM runs`+w+` ORDER BY id DESC LIMIT ?`, args...)
	if err != nil {
		return nil, err
	}
	return collectRuns(rows)
}

// ListRunsAsc lists runs oldest first (by id), after the exclusive id bound
// ("" = from the oldest): bulk retries walk the runs in the order they were
// raised.
func (q Q) ListRunsAsc(ctx context.Context, f RunFilter, after string, limit int) ([]*Run, error) {
	w, args := f.where("")
	if after != "" {
		if w == "" {
			w = " WHERE id > ?"
		} else {
			w += " AND id > ?"
		}
		args = append(args, after)
	}
	args = append(args, limit)
	rows, err := q.q.QueryContext(ctx, `SELECT `+runCols+` FROM runs`+w+` ORDER BY id ASC LIMIT ?`, args...)
	if err != nil {
		return nil, err
	}
	return collectRuns(rows)
}

// RunsOfGroup lists the runs of one event group by step.
func (q Q) RunsOfGroup(ctx context.Context, eventID string) ([]*Run, error) {
	rows, err := q.q.QueryContext(ctx, `SELECT `+runCols+` FROM runs WHERE event_id=? ORDER BY step`, eventID)
	if err != nil {
		return nil, err
	}
	return collectRuns(rows)
}

// RunRef is the little that bookkeeping needs of a run it changed.
type RunRef struct {
	ID       string
	Pipeline string
	Stage    string
}

// closeRuns moves the queued runs matching cond (an SQL condition over the
// runs table, without WHERE) to a terminal state, returning what it closed.
func (t *Tx) closeRuns(ctx context.Context, state, reason string, now time.Time, cond string, args ...any) ([]RunRef, error) {
	rows, err := t.q.QueryContext(ctx, `SELECT id, pipeline, stage FROM runs WHERE state='queued' AND `+cond, args...)
	if err != nil {
		return nil, err
	}
	var refs []RunRef
	for rows.Next() {
		var r RunRef
		if err := rows.Scan(&r.ID, &r.Pipeline, &r.Stage); err != nil {
			rows.Close()
			return nil, err
		}
		refs = append(refs, r)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()
	for _, r := range refs {
		if _, err := t.q.ExecContext(ctx, `UPDATE runs SET state=?, reason=?, finished_at=? WHERE id=? AND state='queued'`,
			state, reason, ms(now), r.ID); err != nil {
			return nil, err
		}
	}
	return refs, nil
}

// SkipRemaining skips the queued steps after step of an event group.
func (t *Tx) SkipRemaining(ctx context.Context, eventID string, afterStep int, reason string, now time.Time) ([]RunRef, error) {
	return t.closeRuns(ctx, RunSkipped, reason, now, `event_id=? AND step>?`, eventID, afterStep)
}

// CancelRuns cancels the queued runs matching f; pipeline-wide, bucket-wide or
// by (bucket, pipeline) depending on the filter.
func (t *Tx) CancelRuns(ctx context.Context, f RunFilter, reason string, now time.Time) ([]RunRef, error) {
	w, args := f.where("")
	if w == "" {
		return nil, nil
	}
	return t.closeRuns(ctx, RunCancelled, reason, now, strings.TrimPrefix(w, " WHERE "), args...)
}

// CancelRunsLimited cancels at most limit queued runs matching f (bulk cancel).
func (t *Tx) CancelRunsLimited(ctx context.Context, f RunFilter, reason string, now time.Time, limit int) ([]RunRef, error) {
	w, args := f.where("")
	cond := "1=1"
	if w != "" {
		cond = strings.TrimPrefix(w, " WHERE ")
	}
	args = append(args, limit)
	return t.closeRuns(ctx, RunCancelled, reason, now, `id IN (SELECT id FROM runs WHERE state='queued' AND `+cond+` ORDER BY id LIMIT ?)`, args...)
}

// Requeue resets a failed run for a fresh series of attempts (spec §6.7).
func (t *Tx) Requeue(ctx context.Context, id string, now time.Time) error {
	_, err := t.q.ExecContext(ctx, `UPDATE runs SET state='queued', reason='', attempt=0, http_status=0, message='', error='',
started_at=NULL, finished_at=NULL, duration_ms=0, not_before=0, runnable_since=NULL, queued_at=? WHERE id=?`, ms(now), id)
	return err
}

// RequeueSkippedAfter requeues the steps of a group that were skipped because
// step failed, so that a retry of it runs them again: the steps that follow it
// without a gap. A skipped step behind a step that ran was skipped because of
// that one (it failed with on_error: stop), and stays skipped.
func (t *Tx) RequeueSkippedAfter(ctx context.Context, eventID string, step int, now time.Time) ([]RunRef, error) {
	rows, err := t.q.QueryContext(ctx, `SELECT id, pipeline, stage, step FROM runs WHERE event_id=? AND step>? AND state='skipped' AND reason='earlier_step_failed' ORDER BY step`, eventID, step)
	if err != nil {
		return nil, err
	}
	var refs []RunRef
	next := step + 1
	for rows.Next() {
		var r RunRef
		var at int
		if err := rows.Scan(&r.ID, &r.Pipeline, &r.Stage, &at); err != nil {
			rows.Close()
			return nil, err
		}
		if at != next {
			break
		}
		refs = append(refs, r)
		next++
	}
	rows.Close()
	for _, r := range refs {
		if err := t.Requeue(ctx, r.ID, now); err != nil {
			return nil, err
		}
	}
	return refs, nil
}

// LaterGroupStarted reports whether a later event group for the same key has
// already started (spec §6.7: a retry never undoes newer work).
func (q Q) LaterGroupStarted(ctx context.Context, bucket, key string, groupSeq int64) (bool, error) {
	var one int
	err := q.q.QueryRowContext(ctx, `SELECT 1 FROM runs WHERE bucket=? AND key=? AND group_seq>? AND started_at IS NOT NULL LIMIT 1`,
		bucket, key, groupSeq).Scan(&one)
	if isNoRows(err) {
		return false, nil
	}
	return err == nil, err
}

// PipelineLoad counts a pipeline's open runs.
type PipelineLoad struct {
	Queued  int64
	Running int64
}

// OpenRunsByPipeline counts queued and running runs per pipeline (metrics and
// GET /status).
func (q Q) OpenRunsByPipeline(ctx context.Context) (map[string]PipelineLoad, error) {
	rows, err := q.q.QueryContext(ctx, `SELECT pipeline, state, COUNT(*) FROM runs WHERE state IN ('queued','running') GROUP BY pipeline, state`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]PipelineLoad{}
	for rows.Next() {
		var name, state string
		var n int64
		if err := rows.Scan(&name, &state, &n); err != nil {
			return nil, err
		}
		l := out[name]
		if state == RunQueued {
			l.Queued = n
		} else {
			l.Running = n
		}
		out[name] = l
	}
	return out, rows.Err()
}

// CountOpenRunsOfBackfill counts a backfill's queued and running runs.
func (q Q) CountOpenRunsOfBackfill(ctx context.Context, id string) (int64, error) {
	var n int64
	err := q.q.QueryRowContext(ctx, `SELECT COUNT(*) FROM runs WHERE backfill_id=? AND state IN ('queued','running')`, id).Scan(&n)
	return n, err
}

// ShiftRunnableSince moves the retry-window start of a pipeline's queued runs
// later by d: time a pipeline spent paused or disabled does not count toward
// the 24 h cap (spec §7.10).
func (t *Tx) ShiftRunnableSince(ctx context.Context, pipeline string, d time.Duration) error {
	_, err := t.q.ExecContext(ctx, `UPDATE runs SET runnable_since=runnable_since+? WHERE pipeline=? AND state='queued' AND runnable_since IS NOT NULL`,
		d.Milliseconds(), pipeline)
	return err
}

// ShiftRunnableSinceIn is ShiftRunnableSince for the queued runs of one
// pipeline in one bucket: the time its attachment was disabled does not count.
func (t *Tx) ShiftRunnableSinceIn(ctx context.Context, bucket, pipeline string, d time.Duration) error {
	_, err := t.q.ExecContext(ctx, `UPDATE runs SET runnable_since=runnable_since+? WHERE bucket=? AND pipeline=? AND state='queued' AND runnable_since IS NOT NULL`,
		d.Milliseconds(), bucket, pipeline)
	return err
}

// PruneRuns deletes finished runs that ended before cutoff (spec §3.9). It
// returns how many it removed.
func (t *Tx) PruneRuns(ctx context.Context, cutoff time.Time, limit int) (int64, error) {
	res, err := t.q.ExecContext(ctx, `DELETE FROM runs WHERE id IN (SELECT id FROM runs WHERE finished_at IS NOT NULL AND finished_at < ?
AND state NOT IN ('queued','running') LIMIT ?)`, ms(cutoff), limit)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// OpenRunsOfKey counts a key's open (queued or running) runs.
func (q Q) OpenRunsOfKey(ctx context.Context, bucket, key string) (int64, error) {
	var n int64
	err := q.q.QueryRowContext(ctx, `SELECT COUNT(*) FROM runs WHERE bucket=? AND key=? AND state IN ('queued','running')`, bucket, key).Scan(&n)
	return n, err
}

// RunBuckets lists, in name order, the buckets that have runs matching f.
func (q Q) RunBuckets(ctx context.Context, f RunFilter) ([]string, error) {
	w, args := f.where("")
	rows, err := q.q.QueryContext(ctx, `SELECT DISTINCT bucket FROM runs`+w+` ORDER BY bucket`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var b string
		if err := rows.Scan(&b); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// CountRuns counts the runs matching f.
func (q Q) CountRuns(ctx context.Context, f RunFilter) (int64, error) {
	w, args := f.where("")
	var n int64
	err := q.q.QueryRowContext(ctx, `SELECT COUNT(*) FROM runs`+w, args...).Scan(&n)
	return n, err
}
