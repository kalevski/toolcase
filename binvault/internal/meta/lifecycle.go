package meta

import (
	"context"
	"time"
)

// LifecycleCurrent lists current data versions created before cutoff, ordered
// by (created_at, seq), after the cursor (spec §3.12; served by the partial
// index on current data versions).
func (q Q) LifecycleCurrent(ctx context.Context, bucket string, cutoff time.Time, afterCreated, afterSeq int64, limit int) ([]*Object, error) {
	return q.queryObjects(ctx, `SELECT `+objCols+` FROM objects WHERE bucket=? AND is_latest=1 AND delete_marker=0
AND created_at < ? AND (created_at > ? OR (created_at = ? AND seq > ?)) ORDER BY created_at, seq LIMIT ?`,
		bucket, ms(cutoff), afterCreated, afterCreated, afterSeq, limit)
}

// LifecycleNoncurrent lists noncurrent versions that became noncurrent before
// cutoff, ordered by (noncurrent_since, seq), after the cursor.
func (q Q) LifecycleNoncurrent(ctx context.Context, bucket string, cutoff time.Time, afterSince, afterSeq int64, limit int) ([]*Object, error) {
	return q.queryObjects(ctx, `SELECT `+objCols+` FROM objects WHERE bucket=? AND is_latest=0 AND noncurrent_since IS NOT NULL
AND noncurrent_since < ? AND (noncurrent_since > ? OR (noncurrent_since = ? AND seq > ?)) ORDER BY noncurrent_since, seq LIMIT ?`,
		bucket, ms(cutoff), afterSince, afterSince, afterSeq, limit)
}

// LifecycleLoneMarkers lists current delete markers that are the only version
// of their key, in key order after afterKey.
func (q Q) LifecycleLoneMarkers(ctx context.Context, bucket, afterKey string, limit int) ([]*Object, error) {
	return q.queryObjects(ctx, `SELECT `+objCols+` FROM objects o WHERE bucket=? AND is_latest=1 AND delete_marker=1 AND key > ?
AND NOT EXISTS (SELECT 1 FROM objects o2 WHERE o2.bucket=o.bucket AND o2.key=o.key AND o2.seq<>o.seq) ORDER BY key LIMIT ?`,
		bucket, afterKey, limit)
}

// NoncurrentRank counts the key's noncurrent versions newer than seq (how many
// newer noncurrent versions would be kept; noncurrent_keep).
func (q Q) NoncurrentRank(ctx context.Context, bucket, key string, seq int64) (int, error) {
	var n int
	err := q.q.QueryRowContext(ctx, `SELECT COUNT(*) FROM objects WHERE bucket=? AND key=? AND is_latest=0 AND seq > ?`, bucket, key, seq).Scan(&n)
	return n, err
}

// BucketsWithLifecycle lists buckets whose lifecycle rules are not empty.
func (q Q) BucketsWithLifecycle(ctx context.Context) ([]string, error) {
	rows, err := q.q.QueryContext(ctx, `SELECT name FROM buckets WHERE lifecycle <> '[]' ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func (q Q) queryObjects(ctx context.Context, query string, args ...any) ([]*Object, error) {
	rows, err := q.q.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Object
	for rows.Next() {
		o, err := scanObject(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}
