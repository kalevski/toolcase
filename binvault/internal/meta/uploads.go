package meta

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"
)

const uploadCols = `upload_id, bucket, key, initiated_at, updated_at, state, completed_at, encrypted, headers, metadata, tags,
checksum_algo, checksum_type, storage_class, actor, complete_hash, complete_result`

func scanUpload(s rowScanner) (*Upload, error) {
	var u Upload
	var initiated, updated int64
	var completed sql.NullInt64
	var enc int
	var headers, md, tags, actor, result string
	if err := s.Scan(&u.UploadID, &u.Bucket, &u.Key, &initiated, &updated, &u.State, &completed, &enc, &headers, &md, &tags,
		&u.ChecksumAlgo, &u.ChecksumType, &u.StorageClass, &actor, &u.CompleteHash, &result); err != nil {
		return nil, err
	}
	u.InitiatedAt, u.UpdatedAt = fromMS(initiated), fromMS(updated)
	if completed.Valid {
		t := fromMS(completed.Int64)
		u.CompletedAt = &t
	}
	u.Encrypted = enc == 1
	_ = json.Unmarshal([]byte(headers), &u.Headers)
	_ = json.Unmarshal([]byte(md), &u.Metadata)
	_ = json.Unmarshal([]byte(tags), &u.Tags)
	if actor != "" {
		u.Actor = json.RawMessage(actor)
	}
	if result != "" {
		u.CompleteResult = json.RawMessage(result)
	}
	return &u, nil
}

// UploadKnown reports whether an upload row exists (orphan sweeper).
func (q Q) UploadKnown(ctx context.Context, id string) (bool, error) {
	var one int
	err := q.q.QueryRowContext(ctx, `SELECT 1 FROM uploads WHERE upload_id=?`, id).Scan(&one)
	if isNoRows(err) {
		return false, nil
	}
	return err == nil, err
}

// GetUpload loads an upload.
func (q Q) GetUpload(ctx context.Context, id string) (*Upload, error) {
	u, err := scanUpload(q.q.QueryRowContext(ctx, `SELECT `+uploadCols+` FROM uploads WHERE upload_id=?`, id))
	if isNoRows(err) {
		return nil, ErrNotFound
	}
	return u, err
}

// CountOpenUploads counts open uploads of a bucket ("" = all buckets).
func (q Q) CountOpenUploads(ctx context.Context, bucket string) (int64, error) {
	var n int64
	var err error
	if bucket == "" {
		err = q.q.QueryRowContext(ctx, `SELECT COUNT(*) FROM uploads WHERE state='open'`).Scan(&n)
	} else {
		err = q.q.QueryRowContext(ctx, `SELECT COUNT(*) FROM uploads WHERE state='open' AND bucket=?`, bucket).Scan(&n)
	}
	return n, err
}

// CreateUpload inserts an open upload.
func (t *Tx) CreateUpload(ctx context.Context, u *Upload) error {
	now := ms(t.now)
	if u.InitiatedAt.IsZero() {
		u.InitiatedAt = t.now
	}
	u.UpdatedAt = u.InitiatedAt
	u.State = "open"
	actor := string(u.Actor)
	if actor == "" {
		actor = "{}"
	}
	_ = now
	_, err := t.q.ExecContext(ctx, `INSERT INTO uploads (`+uploadCols+`) VALUES (?,?,?,?,?,'open',NULL,?,?,?,?,?,?,?,?,'','')`,
		u.UploadID, u.Bucket, u.Key, ms(u.InitiatedAt), ms(u.UpdatedAt), boolInt(u.Encrypted),
		jsonText(u.Headers, "{}"), jsonText(u.Metadata, "{}"), jsonText(u.Tags, "{}"),
		u.ChecksumAlgo, u.ChecksumType, u.StorageClass, actor)
	return err
}

// TouchUpload bumps updated_at (every part upload).
func (t *Tx) TouchUpload(ctx context.Context, id string) error {
	_, err := t.q.ExecContext(ctx, `UPDATE uploads SET updated_at=? WHERE upload_id=?`, ms(t.now), id)
	return err
}

// MarkUploadEncrypted flips the encrypted flag (an UploadPartCopy from an
// encrypted source makes the whole upload encrypted, spec §3.11).
func (t *Tx) MarkUploadEncrypted(ctx context.Context, id string) error {
	_, err := t.q.ExecContext(ctx, `UPDATE uploads SET encrypted=1 WHERE upload_id=?`, id)
	return err
}

// CompleteUpload records a finished upload so a retried Complete can answer the
// same result (spec §5.6).
func (t *Tx) CompleteUpload(ctx context.Context, id, hash string, result []byte) error {
	_, err := t.q.ExecContext(ctx, `UPDATE uploads SET state='completed', completed_at=?, complete_hash=?, complete_result=? WHERE upload_id=?`,
		ms(t.now), hash, string(result), id)
	return err
}

// DeleteUpload removes an upload row (parts cascade).
func (t *Tx) DeleteUpload(ctx context.Context, id string) error {
	_, err := t.q.ExecContext(ctx, `DELETE FROM uploads WHERE upload_id=?`, id)
	return err
}

// uploadOrder is the order uploads are listed in: by key, then (as S3 does) by
// initiation time; the upload id only breaks ties.
const uploadOrder = `ORDER BY key, initiated_at, upload_id`

// ListUploads returns open uploads of a bucket in uploadOrder, starting after
// (keyMarker, uploadMarker): the uploads of keyMarker that were initiated after
// the marker upload (or at the same moment with a greater id) and every later
// key. When the marker upload is gone (aborted or completed since the last page,
// as a clean-up loop does), the rest of the uploads of that key are listed in
// full: a repeat is possible, a skipped upload is not.
func (q Q) ListUploads(ctx context.Context, bucket, prefix, keyMarker, uploadMarker string, limit int) ([]*Upload, error) {
	args := []any{bucket, "open"}
	where := `bucket=? AND state=?`
	if prefix != "" {
		where += ` AND key >= ?`
		args = append(args, prefix)
		if up := PrefixUpper(prefix); up != "" {
			where += ` AND key < ?`
			args = append(args, up)
		}
	}
	if keyMarker != "" {
		if uploadMarker != "" {
			var at int64
			err := q.q.QueryRowContext(ctx, `SELECT initiated_at FROM uploads WHERE upload_id=? AND bucket=? AND key=?`, uploadMarker, bucket, keyMarker).Scan(&at)
			switch {
			case err == nil:
				where += ` AND (key > ? OR (key = ? AND (initiated_at > ? OR (initiated_at = ? AND upload_id > ?))))`
				args = append(args, keyMarker, keyMarker, at, at, uploadMarker)
			case isNoRows(err):
				where += ` AND key >= ?`
				args = append(args, keyMarker)
			default:
				return nil, err
			}
		} else {
			where += ` AND key > ?`
			args = append(args, keyMarker)
		}
	}
	args = append(args, limit)
	rows, err := q.q.QueryContext(ctx, `SELECT `+uploadCols+` FROM uploads WHERE `+where+` `+uploadOrder+` LIMIT ?`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Upload
	for rows.Next() {
		u, err := scanUpload(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// ExpiredUploads lists open uploads idle since before cutoff (multipart expiry).
func (q Q) ExpiredUploads(ctx context.Context, cutoff time.Time, limit int) ([]*Upload, error) {
	return q.ExpiredUploadsAfter(ctx, cutoff, "", limit)
}

// ExpiredUploadsAfter is ExpiredUploads for the uploads whose id sorts after
// `after`, in id order: a sweep that leaves some uploads alone (those of buckets
// this node must not touch) still reaches the others.
func (q Q) ExpiredUploadsAfter(ctx context.Context, cutoff time.Time, after string, limit int) ([]*Upload, error) {
	rows, err := q.q.QueryContext(ctx, `SELECT `+uploadCols+` FROM uploads WHERE state='open' AND updated_at < ? AND upload_id > ? ORDER BY upload_id LIMIT ?`, ms(cutoff), after, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Upload
	for rows.Next() {
		u, err := scanUpload(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// OpenUploadsOlder lists open uploads initiated before cutoff in a bucket
// whose key starts with prefix (lifecycle abort_multipart_days).
func (q Q) OpenUploadsOlder(ctx context.Context, bucket string, cutoff time.Time, prefix string, limit int) ([]*Upload, error) {
	where := `bucket=? AND state='open' AND initiated_at < ?`
	args := []any{bucket, ms(cutoff)}
	if prefix != "" { // a byte range, like every other prefix query (substr would count characters)
		where += ` AND key >= ?`
		args = append(args, prefix)
		if up := PrefixUpper(prefix); up != "" {
			where += ` AND key < ?`
			args = append(args, up)
		}
	}
	args = append(args, limit)
	rows, err := q.q.QueryContext(ctx, `SELECT `+uploadCols+` FROM uploads WHERE `+where+` LIMIT ?`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Upload
	for rows.Next() {
		u, err := scanUpload(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// ListUploadsFrom lists open uploads of a bucket whose key starts with prefix,
// from key >= from (inclusive), in uploadOrder. Resuming a listing beyond a
// common prefix uses it to jump past every key beneath that prefix.
func (q Q) ListUploadsFrom(ctx context.Context, bucket, prefix, from string, limit int) ([]*Upload, error) {
	where := `bucket=? AND state='open' AND key >= ?`
	lower := from
	if prefix > lower {
		lower = prefix
	}
	args := []any{bucket, lower}
	if up := PrefixUpper(prefix); prefix != "" && up != "" {
		where += ` AND key < ?`
		args = append(args, up)
	}
	args = append(args, limit)
	rows, err := q.q.QueryContext(ctx, `SELECT `+uploadCols+` FROM uploads WHERE `+where+` `+uploadOrder+` LIMIT ?`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Upload
	for rows.Next() {
		u, err := scanUpload(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// ---- parts ------------------------------------------------------------------

const partCols = `upload_id, number, part_id, size, stored_size, etag, checksum_algo, checksum, created_at`

func scanPart(s rowScanner) (*Part, error) {
	var p Part
	var created int64
	if err := s.Scan(&p.UploadID, &p.Number, &p.PartID, &p.Size, &p.StoredSize, &p.ETag, &p.ChecksumAlgo, &p.Checksum, &created); err != nil {
		return nil, err
	}
	p.CreatedAt = fromMS(created)
	return &p, nil
}

// GetPart loads one part.
func (q Q) GetPart(ctx context.Context, uploadID string, number int) (*Part, error) {
	p, err := scanPart(q.q.QueryRowContext(ctx, `SELECT `+partCols+` FROM parts WHERE upload_id=? AND number=?`, uploadID, number))
	if isNoRows(err) {
		return nil, ErrNotFound
	}
	return p, err
}

// ListParts returns parts with number > after, ascending.
func (q Q) ListParts(ctx context.Context, uploadID string, after, limit int) ([]*Part, error) {
	rows, err := q.q.QueryContext(ctx, `SELECT `+partCols+` FROM parts WHERE upload_id=? AND number>? ORDER BY number LIMIT ?`, uploadID, after, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Part
	for rows.Next() {
		p, err := scanPart(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// PutPart inserts or replaces a part and returns the replaced row, if any (so
// the caller can delete its file and adjust upload_bytes).
func (t *Tx) PutPart(ctx context.Context, p *Part) (replaced *Part, err error) {
	old, err := scanPart(t.q.QueryRowContext(ctx, `SELECT `+partCols+` FROM parts WHERE upload_id=? AND number=?`, p.UploadID, p.Number))
	if err != nil && !isNoRows(err) {
		return nil, err
	}
	if isNoRows(err) {
		old = nil
	}
	if p.CreatedAt.IsZero() {
		p.CreatedAt = t.now
	}
	_, err = t.q.ExecContext(ctx, `INSERT OR REPLACE INTO parts (`+partCols+`) VALUES (?,?,?,?,?,?,?,?,?)`,
		p.UploadID, p.Number, p.PartID, p.Size, p.StoredSize, p.ETag, p.ChecksumAlgo, p.Checksum, ms(p.CreatedAt))
	return old, err
}

// UploadPartTotals returns the byte total and count of an upload's parts.
func (q Q) UploadPartTotals(ctx context.Context, uploadID string) (bytes, count int64, err error) {
	err = q.q.QueryRowContext(ctx, `SELECT COALESCE(SUM(size),0), COUNT(*) FROM parts WHERE upload_id=?`, uploadID).Scan(&bytes, &count)
	return
}

// DeleteParts removes an upload's part rows (the upload row stays).
func (t *Tx) DeleteParts(ctx context.Context, uploadID string) error {
	_, err := t.q.ExecContext(ctx, `DELETE FROM parts WHERE upload_id=?`, uploadID)
	return err
}

// PruneCompletedUploads deletes completed-upload records older than cutoff
// (the idempotency window for retried Complete calls, spec §5.6).
func (t *Tx) PruneCompletedUploads(ctx context.Context, cutoff time.Time) (int64, error) {
	res, err := t.q.ExecContext(ctx, `DELETE FROM uploads WHERE state='completed' AND completed_at < ?`, ms(cutoff))
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// OpenUploadsAfter pages through every open upload in id order (boot-time
// reconciliation of uploads/ against the database, spec §9.5).
func (q Q) OpenUploadsAfter(ctx context.Context, afterID string, limit int) ([]*Upload, error) {
	rows, err := q.q.QueryContext(ctx, `SELECT `+uploadCols+` FROM uploads WHERE state='open' AND upload_id > ? ORDER BY upload_id LIMIT ?`, afterID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Upload
	for rows.Next() {
		u, err := scanUpload(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}
