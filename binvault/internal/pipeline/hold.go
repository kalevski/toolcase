package pipeline

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// Holds. The time a pipeline, or one of its attachments, spends disabled or
// paused does not count toward a queued run's 24 hours of retrying (spec
// §7.10). The start of a hold is kept in the node's kv table and settled in the
// transaction of the change that starts or ends it: a restart forgets nothing,
// and no run can be claimed between the release and the shift of its window.

const (
	pipelineHoldPrefix   = "hold/p/"
	attachmentHoldPrefix = "hold/a/"
)

func pipelineHoldKey(pipeline string) string { return pipelineHoldPrefix + pipeline }

func attachmentHoldKey(bucket, pipeline string) string {
	return attachmentHoldPrefix + bucket + "/" + pipeline
}

// settleHold records that what is kept under key is now held or not. When it has
// just been released it returns how long it was held.
func settleHold(ctx context.Context, tx *meta.Tx, key string, held bool, now time.Time) (time.Duration, error) {
	since, err := tx.KVGet(ctx, key)
	if err != nil && !errors.Is(err, meta.ErrNotFound) {
		return 0, err
	}
	was := err == nil
	switch {
	case held && !was:
		return 0, tx.KVSet(ctx, key, strconv.FormatInt(now.UnixMilli(), 10))
	case !held && was:
		var d time.Duration
		if ms, err := strconv.ParseInt(since, 10, 64); err == nil {
			d = now.Sub(time.UnixMilli(ms))
		}
		return max(d, 0), tx.KVDelete(ctx, key)
	}
	return 0, nil
}

// settlePipelineHold settles the hold of a pipeline whose definition was just
// stored and moves the retry window of its queued runs by the time it was held.
func (m *Manager) settlePipelineHold(ctx context.Context, tx *meta.Tx, def Definition) error {
	d, err := settleHold(ctx, tx, pipelineHoldKey(def.Name), !def.Enabled || def.Paused, m.Now())
	if err != nil || d <= 0 {
		return err
	}
	return tx.ShiftRunnableSince(ctx, def.Name, d)
}

// settleAttachmentHold is settlePipelineHold for an attachment.
func (m *Manager) settleAttachmentHold(ctx context.Context, tx *meta.Tx, a meta.Attachment) error {
	d, err := settleHold(ctx, tx, attachmentHoldKey(a.Bucket, a.Pipeline), !a.Enabled, m.Now())
	if err != nil || d <= 0 {
		return err
	}
	return tx.ShiftRunnableSinceIn(ctx, a.Bucket, a.Pipeline, d)
}
