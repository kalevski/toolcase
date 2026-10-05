package meta

import (
	"context"
	"database/sql"
)

// A WriteGate lets a bucket be frozen for a move (spec §8.8). The committer asks
// it before it runs the function of a write whose context names a bucket
// (WithBucket): the gate either refuses the write, or lets it run and is told when
// it has finished. Writes without a bucket in their context (workers, cluster
// bookkeeping) are not asked.
type WriteGate func(ctx context.Context, bucket string) (exit func(), err error)

type gateHolder struct{ g WriteGate }

// SetWriteGate installs the gate (nil removes it). It is meant to be set once,
// before the node serves.
func (d *DB) SetWriteGate(g WriteGate) {
	if g == nil {
		d.gate.Store(nil)
		return
	}
	d.gate.Store(&gateHolder{g})
}

func (d *DB) writeGate() WriteGate {
	if h := d.gate.Load(); h != nil {
		return h.g
	}
	return nil
}

type bucketCtxKey struct{}

// WithBucket tags a context with the bucket a write acts on, so that the write
// gate can see it.
func WithBucket(ctx context.Context, bucket string) context.Context {
	return context.WithValue(ctx, bucketCtxKey{}, bucket)
}

// BucketFrom is the bucket a context was tagged with ("" if none).
func BucketFrom(ctx context.Context) string {
	b, _ := ctx.Value(bucketCtxKey{}).(string)
	return b
}

// ReadTx runs fn on one read transaction: a consistent snapshot of every table,
// whatever happens to the database meanwhile.
func (d *DB) ReadTx(ctx context.Context, fn func(q Q) error) error {
	tx, err := d.r.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return err
	}
	defer tx.Rollback()
	return fn(Q{tx})
}
