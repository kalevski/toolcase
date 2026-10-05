package meta

import (
	"context"
	"database/sql"
	"time"
)

// PeerRow is what a node remembers about another node of its cluster (spec
// §8.3): the name it last announced, when it was first seen, and whether it has
// been retired (replaced by a redeployment, or removed by an admin).
type PeerRow struct {
	NodeID     string
	Name       string
	FirstSeen  time.Time
	Retired    bool
	RetiredAt  *time.Time
	RetiredWhy string
}

// ListPeers returns every remembered node, oldest first.
func (q Q) ListPeers(ctx context.Context) ([]PeerRow, error) {
	rows, err := q.q.QueryContext(ctx, `SELECT node_id, name, first_seen, retired, retired_at, retired_why FROM peers ORDER BY first_seen, node_id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []PeerRow
	for rows.Next() {
		var p PeerRow
		var first int64
		var ret int
		var at sql.NullInt64
		if err := rows.Scan(&p.NodeID, &p.Name, &first, &ret, &at, &p.RetiredWhy); err != nil {
			return nil, err
		}
		p.FirstSeen, p.Retired = fromMS(first), ret != 0
		if at.Valid {
			v := fromMS(at.Int64)
			p.RetiredAt = &v
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// PeerURLs returns, per configured URL, the node id that answered there last.
func (q Q) PeerURLs(ctx context.Context) (map[string]string, error) {
	rows, err := q.q.QueryContext(ctx, `SELECT url, node_id FROM peer_urls`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var u, id string
		if err := rows.Scan(&u, &id); err != nil {
			return nil, err
		}
		out[u] = id
	}
	return out, rows.Err()
}

// UpsertPeer records a node: inserted with first_seen = now, or its name updated.
func (t *Tx) UpsertPeer(ctx context.Context, id, name string, now time.Time) error {
	_, err := t.q.ExecContext(ctx, `INSERT INTO peers (node_id, name, first_seen) VALUES (?, ?, ?)
ON CONFLICT(node_id) DO UPDATE SET name = excluded.name`, id, name, ms(now))
	return err
}

// SetPeerRetired retires a node (its catalog ops stay; it no longer holds back
// compaction) or revives it.
func (t *Tx) SetPeerRetired(ctx context.Context, id string, retired bool, why string, at time.Time) error {
	if retired {
		_, err := t.q.ExecContext(ctx, `INSERT INTO peers (node_id, first_seen, retired, retired_at, retired_why) VALUES (?, ?, 1, ?, ?)
ON CONFLICT(node_id) DO UPDATE SET retired = 1, retired_at = excluded.retired_at, retired_why = excluded.retired_why`,
			id, ms(at), ms(at), why)
		return err
	}
	_, err := t.q.ExecContext(ctx, `UPDATE peers SET retired = 0, retired_at = NULL, retired_why = '' WHERE node_id = ?`, id)
	return err
}

// SetPeerURL records which node id answered at a URL.
func (t *Tx) SetPeerURL(ctx context.Context, url, id string) error {
	_, err := t.q.ExecContext(ctx, `INSERT INTO peer_urls (url, node_id) VALUES (?, ?)
ON CONFLICT(url) DO UPDATE SET node_id = excluded.node_id`, url, id)
	return err
}
