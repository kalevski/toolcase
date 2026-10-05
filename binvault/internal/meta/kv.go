package meta

import "context"

// KVGet reads a node-local key/value (node id, cluster clock, ...).
func (q Q) KVGet(ctx context.Context, key string) (string, error) {
	var v string
	err := q.q.QueryRowContext(ctx, `SELECT value FROM kv WHERE key=?`, key).Scan(&v)
	if isNoRows(err) {
		return "", ErrNotFound
	}
	return v, err
}

// KVSet stores a key/value.
func (t *Tx) KVSet(ctx context.Context, key, value string) error {
	_, err := t.q.ExecContext(ctx, `INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, key, value)
	return err
}

// KVDelete removes a key.
func (t *Tx) KVDelete(ctx context.Context, key string) error {
	_, err := t.q.ExecContext(ctx, `DELETE FROM kv WHERE key=?`, key)
	return err
}

// KVDeletePrefix removes every key that starts with prefix (a non-empty prefix
// of ASCII keys).
func (t *Tx) KVDeletePrefix(ctx context.Context, prefix string) error {
	end := prefix[:len(prefix)-1] + string(prefix[len(prefix)-1]+1)
	_, err := t.q.ExecContext(ctx, `DELETE FROM kv WHERE key >= ? AND key < ?`, prefix, end)
	return err
}

// KVKeys lists the keys that start with prefix (a non-empty prefix of ASCII keys).
func (q Q) KVKeys(ctx context.Context, prefix string) ([]string, error) {
	end := prefix[:len(prefix)-1] + string(prefix[len(prefix)-1]+1)
	rows, err := q.q.QueryContext(ctx, `SELECT key FROM kv WHERE key >= ? AND key < ? ORDER BY key`, prefix, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

// PublishPendingKey is the kv key that marks a bucket created on a cluster node
// whose catalog entry is not written yet; its value is the bucket's generation.
// The marker is written in the creation transaction, so a crash between the local
// row and the catalog write is repaired at the next start (spec §8.5).
func PublishPendingKey(bucket string) string { return "publish/" + bucket }

// ClusterPublishedKey is set once this node has published its local buckets to
// the catalog for the first time (the single-node upgrade, spec §8.5): from then
// on a local bucket the catalog does not list is an orphan, not a bucket to publish.
const ClusterPublishedKey = "cluster/published"
