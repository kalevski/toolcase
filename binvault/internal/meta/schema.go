package meta

// migrations are forward-only and applied in order at boot (spec §3.2, §9.6).
// Each entry is one SQL script run inside its own transaction. The cluster
// tables arrive in migration 2 (spec §8), the bucket-move table and the bucket
// epoch in migration 3; migration 1 is everything a single node needs.
var migrations = []string{
	// ---- 1: single-node schema ------------------------------------------
	`
CREATE TABLE kv (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE buckets (
  name           TEXT PRIMARY KEY,
  generation     TEXT    NOT NULL,
  created_at     INTEGER NOT NULL,
  revision       INTEGER NOT NULL DEFAULT 1,
  quota_bytes    INTEGER,
  max_objects    INTEGER,
  max_object_bytes INTEGER,
  allowed_content_types TEXT NOT NULL DEFAULT '[]',
  versioning     TEXT    NOT NULL DEFAULT 'off',
  encryption     TEXT    NOT NULL DEFAULT 'none',
  lifecycle      TEXT    NOT NULL DEFAULT '[]',
  limits         TEXT    NOT NULL DEFAULT '{}',
  anonymous_read TEXT    NOT NULL DEFAULT 'off',
  anonymous_prefixes TEXT NOT NULL DEFAULT '[]',
  cors           TEXT    NOT NULL DEFAULT '[]',
  data_key       BLOB,
  attachments_revision INTEGER NOT NULL DEFAULT 0,
  objects        INTEGER NOT NULL DEFAULT 0,
  versions       INTEGER NOT NULL DEFAULT 0,
  delete_markers INTEGER NOT NULL DEFAULT 0,
  bytes          INTEGER NOT NULL DEFAULT 0,
  upload_bytes   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tokens (
  access_key_id TEXT PRIMARY KEY,
  bucket        TEXT    NOT NULL REFERENCES buckets(name) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  secret        BLOB    NOT NULL,
  grants        TEXT    NOT NULL,
  limits        TEXT    NOT NULL DEFAULT '{}',
  expires_at    INTEGER,
  created_at    INTEGER NOT NULL,
  last_used_at  INTEGER,
  revision      INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX tokens_bucket ON tokens(bucket);

CREATE TABLE blobs (
  blob_id    TEXT PRIMARY KEY,
  bucket     TEXT    NOT NULL,
  size       INTEGER NOT NULL,
  plain_size INTEGER NOT NULL,
  sse        INTEGER NOT NULL DEFAULT 0,
  refs       INTEGER NOT NULL DEFAULT 0,
  zero_since INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX blobs_gc ON blobs(zero_since) WHERE refs = 0;
CREATE INDEX blobs_bucket ON blobs(bucket);

CREATE TABLE objects (
  seq            INTEGER PRIMARY KEY AUTOINCREMENT,
  bucket         TEXT    NOT NULL REFERENCES buckets(name) ON DELETE CASCADE,
  key            TEXT    NOT NULL,
  version        TEXT    NOT NULL,
  is_latest      INTEGER NOT NULL,
  delete_marker  INTEGER NOT NULL DEFAULT 0,
  null_version   INTEGER NOT NULL DEFAULT 0,
  blob_id        TEXT,
  size           INTEGER NOT NULL DEFAULT 0,
  etag           TEXT    NOT NULL DEFAULT '',
  sha256         TEXT    NOT NULL DEFAULT '',
  checksum_algo  TEXT    NOT NULL DEFAULT '',
  checksum       TEXT    NOT NULL DEFAULT '',
  checksum_type  TEXT    NOT NULL DEFAULT '',
  content_type        TEXT NOT NULL DEFAULT '',
  content_encoding    TEXT NOT NULL DEFAULT '',
  content_language    TEXT NOT NULL DEFAULT '',
  content_disposition TEXT NOT NULL DEFAULT '',
  cache_control       TEXT NOT NULL DEFAULT '',
  expires             TEXT NOT NULL DEFAULT '',
  metadata       TEXT    NOT NULL DEFAULT '{}',
  tags           TEXT    NOT NULL DEFAULT '{}',
  parts          TEXT    NOT NULL DEFAULT '[]',
  created_at     INTEGER NOT NULL,
  noncurrent_since INTEGER,
  sse            INTEGER NOT NULL DEFAULT 0,
  UNIQUE (bucket, key, version)
);
CREATE INDEX objects_key ON objects(bucket, key, seq DESC);
CREATE INDEX objects_latest ON objects(bucket, key) WHERE is_latest = 1;
CREATE INDEX objects_lc_current ON objects(bucket, created_at) WHERE is_latest = 1 AND delete_marker = 0;
CREATE INDEX objects_lc_noncurrent ON objects(bucket, noncurrent_since) WHERE is_latest = 0;
CREATE INDEX objects_lc_markers ON objects(bucket, key) WHERE is_latest = 1 AND delete_marker = 1;
CREATE INDEX objects_blob ON objects(blob_id) WHERE blob_id IS NOT NULL;

CREATE TABLE uploads (
  upload_id    TEXT PRIMARY KEY,
  bucket       TEXT    NOT NULL REFERENCES buckets(name) ON DELETE CASCADE,
  key          TEXT    NOT NULL,
  initiated_at INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  state        TEXT    NOT NULL DEFAULT 'open',
  completed_at INTEGER,
  encrypted    INTEGER NOT NULL DEFAULT 0,
  headers      TEXT    NOT NULL DEFAULT '{}',
  metadata     TEXT    NOT NULL DEFAULT '{}',
  tags         TEXT    NOT NULL DEFAULT '{}',
  checksum_algo TEXT   NOT NULL DEFAULT '',
  checksum_type TEXT   NOT NULL DEFAULT '',
  storage_class TEXT   NOT NULL DEFAULT '',
  actor        TEXT    NOT NULL DEFAULT '{}',
  complete_hash   TEXT NOT NULL DEFAULT '',
  complete_result TEXT NOT NULL DEFAULT ''
);
CREATE INDEX uploads_key ON uploads(bucket, key, initiated_at);
CREATE INDEX uploads_state ON uploads(state, updated_at);

CREATE TABLE parts (
  upload_id TEXT    NOT NULL REFERENCES uploads(upload_id) ON DELETE CASCADE,
  number    INTEGER NOT NULL,
  part_id   TEXT    NOT NULL,
  size      INTEGER NOT NULL,
  stored_size INTEGER NOT NULL,
  etag      TEXT    NOT NULL,
  checksum_algo TEXT NOT NULL DEFAULT '',
  checksum  TEXT    NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (upload_id, number)
);

CREATE TABLE pipelines (
  name       TEXT PRIMARY KEY,
  generation TEXT    NOT NULL,
  revision   INTEGER NOT NULL DEFAULT 1,
  stage      TEXT    NOT NULL,
  definition TEXT    NOT NULL,
  headers_sealed        BLOB,
  signing_secret_sealed BLOB,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE attachments (
  bucket     TEXT    NOT NULL REFERENCES buckets(name) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  pipeline   TEXT    NOT NULL,
  generation TEXT    NOT NULL,
  enabled    INTEGER NOT NULL DEFAULT 1,
  match      TEXT    NOT NULL DEFAULT '{}',
  PRIMARY KEY (bucket, position),
  UNIQUE (bucket, pipeline)
);

CREATE TABLE runs (
  id          TEXT PRIMARY KEY,
  group_seq   INTEGER NOT NULL,
  event_id    TEXT    NOT NULL,
  pipeline    TEXT    NOT NULL,
  generation  TEXT    NOT NULL DEFAULT '',
  stage       TEXT    NOT NULL,
  bucket      TEXT    NOT NULL,
  key         TEXT    NOT NULL,
  event       TEXT    NOT NULL,
  operation   TEXT    NOT NULL,
  object_version TEXT NOT NULL DEFAULT '',
  actor       TEXT    NOT NULL DEFAULT '{}',
  lineage     TEXT    NOT NULL DEFAULT '{}',
  payload     TEXT    NOT NULL DEFAULT '{}',
  state       TEXT    NOT NULL,
  reason      TEXT    NOT NULL DEFAULT '',
  step        INTEGER NOT NULL,
  steps       INTEGER NOT NULL,
  attempt     INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 1,
  http_status INTEGER NOT NULL DEFAULT 0,
  message     TEXT    NOT NULL DEFAULT '',
  error       TEXT    NOT NULL DEFAULT '',
  queued_at   INTEGER NOT NULL,
  started_at  INTEGER,
  finished_at INTEGER,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  not_before  INTEGER NOT NULL DEFAULT 0,
  runnable_since INTEGER,
  backfill_id TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX runs_sched ON runs(state, not_before);
CREATE INDEX runs_key ON runs(bucket, key, group_seq);
CREATE INDEX runs_event ON runs(event_id, step);
CREATE INDEX runs_pipeline ON runs(pipeline, state);
CREATE INDEX runs_finished ON runs(finished_at) WHERE finished_at IS NOT NULL;
-- the scheduler only ever asks about open (queued or running) runs: partial
-- indexes keep those lookups small however much history the table keeps
CREATE INDEX runs_open_queue ON runs(group_seq, step) WHERE state = 'queued';
CREATE INDEX runs_open_key ON runs(bucket, key, group_seq) WHERE state IN ('queued', 'running');
CREATE INDEX runs_open_event ON runs(event_id, step) WHERE state IN ('queued', 'running');
CREATE INDEX runs_backfill ON runs(backfill_id, state) WHERE backfill_id != '';

CREATE TABLE backfills (
  id         TEXT PRIMARY KEY,
  bucket     TEXT    NOT NULL,
  pipeline   TEXT    NOT NULL,
  prefix     TEXT    NOT NULL DEFAULT '',
  modified_after  INTEGER,
  modified_before INTEGER,
  state      TEXT    NOT NULL,
  scanned    INTEGER NOT NULL DEFAULT 0,
  enqueued   INTEGER NOT NULL DEFAULT 0,
  cursor     TEXT    NOT NULL DEFAULT '',
  error      TEXT    NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  finished_at INTEGER
);
`,
	// ---- 2: cluster tables (schema_cluster.go) ----------------------------
	migrationCluster,
	// ---- 3: bucket moves (schema_moves.go) ---------------------------------
	migrationMoves,
}
