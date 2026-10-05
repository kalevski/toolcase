package engine

import (
	"context"
	"errors"

	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// SetTags replaces the tags of one version. Tag changes do not change the
// version, ETag or Last-Modified and raise no event (spec §5.7).
func (e *Engine) SetTags(ctx context.Context, bucket string, o *meta.Object, tags map[string]string) error {
	return e.SetTagsGuarded(ctx, bucket, o, tags, nil, false)
}

// SetTagsGuarded is SetTags under the stale-write guard of an after run's token
// (spec §7.8): unless the request pins the event's version (pinned), tagging
// the triggering key requires the key's live version to still be the one the
// event is about, checked in the same transaction as the change.
func (e *Engine) SetTagsGuarded(ctx context.Context, bucket string, o *meta.Object, tags map[string]string, g *Guard, pinned bool) error {
	if err := ValidateTags(tags); err != nil {
		return err
	}
	err := e.DB.Update(ctx, func(tx *meta.Tx) error {
		if g.Applies(o.Key) && !pinned {
			latest, err := tx.GetLatest(ctx, bucket, o.Key)
			if err != nil && !errors.Is(err, meta.ErrNotFound) {
				return err
			}
			if err != nil {
				latest = nil
			}
			if err := g.Check(latest); err != nil {
				return err
			}
		}
		cur, err := tx.GetBySeq(ctx, o.Seq)
		if err != nil {
			if errors.Is(err, meta.ErrNotFound) {
				return noSuchKey(o.Key)
			}
			return err
		}
		if cur == nil || cur.DeleteMarker {
			return noSuchKey(o.Key)
		}
		return tx.SetObjectTags(ctx, o.Seq, tags)
	})
	return wrapErr(err)
}
