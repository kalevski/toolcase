package mover

import (
	"context"
	"errors"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

var (
	errAlready  = errors.New("mover: the catalog is at or beyond that epoch")
	errStaleGen = errors.New("mover: the catalog lists another incarnation of the bucket")
)

// ensureHandoff makes the catalog say that the bucket is homed on node `home` at
// `epoch` (the hand-off op of spec §8.8 step 5): the register is rewritten only if
// it is of the same incarnation and at a lower epoch, so the epoch only ever rises
// and the same call made by the old home and by the new one — both do, whoever gets
// there first — writes the same value. It returns nil when there is nothing (left)
// to hand off: the entry is already there, was dropped, or is of another
// incarnation; an error means "try again" (the node is starting, the log could not
// be written).
func (m *Mover) ensureHandoff(ctx context.Context, bucket, generation, home string, epoch int64, wait time.Duration) error {
	op, err := m.o.Node.UpdateBucket(ctx, bucket, func(c cluster.BucketEntry) (cluster.BucketEntry, error) {
		switch {
		case c.Generation != generation:
			return c, errStaleGen
		case c.Epoch >= epoch:
			return c, errAlready
		}
		c.Home, c.Epoch = home, epoch
		return c, nil
	})
	switch {
	case err == nil:
		if wait > 0 {
			// replication normally takes well under a second: give the peers a moment, so
			// that the next request through any node already finds the new home
			m.o.Node.WaitReplicated(ctx, []cluster.Op{op}, wait)
		}
		return nil
	case errors.Is(err, errAlready):
		return nil
	case errors.Is(err, errStaleGen), errors.Is(err, cluster.ErrNotFound):
		m.log.Warn("move: the catalog no longer lists this incarnation of the bucket; nothing to hand off", "bucket", bucket)
		return nil
	}
	return err
}

// waitCatalog waits, up to d, until this node's catalog says the bucket is at `epoch`
// or beyond: the target writes the hand-off before it answers OK, and it reaches the
// old home within milliseconds. Waiting for it keeps the old home from writing the
// same op a moment before it arrives, which the catalog would report as a conflict.
func (m *Mover) waitCatalog(ctx context.Context, bucket, generation string, epoch int64, d time.Duration) {
	deadline := time.Now().Add(d)
	for i := 0; time.Now().Before(deadline); i++ {
		if rec, ok := m.o.Node.Bucket(bucket); !ok || rec.Generation != generation || rec.Epoch >= epoch {
			return
		}
		if i%5 == 4 {
			m.o.Node.SyncNow(ctx)
		}
		if !m.sleep(ctx, 20*time.Millisecond) {
			return
		}
	}
}

// handoffUntilDone repeats ensureHandoff until it succeeds, for as long as the
// mover runs: the move's decision is durable already, so the catalog must follow.
func (m *Mover) handoffUntilDone(ctx context.Context, bucket, generation, home string, epoch int64, wait time.Duration) error {
	for backoff := 200 * time.Millisecond; ; backoff = min(backoff*2, 5*time.Second) {
		err := m.ensureHandoff(ctx, bucket, generation, home, epoch, wait)
		if err == nil {
			return nil
		}
		m.log.Warn("move: writing the hand-off to the catalog failed; trying again", "bucket", bucket, "error", err)
		if !m.sleep(ctx, backoff) {
			return ctx.Err()
		}
	}
}

// restartTasks finishes what a restart left half done: the targets of moves that
// ended at start-up are told to drop their copies, and a bucket this node activated
// whose hand-off never reached the catalog (it crashed between the two) gets its
// entry written.
func (m *Mover) restartTasks() {
	m.mu.Lock()
	discards := m.discards
	m.discards = nil
	m.mu.Unlock()
	for _, mv := range discards {
		mv := mv
		m.sendDiscard(m.ctx, &mv)
	}
	ins, err := m.o.DB.Read().ListMoves(m.ctx, meta.MoveFilter{Role: meta.MoveIn, States: []string{meta.MoveActivated}, Limit: 100000})
	if err != nil {
		m.log.Warn("move: cannot list the activated moves", "error", err)
		return
	}
	for _, row := range ins {
		b, err := m.o.DB.Read().GetBucket(m.ctx, row.Bucket)
		if err != nil || b.Generation != row.Generation || b.Epoch != row.Epoch {
			continue // moved on since, or gone
		}
		if err := m.handoffUntilDone(m.ctx, row.Bucket, row.Generation, m.selfID(), row.Epoch, 0); err != nil {
			return
		}
	}
}
