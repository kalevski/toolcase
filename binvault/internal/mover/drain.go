package mover

import (
	"context"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// The drain of a node (spec §6.9, §8.8): while the node is cordoned, its buckets move
// away one after another, each to the node `auto` placement picks. The state is the
// cordon flag, the buckets the catalog still homes here and the moves: nothing else
// is kept, so a restart picks the drain up where it was (the flag is persisted).

// drainLoop looks for a bucket to move away whenever the node is cordoned.
func (m *Mover) drainLoop() {
	t := time.NewTicker(m.tune.DrainPoll)
	defer t.Stop()
	skip := map[string]time.Time{} // buckets whose last drain move failed: not retried at once
	m.drainWarned = map[string]time.Time{}
	for {
		select {
		case <-m.ctx.Done():
			return
		case <-m.drain:
		case <-t.C:
		}
		if m.o.Node.Cordoned() && m.ready() {
			m.drainRound(skip)
		}
	}
}

func (m *Mover) ready() bool { return m.o.Ready == nil || m.o.Ready() }

// drainRound moves the node's buckets, one at a time, until none is left, the node is
// not cordoned any more or a bucket cannot be moved now.
func (m *Mover) drainRound(skip map[string]time.Time) {
	ctx := m.ctx
	n := m.o.Node
	for m.ctx.Err() == nil && n.Cordoned() {
		recs, err := n.BucketsHomed(ctx, n.ID())
		if err != nil || len(recs) == 0 {
			return
		}
		moved := false
		for _, rec := range recs {
			if m.ctx.Err() != nil || !n.Cordoned() {
				return
			}
			if until, ok := skip[rec.Name]; ok && time.Now().Before(until) {
				continue
			}
			b, err := m.o.DB.Read().GetBucket(ctx, rec.Name)
			if err != nil || b.Generation != rec.Generation || b.Epoch != rec.Epoch {
				continue // not held here (missing, or an orphan): nothing to move
			}
			// a move of this bucket that an admin started is waited for, not duplicated
			if open, _ := m.o.DB.Read().ListMoves(ctx, meta.MoveFilter{Bucket: rec.Name, Open: true, Limit: 1}); len(open) > 0 {
				m.waitFinal(ctx, open[0].ID)
				moved = true
				continue
			}
			target, ok := m.pickTarget(ctx, b)
			if !ok {
				if time.Since(m.drainWarned[rec.Name]) > time.Minute {
					m.drainWarned[rec.Name] = time.Now()
					m.log.Warn("drain: no other node can take the bucket now; waiting", "bucket", rec.Name)
				}
				return
			}
			row, err := m.enqueue(ctx, b, target.ID, 0)
			if err != nil {
				skip[rec.Name] = time.Now().Add(30 * time.Second)
				continue
			}
			m.log.Info("drain: moving a bucket away", "bucket", rec.Name, "to", target.Name, "move", row.ID)
			final := m.waitFinal(ctx, row.ID)
			moved = true
			if final == nil || final.State != meta.MoveDone {
				skip[rec.Name] = time.Now().Add(30 * time.Second)
				if final != nil {
					m.log.Warn("drain: the move of a bucket did not complete; it is tried again later", "bucket", rec.Name, "move", row.ID, "state", final.State, "error", final.Error)
				}
			}
		}
		if !moved {
			return // every bucket left is held back: look again at the next poll
		}
	}
}

// pickTarget picks the node `auto` placement gives a bucket of this node's: the one
// with the most free disk that can take it (never this node).
func (m *Mover) pickTarget(ctx context.Context, b *meta.Bucket) (target struct {
	ID, Name string
}, ok bool) {
	keyIDs, err := m.sealedKeyIDs(ctx, b)
	if err != nil {
		return target, false
	}
	need := m.bucketBytes(ctx, b)
	for _, p := range m.o.Node.Placement() {
		if p.ID == m.selfID() {
			continue
		}
		if why, _ := m.targetProblem(p, need, keyIDs); why == "" {
			target.ID, target.Name = p.ID, p.Name
			return target, true
		}
	}
	return target, false
}

// waitFinal waits until the move has ended (nil if the mover closes first).
func (m *Mover) waitFinal(ctx context.Context, id string) *meta.Move {
	for {
		row, err := m.o.DB.Read().GetMove(ctx, id)
		if err == nil && row.Final() {
			return row
		}
		if !m.sleep(ctx, 100*time.Millisecond) {
			return nil
		}
	}
}
