package meta

import (
	"context"
	"strings"
	"time"
)

// Pipeline is one stored pipeline definition (spec §7.2). Definition is the
// JSON document with every secret redacted; the secrets themselves live
// sealed in HeadersSealed (the service.headers values, as one JSON object) and
// SigningSealed (service.signing_secret) (spec §4.7).
type Pipeline struct {
	Name          string
	Generation    string
	Revision      int64
	Stage         string
	Definition    string
	HeadersSealed []byte
	SigningSealed []byte
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

const pipelineCols = `name, generation, revision, stage, definition, headers_sealed, signing_secret_sealed, created_at, updated_at`

func scanPipeline(s rowScanner) (*Pipeline, error) {
	var p Pipeline
	var created, updated int64
	if err := s.Scan(&p.Name, &p.Generation, &p.Revision, &p.Stage, &p.Definition, &p.HeadersSealed, &p.SigningSealed, &created, &updated); err != nil {
		return nil, err
	}
	p.CreatedAt, p.UpdatedAt = fromMS(created), fromMS(updated)
	return &p, nil
}

// GetPipeline loads a pipeline by name (ErrNotFound if absent).
func (q Q) GetPipeline(ctx context.Context, name string) (*Pipeline, error) {
	p, err := scanPipeline(q.q.QueryRowContext(ctx, `SELECT `+pipelineCols+` FROM pipelines WHERE name=?`, name))
	if isNoRows(err) {
		return nil, ErrNotFound
	}
	return p, err
}

// ListPipelines lists pipelines with name > after, ordered by name. limit <= 0
// means no limit.
func (q Q) ListPipelines(ctx context.Context, after string, limit int) ([]*Pipeline, error) {
	if limit <= 0 {
		limit = 1 << 30
	}
	rows, err := q.q.QueryContext(ctx, `SELECT `+pipelineCols+` FROM pipelines WHERE name > ? ORDER BY name LIMIT ?`, after, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Pipeline
	for rows.Next() {
		p, err := scanPipeline(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// CountPipelines counts the defined pipelines.
func (q Q) CountPipelines(ctx context.Context) (int64, error) {
	var n int64
	err := q.q.QueryRowContext(ctx, `SELECT COUNT(*) FROM pipelines`).Scan(&n)
	return n, err
}

// CreatePipeline inserts a pipeline (ErrExists if the name is taken).
func (t *Tx) CreatePipeline(ctx context.Context, p *Pipeline) error {
	if p.Revision == 0 {
		p.Revision = 1
	}
	if p.CreatedAt.IsZero() {
		p.CreatedAt = t.now
	}
	p.UpdatedAt = p.CreatedAt
	_, err := t.q.ExecContext(ctx, `INSERT INTO pipelines (`+pipelineCols+`) VALUES (?,?,?,?,?,?,?,?,?)`,
		p.Name, p.Generation, p.Revision, p.Stage, p.Definition, p.HeadersSealed, p.SigningSealed, ms(p.CreatedAt), ms(p.UpdatedAt))
	if err != nil && strings.Contains(err.Error(), "UNIQUE") {
		return ErrExists
	}
	return err
}

// UpdatePipeline rewrites a pipeline's definition and secrets and bumps its
// revision. ifRevision > 0 must match the stored revision (ErrConflict).
func (t *Tx) UpdatePipeline(ctx context.Context, p *Pipeline, ifRevision int64) error {
	now := t.now
	res, err := t.q.ExecContext(ctx, `UPDATE pipelines SET definition=?, headers_sealed=?, signing_secret_sealed=?,
revision=revision+1, updated_at=? WHERE name=? AND (?=0 OR revision=?)`,
		p.Definition, p.HeadersSealed, p.SigningSealed, ms(now), p.Name, ifRevision, ifRevision)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		if _, gerr := t.GetPipeline(ctx, p.Name); gerr != nil {
			return gerr
		}
		return ErrConflict
	}
	p.Revision++
	p.UpdatedAt = now
	return nil
}

// SetPipelineSecrets replaces the sealed values only (rekey).
func (t *Tx) SetPipelineSecrets(ctx context.Context, name string, headers, signing []byte) error {
	_, err := t.q.ExecContext(ctx, `UPDATE pipelines SET headers_sealed=?, signing_secret_sealed=? WHERE name=?`, headers, signing, name)
	return err
}

// DeletePipeline removes a pipeline row (ErrNotFound if absent). Attachments
// are removed separately (DeleteAttachmentsOfPipeline).
func (t *Tx) DeletePipeline(ctx context.Context, name string) error {
	res, err := t.q.ExecContext(ctx, `DELETE FROM pipelines WHERE name=?`, name)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// ---- attachments (spec §6.6, §7.4) ------------------------------------------

// Attachment is one pipeline attached to a bucket. Position orders them (the
// array order of the PUT, spec §6.6); Match is the narrowing filter as JSON.
type Attachment struct {
	Bucket     string
	Position   int
	Pipeline   string
	Generation string
	Enabled    bool
	Match      string
}

const attCols = `bucket, position, pipeline, generation, enabled, match`

func scanAttachment(s rowScanner) (Attachment, error) {
	var a Attachment
	var en int
	if err := s.Scan(&a.Bucket, &a.Position, &a.Pipeline, &a.Generation, &en, &a.Match); err != nil {
		return a, err
	}
	a.Enabled = en == 1
	return a, nil
}

func (q Q) queryAttachments(ctx context.Context, query string, args ...any) ([]Attachment, error) {
	rows, err := q.q.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Attachment
	for rows.Next() {
		a, err := scanAttachment(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// ListAttachments returns a bucket's attachments in execution order.
func (q Q) ListAttachments(ctx context.Context, bucket string) ([]Attachment, error) {
	return q.queryAttachments(ctx, `SELECT `+attCols+` FROM attachments WHERE bucket=? ORDER BY position`, bucket)
}

// AttachmentsOfPipeline returns every attachment of a pipeline, across buckets.
func (q Q) AttachmentsOfPipeline(ctx context.Context, pipeline string) ([]Attachment, error) {
	return q.queryAttachments(ctx, `SELECT `+attCols+` FROM attachments WHERE pipeline=? ORDER BY bucket`, pipeline)
}

// GetAttachment returns the attachment of a pipeline in a bucket
// (ErrNotFound if it is not attached).
func (q Q) GetAttachment(ctx context.Context, bucket, pipeline string) (Attachment, error) {
	a, err := scanAttachment(q.q.QueryRowContext(ctx, `SELECT `+attCols+` FROM attachments WHERE bucket=? AND pipeline=?`, bucket, pipeline))
	if isNoRows(err) {
		return a, ErrNotFound
	}
	return a, err
}

// AttachmentsRevision is the bucket's attachment-list revision, which every
// replacement bumps: caches of the list are valid while it is unchanged.
func (q Q) AttachmentsRevision(ctx context.Context, bucket string) (int64, error) {
	var rev int64
	err := q.q.QueryRowContext(ctx, `SELECT attachments_revision FROM buckets WHERE name=?`, bucket).Scan(&rev)
	if isNoRows(err) {
		return 0, ErrNotFound
	}
	return rev, err
}

// ReplaceAttachments replaces a bucket's whole attachment list atomically and
// bumps the bucket's attachment revision, which it returns. ifRevision > 0
// must match the current revision (ErrConflict); ErrNotFound if the bucket
// does not exist.
func (t *Tx) ReplaceAttachments(ctx context.Context, bucket string, items []Attachment, ifRevision int64) (int64, error) {
	cur, err := t.AttachmentsRevision(ctx, bucket)
	if err != nil {
		return 0, err
	}
	if ifRevision > 0 && cur != ifRevision {
		return 0, ErrConflict
	}
	if _, err := t.q.ExecContext(ctx, `DELETE FROM attachments WHERE bucket=?`, bucket); err != nil {
		return 0, err
	}
	for i, a := range items {
		if _, err := t.q.ExecContext(ctx, `INSERT INTO attachments (`+attCols+`) VALUES (?,?,?,?,?,?)`,
			bucket, i, a.Pipeline, a.Generation, boolInt(a.Enabled), orJSON(a.Match)); err != nil {
			return 0, err
		}
	}
	if _, err := t.q.ExecContext(ctx, `UPDATE buckets SET attachments_revision=attachments_revision+1 WHERE name=?`, bucket); err != nil {
		return 0, err
	}
	return cur + 1, nil
}

func orJSON(s string) string {
	if s == "" {
		return "{}"
	}
	return s
}

// DeleteAttachmentsOfPipeline detaches a pipeline from every bucket (deleting
// the pipeline with ?detach=true) and returns the buckets it was attached to.
// The remaining attachments keep their relative order.
func (t *Tx) DeleteAttachmentsOfPipeline(ctx context.Context, pipeline string) ([]string, error) {
	atts, err := t.AttachmentsOfPipeline(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	var buckets []string
	for _, a := range atts {
		buckets = append(buckets, a.Bucket)
		if _, err := t.q.ExecContext(ctx, `DELETE FROM attachments WHERE bucket=? AND pipeline=?`, a.Bucket, pipeline); err != nil {
			return nil, err
		}
		// close the gap so positions stay 0..n-1 in order
		rest, err := t.ListAttachments(ctx, a.Bucket)
		if err != nil {
			return nil, err
		}
		for i, r := range rest {
			if r.Position != i {
				if _, err := t.q.ExecContext(ctx, `UPDATE attachments SET position=? WHERE bucket=? AND pipeline=?`, i, a.Bucket, r.Pipeline); err != nil {
					return nil, err
				}
			}
		}
		if _, err := t.q.ExecContext(ctx, `UPDATE buckets SET attachments_revision=attachments_revision+1 WHERE name=?`, a.Bucket); err != nil {
			return nil, err
		}
	}
	return buckets, nil
}
