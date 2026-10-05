package pipeline

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/kalevski/toolcase/binvault/internal/admin"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// attachmentJSON is an attachment as the API shows it (spec §6.6).
type attachmentJSON struct {
	Pipeline string `json:"pipeline"`
	Stage    string `json:"stage"`
	Enabled  bool   `json:"enabled"`
	Match    Match  `json:"match"`
}

func (m *Manager) attachmentView(a attEntry) attachmentJSON {
	v := attachmentJSON{Pipeline: a.Pipeline, Enabled: a.Enabled, Match: a.match}
	if p := m.pipes.get(a.Pipeline); p != nil {
		v.Stage = p.Def.Stage
	}
	return v
}

type attachmentsOut struct {
	Items    []attachmentJSON `json:"items"`
	Revision int64            `json:"revision"`
}

func (m *Manager) attachmentsView(s *attSet) attachmentsOut {
	out := attachmentsOut{Items: make([]attachmentJSON, 0, len(s.items)), Revision: s.rev}
	for _, a := range s.items {
		out.Items = append(out.Items, m.attachmentView(a))
	}
	return out
}

func (m *Manager) getAttachments(rc *admin.Ctx, bucket string) error {
	if _, err := m.db.Read().GetBucket(rc.Ctx, bucket); err != nil {
		return bucketErr(err, bucket)
	}
	set, err := m.attachments(rc.Ctx, m.db.Read(), bucket, 0)
	if err != nil {
		return admin.Internal(err)
	}
	admin.WriteJSON(rc.W, http.StatusOK, m.attachmentsView(set))
	return nil
}

func bucketErr(err error, bucket string) error {
	if errors.Is(err, meta.ErrNotFound) {
		return admin.NotFound(fmt.Sprintf("bucket %q does not exist", bucket))
	}
	return admin.Internal(err)
}

// attachmentIn is one item of the PUT body; Stage is read-only and accepted so
// that a GET response can be sent back as it is.
type attachmentIn struct {
	Pipeline string `json:"pipeline"`
	Enabled  *bool  `json:"enabled"`
	Match    Match  `json:"match"`
	Stage    string `json:"stage"`
}

type attachmentsIn struct {
	Items    []attachmentIn `json:"items"`
	Revision int64          `json:"revision"`
}

// putAttachments replaces the bucket's whole ordered list atomically (spec
// §6.6). Array order is execution order, separately within each stage.
func (m *Manager) putAttachments(rc *admin.Ctx, bucket string) error {
	rev, err := ifMatch(rc.R)
	if err != nil {
		return err
	}
	var body attachmentsIn
	if err := rc.Decode(&body); err != nil {
		return err
	}
	if _, err := m.db.Read().GetBucket(rc.Ctx, bucket); err != nil {
		return bucketErr(err, bucket)
	}

	fields := map[string]string{}
	if len(body.Items) > MaxAttachments {
		fields["items"] = fmt.Sprintf("at most %d attachments", MaxAttachments)
	}
	seen := map[string]bool{}
	enabledBefore := 0
	rows := make([]meta.Attachment, 0, len(body.Items))
	for i, it := range body.Items {
		at := func(f, msg string) { fields[fmt.Sprintf("items[%d].%s", i, f)] = msg }
		if it.Pipeline == "" {
			at("pipeline", "required")
			continue
		}
		if seen[it.Pipeline] {
			at("pipeline", fmt.Sprintf("%q is listed twice", it.Pipeline))
			continue
		}
		seen[it.Pipeline] = true
		p, err := m.pipe(rc.Ctx, m.db.Read(), it.Pipeline)
		if err != nil {
			return admin.Internal(err)
		}
		if p == nil {
			at("pipeline", fmt.Sprintf("pipeline %q does not exist", it.Pipeline))
			continue
		}
		enabled := it.Enabled == nil || *it.Enabled
		if enabled && p.Before() {
			enabledBefore++
		}
		sub := map[string]string{}
		it.Match.validate(fmt.Sprintf("items[%d].match", i), p.Def.Stage, sub)
		for k, v := range sub {
			fields[k] = v
		}
		rows = append(rows, meta.Attachment{
			Bucket: bucket, Pipeline: it.Pipeline, Generation: p.Generation, Enabled: enabled, Match: mustJSON(it.Match),
		})
	}
	if enabledBefore > MaxEnabledBefore {
		fields["items"] = fmt.Sprintf("at most %d enabled before attachments (%d given)", MaxEnabledBefore, enabledBefore)
	}
	if len(fields) > 0 {
		return admin.Invalid("invalid attachments", fields)
	}

	var newRev int64
	var refs []meta.RunRef
	err = m.db.Update(rc.Ctx, func(tx *meta.Tx) error {
		old, err := tx.ListAttachments(rc.Ctx, bucket)
		if err != nil {
			return err
		}
		if newRev, err = tx.ReplaceAttachments(rc.Ctx, bucket, rows, rev); err != nil {
			return err
		}
		// a pipeline taken out of the bucket drops its queued runs there
		for _, o := range old {
			if seen[o.Pipeline] {
				continue
			}
			r, err := tx.CancelRuns(rc.Ctx, meta.RunFilter{Bucket: bucket, Pipeline: o.Pipeline}, ReasonAttachmentRemoved, tx.Now())
			if err != nil {
				return err
			}
			refs = append(refs, r...)
			if err := tx.KVDelete(rc.Ctx, attachmentHoldKey(bucket, o.Pipeline)); err != nil {
				return err
			}
		}
		// an attachment enabled again after being disabled: the time it was off does
		// not count toward its queued runs' 24 hours of retrying (spec §7.10)
		for _, a := range rows {
			if err := m.settleAttachmentHold(rc.Ctx, tx, a); err != nil {
				return err
			}
		}
		return nil
	})
	switch {
	case errors.Is(err, meta.ErrNotFound):
		return admin.NotFound(fmt.Sprintf("bucket %q does not exist", bucket))
	case errors.Is(err, meta.ErrConflict):
		return admin.Precondition("the attachments were changed by someone else; read them again")
	case err != nil:
		return admin.Internal(err)
	}
	set := &attSet{rev: newRev, items: make([]attEntry, len(rows))}
	for i, a := range rows {
		set.items[i] = newAttEntry(a)
	}
	m.atts.set(bucket, set)
	for _, r := range refs {
		m.mt.runs.Inc(r.Pipeline, r.Stage, meta.RunCancelled)
	}
	m.notify()
	// a cluster: the bucket's catalog entry names its attached pipelines (spec §8.7)
	if err := m.PublishAttachments(context.WithoutCancel(rc.Ctx), bucket); err != nil {
		return catalogErr(err)
	}
	admin.WriteJSON(rc.W, http.StatusOK, m.attachmentsView(set))
	return nil
}
