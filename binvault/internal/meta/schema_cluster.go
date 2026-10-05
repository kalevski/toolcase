package meta

// migrationCluster is migration 2: the tables a cluster node adds (spec §3.2,
// §8). A single node carries them too, empty, so the schema never depends on
// the mode a node runs in.
//
//   - ops, ops_vv, ops_floor: the catalog op log (§8.5), its version vector (the
//     highest contiguous seq applied per origin) and its floor (the highest seq
//     of an origin no longer held individually: compacted, or covered by a
//     snapshot).
//   - catalog: one row per replicated register, bucket/<name>, pipeline/<name>
//     and key/<access key id> (the access-key index of §8.2 is its key/ rows),
//     tombstones included, each with the (hlc, origin) of the op that wrote it.
//     Columns worth knowing: ops.v is the peer-protocol version the op was created
//     under (a newer one is held, §9.6); ops.prev and catalog.prev are the id of the
//     register winner the author replaced, kept only to tell concurrent writes from
//     causal ones (they never decide a winner); catalog.aux is derived from the
//     payload (a bucket's home node id, a key's bucket) and indexes the lookups
//     "buckets homed on a node" and "keys of a bucket".
//   - peers, peer_urls: what this node remembers about the other nodes (their
//     last known name, when first seen, whether retired) and which node id last
//     answered at each configured URL (§8.3).
//
// The bucket-move table (§8.8) arrives with the move code, in a later migration.
const migrationCluster = `
CREATE TABLE ops (
  origin  TEXT    NOT NULL,
  seq     INTEGER NOT NULL,
  hlc     INTEGER NOT NULL,
  v       INTEGER NOT NULL DEFAULT 1,
  kind    TEXT    NOT NULL,
  key     TEXT    NOT NULL,
  prev    TEXT    NOT NULL DEFAULT '',
  payload BLOB    NOT NULL,
  PRIMARY KEY (origin, seq)
);
CREATE INDEX ops_hlc ON ops(hlc);

CREATE TABLE ops_vv (
  origin TEXT PRIMARY KEY,
  seq    INTEGER NOT NULL
);

CREATE TABLE ops_floor (
  origin TEXT PRIMARY KEY,
  seq    INTEGER NOT NULL
);

CREATE TABLE catalog (
  key     TEXT PRIMARY KEY,
  kind    TEXT    NOT NULL,
  name    TEXT    NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  payload BLOB    NOT NULL,
  aux     TEXT    NOT NULL DEFAULT '',
  prev    TEXT    NOT NULL DEFAULT '',
  hlc     INTEGER NOT NULL,
  origin  TEXT    NOT NULL,
  seq     INTEGER NOT NULL
);
CREATE INDEX catalog_kind ON catalog(kind, name);
CREATE INDEX catalog_aux ON catalog(kind, aux) WHERE deleted = 0;

CREATE TABLE peers (
  node_id     TEXT PRIMARY KEY,
  name        TEXT    NOT NULL DEFAULT '',
  first_seen  INTEGER NOT NULL,
  retired     INTEGER NOT NULL DEFAULT 0,
  retired_at  INTEGER,
  retired_why TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE peer_urls (
  url     TEXT PRIMARY KEY,
  node_id TEXT NOT NULL
);
`
