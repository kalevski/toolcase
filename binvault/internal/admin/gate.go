package admin

import (
	"context"
	"errors"
	"fmt"

	"github.com/kalevski/toolcase/binvault/internal/engine"
)

// GateWrite admits an admin call that changes a bucket (its settings, tokens,
// attachments, backfills, runs): while the bucket is frozen or paused for a move
// (spec §8.8) the call is refused with 503 `unavailable` and Retry-After: 1, like a
// write on the S3 listener. On success it returns a context tagged with the bucket —
// the database writes of the call then meet the same gate — and the func that ends
// the admission; call it when the call is done. Without a gate (a single node's
// engine always has one; tests may not) every call is admitted.
func (rc *Ctx) GateWrite(bucket string) (context.Context, func(), error) {
	if rc.S == nil || rc.S.Eng == nil || rc.S.Eng.Gate == nil {
		return rc.Ctx, func() {}, nil
	}
	ctx, end, err := rc.S.Eng.Gate.Begin(rc.Ctx, bucket, true)
	if err != nil {
		if errors.Is(err, engine.ErrFrozen) || errors.Is(err, context.Canceled) {
			rc.W.Header().Set("Retry-After", "1")
			return rc.Ctx, func() {}, unavailable(fmt.Sprintf("bucket %q is being moved to another node: retry in a moment", bucket))
		}
		return rc.Ctx, func() {}, err
	}
	return ctx, end, nil
}

// TryGateWrite is GateWrite for a call that applies to many buckets (a bulk run
// cancel by pipeline): a bucket that is frozen or paused for a move is not an
// error of the call but a bucket it leaves alone (ok is false, and so is the
// returned func a no-op). The returned context is tagged with the bucket, so that
// the changes the call makes to it meet the gate in the committer too: a bucket
// that freezes meanwhile ends them (engine.ErrFrozen).
func (rc *Ctx) TryGateWrite(bucket string) (ctx context.Context, end func(), ok bool, err error) {
	if rc.S == nil || rc.S.Eng == nil || rc.S.Eng.Gate == nil {
		return rc.Ctx, func() {}, true, nil
	}
	ctx, end, err = rc.S.Eng.Gate.Begin(rc.Ctx, bucket, true)
	switch {
	case err == nil:
		return ctx, end, true, nil
	case errors.Is(err, engine.ErrFrozen):
		return rc.Ctx, func() {}, false, nil
	}
	return rc.Ctx, func() {}, false, err
}
