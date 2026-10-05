package engine

import (
	"context"
	"errors"

	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// ExpireItem is one lifecycle action: it names the exact version row it
// selected, and is skipped if that row changed since (spec §3.12).
type ExpireItem struct {
	Key string
	Seq int64
	// Remove permanently removes the row (noncurrent versions, lone delete
	// markers; raises no event). Otherwise the current version expires like a
	// delete: removed in an unversioned bucket, a marker added in a versioned
	// one, raising object.deleted with operation=lifecycle.
	Remove bool
}

// ExpireBatch applies lifecycle actions in one transaction and returns how many
// were applied (skipped ones are not counted).
func (e *Engine) ExpireBatch(ctx context.Context, bucket string, items []ExpireItem) (int, error) {
	applied := 0
	var events []*Event
	err := e.DB.Update(ctx, func(tx *meta.Tx) error {
		applied, events = 0, nil
		for _, it := range items {
			if it.Remove {
				ok, err := e.removeRow(ctx, tx, bucket, it)
				if err != nil {
					return err
				}
				if ok {
					applied++
				}
				continue
			}
			res, err := e.deleteTx(ctx, tx, &DeleteRequest{
				Bucket: bucket, Key: it.Key, IfSeq: it.Seq, Op: "lifecycle",
				Actor: Actor{Kind: "lifecycle", ID: "lifecycle", Name: "lifecycle"},
			})
			if err != nil {
				return err
			}
			if !res.Skipped && res.Existed {
				applied++
				if res.Event != nil {
					events = append(events, res.Event)
				}
			}
		}
		return nil
	})
	if err != nil {
		return 0, wrapErr(err)
	}
	for _, ev := range events {
		e.afterEvent(ev)
	}
	return applied, nil
}

// removeRow removes one version row that is still what lifecycle selected: a
// noncurrent version, or the current delete marker that is the key's only row.
func (e *Engine) removeRow(ctx context.Context, tx *meta.Tx, bucket string, it ExpireItem) (bool, error) {
	o, err := tx.GetBySeq(ctx, it.Seq)
	if err != nil {
		if errors.Is(err, meta.ErrNotFound) {
			return false, nil
		}
		return false, err
	}
	if o.Bucket != bucket || o.Key != it.Key {
		return false, nil
	}
	if o.IsLatest {
		// only a lone delete marker may be removed while current
		if !o.DeleteMarker {
			return false, nil
		}
		vs, err := tx.VersionsOf(ctx, bucket, it.Key)
		if err != nil {
			return false, err
		}
		if len(vs) != 1 {
			return false, nil
		}
	}
	var d meta.Counters
	if err := e.dropRow(ctx, tx, o, &d); err != nil {
		return false, err
	}
	if err := tx.AddCounters(ctx, bucket, d); err != nil {
		return false, err
	}
	return true, nil
}
