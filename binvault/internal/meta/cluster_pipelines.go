package meta

import (
	"context"
	"time"
)

// This file holds the queries a cluster node needs to make its pipelines table
// follow the replicated catalog (spec §8.5, §8.7): the catalog's pipeline/<name>
// register is the truth, and each node materialises it into its own rows.

// PutPipeline inserts a pipeline row or overwrites the one of that name exactly
// as given — generation, revision and timestamps included. Unlike CreatePipeline
// and UpdatePipeline, which are the single-node admin writes, it takes every
// field from the catalog.
func (t *Tx) PutPipeline(ctx context.Context, p *Pipeline) error {
	_, err := t.q.ExecContext(ctx, `INSERT INTO pipelines (`+pipelineCols+`) VALUES (?,?,?,?,?,?,?,?,?)
ON CONFLICT(name) DO UPDATE SET generation=excluded.generation, revision=excluded.revision, stage=excluded.stage,
definition=excluded.definition, headers_sealed=excluded.headers_sealed, signing_secret_sealed=excluded.signing_secret_sealed,
created_at=excluded.created_at, updated_at=excluded.updated_at`,
		p.Name, p.Generation, p.Revision, p.Stage, p.Definition, p.HeadersSealed, p.SigningSealed, ms(p.CreatedAt), ms(p.UpdatedAt))
	return err
}

// DeleteStaleAttachments detaches a pipeline from every bucket whose attachment
// was made for another generation than keep ("" keeps none: the pipeline is
// gone) and returns those buckets. The remaining attachments keep their relative
// order and each affected bucket's attachment revision rises.
func (t *Tx) DeleteStaleAttachments(ctx context.Context, pipeline, keep string) ([]string, error) {
	atts, err := t.AttachmentsOfPipeline(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	var buckets []string
	for _, a := range atts {
		if keep != "" && a.Generation == keep {
			continue
		}
		buckets = append(buckets, a.Bucket)
		if err := t.DeleteAttachment(ctx, a.Bucket, pipeline); err != nil {
			return nil, err
		}
	}
	return buckets, nil
}

// DeleteAttachment detaches a pipeline from one bucket: the bucket's remaining
// attachments keep their relative order and its attachment revision rises.
func (t *Tx) DeleteAttachment(ctx context.Context, bucket, pipeline string) error {
	if _, err := t.q.ExecContext(ctx, `DELETE FROM attachments WHERE bucket=? AND pipeline=?`, bucket, pipeline); err != nil {
		return err
	}
	rest, err := t.ListAttachments(ctx, bucket)
	if err != nil {
		return err
	}
	for i, r := range rest {
		if r.Position != i {
			if _, err := t.q.ExecContext(ctx, `UPDATE attachments SET position=? WHERE bucket=? AND pipeline=?`, i, bucket, r.Pipeline); err != nil {
				return err
			}
		}
	}
	_, err = t.q.ExecContext(ctx, `UPDATE buckets SET attachments_revision=attachments_revision+1 WHERE name=?`, bucket)
	return err
}

// CancelStaleRuns cancels the queued runs of a pipeline that were raised for
// another generation than keep ("" cancels them all) and returns what it
// cancelled.
func (t *Tx) CancelStaleRuns(ctx context.Context, pipeline, keep, reason string, now time.Time) ([]RunRef, error) {
	if keep == "" {
		return t.closeRuns(ctx, RunCancelled, reason, now, `pipeline=?`, pipeline)
	}
	return t.closeRuns(ctx, RunCancelled, reason, now, `pipeline=? AND generation<>?`, pipeline, keep)
}

// BucketsWithAttachment lists the buckets a pipeline is attached to, whatever
// the generation of the attachment.
func (q Q) BucketsWithAttachment(ctx context.Context, pipeline string) ([]string, error) {
	atts, err := q.AttachmentsOfPipeline(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(atts))
	for _, a := range atts {
		out = append(out, a.Bucket)
	}
	return out, nil
}
