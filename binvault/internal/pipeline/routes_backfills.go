package pipeline

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/admin"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/ulid"
)

const backfillPrefix = "bf_"

// backfillJSON is a backfill as the API shows it (spec §6.8).
type backfillJSON struct {
	ID             string     `json:"id"`
	Bucket         string     `json:"bucket"`
	Pipeline       string     `json:"pipeline"`
	Prefix         string     `json:"prefix"`
	ModifiedAfter  *time.Time `json:"modified_after"`
	ModifiedBefore *time.Time `json:"modified_before"`
	State          string     `json:"state"`
	Scanned        int64      `json:"scanned"`
	Enqueued       int64      `json:"enqueued"`
	Cursor         string     `json:"cursor"`
	Error          *string    `json:"error"`
	CreatedAt      time.Time  `json:"created_at"`
	FinishedAt     *time.Time `json:"finished_at"`
}

func backfillView(b *meta.Backfill) backfillJSON {
	return backfillJSON{
		ID: b.ID, Bucket: b.Bucket, Pipeline: b.Pipeline, Prefix: b.Prefix, ModifiedAfter: admin.WireTimePtr(b.ModifiedAfter),
		ModifiedBefore: admin.WireTimePtr(b.ModifiedBefore), State: b.State, Scanned: b.Scanned, Enqueued: b.Enqueued, Cursor: b.Cursor,
		Error: nilIfEmpty(b.Error), CreatedAt: admin.WireTime(b.CreatedAt), FinishedAt: admin.WireTimePtr(b.FinishedAt),
	}
}

type backfillBody struct {
	Bucket         string     `json:"bucket"`
	Pipeline       string     `json:"pipeline"`
	Prefix         string     `json:"prefix"`
	ModifiedAfter  *time.Time `json:"modified_after"`
	ModifiedBefore *time.Time `json:"modified_before"`
}

// createBackfill starts a backfill (spec §6.8): the pipeline must be an enabled
// after pipeline, attached (and enabled) in the bucket and subscribed to
// object.created, the event a backfill raises.
func (m *Manager) createBackfill(rc *admin.Ctx) error {
	var body backfillBody
	if err := rc.Decode(&body); err != nil {
		return err
	}
	fields := map[string]string{}
	if body.Bucket == "" {
		fields["bucket"] = "required"
	}
	if body.Pipeline == "" {
		fields["pipeline"] = "required"
	}
	if body.ModifiedAfter != nil && body.ModifiedBefore != nil && !body.ModifiedAfter.Before(*body.ModifiedBefore) {
		fields["modified_before"] = "must be later than modified_after"
	}
	if len(fields) > 0 {
		return admin.Invalid("invalid backfill", fields)
	}
	q := m.db.Read()
	if _, err := q.GetBucket(rc.Ctx, body.Bucket); err != nil {
		return bucketErr(err, body.Bucket)
	}
	end, err := gated(rc, body.Bucket)
	if err != nil {
		return err
	}
	defer end()
	p, err := m.pipe(rc.Ctx, q, body.Pipeline)
	if err != nil {
		return admin.Internal(err)
	}
	if p == nil {
		return admin.NotFound(fmt.Sprintf("pipeline %q does not exist", body.Pipeline))
	}
	switch {
	case p.Before():
		return admin.Conflict("a backfill runs an after pipeline; " + p.Name() + " is a before pipeline")
	case !p.Def.Enabled:
		return admin.Conflict("pipeline " + p.Name() + " is disabled")
	case !p.Subscribes(EventCreated):
		return admin.Conflict("pipeline " + p.Name() + " is not subscribed to object.created, the event a backfill raises")
	}
	att, err := q.GetAttachment(rc.Ctx, body.Bucket, body.Pipeline)
	if errors.Is(err, meta.ErrNotFound) {
		return admin.Conflict("pipeline " + p.Name() + " is not attached to bucket " + body.Bucket)
	}
	if err != nil {
		return admin.Internal(err)
	}
	if !att.Enabled {
		return admin.Conflict("the attachment of " + p.Name() + " to bucket " + body.Bucket + " is disabled")
	}
	bf := &meta.Backfill{
		ID: backfillPrefix + ulid.New(), Bucket: body.Bucket, Pipeline: body.Pipeline, Prefix: body.Prefix,
		ModifiedAfter: body.ModifiedAfter, ModifiedBefore: body.ModifiedBefore, State: meta.BackfillRunning,
	}
	if err := m.db.Update(rc.Ctx, func(tx *meta.Tx) error { return tx.CreateBackfill(rc.Ctx, bf) }); err != nil {
		return admin.Internal(err)
	}
	m.bf.start(bf)
	admin.WriteJSON(rc.W, http.StatusAccepted, backfillView(bf))
	return nil
}

func (m *Manager) listBackfills(rc *admin.Ctx) error {
	limit, cursor, err := admin.PageParams(rc.R)
	if err != nil {
		return err
	}
	list, err := m.db.Read().ListBackfills(rc.Ctx, cursor, limit+1)
	if err != nil {
		return admin.Internal(err)
	}
	var next any
	if len(list) > limit {
		list = list[:limit]
		next = list[len(list)-1].ID
	}
	items := make([]backfillJSON, len(list))
	for i, b := range list {
		items[i] = backfillView(b)
	}
	admin.WriteJSON(rc.W, http.StatusOK, map[string]any{"items": items, "next_cursor": next})
	return nil
}

func (m *Manager) getBackfill(rc *admin.Ctx, id string) error {
	b, err := m.db.Read().GetBackfill(rc.Ctx, id)
	if err != nil {
		return backfillErr(err, id)
	}
	admin.WriteJSON(rc.W, http.StatusOK, backfillView(b))
	return nil
}

func backfillErr(err error, id string) error {
	if errors.Is(err, meta.ErrNotFound) {
		return admin.NotFound(fmt.Sprintf("backfill %q does not exist", id))
	}
	return admin.Internal(err)
}

// cancelBackfill stops the walk; the runs it already queued continue unless
// cancelled individually (spec §6.8).
func (m *Manager) cancelBackfill(rc *admin.Ctx, id string) error {
	bf, err := m.db.Read().GetBackfill(rc.Ctx, id)
	if err != nil {
		return backfillErr(err, id)
	}
	end, err := gated(rc, bf.Bucket)
	if err != nil {
		return err
	}
	defer end()
	var was bool
	if err := m.db.Update(rc.Ctx, func(tx *meta.Tx) (err error) {
		was, err = tx.CancelBackfill(rc.Ctx, id, tx.Now())
		return err
	}); err != nil {
		return admin.Internal(err)
	}
	if !was {
		return admin.Conflict("the backfill is not running")
	}
	m.bf.cancel(id)
	return m.getBackfill(rc, id)
}
