package meta

import (
	"context"
	"database/sql"
	"encoding/json"
)

const objCols = `seq, bucket, key, version, is_latest, delete_marker, null_version, blob_id, size, etag, sha256,
checksum_algo, checksum, checksum_type, content_type, content_encoding, content_language, content_disposition,
cache_control, expires, metadata, tags, parts, created_at, noncurrent_since, sse`

func scanObject(s rowScanner) (*Object, error) {
	var o Object
	var blob sql.NullString
	var latest, marker, nullv, sse int
	var meta, tags, parts string
	var created int64
	var nc sql.NullInt64
	if err := s.Scan(&o.Seq, &o.Bucket, &o.Key, &o.Version, &latest, &marker, &nullv, &blob, &o.Size, &o.ETag, &o.SHA256,
		&o.ChecksumAlgo, &o.Checksum, &o.ChecksumType, &o.ContentType, &o.ContentEncoding, &o.ContentLanguage,
		&o.ContentDisposition, &o.CacheControl, &o.Expires, &meta, &tags, &parts, &created, &nc, &sse); err != nil {
		return nil, err
	}
	o.IsLatest, o.DeleteMarker, o.NullVersion, o.SSE = latest == 1, marker == 1, nullv == 1, sse == 1
	o.BlobID = blob.String
	o.CreatedAt = fromMS(created)
	if nc.Valid {
		v := fromMS(nc.Int64)
		o.NoncurrentSince = &v
	}
	// the stored text is "{}" / "[]" for most rows: skip the decoder, keep its result (empty, non-nil)
	if meta == "{}" {
		o.Metadata = map[string]string{}
	} else {
		_ = json.Unmarshal([]byte(meta), &o.Metadata)
	}
	if tags == "{}" {
		o.Tags = map[string]string{}
	} else {
		_ = json.Unmarshal([]byte(tags), &o.Tags)
	}
	if parts == "[]" {
		o.Parts = []int64{}
	} else {
		_ = json.Unmarshal([]byte(parts), &o.Parts)
	}
	return &o, nil
}

// GetLatest returns the key's latest version row (a delete marker is returned
// as such). ErrNotFound if the key has no versions.
func (q Q) GetLatest(ctx context.Context, bucket, key string) (*Object, error) {
	o, err := scanObject(q.q.QueryRowContext(ctx, `SELECT `+objCols+` FROM objects WHERE bucket=? AND key=? AND is_latest=1`, bucket, key))
	if isNoRows(err) {
		return nil, ErrNotFound
	}
	return o, err
}

// GetVersion returns the version whose binvault version id (ULID) is version.
func (q Q) GetVersion(ctx context.Context, bucket, key, version string) (*Object, error) {
	o, err := scanObject(q.q.QueryRowContext(ctx, `SELECT `+objCols+` FROM objects WHERE bucket=? AND key=? AND version=?`, bucket, key, version))
	if isNoRows(err) {
		return nil, ErrNotFound
	}
	return o, err
}

// GetNullVersion returns the key's `null` version (spec §3.10), if any.
func (q Q) GetNullVersion(ctx context.Context, bucket, key string) (*Object, error) {
	o, err := scanObject(q.q.QueryRowContext(ctx, `SELECT `+objCols+` FROM objects WHERE bucket=? AND key=? AND null_version=1`, bucket, key))
	if isNoRows(err) {
		return nil, ErrNotFound
	}
	return o, err
}

// GetS3Version resolves an S3 VersionId ("null" or a ULID).
func (q Q) GetS3Version(ctx context.Context, bucket, key, versionID string) (*Object, error) {
	if versionID == "null" {
		return q.GetNullVersion(ctx, bucket, key)
	}
	return q.GetVersion(ctx, bucket, key, versionID)
}

// GetBySeq loads one row by commit sequence.
func (q Q) GetBySeq(ctx context.Context, seq int64) (*Object, error) {
	o, err := scanObject(q.q.QueryRowContext(ctx, `SELECT `+objCols+` FROM objects WHERE seq=?`, seq))
	if isNoRows(err) {
		return nil, ErrNotFound
	}
	return o, err
}

// NewestVersion returns the key's highest-seq row (the one that is, or should be, latest).
func (q Q) NewestVersion(ctx context.Context, bucket, key string) (*Object, error) {
	o, err := scanObject(q.q.QueryRowContext(ctx, `SELECT `+objCols+` FROM objects WHERE bucket=? AND key=? ORDER BY seq DESC LIMIT 1`, bucket, key))
	if isNoRows(err) {
		return nil, ErrNotFound
	}
	return o, err
}

// VersionsOf lists all versions of a key, newest (highest seq) first.
func (q Q) VersionsOf(ctx context.Context, bucket, key string) ([]*Object, error) {
	rows, err := q.q.QueryContext(ctx, `SELECT `+objCols+` FROM objects WHERE bucket=? AND key=? ORDER BY seq DESC`, bucket, key)
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

// InsertObject adds a version row and fills o.Seq.
func (t *Tx) InsertObject(ctx context.Context, o *Object) error {
	var blob any
	if o.BlobID != "" {
		blob = o.BlobID
	}
	res, err := t.q.ExecContext(ctx, `INSERT INTO objects (bucket, key, version, is_latest, delete_marker, null_version, blob_id,
size, etag, sha256, checksum_algo, checksum, checksum_type, content_type, content_encoding, content_language,
content_disposition, cache_control, expires, metadata, tags, parts, created_at, noncurrent_since, sse)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		o.Bucket, o.Key, o.Version, boolInt(o.IsLatest), boolInt(o.DeleteMarker), boolInt(o.NullVersion), blob,
		o.Size, o.ETag, o.SHA256, o.ChecksumAlgo, o.Checksum, o.ChecksumType, o.ContentType, o.ContentEncoding,
		o.ContentLanguage, o.ContentDisposition, o.CacheControl, o.Expires, jsonText(o.Metadata, "{}"),
		jsonText(o.Tags, "{}"), jsonText(o.Parts, "[]"), ms(o.CreatedAt), msPtr(o.NoncurrentSince), boolInt(o.SSE))
	if err != nil {
		return err
	}
	o.Seq, err = res.LastInsertId()
	return err
}

// SetNoncurrent marks a row as no longer latest at time at.
func (t *Tx) SetNoncurrent(ctx context.Context, seq int64, at int64) error {
	_, err := t.q.ExecContext(ctx, `UPDATE objects SET is_latest=0, noncurrent_since=? WHERE seq=?`, at, seq)
	return err
}

// SetLatest marks a row as the latest version again (after a purge uncovers it).
func (t *Tx) SetLatest(ctx context.Context, seq int64) error {
	_, err := t.q.ExecContext(ctx, `UPDATE objects SET is_latest=1, noncurrent_since=NULL WHERE seq=?`, seq)
	return err
}

// DeleteObjectRow removes one version row.
func (t *Tx) DeleteObjectRow(ctx context.Context, seq int64) error {
	_, err := t.q.ExecContext(ctx, `DELETE FROM objects WHERE seq=?`, seq)
	return err
}

// SetObjectTags replaces a version's tags (tag changes never change the version).
func (t *Tx) SetObjectTags(ctx context.Context, seq int64, tags map[string]string) error {
	_, err := t.q.ExecContext(ctx, `UPDATE objects SET tags=? WHERE seq=?`, jsonText(tags, "{}"), seq)
	return err
}

// CountObjectsForBlob counts version rows referencing a blob (validate --deep).
func (q Q) CountObjectsForBlob(ctx context.Context, blobID string) (int64, error) {
	var n int64
	err := q.q.QueryRowContext(ctx, `SELECT COUNT(*) FROM objects WHERE blob_id=?`, blobID).Scan(&n)
	return n, err
}
