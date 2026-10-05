package meta

import "context"

// ObjectsOfBlob lists up to limit version rows that reference a blob, oldest
// first: what `validate --deep` names when a referenced blob's file is missing.
func (q Q) ObjectsOfBlob(ctx context.Context, blobID string, limit int) ([]*Object, error) {
	return q.queryObjects(ctx, `SELECT `+objCols+` FROM objects WHERE blob_id=? ORDER BY seq LIMIT ?`, blobID, limit)
}
