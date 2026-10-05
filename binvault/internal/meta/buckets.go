package meta

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"
	"time"
)

const bucketCols = `name, generation, created_at, revision, quota_bytes, max_objects, max_object_bytes,
allowed_content_types, versioning, encryption, lifecycle, limits, anonymous_read, anonymous_prefixes,
cors, data_key, attachments_revision, objects, versions, delete_markers, bytes, upload_bytes, epoch`

type rowScanner interface{ Scan(dest ...any) error }

func scanBucket(s rowScanner) (*Bucket, error) {
	var b Bucket
	var created int64
	var quota, maxObj, maxSize sql.NullInt64
	var act, lc, lim, anonp, cors string
	if err := s.Scan(&b.Name, &b.Generation, &created, &b.Revision, &quota, &maxObj, &maxSize,
		&act, &b.Versioning, &b.Encryption, &lc, &lim, &b.AnonymousRead, &anonp,
		&cors, &b.DataKey, &b.AttachmentsRevision, &b.Objects, &b.Versions, &b.DeleteMarkers,
		&b.Bytes, &b.UploadBytes, &b.Epoch); err != nil {
		return nil, err
	}
	b.CreatedAt = fromMS(created)
	if quota.Valid {
		v := quota.Int64
		b.QuotaBytes = &v
	}
	if maxObj.Valid {
		v := maxObj.Int64
		b.MaxObjects = &v
	}
	if maxSize.Valid {
		v := maxSize.Int64
		b.MaxObjectBytes = &v
	}
	_ = json.Unmarshal([]byte(act), &b.AllowedContentTypes)
	_ = json.Unmarshal([]byte(lc), &b.Lifecycle)
	_ = json.Unmarshal([]byte(lim), &b.Limits)
	_ = json.Unmarshal([]byte(anonp), &b.AnonymousPrefixes)
	_ = json.Unmarshal([]byte(cors), &b.CORS)
	return &b, nil
}

func jsonText(v any, empty string) string {
	b, err := json.Marshal(v)
	if err != nil || string(b) == "null" {
		return empty
	}
	return string(b)
}

// GetBucket loads a bucket (ErrNotFound if absent).
func (q Q) GetBucket(ctx context.Context, name string) (*Bucket, error) {
	b, err := scanBucket(q.q.QueryRowContext(ctx, `SELECT `+bucketCols+` FROM buckets WHERE name = ?`, name))
	if isNoRows(err) {
		return nil, ErrNotFound
	}
	return b, err
}

// ListBuckets lists buckets with name > after, ordered by name.
func (q Q) ListBuckets(ctx context.Context, after string, limit int) ([]*Bucket, error) {
	if limit <= 0 {
		limit = 1000
	}
	rows, err := q.q.QueryContext(ctx, `SELECT `+bucketCols+` FROM buckets WHERE name > ? ORDER BY name LIMIT ?`, after, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Bucket
	for rows.Next() {
		b, err := scanBucket(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// CountBuckets returns the number of buckets.
func (q Q) CountBuckets(ctx context.Context) (int64, error) {
	var n int64
	err := q.q.QueryRowContext(ctx, `SELECT COUNT(*) FROM buckets`).Scan(&n)
	return n, err
}

// CreateBucket inserts a new bucket (ErrExists if the name is taken).
func (t *Tx) CreateBucket(ctx context.Context, b *Bucket) error {
	if b.Revision == 0 {
		b.Revision = 1
	}
	if b.CreatedAt.IsZero() {
		b.CreatedAt = t.now
	}
	if b.Versioning == "" {
		b.Versioning = VersioningOff
	}
	if b.Encryption == "" {
		b.Encryption = EncryptionNone
	}
	if b.AnonymousRead == "" {
		b.AnonymousRead = AnonOff
	}
	_, err := t.q.ExecContext(ctx, `INSERT INTO buckets (name, generation, created_at, revision, quota_bytes, max_objects,
max_object_bytes, allowed_content_types, versioning, encryption, lifecycle, limits, anonymous_read,
anonymous_prefixes, cors, data_key, attachments_revision) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		b.Name, b.Generation, ms(b.CreatedAt), b.Revision, nullInt(b.QuotaBytes), nullInt(b.MaxObjects),
		nullInt(b.MaxObjectBytes), jsonText(b.AllowedContentTypes, "[]"), b.Versioning, b.Encryption,
		jsonText(b.Lifecycle, "[]"), jsonText(b.Limits, "{}"), b.AnonymousRead,
		jsonText(b.AnonymousPrefixes, "[]"), jsonText(b.CORS, "[]"), b.DataKey, b.AttachmentsRevision)
	if err != nil && strings.Contains(err.Error(), "UNIQUE") {
		return ErrExists
	}
	return err
}

// UpdateBucketSettings writes the settings columns of b and bumps the revision.
// If ifRevision > 0 it must match the stored revision (ErrConflict otherwise).
func (t *Tx) UpdateBucketSettings(ctx context.Context, b *Bucket, ifRevision int64) error {
	res, err := t.q.ExecContext(ctx, `UPDATE buckets SET quota_bytes=?, max_objects=?, max_object_bytes=?,
allowed_content_types=?, versioning=?, encryption=?, lifecycle=?, limits=?, anonymous_read=?,
anonymous_prefixes=?, cors=?, revision=revision+1 WHERE name=? AND (?=0 OR revision=?)`,
		nullInt(b.QuotaBytes), nullInt(b.MaxObjects), nullInt(b.MaxObjectBytes),
		jsonText(b.AllowedContentTypes, "[]"), b.Versioning, b.Encryption, jsonText(b.Lifecycle, "[]"),
		jsonText(b.Limits, "{}"), b.AnonymousRead, jsonText(b.AnonymousPrefixes, "[]"), jsonText(b.CORS, "[]"),
		b.Name, ifRevision, ifRevision)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		if _, gerr := t.GetBucket(ctx, b.Name); gerr != nil {
			return gerr
		}
		return ErrConflict
	}
	b.Revision++
	return nil
}

// SetBucketDataKey stores the sealed bucket data key.
func (t *Tx) SetBucketDataKey(ctx context.Context, bucket string, sealed []byte) error {
	_, err := t.q.ExecContext(ctx, `UPDATE buckets SET data_key=? WHERE name=?`, sealed, bucket)
	return err
}

// SetBucketDataKeyIfAbsent stores the sealed bucket data key only when the
// bucket has none yet; it reports whether this call stored it (spec §3.11:
// creation is serialised, and an existing key is never replaced).
func (t *Tx) SetBucketDataKeyIfAbsent(ctx context.Context, bucket string, sealed []byte) (bool, error) {
	res, err := t.q.ExecContext(ctx, `UPDATE buckets SET data_key=? WHERE name=? AND data_key IS NULL`, sealed, bucket)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n == 1, err
}

// AddCounters adds a delta to the bucket counters.
func (t *Tx) AddCounters(ctx context.Context, bucket string, d Counters) error {
	_, err := t.q.ExecContext(ctx, `UPDATE buckets SET objects=objects+?, versions=versions+?,
delete_markers=delete_markers+?, bytes=bytes+?, upload_bytes=upload_bytes+? WHERE name=?`,
		d.Objects, d.Versions, d.DeleteMarkers, d.Bytes, d.UploadBytes, bucket)
	return err
}

// DeleteBucket removes the bucket row (cascades to tokens, objects, uploads,
// attachments). Blob rows are released separately (see ReleaseBucketBlobs).
func (t *Tx) DeleteBucket(ctx context.Context, name string) error {
	res, err := t.q.ExecContext(ctx, `DELETE FROM buckets WHERE name=?`, name)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// BucketIsEmpty reports whether the bucket holds no version rows and no open uploads.
func (q Q) BucketIsEmpty(ctx context.Context, name string) (bool, error) {
	var v, u int64
	if err := q.q.QueryRowContext(ctx, `SELECT versions FROM buckets WHERE name=?`, name).Scan(&v); err != nil {
		if isNoRows(err) {
			return false, ErrNotFound
		}
		return false, err
	}
	if err := q.q.QueryRowContext(ctx, `SELECT COUNT(*) FROM uploads WHERE bucket=? AND state='open'`, name).Scan(&u); err != nil {
		return false, err
	}
	return v == 0 && u == 0, nil
}

// Stats totals every bucket's counters (for /status and metrics).
func (q Q) Stats(ctx context.Context) (buckets int64, c Counters, err error) {
	err = q.q.QueryRowContext(ctx, `SELECT COUNT(*), COALESCE(SUM(objects),0), COALESCE(SUM(versions),0),
COALESCE(SUM(delete_markers),0), COALESCE(SUM(bytes),0), COALESCE(SUM(upload_bytes),0) FROM buckets`).
		Scan(&buckets, &c.Objects, &c.Versions, &c.DeleteMarkers, &c.Bytes, &c.UploadBytes)
	return
}

var _ = time.Second
