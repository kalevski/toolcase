package meta

// migrationMoves is migration 3: what a bucket move (spec §8.8) keeps on disk.
//
//   - buckets.epoch is the epoch of the local copy of a bucket: how many moves
//     brought it to the state it is in (0 for a bucket created here). A node serves
//     a bucket only when its local epoch equals the epoch the catalog gives it,
//     which is how the old home stops serving the moment it has handed the bucket
//     over, and the new home starts the moment it activated it, before the
//     catalog's hand-off op has reached everybody.
//   - objects_bucket_seq indexes a bucket's version rows by seq: the blob passes of a
//     move page through them in commit order and the row export reads them in that
//     order, without sorting millions of rows (both are linear in the bucket).
//   - moves has one row per move this node takes part in: role "out" on the old
//     home (the source), "in" on the new home (the target). The row's state holds
//     the two durable decisions of §8.8 step 5 — the source's `cutover`, the
//     target's `activated` / `abandoned` — so that neither node forgets them in a
//     crash. Rows are kept (they are the move history GET /moves lists).
const migrationMoves = `
ALTER TABLE buckets ADD COLUMN epoch INTEGER NOT NULL DEFAULT 0;

CREATE TABLE moves (
  id             TEXT PRIMARY KEY,
  role           TEXT    NOT NULL,
  bucket         TEXT    NOT NULL,
  generation     TEXT    NOT NULL,
  peer           TEXT    NOT NULL,
  state          TEXT    NOT NULL,
  epoch          INTEGER NOT NULL,
  error          TEXT    NOT NULL DEFAULT '',
  max_bps        INTEGER NOT NULL DEFAULT 0,
  bytes_total    INTEGER NOT NULL DEFAULT 0,
  bytes_copied   INTEGER NOT NULL DEFAULT 0,
  objects_copied INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  started_at     INTEGER,
  finished_at    INTEGER
);
CREATE INDEX moves_bucket ON moves(bucket, role);
CREATE INDEX moves_state ON moves(role, state);

-- a bucket's version rows in commit order: the blob passes of a move page through them by
-- seq, and the row export reads them in seq order, without sorting millions of rows
CREATE INDEX objects_bucket_seq ON objects(bucket, seq);
`
