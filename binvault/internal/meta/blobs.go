package meta

import (
	"context"
	"database/sql"
)

const blobCols = `blob_id, bucket, size, plain_size, sse, refs, zero_since, created_at`

func scanBlob(s rowScanner) (*Blob, error) {
	var b Blob
	var sse int
	var zero sql.NullInt64
	var created int64
	if err := s.Scan(&b.BlobID, &b.Bucket, &b.Size, &b.PlainSize, &sse, &b.Refs, &zero, &created); err != nil {
		return nil, err
	}
	b.SSE = sse == 1
	b.CreatedAt = fromMS(created)
	if zero.Valid {
		v := fromMS(zero.Int64)
		b.ZeroSince = &v
	}
	return &b, nil
}

// GetBlob loads a blob row.
func (q Q) GetBlob(ctx context.Context, id string) (*Blob, error) {
	b, err := scanBlob(q.q.QueryRowContext(ctx, `SELECT `+blobCols+` FROM blobs WHERE blob_id=?`, id))
	if isNoRows(err) {
		return nil, ErrNotFound
	}
	return b, err
}

// BlobKnown reports whether a blob row exists.
func (q Q) BlobKnown(ctx context.Context, id string) (bool, error) {
	var one int
	err := q.q.QueryRowContext(ctx, `SELECT 1 FROM blobs WHERE blob_id=?`, id).Scan(&one)
	if isNoRows(err) {
		return false, nil
	}
	return err == nil, err
}

// InsertBlob adds a blob row with b.Refs references (normally 1).
func (t *Tx) InsertBlob(ctx context.Context, b *Blob) error {
	if b.CreatedAt.IsZero() {
		b.CreatedAt = t.now
	}
	_, err := t.q.ExecContext(ctx, `INSERT INTO blobs (`+blobCols+`) VALUES (?,?,?,?,?,?,?,?)`,
		b.BlobID, b.Bucket, b.Size, b.PlainSize, boolInt(b.SSE), b.Refs, msPtr(b.ZeroSince), ms(b.CreatedAt))
	return err
}

// RefBlob adds delta to the blob's reference count. When it reaches zero the
// blob becomes eligible for unlinking after BINVAULT_GC_GRACE (zero_since).
func (t *Tx) RefBlob(ctx context.Context, id string, delta int64) (int64, error) {
	var refs int64
	err := t.q.QueryRowContext(ctx, `UPDATE blobs SET refs = refs + ?,
zero_since = CASE WHEN refs + ? <= 0 THEN COALESCE(zero_since, ?) ELSE NULL END
WHERE blob_id=? RETURNING refs`, delta, delta, ms(t.now), id).Scan(&refs)
	if isNoRows(err) {
		return 0, ErrNotFound
	}
	return refs, err
}

// DeleteBlobRowIfCollectable removes a blob row only if it is still unreferenced and has
// been since before cutoff: the collector's check, inside the writer, of what it listed
// earlier (a blob that was taken back since — a bucket move that came back to this node
// adopts the blobs it still holds — is not collectable any more). It reports whether the
// row was removed.
func (t *Tx) DeleteBlobRowIfCollectable(ctx context.Context, id string, cutoff int64) (bool, error) {
	res, err := t.q.ExecContext(ctx, `DELETE FROM blobs WHERE blob_id=? AND refs<=0 AND zero_since IS NOT NULL AND zero_since < ?`, id, cutoff)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n == 1, err
}

// GCCandidates lists blobs whose reference count has been zero since before cutoff.
func (q Q) GCCandidates(ctx context.Context, cutoff int64, limit int) ([]*Blob, error) {
	rows, err := q.q.QueryContext(ctx, `SELECT `+blobCols+` FROM blobs WHERE refs<=0 AND zero_since IS NOT NULL AND zero_since < ? ORDER BY zero_since LIMIT ?`, cutoff, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Blob
	for rows.Next() {
		b, err := scanBlob(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// GCPending counts blobs waiting to be unlinked (metric).
func (q Q) GCPending(ctx context.Context) (int64, error) {
	var n int64
	err := q.q.QueryRowContext(ctx, `SELECT COUNT(*) FROM blobs WHERE refs<=0`).Scan(&n)
	return n, err
}

// ReleaseBucketBlobs drops this bucket's references to every blob it holds
// (forced bucket deletion, spec §6.3): all its blobs become unreferenced and
// follow the normal GC grace. Call it before DeleteBucket in the same tx.
func (t *Tx) ReleaseBucketBlobs(ctx context.Context, bucket string) error {
	_, err := t.q.ExecContext(ctx, `UPDATE blobs SET refs=0, zero_since=COALESCE(zero_since, ?) WHERE bucket=?`, ms(t.now), bucket)
	return err
}

// ListBlobIDs returns a page of blob ids (> after) for orphan sweeps and scrubbing.
func (q Q) ListBlobs(ctx context.Context, after string, limit int) ([]*Blob, error) {
	rows, err := q.q.QueryContext(ctx, `SELECT `+blobCols+` FROM blobs WHERE blob_id > ? ORDER BY blob_id LIMIT ?`, after, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Blob
	for rows.Next() {
		b, err := scanBlob(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// ScrubPage returns one version row per distinct blob with blob_id > after, in
// blob order, for the integrity scrubber (spec §3.9): the row carries the
// expected SHA-256 of the blob's plaintext.
func (q Q) ScrubPage(ctx context.Context, after string, limit int) ([]*Object, error) {
	return q.queryObjects(ctx, `SELECT `+objCols+` FROM objects WHERE blob_id > ? AND delete_marker = 0 GROUP BY blob_id ORDER BY blob_id LIMIT ?`, after, limit)
}
