package mover

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/ratelimit"
	"github.com/kalevski/toolcase/binvault/internal/seal"
)

// The source's side of a move (spec §8.8): one outMove per move this node runs.

var (
	// errCancelled ends a move an admin cancelled before the freeze.
	errCancelled = errors.New("cancelled by an admin")
	// errBusy: the target takes part in another move; the move waits.
	errBusy = errors.New("the target node is busy with another move")
)

// refusedPrepare is the target's definitive no to the prepare: it holds nothing of
// the move and was told nothing it must forget.
type refusedPrepare struct{ detail string }

func (e *refusedPrepare) Error() string { return "the target node refused the move: " + e.detail }

// busyError is a "not now" of the target that is not about another move (a pipeline
// of the bucket has not reached it yet): errors.Is(err, errBusy) holds, and the text
// of the target is what the waiting move shows.
type busyError struct{ detail string }

func (e *busyError) Error() string        { return e.detail }
func (e *busyError) Is(target error) bool { return target == errBusy }

// busy is the error for the target's answer `busy` with its detail.
func busy(detail string) error {
	if detail == "" || detail == detailAnotherMove {
		return errBusy
	}
	return &busyError{detail: detail}
}

// outMove is a move this node executes as source.
type outMove struct {
	m      *Mover
	id     string
	ctx    context.Context
	cancel context.CancelCauseFunc

	mu  sync.Mutex
	row meta.Move // guarded by mu
	// cancelable is true until the freeze: a cancel is refused after that, so that the
	// two sides never disagree about whether a move is happening.
	cancelable bool
	// frozen: this node refuses the bucket's writes because of this move.
	frozen   bool
	frozenAt time.Time

	bucket      *meta.Bucket
	bytesCopied atomic.Int64
	objects     atomic.Int64
	limiter     *ratelimit.Limiter
	afterSeq    int64 // the watermark of the last blob pass
	sentParts   map[string]struct{}
	passes      int
}

func (m *Mover) newOut(row *meta.Move) *outMove {
	ctx, cancel := context.WithCancelCause(m.ctx)
	// only a move that has not started can be cancelled: one resumed after a restart is
	// past its freeze
	mv := &outMove{m: m, id: row.ID, ctx: ctx, cancel: cancel, row: *row, cancelable: row.State == meta.MoveQueued, sentParts: map[string]struct{}{}}
	mv.bytesCopied.Store(row.BytesCopied)
	mv.objects.Store(row.ObjectsCopied)
	if row.MaxBPS > 0 {
		mv.limiter = ratelimit.New(ratelimit.Limits{BytesInPerSecond: row.MaxBPS})
	}
	return mv
}

// snapshot is the move's record with its live counters.
func (mv *outMove) snapshot() meta.Move {
	mv.mu.Lock()
	defer mv.mu.Unlock()
	r := mv.row
	r.BytesCopied, r.ObjectsCopied = mv.bytesCopied.Load(), mv.objects.Load()
	return r
}

// requestCancel cancels the move if it has not reached the freeze; it reports
// whether it did.
func (mv *outMove) requestCancel() bool {
	mv.mu.Lock()
	defer mv.mu.Unlock()
	if !mv.cancelable {
		return false
	}
	mv.cancel(errCancelled)
	return true
}

// note sets the text the move shows as its `error` while it is not over, in memory
// only: the next record of the move's state replaces it.
func (mv *outMove) note(text string) {
	mv.mu.Lock()
	mv.row.Error = text
	mv.mu.Unlock()
}

// save records the move's state (and counters) on disk.
func (mv *outMove) save(state, errText string) error {
	mv.mu.Lock()
	mv.row.State = state
	mv.row.Error = errText
	mv.row.BytesCopied, mv.row.ObjectsCopied = mv.bytesCopied.Load(), mv.objects.Load()
	now := mv.m.now()
	if mv.row.StartedAt == nil && state != meta.MoveQueued {
		mv.row.StartedAt = &now
	}
	if meta.IsFinalMoveState(state) && mv.row.FinishedAt == nil {
		mv.row.FinishedAt = &now
	}
	row := mv.row
	mv.mu.Unlock()
	return mv.m.update(mv.ctx, func(tx *meta.Tx) error { return tx.SaveMove(mv.ctx, &row) })
}

func (mv *outMove) saveBackground(state, errText string) {
	for backoff := 100 * time.Millisecond; ; backoff = min(backoff*2, 5*time.Second) {
		err := mv.save(state, errText)
		if err == nil {
			return
		}
		mv.m.log.Error("move: cannot record the state of a move; trying again", "move", mv.id, "state", state, "error", err)
		if !mv.m.sleep(mv.m.ctx, backoff) {
			return
		}
	}
}

// url is where the target answers now.
func (mv *outMove) url() (string, error) {
	u, ok := mv.m.o.Node.PeerURL(mv.row.Peer)
	if !ok {
		return "", fmt.Errorf("the target node %s is not reachable", mv.m.nodeName(mv.row.Peer))
	}
	return u, nil
}

// ---- the worker --------------------------------------------------------------------------------

// worker runs the queued moves one at a time, and first the ones a restart
// interrupted past their cutover.
func (m *Mover) worker() {
	for {
		for m.ctx.Err() == nil {
			row := m.nextOut()
			if row == nil {
				break
			}
			if !m.acquire(m.ctx) {
				return
			}
			m.runOut(row)
			m.release()
		}
		select {
		case <-m.ctx.Done():
			return
		case <-m.wake:
		case <-time.After(m.nextWait()):
		}
	}
}

// nextWait is how long the worker sleeps when there is nothing to run.
func (m *Mover) nextWait() time.Duration {
	wait := 2 * time.Second
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, t := range m.retryAt {
		if d := time.Until(t); d < wait {
			wait = max(d, 10*time.Millisecond)
		}
	}
	return wait
}

func (m *Mover) nextOut() *meta.Move {
	q := m.o.DB.Read()
	// a move past its cutover comes first: its bucket is out of service until it ends
	rows, err := q.ListMoves(m.ctx, meta.MoveFilter{Role: meta.MoveOut, States: []string{meta.MoveCutover, meta.MoveMoved, meta.MoveResuming}, Asc: true, Limit: 10})
	if err == nil && len(rows) > 0 {
		return rows[0]
	}
	rows, err = q.ListMoves(m.ctx, meta.MoveFilter{Role: meta.MoveOut, States: []string{meta.MoveQueued}, Asc: true, Limit: 100})
	if err != nil {
		return nil
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(rows) < 100 {
		// a move that left the queue without being run (cancelled, say) holds no delay
		// any more: an entry nobody removes would keep the worker waking every 10 ms
		queued := make(map[string]struct{}, len(rows))
		for _, r := range rows {
			queued[r.ID] = struct{}{}
		}
		for id := range m.retryAt {
			if _, ok := queued[id]; !ok {
				delete(m.retryAt, id)
			}
		}
	}
	now := time.Now()
	for _, r := range rows {
		if t, ok := m.retryAt[r.ID]; ok && now.Before(t) {
			continue
		}
		delete(m.retryAt, r.ID)
		return r
	}
	return nil
}

func (m *Mover) runOut(row *meta.Move) {
	mv := m.newOut(row)
	m.mu.Lock()
	m.outs[row.ID] = mv
	m.mu.Unlock()
	m.met.active.Add(1)
	defer func() {
		m.mu.Lock()
		delete(m.outs, row.ID)
		m.mu.Unlock()
		m.met.active.Add(-1)
		mv.cancel(nil)
	}()
	switch row.State {
	case meta.MoveQueued:
		mv.runFresh()
	case meta.MoveCutover:
		mv.cutover(true)
	case meta.MoveMoved:
		mv.afterMoved()
	case meta.MoveResuming:
		mv.resume()
	}
}

// runFresh runs a queued move up to its cutover.
func (mv *outMove) runFresh() {
	m := mv.m
	var began bool
	err := m.update(mv.ctx, func(tx *meta.Tx) (err error) {
		began, err = tx.MoveTransition(mv.ctx, mv.id, []string{meta.MoveQueued}, meta.MovePreparing, "")
		return err
	})
	if err != nil {
		m.log.Error("move: cannot start a queued move", "move", mv.id, "error", err)
		m.sleep(mv.ctx, time.Second)
		return
	}
	if !began {
		return // cancelled while queued
	}
	mv.mu.Lock()
	mv.row.State, mv.row.Error = meta.MovePreparing, ""
	now := m.now()
	mv.row.StartedAt = &now
	mv.mu.Unlock()
	m.log.Info("move: starting", "move", mv.id, "bucket", mv.row.Bucket, "to", m.nodeName(mv.row.Peer), "epoch", mv.row.Epoch)

	err = mv.prepare()
	if err == nil {
		err = mv.copy()
	}
	if errors.Is(err, errBusy) && !errors.Is(context.Cause(mv.ctx), errCancelled) {
		mv.requeue(err)
		return
	}
	if err == nil {
		err = mv.freezeAndSend()
	}
	if errors.Is(err, errBusy) && !m.closing() {
		// the target asked for time after the bucket was frozen (a pipeline of the bucket has
		// not reached it yet): the freeze is lifted, the bucket is served here as before and
		// the move starts again later; the target keeps what it has received
		mv.lift("busy")
		mv.requeue(err)
		return
	}
	if err != nil {
		mv.abort(err)
		return
	}
	mv.cutover(false)
}

// requeue puts a move whose target is busy back in the queue.
func (mv *outMove) requeue(why error) {
	m := mv.m
	m.mu.Lock()
	m.retryAt[mv.id] = time.Now().Add(jitter(m.tune.RequeueDelay))
	m.mu.Unlock()
	m.log.Info("move: the target is busy; the move waits", "move", mv.id, "bucket", mv.row.Bucket, "why", why.Error())
	mv.mu.Lock()
	mv.row.StartedAt = nil
	mv.mu.Unlock()
	mv.saveBackground(meta.MoveQueued, "waiting: "+why.Error())
}

// ---- step 1: prepare --------------------------------------------------------------------

func (mv *outMove) prepare() error {
	m := mv.m
	ctx := mv.ctx
	b, err := m.o.DB.Read().GetBucket(ctx, mv.row.Bucket)
	if err != nil {
		if errors.Is(err, meta.ErrNotFound) {
			return errf("the bucket does not exist on this node any more")
		}
		return err
	}
	rec, ok := m.o.Node.Bucket(b.Name)
	switch {
	case !ok || rec.Home != m.selfID() || rec.Generation != b.Generation || rec.Epoch != b.Epoch:
		return errf("this node is not the home of the bucket at its current epoch")
	case b.Generation != mv.row.Generation || b.Epoch+1 != mv.row.Epoch:
		return errf("the bucket changed since the move was requested")
	}
	mv.bucket = b
	keyIDs, err := m.sealedKeyIDs(ctx, b)
	if err != nil {
		return err
	}
	url, err := mv.url()
	if err != nil {
		return err
	}
	mv.mu.Lock()
	mv.row.BytesTotal = m.bucketBytes(ctx, b)
	total := mv.row.BytesTotal
	mv.mu.Unlock()
	if err := mv.save(meta.MovePreparing, ""); err != nil {
		return err
	}
	res, err := m.control(ctx, url, mv.id, "prepare", "POST", prepareReq{
		Bucket: b.Name, Generation: b.Generation, Epoch: mv.row.Epoch, From: m.selfID(), Bytes: total, KeyIDs: keyIDs,
		FreezeTimeoutMS: m.cfg.MoveFreezeTimeout.Milliseconds(),
	}, m.tune.ControlTimeout)
	switch {
	case err != nil:
		if ctx.Err() != nil {
			return context.Cause(ctx)
		}
		return fmt.Errorf("the target node did not answer prepare: %w", err)
	case res.Status == 200 && res.JSON && res.Reply.Result == resultOK:
		return nil
	case res.JSON && res.Reply.Result == resultBusy:
		return busy(res.Reply.Detail)
	case res.JSON && res.Reply.Result == resultRefused:
		return &refusedPrepare{detail: res.Reply.Detail}
	}
	return fmt.Errorf("the target node answered prepare with %s", res.detail())
}

// sealedKeyIDs lists the master keys the bucket's sealed values — its data key and
// its tokens' secrets — were sealed under (spec §8.8 step 1, §4.7).
func (m *Mover) sealedKeyIDs(ctx context.Context, b *meta.Bucket) ([]string, error) {
	set := map[seal.KeyID]struct{}{}
	if len(b.DataKey) > 0 {
		id, err := seal.SealedKeyID(b.DataKey)
		if err != nil {
			return nil, fmt.Errorf("the bucket's data key is not a sealed value: %w", err)
		}
		set[id] = struct{}{}
	}
	for after := ""; ; {
		ts, err := m.o.DB.Read().ListTokens(ctx, b.Name, after, 200)
		if err != nil {
			return nil, err
		}
		for _, t := range ts {
			after = t.AccessKeyID
			id, err := seal.SealedKeyID(t.Secret)
			if err != nil {
				return nil, fmt.Errorf("the secret of token %s is not a sealed value: %w", t.AccessKeyID, err)
			}
			set[id] = struct{}{}
		}
		if len(ts) < 200 {
			break
		}
	}
	out := make([]string, 0, len(set))
	for id := range set {
		out = append(out, id.String())
	}
	sort.Strings(out)
	return out, nil
}

// ---- step 3 and 4: freeze, last blobs, rows -----------------------------------------------

// freezeAndSend freezes the bucket, sends what the online passes did not and all
// of its rows, and returns once the target has imported and verified them. The
// whole of it is bounded by BINVAULT_MOVE_FREEZE_TIMEOUT.
func (mv *outMove) freezeAndSend() error {
	m := mv.m
	mv.mu.Lock()
	if err := context.Cause(mv.ctx); err != nil {
		mv.mu.Unlock()
		return err
	}
	mv.cancelable = false // from here the move is not cancelled any more
	mv.mu.Unlock()
	if err := mv.save(meta.MoveFrozen, ""); err != nil {
		return err
	}
	timeout := m.cfg.MoveFreezeTimeout
	fctx, cancel := context.WithTimeout(mv.ctx, timeout)
	defer cancel()
	wrap := func(what string, err error) error {
		if errors.Is(err, context.DeadlineExceeded) && fctx.Err() != nil && mv.ctx.Err() == nil {
			return fmt.Errorf("%s: the freeze lasted longer than BINVAULT_MOVE_FREEZE_TIMEOUT (%s)", what, timeout)
		}
		return fmt.Errorf("%s: %w", what, err)
	}
	mv.mu.Lock()
	mv.frozen, mv.frozenAt = true, m.now()
	mv.mu.Unlock()
	if err := m.o.Gate.Freeze(fctx, mv.row.Bucket); err != nil {
		return wrap("freezing the bucket's writes", err)
	}
	if err := m.o.Pipes.FreezeBucket(fctx, mv.row.Bucket); err != nil {
		return wrap("freezing the bucket's pipelines", err)
	}
	m.log.Info("move: the bucket is frozen", "move", mv.id, "bucket", mv.row.Bucket)
	// the bucket the move was prepared for must still be the one that is frozen (it may
	// have been deleted, even created again, during the passes)
	if b, err := m.o.DB.Read().GetBucket(fctx, mv.row.Bucket); err != nil || b.Generation != mv.row.Generation || b.Epoch+1 != mv.row.Epoch {
		return errf("the bucket was deleted or replaced while it was being copied")
	}
	if _, err := mv.pass(fctx, mv.afterSeq, true); err != nil {
		return wrap("sending the last blobs", err)
	}
	counts, err := mv.sendRows(fctx)
	if err != nil {
		return wrap("sending the rows", err)
	}
	mv.objects.Store(counts["objects"])
	return nil
}

// lift undoes the freeze of a move that ended before its cutover.
func (mv *outMove) lift(outcome string) {
	mv.mu.Lock()
	was, since := mv.frozen, mv.frozenAt
	mv.frozen = false
	mv.mu.Unlock()
	if !was {
		return
	}
	mv.m.o.Gate.Thaw(mv.row.Bucket)
	mv.m.o.Pipes.ThawBucket(mv.row.Bucket)
	mv.m.met.freeze.Observe(time.Since(since).Seconds(), outcome)
}

// abort ends a move before its cutover: the freeze is lifted, the failure recorded
// and the target told to drop what it received.
func (mv *outMove) abort(err error) {
	m := mv.m
	state, text := meta.MoveFailed, err.Error()
	switch {
	case errors.Is(err, errCancelled) || errors.Is(context.Cause(mv.ctx), errCancelled):
		state, text = meta.MoveCancelled, errCancelled.Error()
	case m.closing():
		return // the node is shutting down: the next start ends the move (Recover)
	}
	mv.saveBackground(state, text)
	mv.lift(state)
	m.met.moves.Inc(state)
	m.log.Warn("move: ended before the cutover; the bucket is served here as before", "move", mv.id, "bucket", mv.row.Bucket, "state", state, "error", text)
	// a target that refused the prepare holds nothing and has nothing to forget
	var refused *refusedPrepare
	if errors.As(err, &refused) {
		return
	}
	row := mv.snapshot()
	// in the background: an unreachable target must not hold up the next move
	m.wg.Add(1)
	go func() {
		defer m.wg.Done()
		m.sendDiscard(m.ctx, &row)
	}()
}

// sendDiscard tells the target to drop the copy it holds for a move that ended,
// best effort: if it cannot be reached it gives the copy up by itself, at the latest
// when it next starts (spec §8.8).
func (m *Mover) sendDiscard(ctx context.Context, row *meta.Move) {
	for attempt := 1; attempt <= 3; attempt++ {
		if url, ok := m.o.Node.PeerURL(row.Peer); ok {
			res, err := m.control(ctx, url, row.ID, "discard", "POST", nil, m.tune.ControlTimeout)
			if err == nil && res.Status == 200 && res.JSON {
				return
			}
			if err == nil && res.JSON && res.Reply.Result == resultRefused {
				m.log.Warn("move: the target would not discard its copy", "move", row.ID, "detail", res.Reply.Detail)
				return
			}
		}
		if !m.sleep(ctx, time.Duration(attempt)*time.Second) {
			return
		}
	}
	m.log.Info("move: the target could not be told to drop its copy; it does so by itself", "move", row.ID, "to", m.nodeName(row.Peer))
}

// ---- step 5: cutover -----------------------------------------------------------------------

// cutover pauses the bucket completely, records the decision to cut over, and asks
// the target to activate until it answers (spec §8.8 step 5). Only the answer
// REFUSED lifts the pause; every other outcome — a timeout, a connection error, an
// error page from a proxy in front of the target — is no answer, because silence
// does not tell whether the target is serving: the move asks again, for ever, also
// after a restart of this node (resumed). The target being retired ends it.
func (mv *outMove) cutover(resumed bool) {
	m := mv.m
	if !resumed {
		m.o.Gate.Pause(mv.row.Bucket)
		if err := mv.save(meta.MoveCutover, ""); err != nil {
			mv.abort(fmt.Errorf("recording the cutover: %w", err))
			return
		}
		m.log.Info("move: cutover; asking the target to activate", "move", mv.id, "bucket", mv.row.Bucket, "to", m.nodeName(mv.row.Peer))
	}
	backoff := m.tune.ActivateBackoff
	for attempt := 1; ; attempt++ {
		if m.closing() || mv.ctx.Err() != nil {
			return // stays in `cutover`: asked again after the restart
		}
		outcome, detail := mv.askActivate()
		switch outcome {
		case activateOK:
			mv.note("")
			if mv.crashAt("ok") {
				return
			}
			mv.moved()
			return
		case activateRefused:
			mv.refusedByTarget(detail)
			return
		}
		// what an admin who finds the move in cutover wants to know: why it is not over
		// (shown in the move's `error`, until the target answers; not persisted)
		mv.note(fmt.Sprintf("waiting for the target's answer to activate (the bucket stays paused; asked %d times so far): %s", attempt, detail))
		if mv.targetRetired() {
			// retired is "gone for good" only if the target really is: one that is alive and
			// has decided to activate is the home (it may have served already), and taking
			// the bucket back at epoch + 2 would discard what it acknowledged
			if mv.targetActivated() {
				m.log.Warn("move: the target was retired but has activated: the move is done", "move", mv.id, "bucket", mv.row.Bucket, "to", m.nodeName(mv.row.Peer))
				mv.note("")
				if mv.crashAt("ok") {
					return
				}
				mv.moved()
				return
			}
			mv.note("")
			mv.resume()
			return
		}
		if attempt == 1 || attempt%10 == 0 {
			m.log.Warn("move: the target gave no answer to activate; the bucket stays paused and the call is repeated", "move", mv.id,
				"bucket", mv.row.Bucket, "to", m.nodeName(mv.row.Peer), "attempt", attempt, "detail", detail)
		}
		if !m.sleep(mv.ctx, backoff) {
			return
		}
		backoff = min(backoff*2, m.tune.ActivateBackoffMax)
	}
}

// askActivate calls activate once. It returns "OK" or "REFUSED" only for a proper
// answer of the target: HTTP 200, application/json, this move's id and one of the
// two words; anything else is no answer ("").
func (mv *outMove) askActivate() (outcome, detail string) {
	m := mv.m
	url, err := mv.url()
	if err != nil {
		return "", err.Error()
	}
	res, err := m.control(mv.ctx, url, mv.id, "activate", "POST", nil, m.tune.ActivateTimeout)
	if err != nil {
		return "", err.Error()
	}
	var ar activateReply
	if res.Status != 200 || !res.ContentJSON || json.Unmarshal(res.Body, &ar) != nil || ar.Move != mv.id {
		return "", fmt.Sprintf("not an answer to activate: %s", res.detail())
	}
	switch ar.Result {
	case activateOK:
		return activateOK, ""
	case activateRefused:
		return activateRefused, ar.Reason
	}
	return "", fmt.Sprintf("not an answer to activate: %s", res.detail())
}

// targetRetired reports whether this node has retired the target (DELETE
// /cluster/nodes/{id}): it is gone for good, so the move ends and the bucket stays
// here (spec §8.8 Failures).
func (mv *outMove) targetRetired() bool {
	r, ok := mv.m.o.Node.Route(mv.row.Peer)
	return ok && r.Retired
}

// targetActivated asks the target — by its last known address, whether or not this
// node thinks it is up — for its record of the move, and reports whether it has
// activated it. Silence, an error and every other state are "no".
func (mv *outMove) targetActivated() bool {
	m := mv.m
	r, ok := m.o.Node.Route(mv.row.Peer)
	if !ok || r.URL == "" {
		return false
	}
	res, err := m.control(mv.ctx, r.URL, mv.id, "", "GET", nil, m.tune.ControlTimeout)
	return err == nil && res.Status == http.StatusOK && res.JSON && res.Reply.Result == resultOK && res.Reply.State == meta.MoveActivated
}

// refusedByTarget ends the move after the target's REFUSED: the target will never
// serve the bucket, so this node serves it again.
func (mv *outMove) refusedByTarget(reason string) {
	m := mv.m
	text := "refused by the target node: " + reason
	mv.saveBackground(meta.MoveFailed, text)
	mv.lift("refused")
	m.o.Gate.Thaw(mv.row.Bucket) // (after a restart the freeze was not this process's: lift did nothing)
	m.o.Pipes.ThawBucket(mv.row.Bucket)
	m.met.moves.Inc(meta.MoveFailed)
	m.log.Warn("move: the target refused to activate; the bucket is served here again", "move", mv.id, "bucket", mv.row.Bucket, "reason", reason)
}

// moved is the source's side of "the target answered OK": the bucket belongs to the
// target from now on (spec §8.8 step 5). The durable record and the local epoch go
// together, so that this node refuses the bucket from this instant on, whatever the
// catalog says yet.
func (mv *outMove) moved() {
	m := mv.m
	for backoff := 100 * time.Millisecond; ; backoff = min(backoff*2, 5*time.Second) {
		err := m.update(mv.ctx, func(tx *meta.Tx) error {
			if _, err := tx.MoveTransition(mv.ctx, mv.id, []string{meta.MoveCutover}, meta.MoveMoved, ""); err != nil {
				return err
			}
			_, err := tx.SetBucketEpoch(mv.ctx, mv.row.Bucket, mv.row.Generation, mv.row.Epoch)
			return err
		})
		if err == nil {
			break
		}
		m.log.Error("move: cannot record that the bucket moved; trying again", "move", mv.id, "error", err)
		if !m.sleep(mv.ctx, backoff) {
			return
		}
	}
	mv.mu.Lock()
	mv.row.State = meta.MoveMoved
	// the writes were frozen from the freeze to here, where the target takes the bucket
	// over; the hand-off wait and the cleanup that follow are not a freeze (after a
	// restart the freeze of the process that started the move is not known)
	was, since := mv.frozen, mv.frozenAt
	mv.frozen = false
	mv.mu.Unlock()
	if was && !since.IsZero() {
		m.met.freeze.Observe(time.Since(since).Seconds(), "done")
	}
	m.own(mv.row.Bucket, mv.id)
	if mv.crashAt("moved") {
		return
	}
	m.log.Info("move: the target is the home of the bucket now", "move", mv.id, "bucket", mv.row.Bucket, "to", m.nodeName(mv.row.Peer), "epoch", mv.row.Epoch)
	mv.afterMoved()
}

// afterMoved is what follows the decision: the hand-off op in the catalog, the
// pipelines' farewell, the cleanup. It is repeated after a restart.
func (mv *outMove) afterMoved() {
	m := mv.m
	m.waitCatalog(mv.ctx, mv.row.Bucket, mv.row.Generation, mv.row.Epoch, 2*time.Second)
	if err := m.handoffUntilDone(mv.ctx, mv.row.Bucket, mv.row.Generation, mv.row.Peer, mv.row.Epoch, 3*time.Second); err != nil {
		return
	}
	m.o.Pipes.BucketMoved(mv.row.Bucket)
	if mv.crashAt("handoff") {
		return
	}
	mv.cleanup()
}

// cleanup removes the local copy (spec §8.8 step 6): rows, part files and blob
// references — its blobs follow the normal grace — and writes no catalog op and
// fires no event.
func (mv *outMove) cleanup() {
	m := mv.m
	ctx := mv.ctx
	var uploads []string
	// The rows go in pieces, one short transaction each: the move stays `moved` until
	// the last piece, which removes the bucket row and ends the move in the same
	// transaction, so a restart in between finds the move and the rest of the rows and
	// carries on (spec §8.8 step 6). The bucket is not served here meanwhile: the
	// catalog says it is the target's.
	for backoff := 100 * time.Millisecond; ; {
		var last bool
		err := m.update(ctx, func(tx *meta.Tx) error {
			uploads, last = nil, true
			// only the copy this move left behind: never a bucket of that name that was
			// created or moved here since
			if b, err := tx.GetBucket(ctx, mv.row.Bucket); err == nil && b.Generation == mv.row.Generation && b.Epoch == mv.row.Epoch {
				done, gone, err := tx.DiscardBucketChunk(ctx, mv.row.Bucket, m.tune.CleanupChunk)
				if err != nil {
					return err
				}
				if !done {
					last = false
					return nil
				}
				uploads = gone
				if err := m.o.Pipes.BucketLeaving(ctx, tx, mv.row.Bucket); err != nil {
					return err
				}
			}
			_, err := tx.MoveTransition(ctx, mv.id, []string{meta.MoveMoved}, meta.MoveDone, "")
			return err
		})
		if err != nil {
			m.log.Error("move: cannot remove the local copy; trying again", "move", mv.id, "bucket", mv.row.Bucket, "error", err)
			if !m.sleep(ctx, backoff) {
				return
			}
			backoff = min(backoff*2, 5*time.Second)
			continue
		}
		backoff = 100 * time.Millisecond
		if last {
			break
		}
		if mv.crashAt("cleanup") { // a test seam: the process dies between two pieces
			return
		}
		if ctx.Err() != nil {
			return // closing: the next start carries on
		}
	}
	for _, id := range uploads {
		_ = m.o.Store.RemoveUpload(id)
	}
	m.disown(mv.row.Bucket, mv.id)
	if m.o.BucketGone != nil {
		m.o.BucketGone(mv.row.Bucket)
	}
	m.o.Pipes.ForgetBucket(mv.row.Bucket)
	m.o.Gate.Thaw(mv.row.Bucket)
	mv.mu.Lock()
	mv.row.State = meta.MoveDone
	mv.mu.Unlock()
	m.met.moves.Inc(meta.MoveDone)
	snap := mv.snapshot()
	m.log.Info("move: done", "move", mv.id, "bucket", mv.row.Bucket, "to", m.nodeName(mv.row.Peer), "epoch", mv.row.Epoch,
		"bytes", snap.BytesCopied, "objects", snap.ObjectsCopied)
}

// resume ends a cutover whose target was retired: this node takes the bucket back
// at epoch + 2 and writes that to the catalog, so that a copy on the target that
// ever returns is an orphan (spec §8.8 Failures). The decision is durable first
// (state `resuming`, the local epoch), the catalog second, the pause lifted last.
func (mv *outMove) resume() {
	m := mv.m
	newEpoch := mv.row.Epoch + 1
	if mv.row.State != meta.MoveResuming {
		err := m.update(mv.ctx, func(tx *meta.Tx) error {
			if _, err := tx.MoveTransition(mv.ctx, mv.id, []string{meta.MoveCutover}, meta.MoveResuming, "the target node was retired: the bucket stays on this node"); err != nil {
				return err
			}
			_, err := tx.SetBucketEpoch(mv.ctx, mv.row.Bucket, mv.row.Generation, newEpoch)
			return err
		})
		if err != nil {
			m.log.Error("move: cannot record that the move was ended by the target's retirement", "move", mv.id, "error", err)
			return
		}
	}
	m.own(mv.row.Bucket, mv.id)
	m.log.Warn("move: the target node was retired; the bucket stays here at epoch+2", "move", mv.id, "bucket", mv.row.Bucket, "epoch", newEpoch)
	// the catalog entry is made to say "this node, at the new epoch", whatever it said
	for backoff := 200 * time.Millisecond; ; backoff = min(backoff*2, 5*time.Second) {
		err := m.ensureHandoff(mv.ctx, mv.row.Bucket, mv.row.Generation, m.selfID(), newEpoch, 3*time.Second)
		if err == nil {
			break
		}
		m.log.Warn("move: writing the epoch to the catalog failed; trying again", "move", mv.id, "error", err)
		if !m.sleep(mv.ctx, backoff) {
			return
		}
	}
	text := "the target node was retired: the bucket stays on this node"
	mv.saveBackground(meta.MoveFailed, text)
	m.disown(mv.row.Bucket, mv.id)
	mv.lift("retired")
	m.o.Gate.Thaw(mv.row.Bucket)
	m.o.Pipes.ThawBucket(mv.row.Bucket)
	m.met.moves.Inc(meta.MoveFailed)
}
