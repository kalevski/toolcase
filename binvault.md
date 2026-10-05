# binvault — specification

Status: draft v0.5 · Language: Go 1.25 · Location: `toolcase/binvault/`

binvault is an S3-compatible object storage server with built-in **pipelines**:
admin-defined procedures that call an external service for every file, either
before it is saved or after it has been saved. Services integrate by receiving
a short-lived token for the S3 API. There are no callback URLs and no result
protocol.

Revision note: v0.5 fixes the problems a review found in v0.4, always by the
simplest rule that works: versioning is `off` or `enabled` (no "suspended"),
versions are ordered by a commit sequence, there is no `202` hand-off, a bucket
move copies blobs online and the rows during one short freeze, peers are trusted
instead of checking who owns each catalog op, and §4.4 lists the action every S3
operation needs. v0.4 widened v1 after review: S3 versioning, lifecycle expiry,
SSE-S3, POST Object, write-once (`create`) and `purge` actions, rate limits,
bucket content rules, online bucket moves, a separate admin listener, and bearer
authentication for pipeline tokens only. v0.3 added optional **clustering by
bucket** (§8): several nodes
share a small catalog, each bucket lives on one home node, and any node forwards
a request to the bucket's home. It also applied review fixes: bucket tokens use
the same grants as pipeline tokens, any SigV4 region is accepted, `match` is a
selector rather than a policy and gains `operations`, a paused pipeline keeps its
queue, the default `before` budget fits client timeouts, link-local addresses
are always blocked for pipeline calls, and §11 adds delivery phases. v0.2 was a
full rewrite of v0.1: it specified the S3 surface in detail, made pipelines
generic ("anything that needs doing to a file"), added per-pipeline token grants
so services can write derivatives, and added the operational pieces (retries,
run log, backfill, key rotation).

## 1. Overview

### 1.1 What binvault is

binvault is a single-binary object storage server written in Go. Its only
interface is HTTP/REST, served by two APIs on separate listeners (plus a peer
listener when clustered, §8):

- **Data plane — the S3 API.** `/{bucket}/{key}`, usable from any S3 SDK, the
  AWS CLI, rclone, or `curl`.
- **Control plane — the admin API.** `/_admin/v1/…`, driven by one admin token
  from the environment, on its own listener (loopback by default). It creates and
  configures buckets (versioning, lifecycle, encryption, limits), issues bucket
  tokens, and defines and attaches pipelines.

On top of storage, binvault adds **pipelines**: global procedures that run when
an object is created, updated or deleted, either **before** the write becomes
visible or **after** it has been committed. A pipeline calls an external
service and hands it a short-lived, narrowly scoped token for the S3 API. The
service does whatever the file needs — validate, scan, compress, resize,
transcode, extract, index, mirror, notify, clean up — by talking to binvault
through ordinary S3 calls. binvault never interprets file contents itself.

A bucket with no pipelines attached is a plain S3 bucket and carries no
pipeline overhead.

binvault runs as one node or as a cluster of nodes. In a cluster every bucket
lives on exactly one **home node**, which stores its objects and is its only
writer, so each bucket keeps single-node semantics: strong consistency, atomic
commits, pipelines and quotas. The nodes replicate only a small catalog (which
node homes which bucket, and the pipeline definitions), and any node forwards a
request to the bucket's home. Capacity and throughput grow by adding nodes and
spreading buckets; a bucket never spans nodes (§8).

### 1.2 Design principles

1. **S3 first.** Changing the endpoint and credentials is enough to use stock
   SDKs. Where this document is silent, behaviour follows the AWS S3 REST API
   reference.
2. **Control plane ≠ data plane.** Buckets, tokens and pipelines are created
   only through the admin API. The S3 API cannot create or reconfigure them, nor
   change bucket settings such as versioning, lifecycle, encryption or CORS; it
   only reads them.
3. **A token, not a protocol.** Services do not implement a callback or a
   result schema. They receive an invocation, use an S3 credential, and answer
   with an HTTP status.
4. **Safe by default.** Pipelines that gate writes fail closed; commits are
   atomic; tokens are least-privilege and short-lived; a pipeline can never act
   on an object that changed underneath it.
5. **Boring storage.** Local filesystem for bytes, embedded SQLite for
   metadata, strong consistency, one data directory per node to back up.
6. **Shard, don't replicate.** Scale out by giving each bucket one home node.
   Nodes share a small control-plane catalog and never replicate object data
   (§8).

### 1.3 Goals and non-goals

Goals

- Stock S3 clients work unmodified apart from endpoint and credentials: AWS
  SDKs (Go, JS, Python, Java, .NET, Rust), AWS CLI v2, rclone, MinIO `mc`.
- Backup- and app-friendly S3: versioning, lifecycle expiry, server-side
  encryption (SSE-S3), browser POST uploads, write-once and rate-limited tokens.
- One admin token, set through the environment, manages the whole server.
  Buckets are created by the admin only; each bucket has many tokens.
- Global pipelines, attached per bucket, running `before` or `after` save,
  integrated by handing the service a token.
- One static binary or container, environment-configured, one data directory,
  strong consistency.
- Optional multi-node mode: capacity and throughput scale by sharding buckets
  across nodes, and clients talk to any node (§8).
- Operable: metrics, a run log, retries, backfill, key rotation.

Non-goals (v1)

- No UI, and no CLI beyond the process subcommands in §2.1. REST is the only
  interface.
- No object replication, erasure coding, multi-region or automatic rebalancing.
  Cluster mode shards *buckets* across nodes (§8): a bucket lives on one node and
  is not made highly available by it.
- No IAM policy language, STS or user accounts — tokens carrying seven actions
  (§4.4).
- No object lock or legal hold (the `create` and `purge` actions give write-once
  protection instead), SSE-KMS or SSE-C, bucket notifications (pipelines replace
  them), website hosting, replication, or ACLs.
- Pipelines do not stream object bytes to services; they hand over a token
  (a body-delivery mode is a possible later addition, §13.2).

### 1.4 Concepts

| Concept | Description |
|---|---|
| Admin token | Value of `BINVAULT_ADMIN_TOKEN`. Authorises the admin API only. Never stored. |
| Bucket | Namespace of objects, created by the admin. |
| Bucket token | S3 credential pair bound to one bucket, with grants (actions on key patterns) and an optional expiry. A bucket has many. |
| Object | Immutable bytes plus metadata and tags, addressed by bucket and key. In a versioned bucket every write is a new version (§3.10). |
| Version | One stored state of a key. A versioned bucket keeps every version; an unversioned bucket keeps exactly one (§3.10). |
| Delete marker | A zero-byte version that hides a key in a versioned bucket (§3.10). |
| Pipeline | Global procedure: stage (`before` / `after`), events, match filters, a service to call, and the token grants that service receives. |
| Attachment | A pipeline included in a bucket, with a position, an enabled flag and an optional narrowing filter. |
| Event | `object.created`, `object.updated` or `object.deleted`. |
| Run | One execution of one pipeline for one event. |
| Pipeline token | Ephemeral S3 credential minted for each service call and delivered to the service; revoked when the call ends. |
| Staged object | A received but not yet committed upload. Visible only to the `before` pipeline token of that write. |
| Node | One binvault process with its own data directory. A single node is a cluster of one. |
| Home node | The one node that stores a bucket's objects, serves it and is its only writer (§8). Chosen when the bucket is created; changed only by an explicit move (§8.8). |
| Catalog | The small control-plane state replicated to every node: bucket → home entries, pipeline definitions and an access-key index (§8.2). |

### 1.5 Pipeline flow at a glance

```
client ── PUT ──► binvault
                   1. authenticate, stream the body into a staging file
                   2. before pipelines, in order ── invoke ──► service
                        the service reads / replaces / deletes the staged
                        object through the S3 API using its token
                   3. atomic commit: the object becomes visible, 200 to client
                   4. after pipelines, asynchronous, in order ── invoke ──► service
                        the service reads / derives / tags / deletes with
                        its token
```

In a cluster the client can start at any node; that node forwards the request to
the bucket's home, which runs these steps (§8.4).

### 1.6 Quick tour

```bash
export ADMIN=$(openssl rand -hex 32)          # admin token
export MASTER=$(openssl rand -base64 32)      # keep it: it seals token secrets
docker run -d --name binvault -p 9000:9000 -p 127.0.0.1:9001:9001 -v binvault-data:/var/lib/binvault \
  -e BINVAULT_ADMIN_TOKEN=$ADMIN -e BINVAULT_MASTER_KEY=$MASTER \
  ghcr.io/kalevski/toolcase/binvault     # 9000 = S3, 9001 = admin (host loopback only)

BV=http://localhost:9000               # S3 API
ADM=http://127.0.0.1:9001/_admin/v1    # admin API
curl -sX POST $ADM/buckets -H "Authorization: Bearer $ADMIN" \
  -d '{"name":"photos","versioning":"enabled"}'
curl -sX POST $ADM/buckets/photos/tokens -H "Authorization: Bearer $ADMIN" \
  -d '{"name":"web","grants":[{"actions":["read","write","delete","list"]}]}'
# → { "access_key_id": "BVK…", "secret_access_key": "…" }   (secret shown once)

AWS_ACCESS_KEY_ID=BVK… AWS_SECRET_ACCESS_KEY=… \
  aws --endpoint-url $BV s3 cp ./a.png s3://photos/a.png
```

A cluster adds only a few variables and a peer URL list; see the cluster tour in
§8.10.

## 2. Process, configuration and routing

### 2.1 Subcommands

| Command | Purpose |
|---|---|
| `binvault run` | Serve the API. Default when no command is given. |
| `binvault validate [--deep]` | Parse config; check secrets; load the files `run` loads (the TLS certificate and key of the public and admin listeners, the pipeline CA bundle and, in cluster mode, the peer listener's certificate and the cluster CA bundle); open the database read-only and check its schema version; verify that the master key opens every sealed value (§4.7); check the data dir (writable; the data dir itself, `tmp/`, `uploads/` and `blobs/` on one filesystem; free space) and, in cluster mode, the cluster settings (§8.3; peers are not contacted). A database older than the binary's schema is reported as `migration pending (N to M)`: the sealed-value and blob checks read it with the new schema's queries, so they run once `run` has migrated it (§9.6); a database from a newer schema is a problem. `--deep` also verifies that every referenced blob exists, naming the bucket, key and version of the objects that need a missing one. Exits non-zero on any problem and changes nothing; it takes no lock (§3.1), so it also works on a live node's data dir. |
| `binvault healthcheck` | `GET /_healthz` on the local listen address; exit 0 or 1. Used by the container `HEALTHCHECK` (the image has no curl). It fails while the node shuts down (§9.3). |
| `binvault rekey` | Re-encrypt every sealed secret under the current master key (§4.7). The node must be stopped: `rekey` takes the data dir's lock (§3.1) and exits 1 while another process holds it, since a running node would not know the new key. In a cluster, run it on every node. |
| `binvault version` | Print version, commit and Go version. |

`binvault help`, `--help` and `-h` (also after a command) print the usage and exit 0. `validate` takes only `--deep`, `run` and `rekey` take no arguments, and anything else exits 2; `run` is the only name of the serving command.

### 2.2 Container and filesystem

- Static binary (`CGO_ENABLED=0`, pure-Go SQLite), multi-stage build, distroless
  non-root runtime image, `EXPOSE 9000 9001 9100` (S3, admin, and the peer
  listener of §8, used only in a cluster), `VOLUME /var/lib/binvault`.
- Inside a container the loopback address is unreachable from the host, so the
  image sets `BINVAULT_ADMIN_LISTEN=0.0.0.0:9001` and
  `BINVAULT_ADMIN_INSECURE_HTTP=true`. Publish 9001 on the host's loopback only
  (`-p 127.0.0.1:9001:9001`).
- The process writes only under `BINVAULT_DATA_DIR`. Unlike imagewarden it
  needs a writable volume, but `--read-only --cap-drop ALL` works as long as
  the data dir is a mounted volume.
- A systemd unit is shipped in `packaging/binvault.service` (as for zonewright).

### 2.3 Configuration

Environment-only in v1. Every variable has a default except the two secrets (and,
in a cluster, the cluster key and node name).
Applied overrides are logged at boot; secrets are never logged. Unknown
`BINVAULT_*` variables produce a warning (catches typos), as does a cluster variable set
on a single node; warnings go through the process logger like every other line, so
`BINVAULT_LOG_FORMAT=json` is JSON on every line, and `BINVAULT_LOG_LEVEL` filters
them. The secret
variables also accept a `_FILE` form (`BINVAULT_ADMIN_TOKEN_FILE`,
`BINVAULT_MASTER_KEY_FILE`, `BINVAULT_MASTER_KEY_OLD_FILE`,
`BINVAULT_CLUSTER_KEY_FILE`) for mounted secrets.

| Variable | Default | Meaning |
|---|---|---|
| `BINVAULT_ADMIN_TOKEN` | — **required** | Admin bearer token: at least 32 characters, none of them a comma. Boot fails otherwise. A comma-separated list of such tokens is accepted so the token can be rotated without downtime (§4.2). Use the same value on every node of a cluster. |
| `BINVAULT_MASTER_KEY` | — **required** | Base64 of 32 random bytes. Seals secrets at rest (§4.7); identical on every node of a cluster. **Back it up**: without it stored token secrets cannot be recovered. |
| `BINVAULT_MASTER_KEY_OLD` | — | Comma-separated base64 keys, decrypt-only, used during key rotation. |
| `BINVAULT_LISTEN` | `:9000` | Bind address of the public (S3) listener. |
| `BINVAULT_ADMIN_LISTEN` | `127.0.0.1:9001` | Bind address of the admin listener, which serves `/_admin/v1/**` and `/_metrics` and nothing else. A non-loopback address needs TLS (below) or `BINVAULT_ADMIN_INSECURE_HTTP`. |
| `BINVAULT_ADMIN_TLS_CERT_FILE`, `BINVAULT_ADMIN_TLS_KEY_FILE` | — | TLS for the admin listener. |
| `BINVAULT_ADMIN_INSECURE_HTTP` | `false` | Allow a non-loopback admin listener without TLS (for example in a container whose admin port is published on the host's loopback only). The image sets it. |
| `BINVAULT_ENDPOINT_URL` | `http://<hostname>:<port>` | URL at which **pipeline services** reach *this node*. Must be reachable from them. In a cluster each node sets its own; it is also the node's public `endpoint` in `GET /_admin/v1/cluster`. |
| `BINVAULT_DOMAIN` | — | Enables virtual-hosted-style requests for `<bucket>.<domain>` (§2.4). Identical on every node of a cluster. |
| `BINVAULT_REGION` | `us-east-1` | Region binvault reports (`GetBucketLocation`) and hands to pipeline services. Requests signed for any other region are accepted (§4.5). |
| `BINVAULT_TLS_CERT_FILE`, `BINVAULT_TLS_KEY_FILE` | — | Optional built-in TLS (enables HTTP/2). Normally TLS is terminated by a reverse proxy. |
| `BINVAULT_TRUSTED_PROXIES` | — | CIDRs whose `X-Forwarded-For` is trusted for client addresses on the public listener (peers are trusted by the cluster key instead, §8.4). |
| `BINVAULT_DATA_DIR` | `/var/lib/binvault` | Root of all persistent state. |
| `BINVAULT_FSYNC` | `true` | fsync blobs and directories before acknowledging a write. `false` also sets SQLite to `synchronous=NORMAL`: after a power loss the most recent acknowledged commits can be gone (the database itself stays consistent in WAL mode). |
| `BINVAULT_MIN_FREE_MB` | `512` | Writes fail with `StorageFull` below this much free space. |
| `BINVAULT_MAX_OBJECT_MB` | `5120` | Largest object (single PUT or assembled multipart): 1 to 5242880, the hard ceiling of 5 TiB. |
| `BINVAULT_GC_GRACE` | `1h` | How long an unreferenced blob is kept before unlinking. Keep it longer than your backup's copy phase (§9.5). |
| `BINVAULT_MULTIPART_TTL` | `168h` | Idle multipart uploads older than this are aborted. At least `1m`. |
| `BINVAULT_CLOCK_SKEW` | `15m` | SigV4 timestamp tolerance (§4.5). |
| `BINVAULT_HEADER_TIMEOUT` | `10s` | Time allowed to receive request headers. |
| `BINVAULT_BODY_IDLE_TIMEOUT` | `60s` | A transfer that moves no bytes for this long is aborted (`RequestTimeout`; on the admin listener a request body that stops arriving is answered `400`, and a response nobody reads is cut). It applies to the public and the admin listener alike, and to the transfers of a bucket move (§8.8): a target that stops taking data fails the move. There is no overall transfer timeout. |
| `BINVAULT_SHUTDOWN_TIMEOUT` | `60s` | Grace period on SIGTERM (SIGINT and SIGHUP end the node the same way, §9.4). Give a supervisor a stop timeout longer than this (the shipped systemd unit and compose files do). |
| `BINVAULT_AUTH_FAIL_LIMIT` | `30` | Failed authentications per minute per client address before throttling (§4.8). |
| `BINVAULT_SCRUB_INTERVAL` | `0` (off) | Interval of the optional integrity scrubber (§3.9). The first pass runs about a minute after start (sooner when the interval is shorter). |
| `BINVAULT_LIFECYCLE_INTERVAL` | `1h` | How often lifecycle rules are evaluated (§3.12). The first pass runs about a minute after start (sooner when the interval is shorter), so a long interval does not mean "never" on a node that restarts more often. |
| `BINVAULT_LIFECYCLE_BATCH` | `1000` | Lifecycle actions applied per transaction. A run keeps going batch after batch until nothing is left or `BINVAULT_LIFECYCLE_INTERVAL` has passed. |
| `BINVAULT_PIPELINE_WORKERS` | `8` | Concurrency of `after` runs on this node. |
| `BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT` | `25s` | Time budget for the whole `before` chain of one write: `1s` to `10m`. Keep it below your clients' and proxies' timeouts (§7.9). Must be the same on every node of a cluster (`hello` reports a mismatch, §8.3). |
| `BINVAULT_PIPELINE_MAX_DEPTH` | `4` | Maximum causal depth of `after` runs triggered by pipeline writes (§7.11). |
| `BINVAULT_PIPELINE_ALLOW_PRIVATE` | `true` | Allow pipeline URLs resolving to private or loopback addresses. Link-local and cloud-metadata addresses are always refused (§7.13). |
| `BINVAULT_PIPELINE_CA_FILE` | — | Extra CA bundle trusted for pipeline HTTPS calls. |
| `BINVAULT_PIPELINE_RUN_RETENTION` | `336h` | How long finished runs are kept (14 days). |
| `BINVAULT_METRICS_PER_BUCKET` | `true` | Per-bucket metric labels; disable for many buckets. With `false` the `bucket` label disappears: the three per-bucket gauges and the lifecycle counter keep their names and become node-wide figures (§9.2). |
| `BINVAULT_LOG_FORMAT` | `logfmt` | `logfmt` or `json`. |
| `BINVAULT_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error`. |
| `BINVAULT_NODE_NAME` | — | Cluster only; **required when `BINVAULT_CLUSTER_URLS` is set** (a container's default hostname changes on every re-create). Unique human name of this node: used in the admin API, logs and `x-binvault-node`. Buckets are bound to the node's id, not its name (§8.3). |
| `BINVAULT_CLUSTER_URLS` | — | Comma-separated peer URLs: the **same list on every node, itself included**. Unset = single node, and none of the `BINVAULT_CLUSTER_*` settings apply (§8). |
| `BINVAULT_CLUSTER_KEY` | — | Shared secret (≥ 32 bytes) that authenticates peers. **Required when `BINVAULT_CLUSTER_URLS` is set.** Several comma-separated keys are accepted during rotation: a node sends the first key and accepts all of them. |
| `BINVAULT_CLUSTER_LISTEN` | `:9100` | Peer listener: catalog replication and forwarded requests. Keep it off the public network. |
| `BINVAULT_CLUSTER_TLS_CERT_FILE`, `BINVAULT_CLUSTER_TLS_KEY_FILE` | — | TLS for the peer listener. Omit when it listens on loopback behind a TLS proxy. |
| `BINVAULT_CLUSTER_CA_FILE` | — | Extra CA bundle (or pinned self-signed certificate) trusted for peer HTTPS. |
| `BINVAULT_CLUSTER_INSECURE_HTTP` | `false` | Allow plain-HTTP peer URLs and listener (private network or VPN only). Everything on the peer link then travels readable: the cluster key, forwarded object data and newly issued token secrets. |
| `BINVAULT_CLUSTER_PULL_INTERVAL` | `5s` | Fallback poll for catalog replication; a nudge normally makes it sub-second (§8.5). |
| `BINVAULT_CLUSTER_MAX_CLOCK_SKEW` | `2m` | Catalog ops stamped further in the future than this are held and alarmed. |
| `BINVAULT_CLUSTER_STARTUP_FENCE` | `30s` | How long a starting node waits for all its peers before it serves buckets or accepts catalog writes (§8.5). |
| `BINVAULT_CLUSTER_RETENTION` | `720h` | Catalog op history kept (30 days); compaction needs every peer's acknowledgement. |
| `BINVAULT_CLUSTER_FORWARD_CONNECT_TIMEOUT` | `3s` | Dial timeout when forwarding to a home node; failure answers `503`. |
| `BINVAULT_MOVE_STREAMS` | `4` | Parallel blob streams during a bucket move (§8.8). |
| `BINVAULT_MOVE_FREEZE_TIMEOUT` | `60s` | Longest the write freeze at the end of a move may last (it grows with the number of objects, not their size: about 20 µs per version, roughly 22 s per million versions with fsync on); past it the move fails and the old home resumes. Raise it for buckets with more than a million versions (§8.8). |

### 2.4 URL space and routing

| Path | Purpose | Auth | Listener |
|---|---|---|---|
| `GET /` | S3 ListBuckets | bucket token | public |
| `/{bucket}`, `/{bucket}/{key…}` | S3 API, including POST Object | §4.5 | public |
| `/_admin/v1/…` | Admin API | admin token | admin |
| `GET /_healthz` | Readiness/liveness | none | public |
| `GET /_version` | Build info: `{"version", "commit", "go"}` (the same Go version `binvault version` prints) | none | public |
| `GET /_metrics` | Prometheus text exposition | admin token | admin |
| `/_peer/v1/…` and forwarded requests | Cluster replication, discovery and forwarding (§8) | cluster key | peer (cluster only) |

An anonymous `GET /` is `403 AccessDenied`, as on S3: ListBuckets needs a bucket
token (§4.1). `/_healthz` and `/_version` answer on exactly those paths; `/_healthz/x`
and `/_version/x` are `404`.

In path-style requests any first path segment beginning with `_` is reserved for
binvault. Bucket names cannot start with `_`, so the namespaces never collide.
(The service endpoints are underscore-prefixed rather than `/healthz` because
`healthz` is a legal bucket name.) On the public listener `/_admin/…` and
`/_metrics` answer `404`; the admin API exists only on the admin listener. The
reservation does not apply when the bucket comes from `Host` (virtual-hosted
style, below): there the whole path is the key, and keys may start with `_`
(`/_next/app.js`). Point health checks at the bare node address, not at a bucket
host.

Addressing styles:

- **Path-style** (always): `https://host/{bucket}/{key}`.
- **Virtual-hosted-style** (when `BINVAULT_DOMAIN` is set): `Host:
  <bucket>.<domain>` selects the bucket and the whole path is the key. Requests
  to the bare domain or any other host are path-style. While a domain is set,
  bucket names containing dots are rejected, since they cannot be addressed.

Routing rules that matter for S3 compatibility:

- Route on the **raw request path**. No path cleaning, no redirects for `//`,
  `.` or `..`; these are literal key text. (Go's default `ServeMux` cleans
  paths and must not be used.)
- Percent-decode the path exactly once. `+` in a path is a literal plus; `+` in
  a query string is a space (S3 behaviour).
- `/{bucket}` and `/{bucket}/` are both the bucket; an empty key means a
  bucket-level operation. A `POST` with a `multipart/form-data` body to the
  bucket is POST Object (§5.4.9).
- In a cluster the bucket is also the routing key: resolve it (from `Host`, the
  first path segment or the access key id) before any other work, and forward the
  request when the bucket is homed elsewhere (§8.4).

## 3. Storage and data model

### 3.1 On-disk layout

```
$BINVAULT_DATA_DIR/
  meta.db (+ -wal, -shm)       SQLite metadata
  blobs/ab/cd/<blob_id>        immutable object bodies (2-level hex fan-out)
  uploads/<upload_id>/<part_id> multipart parts (one file per uploaded part; the `parts` row maps number → part_id)
  tmp/                         in-flight uploads and staged objects; emptied on boot
  FORMAT                       on-disk format marker
  LOCK                         lock file: held (flock) by the one process that uses the data dir
```

A data directory belongs to one process. `binvault run` and `binvault rekey` take an
exclusive, non-blocking `flock` on `LOCK` before they change anything (`run` before it
empties `tmp/`) and exit 1 with "data dir … is in use by another process" while another
process holds it: a second node on a live data dir would delete the first one's staged
files, and a `rekey` on it would re-seal everything under a key the running node does not
know. The lock lives as long as the process (`kill -9` included) and is released after the
database is closed. `validate` and `healthcheck` only read and take no lock, so they work
on a live node's data dir. A filesystem without `flock` support, or a platform without it,
runs unlocked. Run `rekey` as the user that runs the node: a `LOCK` created by another
user (`sudo binvault rekey`) keeps the node from opening it. Files are created `0640` and
directories `0750`, `meta.db` (which holds sealed secrets) and its `-wal` and `-shm` files
included.

The data dir itself, `tmp/`, `uploads/` and `blobs/` must be on one filesystem so a
staged file can be committed with an atomic `rename` (`run` creates `tmp/` and `uploads/`
next to `meta.db`); `validate` checks this, on a fresh data dir too.

A node's identity — a random id generated at first start — lives in `meta.db`, so
it travels with backups of the data dir and changes if a fresh volume is used
(§8.3).

### 3.2 Metadata database

Embedded SQLite via a pure-Go driver (`modernc.org/sqlite`, as in zonewright):
WAL mode, `synchronous=FULL` (`NORMAL` when `BINVAULT_FSYNC=false`), foreign keys on, one serialised writer and a pool
of readers. Schema is versioned with forward-only migrations applied at boot;
a binary refuses to start on a database written by a newer schema. Tables:
`buckets`, `tokens`, `objects`, `blobs`, `uploads`, `parts`, `pipelines`,
`attachments`, `runs`, `backfills`, `kv` (small settings, such as the node's id, §3.1) and
the cluster tables, which a single node carries too, empty: `catalog` (the replicated
registers: bucket entries, pipeline definitions and the access-key index, §8.2), `ops`,
`ops_vv` and `ops_floor` (the catalog op log, its version vector and its compaction floor,
§8.5), `peers` and `peer_urls` (§8.3) and `moves` (§8.8). `buckets` also carries the
`epoch` of the local copy (§8.8). `objects` has one row per object *version* (§3.3). In a cluster `buckets` and `pipelines` hold
the replicated catalog for *every* bucket and pipeline, while objects, tokens,
attachments, runs and the rest only contain rows for the buckets homed on this
node.

Object keys use SQLite's `BINARY` collation, which orders by raw UTF-8 bytes —
exactly the order S3 lists keys in. `objects` is indexed on
`(bucket, key, seq DESC)` (`seq` is the commit sequence of §3.3), so a key's
versions sit together, newest first; listings use keyset pagination over it, and
a partial index on the latest versions serves `ListObjects`. A
`(bucket, seq)` index lets a bucket move page through a bucket's rows in commit
order (§8.8). Lifecycle (§3.12)
uses three partial indexes: current data versions by `created_at`, noncurrent
versions by `noncurrent_since`, and current delete markers.

Bucket counters (`objects`, `versions`, `delete_markers`, `bytes`, `upload_bytes`)
are updated inside the same transaction as every commit and every part upload, so
stats and quota checks are O(1): `max_objects` is checked against `versions −
delete_markers`, `quota_bytes` against `bytes + upload_bytes`.

**Write throughput.** One writer with an fsync per commit would cap small-object
rates, so commits are grouped: concurrent PUT commits share one transaction and
one fsync (a window of at most 5 ms). Run state changes after the enqueue
(`queued → running → succeeded`) are batched in the background (at most 50 ms),
which is safe because losing one only causes a re-run (at-least-once, §7.10).

### 3.3 Object (version) record

| Field | Notes |
|---|---|
| `bucket`, `key` | Identity, together with `version`. |
| `version` | The version's id: a ULID allocated when the write is admitted (unique across a cluster without coordination). It is only an id and never decides order. Exposed as `x-binvault-version`, shown to `before` pipelines, and used by the stale-write guard (§7.8). In an enabled bucket it is also the S3 `VersionId` (§3.10). |
| `seq` | The row's commit sequence: SQLite's autoincrement value, assigned inside the commit transaction, so it is the true commit order. The highest `seq` of a key is its newest version. It decides which version is latest, which one becomes latest when another is purged, and what "newest" means in listings and lifecycle. A bucket move re-inserts rows in `seq` order (§8.8). |
| `blob_id`, `size` | Body and its length. |
| `etag` | Hex MD5 (multipart: `md5-of-part-md5s-N`). |
| `sha256` | Always computed; used for integrity and given to pipelines. |
| `checksum` | The additional S3 checksum (CRC32, CRC32C, CRC64NVME, SHA1, SHA256) the client supplied, if any. |
| `content_type`, `content_encoding`, `content_language`, `content_disposition`, `cache_control`, `expires` | As supplied. Default `Content-Type` is `binary/octet-stream`. |
| `metadata` | User metadata (`x-amz-meta-*`), names lower-cased. |
| `tags` | Object tags. |
| `parts` | Part sizes, only for objects created by multipart upload. Cleared when a `before` pipeline replaces the bytes (the object is then single-part). |
| `created_at` | Commit time; served as `Last-Modified` (1 s resolution). |
| `is_latest` | The key's current version; maintained in the commit transaction. |
| `delete_marker` | A zero-byte version that hides the key (§3.10). |
| `null_version` | The S3 `VersionId` is the literal `null` (written while the bucket was `off`). |
| `noncurrent_since` | When a newer version superseded this one; cleared again if a purge makes this version the latest. Drives lifecycle (§3.12). |
| `sse` | `AES256` when the blob is encrypted (§3.11). |

### 3.4 Blobs, copies and garbage collection

Blob files are immutable and referenced by a counted `blobs` row. `CopyObject`
creates a new object row that references the same blob, so a copy of any size is
O(1) and costs no disk. An overwrite or pipeline replacement creates a new
blob (copy-on-write). Every version row holds one reference, so a noncurrent
version keeps its blob until it is removed (§3.10). A blob whose last reference was dropped is unlinked once
`BINVAULT_GC_GRACE` has passed (the delay keeps file-level backups consistent,
§9.5); an open reader keeps reading even an unlinked file, so in-flight
downloads finish. Orphans (a crash between rename and commit) are removed by the
sweeper (§3.9).

### 3.5 Write path

For `PutObject`, `CopyObject` and `CompleteMultipartUpload`:

1. **Admit.** Authenticate and authorise, validate headers and key, allocate the
   version id (§3.3), apply rate
   limits (§4.9), and check the bucket rules (§3.13), the bucket quota (against
   the declared size: `Content-Length`, or `x-amz-decoded-content-length` for
   `aws-chunked`) and free disk space — all *before* the body is read, so
   `Expect: 100-continue` is answered only for requests that will be accepted.
   A token that holds `create` but not `write` is refused here if the key already
   has a visible object (§4.4). A request refused before its body is read is
   answered at once and the connection is then closed — but only after the node has
   read and thrown away what the client is still sending (up to 64 MiB, for at
   most 30 s and `min(BINVAULT_BODY_IDLE_TIMEOUT, 5 s)` of silence), so a client
   that streams without waiting for `100-continue` (rclone, the Node SDK) reads the
   S3 error instead of a connection reset. A body that stalls, goes on past those
   bounds, or was held back for a `100-continue` that never came is not waited for.
2. **Receive.** Stream the body into `tmp/` while computing MD5, SHA-256 and the
   client-requested checksum, sniffing the content type from the first 512 bytes
   (§3.13) and encrypting when the object is to be encrypted (§3.11). Decode
   `aws-chunked` framing and verify chunk signatures. Enforce size limit, idle
   timeout and bandwidth limits. Memory use is independent of object size.
3. **Verify.** Compare `Content-MD5`, `x-amz-checksum-*` and
   `x-amz-content-sha256` with what was received (`BadDigest`,
   `XAmzContentSHA256Mismatch`, `IncompleteBody`).
4. **Stage.** fsync the file. The object is now *staged* and invisible.
5. **`before` pipelines** run against the staged object (§7.9). They may
   replace it, delete it, or fail the write.
6. **Commit.** Move the staged file to `blobs/` (fsync file and directory), then
   one SQLite transaction: re-check preconditions (`If-None-Match`, `If-Match`,
   and the write-once rule of the `create` action), bucket rules and quota against
   the *final* object, write the version row as the bucket's versioning state
   requires (§3.10: replace the key's only version, or add a version) with the next
   `seq`, adjust blob references and bucket counters, and insert the `after` runs
   for this event (a transactional outbox — an event cannot be lost or emitted for
   a write that did not commit). For `CopyObject` the source version row is
   re-read in this same transaction and the blob reference is taken there; if the
   source is gone the copy fails with `NoSuchKey`, so a copy can never point at a
   blob that was just released.
7. **Respond.** With `BINVAULT_FSYNC=true`, a `200` means data and metadata are
   on stable storage.

Reads: look up the object row, open the blob, stream it (decrypting an encrypted
blob chunk by chunk, §3.11) with S3 range and conditional semantics (§5.4). A
`GET` never touches SQLite writers.

### 3.6 Consistency and concurrency

- Strongly consistent per bucket: read-after-write and list-after-write for
  every operation. In a cluster this holds from any entry node, because a bucket's
  home node serves every request for it (§8.4).
- Overwrites and deletes are atomic. A `GET` returns a complete old or complete
  new object, never a mixture.
- Concurrent writes to one key: the last commit wins. Use conditional writes
  (§5.5) for compare-and-swap.
- Staged objects are invisible to everyone except the pipeline token of that
  write.

### 3.7 Naming rules

- **Bucket names:** 3–63 characters of lowercase letters, digits, hyphens and
  dots; start and end with a letter or digit; no `..`; not shaped like an IPv4
  address; not starting with `_`; no dots while `BINVAULT_DOMAIN` is set.
- **Keys:** valid UTF-8, 1–1024 bytes, no NUL. Byte-exact: no normalisation of
  Unicode, slashes, `.` or `..`. A key ending in `/` is an ordinary object
  (zero-byte "folder markers" are allowed). On disk the key never appears — blobs
  are named by id — so no key can escape the data directory.

### 3.8 Limits

| Limit | Value |
|---|---|
| Key length | 1024 bytes |
| User metadata per object | 2 KiB (sum of names and values), US-ASCII values |
| Tags per object / key / value | 10 / 128 chars / 256 chars |
| Object size | `BINVAULT_MAX_OBJECT_MB` (default 5 GiB, max 5 TiB); per-bucket cap in bucket settings |
| Multipart | 1–10,000 parts; 5 MiB–5 GiB per part (last part may be smaller) |
| `ListObjects*`, `ListParts`, `ListMultipartUploads` page | 1000 |
| `DeleteObjects` keys per request | 1000 |
| XML request body | 2 MiB |
| JSON admin request body | 256 KiB |
| Request header block | 64 KiB |
| Tokens per bucket | 1000 |
| Pipelines (global) / attachments per bucket | 256 / 32 |
| Enabled `before` attachments per bucket | 8 |
| Nodes per cluster | 16 supported (every node pulls from every other) |
| Lifecycle rules per bucket | 100 |
| `allowed_content_types` patterns per bucket | 100 |
| POST Object form fields besides the file | 20 KiB in total |

### 3.9 Background jobs

| Job | Schedule | Action |
|---|---|---|
| Blob GC | every minute | Unlink blobs whose reference count reached zero more than `BINVAULT_GC_GRACE` ago. |
| Orphan sweeper | boot, hourly | Remove blob files with no row and `uploads/` directories with no upload row, older than 1 h; empty `tmp/` at boot. |
| Multipart expiry | every 10 min | Abort uploads idle longer than `BINVAULT_MULTIPART_TTL`. |
| Run pruning | hourly | Delete finished runs older than `BINVAULT_PIPELINE_RUN_RETENTION`. |
| Token bookkeeping | 1 min | Flush `last_used_at`; drop expired pipeline tokens from memory. |
| Scrubber (optional) | about a minute after boot, then every `BINVAULT_SCRUB_INTERVAL` (off at `0`) | Re-hash blobs against stored SHA-256; log and count mismatches. Never repairs or deletes. |
| Lifecycle | about a minute after boot, then every `BINVAULT_LIFECYCLE_INTERVAL` | Apply lifecycle rules in batches of `BINVAULT_LIFECYCLE_BATCH` until nothing is left (§3.12). |
| Move worker (cluster) | on demand | Copy a bucket to its new home and cut over (§8.8). |
| Peer sync (cluster) | `BINVAULT_CLUSTER_PULL_INTERVAL`, and on notify | Pull catalog ops from every peer and acknowledge them (§8.5). |
| Peer discovery (cluster) | 30 s | `hello` every peer URL: liveness, identity, free disk. |
| Catalog compaction (cluster) | hourly | Drop acknowledged ops and tombstones older than `BINVAULT_CLUSTER_RETENTION`. |

### 3.10 Versioning

A bucket's `versioning` setting (admin API, §6.3) is `"off"` (the default) or
`"enabled"`. It can go from off to enabled and never back, as in S3. There is no
"suspended" state: replacing a `null` version in place would let a token without
`purge` destroy history. To stop history growing, give the bucket a lifecycle rule
with `noncurrent_days` (§3.12). The S3 API only reads the setting
(`GetBucketVersioning` answers `Enabled`, or an empty document while `off`);
`PutBucketVersioning` is `AccessDenied`. The object table holds one row per
version from the start, so an unversioned bucket is simply one that keeps a single
version per key.

| State | A write (PUT, copy, POST, multipart) | A delete without `versionId` |
|---|---|---|
| off | Replaces the key's only version | Removes it |
| enabled | Adds a new version; older ones stay | Adds a **delete marker**, a zero-byte version (nothing is added if the key has no versions or its latest version already is a marker) |

- **Version ids.** Every write has a ULID `version` (§3.3). In an enabled bucket
  it is the S3 `VersionId`. When an unversioned bucket is enabled, its existing
  objects become `null` versions: the S3 `VersionId` is the literal `null`, there
  is at most one per key, and it behaves like any other version (a newer write
  makes it noncurrent; `?versionId=null` addresses it). Responses carry
  `x-amz-version-id` only in enabled buckets; `x-binvault-version` is always
  present.
- **Reading.** A plain `GET` or `HEAD` returns the latest version. If that is a
  delete marker the answer is `404 NoSuchKey` with `x-amz-delete-marker: true`.
  `?versionId=<id>` (or `null`) returns that version; a delete marker named by id
  is `405 MethodNotAllowed` with `x-amz-delete-marker: true`, and an unknown id is
  `404 NoSuchVersion`. `read` covers every version. Anonymous requests see only
  the latest version: any `versionId` is `AccessDenied` for them.
- **Permanent deletion.** `DELETE ?versionId=<id>` removes one version or delete
  marker for good and needs `purge`, not `delete`. Removing the latest version
  makes the version with the next-highest `seq` the latest; removing a delete
  marker brings the key back. In an unversioned bucket `versionId=null` counts as
  **no version id at all** — for the action it needs (`delete`), for the `before`
  delete chain and for the event's `operation` (`delete`) — and any other
  `versionId` is `InvalidArgument`.
- **Listing.** `ListObjects` and `ListObjectsV2` show the latest version of each
  key and omit keys whose latest version is a delete marker. `ListObjectVersions`
  (§5.4.8) shows everything.
- **Quota and counters.** Every data version counts: `quota_bytes` sums their
  logical sizes and `max_objects` counts them. Delete markers count toward neither.
  Bucket stats report `objects` (visible keys), `versions` (all version rows,
  markers included) and `bytes`.
- **Events** describe changes to what a plain `GET` would return (§7.5): a key
  that gains a visible object is `object.created`; a visible object replaced by
  another version — a new write, or a permanent deletion that uncovers an older
  one — is `object.updated`; a key that stops being visible — a delete marker, the
  permanent deletion of its last visible version, or lifecycle expiry — is
  `object.deleted`. Changes to noncurrent versions raise no event.
- **Blobs.** Each version row holds one blob reference (§3.4). A noncurrent
  version keeps its blob until it is removed by `purge`, by lifecycle (§3.12), or
  with the bucket.

### 3.11 Server-side encryption (SSE-S3)

Opt-in per bucket or per request; the master key (§4.7) is the root of trust.

- **Switches.** The bucket setting `encryption` is `"none"` (the default) or
  `"sse-s3"`, which encrypts every new write. A request can also ask for it with
  `x-amz-server-side-encryption: AES256` (PutObject, CopyObject,
  CreateMultipartUpload, POST Object). `aws:kms`, `aws:kms:dsse` and the SSE-C
  headers are `NotImplemented`. Existing objects keep the state they were written
  in. Responses for encrypted objects carry `x-amz-server-side-encryption: AES256`.
  `GetBucketEncryption` reports the bucket default (or
  `ServerSideEncryptionConfigurationNotFoundError`); its Put and Delete are
  `AccessDenied` (admin API).
- **Keys.** Each bucket has a random 256-bit **bucket data key**, stored sealed
  under the master key (§4.7). It is created and committed (fsynced) when the
  bucket first needs it — `encryption` set to `sse-s3`, or the first request that
  asks for SSE — and always before the first encrypted byte is written; creation is
  serialised per bucket, and a key that cannot be opened is never replaced (boot
  fails instead, §4.7). A blob's key is
  `HKDF-SHA256(bucket data key, salt = blob id, info = "binvault/blob/v1")`, so
  every blob has its own key and only the bucket key is stored. Rotating the
  master key re-seals bucket data keys; blobs are never rewritten.
- **Format.** An encrypted blob is a small header (magic, version, chunk size,
  plaintext length) followed by 64 KiB chunks, each AES-256-GCM with a counter
  nonce; the last chunk is marked in its associated data so truncation is
  detected. A ranged read decrypts only the chunks it needs. Overhead is 16 bytes
  per chunk.
- **Where it applies.** Encryption happens while the body streams into `tmp/`, so a
  staged object is already encrypted. MD5, SHA-256 and the other checksums are
  computed over the plaintext, so `ETag` and checksums behave as for unencrypted
  objects. `GET`, anonymous reads, the scrubber, the staged view (§7.8) and
  pipeline tokens all see plaintext, and a pipeline replacement inherits the
  object's encryption. Multipart parts are stored encrypted too: every part file
  has a random `part_id` (kept in its `parts` row; re-uploading a number writes a
  new file with a new id and deletes the old one), and its key is derived like a
  blob key with `part_id` as the salt, so no key and nonce are ever reused. Parts
  are re-encrypted as one blob at completion, which is already a full pass over the
  data.
- **Copies.** A same-bucket copy shares the encrypted blob (O(1)). The destination
  is encrypted if the request says `AES256` or the bucket default is `sse-s3`;
  otherwise it keeps the source's state, so a copy never silently decrypts. When the
  destination's state differs from the source's, the copy writes a new blob instead.
  UploadPartCopy cannot decrypt either: a part copied from an encrypted source makes
  the whole multipart upload encrypted (that part is stored encrypted and Complete
  writes an encrypted object).
- **Cost and limits.** Reads of encrypted blobs cannot use `sendfile`; AES-GCM runs
  at gigabytes per second per core, which is rarely the bottleneck. SSE-S3
  protects stolen disks and backups, not an attacker who has the master key or the
  running process.

### 3.12 Lifecycle

Rules are a bucket setting (admin API, §6.3). The S3 API reads them
(`GetBucketLifecycleConfiguration`, as S3 XML); `PutBucketLifecycleConfiguration`
and `DeleteBucketLifecycle` are `AccessDenied`. A rule:

| Field | Meaning |
|---|---|
| `id`, `enabled` | Name and on/off switch. |
| `filter` | Every present condition must match: `prefix`, `tags` (all listed tags), `min_size`, `max_size`. Empty = every object. |
| `expire_days` | The current data version expires when it is this many days old, counted from its creation. Unversioned bucket: the object is deleted. Enabled: a delete marker is added. A current delete marker is left alone (see `expire_delete_markers`). |
| `expire_delete_markers` | Remove a delete marker once it is the only version of its key left. |
| `noncurrent_days` | A noncurrent version is removed this many days after it became noncurrent. |
| `noncurrent_keep` | With `noncurrent_days`: always keep this many of the newest noncurrent versions. |
| `abort_multipart_days` | Abort multipart uploads this many days after they were initiated (`BINVAULT_MULTIPART_TTL` still aborts idle ones). |

```json
"lifecycle": [
  { "id": "scratch", "filter": { "prefix": "tmp/" }, "expire_days": 2,
    "abort_multipart_days": 1 },
  { "id": "history", "noncurrent_days": 30, "noncurrent_keep": 5,
    "expire_delete_markers": true }
]
```

- **Execution.** A janitor job (`BINVAULT_LIFECYCLE_INTERVAL`, default 1 h) visits
  the buckets that have rules, finds candidates through the partial indexes of §3.2
  and applies them in batches of `BINVAULT_LIFECYCLE_BATCH` per transaction,
  continuing until nothing is left or the interval has passed. Every action names
  the exact version row it selected (key and `seq`) and is skipped if that row has
  changed since, so a concurrent overwrite is never expired by mistake. The earliest
  expiry among the matching rules wins. A day is 24 hours from the version's
  timestamp; unlike S3, expiry is not rounded to midnight UTC.
- **Events and pipelines.** Expiring a *visible* object raises `object.deleted`
  (`operation: lifecycle`, `actor.kind: lifecycle`), so cascade-cleanup pipelines
  run. Removing noncurrent versions or delete markers raises no event. Lifecycle is
  the owner's policy: it does not run `before` chains and cannot be vetoed.
- **Header.** An object covered by an `expire_days` rule carries
  `x-amz-expiration: expiry-date="<HTTP-date>", rule-id="<id>"` on PUT, GET and HEAD.
- Rules move with a bucket (§8.8) and run on its home node.

### 3.13 Bucket rules

Two bucket settings (§6.3) let a bucket enforce policy itself, before any pipeline
runs:

- `max_object_bytes` — the largest single object; larger writes are
  `EntityTooLarge`.
- `allowed_content_types` — patterns such as `image/*` or `application/pdf`
  (case-insensitive, media type only: parameters such as `; charset=utf-8` are
  ignored, as in `match`, §7.3; at most 100; empty = anything). The type is
  **sniffed from the object's first 512 bytes** (the Go sniffer plus a table of
  extra signatures); the declared `Content-Type` is stored as sent but not trusted. A write whose sniffed
  type matches no pattern is `ContentTypeNotAllowed` (415). Unrecognised binary
  data sniffs as `application/octet-stream`, so list that type if such uploads are
  acceptable.

The size cap is checked at admission and while receiving. The type is checked as
soon as the first 512 bytes arrive: a rejected upload is read and discarded (nothing
is stored) and answered `415` when its body ends, so clients that send the whole
body before reading the response still see the error. It is checked again on the
final bytes after `before` pipelines, since a transform can change the type.
Multipart uploads are checked at part 1 and at completion. Rules apply to every
write path, `after` pipelines writing derivatives
included, so a bucket restricted to images cannot receive a JSON sidecar: use
another bucket or widen the list. Unlike a pipeline's `match` (§7.3), rules
enforce.

## 4. Authentication and authorization

### 4.1 Principals

| Principal | Obtained by | Can |
|---|---|---|
| Admin | `BINVAULT_ADMIN_TOKEN` | The admin API and `/_metrics`, on the admin listener only. **No object access** — to read or write objects the admin mints a bucket token like anyone else, which keeps the audit trail honest. On the S3 API the admin token is not a credential: it is rejected like any other invalid bearer, with no hint that it is the admin token. |
| Bucket token | Admin API (§6.4) | The S3 API on exactly one bucket, limited by its grants and expiry. |
| Pipeline token | Minted for each service call (§7.8) | The S3 API on one bucket, limited to the pipeline's grants and to the triggering object. Never the admin API. |
| Anonymous | — | `GET`/`HEAD` of objects in buckets that enable `anonymous_read` (§4.6), CORS preflight, `/_healthz`, `/_version`. |
| Peer | `BINVAULT_CLUSTER_KEY` on the peer listener (§8.3) | Replicate the catalog, forward S3 requests, and carry admin calls that the receiving node has already authenticated (§8.6). A forwarded S3 request still carries the client's own credentials, which the home node verifies. Peers are fully trusted (§8.3). |

### 4.2 Admin token

`Authorization: Bearer <BINVAULT_ADMIN_TOKEN>`, compared in constant time.
Accepted only on the admin listener, for `/_admin/v1/**` and `/_metrics`. There is
one admin identity and the token is never stored or logged. To rotate it, put the
new token next to the old one (comma-separated), restart, switch clients over,
then remove the old one. In a cluster every node has the same set. The node that
receives an admin call authenticates it; the token never crosses the peer link
(calls for another node's bucket travel as peer requests, §8.6).

### 4.3 Bucket tokens

A bucket token is an S3-style credential pair:

- `access_key_id` — `BVK` + 17 characters from `A–Z2–7` (20 total, so SDKs that
  validate key length are satisfied). Public identifier.
- `secret_access_key` — 40 random alphanumeric characters, returned **once**,
  at creation.

| Attribute | Meaning |
|---|---|
| `name` | Human label. |
| `grants` | One or more `{ "actions": [...], "keys": [...] }` entries (§4.4): `actions` ⊆ the seven of §4.4; `keys` are key patterns (§4.4), omitted = every key. Neither list may be empty (`400`). A request is allowed when some grant covers its action and key. |
| `limits` | Optional rate limits for this token (§4.9). |
| `expires_at` | Optional. An expired token fails as `InvalidAccessKeyId`, like an unknown or revoked one. |
| `last_used_at` | Updated at most once a minute. |

A token authorises exactly one bucket; cross-bucket requests are `AccessDenied`.
Revoking a token (`DELETE`, §6.4) takes effect immediately: the node that serves
the bucket invalidates its cache synchronously. A transfer already in flight
completes.

### 4.4 Actions and the authorization matrix

Seven actions, shared by bucket tokens and pipeline grants:

| Action | S3 operations it permits |
|---|---|
| `read` | GetObject, HeadObject (any version), GetObjectAttributes, GetObjectTagging, GetObjectAcl, source side of CopyObject / UploadPartCopy |
| `list` | ListObjects, ListObjectsV2, ListObjectVersions, ListMultipartUploads |
| `create` | PutObject, POST Object, destination of CopyObject / UploadPartCopy, CreateMultipartUpload, UploadPart, CompleteMultipartUpload — **only where the key has no visible object** (write-once, below); also AbortMultipartUpload and ListParts, which write-once does not restrict |
| `write` | The same operations **without** that restriction (overwriting, or adding a version), and PutObjectAcl (`private` or `bucket-owner-full-control`, accepted and ignored); **implies `create` and `tag`** |
| `tag` | PutObjectTagging, DeleteObjectTagging, and tags supplied with a write (`x-amz-tagging`, POST `tagging`, `x-amz-tagging-directive: REPLACE`, CreateMultipartUpload): a write that carries tags needs `tag` as well as `create`; `write` implies it |
| `delete` | DeleteObject / DeleteObjects entries **without** a version id: permanent in an unversioned bucket (where `versionId=null` counts as no version id), a delete marker in an enabled one |
| `purge` | DeleteObject / DeleteObjects entries **with** a version id in an enabled bucket: permanent removal of one version or delete marker. Each DeleteObjects entry is judged exactly like the equivalent DeleteObject, so a token holding only `purge` can remove versions in a batch too |

**Write-once.** A token with `create` but not `write` can add keys but never
replace one: a write over a visible object is `AccessDenied` ("this token may only
create new keys"), checked at admission and again atomically at commit, like
`If-None-Match: *`. With `read` and `list` but no `delete` or `purge` it is a
backup credential that a leak cannot use to destroy existing data. A key whose
latest version is a delete marker counts as having no visible object (the write
then adds a version and overwrites nothing, because versioning can never be
suspended, §3.10).

Bucket-level calls — HeadBucket, GetBucketLocation, ListBuckets, CreateBucket on
the token's own bucket, GetBucketVersioning, GetBucketLifecycleConfiguration,
GetBucketEncryption, GetBucketCors, GetBucketAcl, PutBucketAcl (`private` or
`bucket-owner-full-control`, ignored) and the other stubbed sub-resources — need any
one action on that bucket.
Overwriting an existing key needs `write`, not `delete`.

**Key patterns.** A grant's `keys` are literal text with an optional single
trailing `*` that matches any suffix, `/` included; a pattern without `*` matches
exactly one key. A literal `*` or `\` inside a pattern is written `\*` or `\\`.
An action on a key is allowed when some grant lists that action
and a pattern matching the key. `list` is honoured when the request's `prefix`
starts with the literal part of a granted pattern (otherwise `AccessDenied`), and
results are filtered to permitted keys. Pipeline grants use the same patterns and
add `{variables}` (§7.8).

### 4.5 Request authentication on the S3 API

Accepted, in this order of detection:

1. **AWS Signature V4, header form** — `Authorization: AWS4-HMAC-SHA256
   Credential=<access_key_id>/<date>/<region>/s3/aws4_request,
   SignedHeaders=…, Signature=…`. This is what every SDK does.
2. **AWS Signature V4, presigned query form** — `X-Amz-Algorithm`,
   `X-Amz-Credential`, `X-Amz-Date`, `X-Amz-Expires` (1–604800 s),
   `X-Amz-SignedHeaders`, `X-Amz-Signature` (§5.9).
3. **Bearer, pipeline tokens only** — `Authorization: Bearer
   <access_key_id>.<secret_access_key>` with a `BVP…` pipeline token (§7.8), a
   binvault extension for services that do not want an SDK. A bucket token
   (`BVK…`) sent as bearer is `AccessDenied` ("use SigV4 or a presigned URL"):
   its secret is long-lived and must not travel in a header. `curl` can sign for
   itself: `curl --aws-sigv4 "aws:amz:us-east-1:s3" --user "$KEY:$SECRET" …` (any
   region string works, see below) — curl 8.1 or newer, which sends the
   `x-amz-content-sha256` header the S3 flavour of SigV4 needs; curl 7.87 to 8.0 also
   works with `-H "x-amz-content-sha256: UNSIGNED-PAYLOAD"`, older ones are refused (use the
   AWS CLI).
4. **POST policy** — a SigV4 signature over a form policy, for POST Object only
   (§5.4.9).
5. **Anonymous**, only where §4.6 allows.

Not supported: Signature V2, HTTP Basic, cookies, tokens in query strings.
Mixing header and query authentication is `InvalidRequest`.

SigV4 requirements:

- It is the **S3 flavour**: the canonical URI is the exact request path,
  URI-encoded once, with no normalisation; the payload hash comes from
  `x-amz-content-sha256` (required for header-signed requests); `host` and
  `x-amz-date` (or `Date`) must be signed.
- Time: for header-signed requests `x-amz-date` must be within
  `BINVAULT_CLOCK_SKEW` of server time, else `RequestTimeTooSkewed`. A presigned URL
  or POST policy is valid from its signing date (a date more than the skew in the
  future is `RequestTimeTooSkewed`) until its own expiry (§5.9, §5.4.9), however
  long ago it was signed.
- Signed headers: every `x-amz-*` request header must be signed (as on S3), so a
  presigned-URL holder cannot add `x-amz-copy-source`, `x-amz-tagging` or the like;
  an unsigned one is `AccessDenied` (`HeadersNotSigned`). `x-amz-content-sha256` in
  the header form is exempt. Presigned URLs must be SigV4: SDKs that default to
  Signature V2 for presigning (botocore without `signature_version="s3v4"`) get
  `400`.
- Scope: the credential scope's service must be `s3`. **Any region is
  accepted**: the signature is verified with the region the client signed for, so
  apps configured for another region (or `auto`) work unchanged. A malformed
  scope is `AuthorizationHeaderMalformed` (HTTP 400). `BINVAULT_REGION` is only
  what binvault reports and hands to pipeline services.
- Failures: unknown, revoked or expired key → `InvalidAccessKeyId`; bad signature →
  `SignatureDoesNotMatch`; known key without permission → `AccessDenied`.
- Payload modes (`UNSIGNED-PAYLOAD`, signed hex hash, the `STREAMING-*`
  variants) are listed in §5.8.
- Derived signing keys are cached per (key, date, region) for the day, only after a
  signature has verified, in a bounded cache (any region string is accepted, so an
  unbounded cache would be a memory leak).

### 4.6 Anonymous read

Per-bucket setting `anonymous_read` (admin API, §6.3):

- `"off"` (default) — no anonymous access.
- `"objects"` — unauthenticated `GET`/`HEAD` of objects, optionally limited to
  `anonymous_prefixes`. The latest version only: never listing, never a
  `versionId`, never writes, never tagging or ACL calls.

Anonymous responses carry the object's stored `Cache-Control`, plus
`X-Content-Type-Options: nosniff` (as do all object responses) and
`Content-Security-Policy: sandbox`, so a user-uploaded HTML or SVG file opened
directly cannot run script in the bucket's origin (images embedded in pages are
unaffected).

### 4.7 Secrets at rest and key rotation

SigV4 requires the server to know the raw secret, so token secrets cannot be
one-way hashed. They are **sealed**: AES-256-GCM with a random 96-bit nonce,
the record type and id as associated data, and the first four bytes of the key's
SHA-256 stored beside the ciphertext as a key id.

Sealed values: bucket token secrets, bucket data keys (§3.11), pipeline
`service.headers` values, and pipeline `service.signing_secret`. Everything else in `meta.db` is plaintext
metadata; the admin token is not stored at all.

Rotation: set the new key as `BINVAULT_MASTER_KEY`, move the previous one to
`BINVAULT_MASTER_KEY_OLD`, restart (old values still decrypt), stop the server,
run `binvault rekey` (re-seals every sealed value in the database under the current
key, including the ones inside catalog ops, §8.5), start, then drop the old key —
but only once no backup sealed under it is still needed: a backup keeps the key
that sealed it, so restoring an older backup needs that key in
`BINVAULT_MASTER_KEY_OLD`. Without the right key a sealed value is unrecoverable.
`validate` and boot **fail** and name the records that cannot be opened (a wrong
master key is caught here), and binvault never replaces a sealed value it cannot
open.

Pipeline tokens are never persisted (§7.8).

In a cluster every node uses the same master key: pipeline secrets replicate
sealed. `hello` lists the id of every key a node can open (current first), and an
op carrying sealed values goes to a peer that can open the key that sealed it;
otherwise the op is held (not skipped) and alarmed until that peer has the key
(§8.3). Bucket token secrets and bucket data keys never leave their home node,
except sealed inside a move and, for a token secret, in the one response that
issues it (§6.4). Rotate in three steps, so that every node can always open
everything that any node seals: (1) add the new key to `BINVAULT_MASTER_KEY_OLD` on
every node (nothing is sealed under it yet); (2) make it the current
`BINVAULT_MASTER_KEY` on every node, one node at a time, moving the old key to
`BINVAULT_MASTER_KEY_OLD`; (3) stop and `rekey` each node in turn, then drop the old
key.

### 4.8 Brute-force protection

Failed authentications are counted per client address in a sliding one-minute
window. Once an address has `BINVAULT_AUTH_FAIL_LIMIT` failures in the window it is
answered `503 SlowDown` (S3 API) or `429` (admin API) with `Retry-After` until the
window clears. The check comes before authentication, so a valid request from a blocked
address is refused too; behind NAT or an untrusted proxy every client shares one
address (list the proxy in `BINVAULT_TRUSTED_PROXIES`). Keys are
never blocked, only addresses, so knowing a key id (it is public) cannot lock a
token out. Failures of pipeline-token keys (`BVP…`) are not counted: a service
that keeps calling after its token was revoked cannot lock itself or its
neighbours out. Client address is the socket peer unless it is in
`BINVAULT_TRUSTED_PROXIES`, in which case it is the right-most `X-Forwarded-For`
entry that is not itself a trusted proxy. In a cluster the home node does the
counting, using the client address its forwarding peer reports (§8.4).

### 4.9 Rate limits

Limits keep one tenant from starving a node. A **bucket** (§6.3) and a **token**
(§6.4) can each carry them, with the same fields:

| Field | Effect |
|---|---|
| `requests_per_second`, `burst` | Request rate. A request over the limit is answered `503 SlowDown` with `Retry-After`. `burst` defaults to twice the rate. |
| `bytes_in_per_second` | Pace of uploads. |
| `bytes_out_per_second` | Pace of downloads. |

A request must pass both the token's and the bucket's limits; anonymous reads count
against the bucket's. Request limits reject; bandwidth limits *slow* the transfer
(shared by its concurrent transfers) instead of failing it. Pipeline tokens are
exempt, since pipeline concurrency already bounds their load (§7.2), and so are the
admin API and `/_healthz`. Limits are enforced where the bucket lives, so they are
exact even in a cluster, and they reset when the node restarts. Throttled requests
are counted in `binvault_throttled_total{reason}`.

## 5. S3 API

### 5.1 Conventions

- XML request and response bodies use the S3 namespace
  `http://s3.amazonaws.com/doc/2006-03-01/`; wire formats follow the AWS S3 API
  reference unless noted here.
- Every response carries `x-amz-request-id` (unique, also logged), `x-amz-id-2`,
  `Date`, and `Server: binvault`.
- Timestamps: XML elements use `2006-01-02T15:04:05.000Z`, always with a zero
  fraction — object times are whole seconds, as in S3, and agree with
  `Last-Modified` (`aws s3 sync --exact-timestamps` compares them); headers use
  HTTP-date. `ETag` is always a quoted string in headers.
- Errors are S3 XML (`<Error><Code/><Message/><Resource/><RequestId/>`), media
  type `application/xml`. `HEAD` errors carry the status only.
- Request bodies: a `PUT` needs `Content-Length`, an `aws-chunked` stream with
  `x-amz-decoded-content-length`, or `Transfer-Encoding: chunked` (accepted
  liberally); otherwise `MissingContentLength` (411).
- Unknown request headers are ignored. A recognised `x-amz-*` header that
  implies unsupported behaviour (SSE-KMS or SSE-C, object lock,
  website redirect, non-private ACLs) is rejected rather than silently
  ignored.
- `x-amz-expected-bucket-owner` and `x-amz-request-payer` are accepted and
  ignored.
- binvault adds a few response headers: `x-binvault-version` (object version),
  `x-binvault-modified: true` on a write whose content was replaced by a
  `before` pipeline, and, in cluster mode, `x-binvault-node` — the name of the
  node that produced the response, normally the bucket's home.
- Enabled buckets add `x-amz-version-id` and `x-amz-delete-marker` (§3.10);
  encrypted objects add `x-amz-server-side-encryption: AES256` (§3.11); objects
  covered by an `expire_days` rule add `x-amz-expiration` (§3.12).

### 5.2 Compatibility matrix

Legend: **Full** — as S3. **Partial** — supported with the noted differences.
**Stub** — a fixed, harmless answer so common tools keep working.
**Restricted** — exists but is an admin-API concern here. **No** —
`NotImplemented` (501).

| Area | Operation | Support | Notes |
|---|---|---|---|
| Service | ListBuckets | Partial | Returns only the token's own bucket; an anonymous `GET /` is `403 AccessDenied`. |
| Bucket | HeadBucket | Full | |
| | CreateBucket | Restricted | Token's own existing bucket → `200`, nothing changes (S3 does the same in us-east-1); anything else → `AccessDenied` ("use the admin API"). |
| | DeleteBucket | Restricted | `AccessDenied`. |
| | GetBucketLocation | Full | Empty `LocationConstraint` for `us-east-1`, as S3. |
| | GetBucketVersioning | Full | `Enabled`, or an empty document while `off` (§3.10). |
| | PutBucketVersioning | Restricted | `AccessDenied` (admin API). |
| | GetBucketLifecycleConfiguration | Partial | The admin-managed rules as S3 XML; `NoSuchLifecycleConfiguration` when there are none (§3.12). |
| | PutBucketLifecycleConfiguration, DeleteBucketLifecycle | Restricted | `AccessDenied` (admin API). |
| | GetBucketEncryption | Partial | The bucket default (§3.11); `ServerSideEncryptionConfigurationNotFoundError` when none. |
| | PutBucketEncryption, DeleteBucketEncryption | Restricted | `AccessDenied` (admin API). |
| | GetBucketCors | Partial | Read-only view of admin-managed rules. |
| | PutBucketCors, DeleteBucketCors | Restricted | `AccessDenied` (admin API). |
| | GetBucketAcl, GetObjectAcl | Stub | Fixed owner with `FULL_CONTROL`. |
| | PutBucketAcl, PutObjectAcl, `x-amz-acl` | Partial | `private` and `bucket-owner-full-control` accepted and ignored; others `AccessControlListNotSupported`, and so are `x-amz-grant-*` headers. An `AccessControlPolicy` body is accepted (and ignored) only when it grants nothing to anyone but the owner — what s3cmd sends for "private"; a grant to a group (`AllUsers`) or another account is `AccessControlListNotSupported`, so a client never believes something was shared. |
| | Other sub-resources (policy, tagging, website, object-lock, replication, ownership-controls, public-access-block) | No | GET → the S3 "not configured" error (`NoSuchBucketPolicy`, `NoSuchTagSet`, `NoSuchWebsiteConfiguration`, `ObjectLockConfigurationNotFoundError`, `ReplicationConfigurationNotFoundError`, `OwnershipControlsNotFoundError`, `NoSuchPublicAccessBlockConfiguration`); PUT/DELETE → `NotImplemented`. `logging`, `notification`, `requestPayment` GET → default empty document. |
| Objects | PutObject | Full | Conditional writes, checksums, tagging header, SSE-S3, versioning. |
| | GetObject, HeadObject | Full | Range, conditionals, `response-*` overrides, `partNumber`, `versionId`. |
| | GetObjectAttributes | Partial | `ObjectParts` of a multipart object carries part numbers and sizes, not per-part checksums (§5.4.7). |
| | DeleteObject, DeleteObjects | Full | Delete markers and version ids (§3.10). |
| | CopyObject | Partial | Same bucket only; `?versionId` selects the source version. |
| | ListObjectsV2, ListObjects | Full | |
| | ListObjectVersions | Full | §5.4.8. |
| | Get/Put/DeleteObjectTagging | Full | With `versionId`. |
| | RestoreObject, SelectObjectContent, retention, legal hold, torrent | No | |
| Multipart | Create, UploadPart, UploadPartCopy, Complete, Abort, ListParts, ListMultipartUploads | Full | |
| Uploads from browsers | POST Object (form + policy) | Full | §5.4.9. Presigned PUT works too. |
| Auth | SigV4 header, presigned, streaming payloads | Full | §4.5, §5.8. |
| | SigV2 | No | |
| | Bearer | Extension | Pipeline tokens only (§4.5). |
| Misc | CORS preflight | Full | §5.10. |
| | Virtual-hosted-style addressing | Optional | `BINVAULT_DOMAIN`. |
| | Object Lock, SSE-KMS, SSE-C, replication, inventory, analytics, access points, S3 Express, bucket notifications | No | Pipelines cover notification-style needs; `create` and `purge` cover write-once protection. |

In an unversioned bucket `versionId=null` addresses the key's only version (a
delete with it is a plain delete) and any other `versionId` is `InvalidArgument`;
enabled buckets follow §3.10.
`x-amz-storage-class` accepts `STANDARD` and
`REDUCED_REDUNDANCY` (stored and reported as `STANDARD`); other classes are
`InvalidStorageClass`. The `Owner` element, where S3 requires one, is the
bucket name for both `ID` and `DisplayName`.

### 5.3 Bucket-level behaviour

- **ListBuckets** (`GET /`) lists the single bucket the credential belongs to
  with its creation time. Tools such as `aws s3 ls`, rclone and Cyberduck use
  it as a connectivity check, which is why it is supported rather than denied.
- **CreateBucket** (`PUT /{bucket}`) answers `200` for a token's own bucket and
  changes nothing, so tools that "ensure the bucket exists" (rclone, `aws s3 mb`,
  Terraform) keep working; it never creates anything: any other name, existing or
  not, is `AccessDenied`.
- Bucket sub-resource requests are recognised by their query parameter and
  answered per the matrix; an unrecognised parameter on a bucket request is
  `NotImplemented`, never silently treated as ListObjects.

### 5.4 Object operations

#### 5.4.1 PutObject

`PUT /{bucket}/{key}` — needs `create` (when the key has no visible object) or
`write`; `x-amz-tagging` also needs `tag` (`write` implies it).

- Headers honoured: `Content-Type`, `Content-Encoding`, `Content-Language`,
  `Content-Disposition`, `Cache-Control`, `Expires`, `x-amz-meta-*`,
  `x-amz-tagging` (`k=v&k2=v2`, URL-encoded, ≤ 10 tags → `InvalidTag`),
  `Content-MD5`, `x-amz-content-sha256`, `x-amz-checksum-*`,
  `x-amz-sdk-checksum-algorithm`, `x-amz-storage-class`,
  `x-amz-server-side-encryption`, `If-None-Match`, `If-Match`.
- Flow: §3.5, including `before` pipelines (§7.9). The client's request is held
  open until the object is committed.
- Response: `200`, `ETag` of the **final** stored bytes, the `x-amz-checksum-*`
  header if one was supplied, `x-binvault-version`, `x-amz-version-id` (enabled
  buckets), `x-amz-server-side-encryption` (encrypted objects), and
  `x-binvault-modified` when a pipeline replaced the content. Empty body.
- An overwrite is atomic and keeps the old object visible until commit.
- Clients that verify an upload by comparing the returned `ETag` with a local
  MD5 will report a mismatch for an object a pipeline modified; that is
  inherent to transformation pipelines.
- Errors include `EntityTooLarge`, `BadDigest`, `InvalidDigest`,
  `IncompleteBody`, `KeyTooLongError`, `MetadataTooLarge`, `InvalidTag`,
  `QuotaExceeded`, `StorageFull`, `PreconditionFailed`, `ContentTypeNotAllowed`,
  `SlowDown`, `AccessDenied` (a `create`-only token over an existing key), and the
  pipeline errors (§5.11).

#### 5.4.2 GetObject and HeadObject

`GET|HEAD /{bucket}/{key}` — needs `read` (or anonymous read).

- **`versionId`** selects a version (§3.10); a delete marker is `404 NoSuchKey`
  when it is the latest and `405 MethodNotAllowed` when named by id, both with
  `x-amz-delete-marker: true`.
- **Range**: a single `bytes=` range (`a-b`, `a-`, `-n`) → `206` + `Content-Range`;
  unsatisfiable → `416 InvalidRange`. Multiple ranges are ignored and the full
  object is returned with `200`, as S3 does. `Accept-Ranges: bytes` always.
- **Conditionals**: §5.5.
- **`partNumber`**: for objects created by multipart upload returns that part's
  bytes (`206`, `x-amz-mp-parts-count`); for other objects `partNumber=1` is the
  whole object and anything else is `InvalidPartNumber` (416). With a `Range`
  header it is `InvalidRequest`, as in S3.
- **`response-*` overrides** — `response-content-type`, `-content-language`,
  `-expires`, `-cache-control`, `-content-disposition`, `-content-encoding` —
  only on signed or presigned requests; anonymous → `InvalidRequest`.
- **`x-amz-checksum-mode: ENABLED`** returns the stored checksum headers.
- Response headers: `Last-Modified`, `ETag`, `Content-Length`, `Content-Type`
  and the other stored content headers, `x-amz-meta-*`, `x-amz-tagging-count`
  (when tags exist), `x-binvault-version`, `x-amz-version-id` (enabled buckets),
  `x-amz-server-side-encryption`, `x-amz-expiration`,
  `X-Content-Type-Options: nosniff`.
  `x-amz-storage-class` is omitted (S3 omits it for STANDARD).
- `HEAD` returns the same headers with no body; its errors are status only.

#### 5.4.3 DeleteObject

`DELETE /{bucket}/{key}` — needs `delete`. Returns `204` whether or not the key
existed. In an enabled bucket it adds a delete marker and answers with
`x-amz-delete-marker: true` and `x-amz-version-id`, unless the key has no versions
or its latest version already is a marker, in which case nothing is added; see
§3.10. `DELETE …?versionId=<id>` removes one version for good, needs `purge`, and
answers with that `x-amz-version-id`. An `object.deleted` event fires when a
visible object stopped being visible (§7.5). A `before` pipeline may veto a delete
without a version id → `422 PipelineRejected` (§7.9); a delete with a version id
runs no `before` chain. (In an unversioned bucket `versionId=null` counts as no
version id, §3.10, so it cannot be used to get around a delete gate.)

#### 5.4.4 DeleteObjects

`POST /{bucket}?delete` — every entry is judged exactly like the equivalent
DeleteObject: `delete` for an entry without a `<VersionId>`, `purge` for one with
it (§4.4). Up to 1000 keys, `<Quiet>` supported; results report `<DeleteMarker>`
and `<DeleteMarkerVersionId>` as S3 does. Always `200` with per-key `<Deleted>` /
`<Error>` entries (a key the token's grants do not cover, or one vetoed by a
pipeline, is an `<Error>` for that key only; an `<Object>` without a `<Key>` is
`MalformedXML` for the whole request). `Content-MD5` and `x-amz-checksum-<algo>`
(header, or the trailer of an `aws-chunked` body) are verified when present but not
required: `BadDigest`. Each deleted key fires its own event. Entries are
processed in order, and the `before` delete chains of all entries share **one**
budget, `BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT`. Entries that match no `before`
chain are not held up by it. When the budget runs out, the entries still waiting
are judged by the rule of §7.9 step 4: `<Error>` `PipelineTimeout` and not
deleted, unless every unfinished pipeline of that entry is `on_error: continue`,
in which case the delete proceeds.

#### 5.4.5 CopyObject

`PUT /{bucket}/{key}` with `x-amz-copy-source: [/]bucket/key` (URL-encoded;
`?versionId=<id>` selects a source version, a delete marker being
`InvalidRequest`) — needs `read` on the source and `write` or `create` on the
destination.

- **Same bucket only.** A different source bucket is `AccessDenied` ("tokens are
  bucket-scoped"), since a token authorises one bucket (and in a cluster the two
  buckets could live on different nodes).
- O(1): the new version shares the source blob (§3.4), unless the copy changes its
  encryption (§3.11). A copy is a single-part object: it keeps the source's ETag
  but not its part layout (`partNumber` reads and `ObjectParts` see one part).
- `x-amz-metadata-directive` `COPY` (default) / `REPLACE`;
  `x-amz-tagging-directive` `COPY` / `REPLACE`; `x-amz-copy-source-if-*`
  conditionals (§5.5).
- Copying a key's current version onto itself with nothing changed — the result
  would have the same metadata, tags and encryption state as the source, after the
  bucket default is applied — is `InvalidRequest`, as in S3. Anything else is an
  ordinary copy that adds a version (or replaces the only one): a source
  `?versionId` (restoring an old version), `REPLACE` of metadata or tags, or a
  different encryption state (an SSE header, or a bucket default the source does
  not have: how existing objects get encrypted). It counts as a write
  (`object.updated`).
- Fires created/updated for the destination with `operation: copy` and
  `copy_source` (§7.6); `before` pipelines run against the destination.
- Response: `CopyObjectResult` (`ETag`, `LastModified`) plus, in enabled buckets,
  `x-amz-copy-source-version-id` and `x-amz-version-id`. If the operation is still
  running after 10 seconds (slow `before` pipelines), binvault sends `200` and
  finishes the XML — or an `<Error>` document — later, with whitespace keep-alives,
  as S3 does. After that early `200` the outcome lives only in the body, so the
  `x-amz-version-id` and `x-binvault-*` headers are not sent and the 4xx/5xx retry
  hints of §5.11 do not apply: an SDK maps an `<Error>` inside a `200` by its own
  rules.

#### 5.4.6 Listing

`GET /{bucket}?list-type=2` (V2) and `GET /{bucket}` (V1) — need `list`.

- Parameters: `prefix`, `delimiter`, `max-keys` (≤ 1000, default 1000,
  `0` allowed), `encoding-type=url`, V2: `continuation-token`, `start-after`,
  `fetch-owner`; V1: `marker`.
- Order: ascending raw UTF-8 byte order. Staged and not-yet-committed objects
  are never listed. Only the latest version of each key is listed, and keys whose
  latest version is a delete marker are omitted (§3.10).
- Response: `Name`, `Prefix`, `Delimiter`, `MaxKeys`, `KeyCount`, `IsTruncated`,
  `NextContinuationToken` (V2) / `NextMarker` (V1, with delimiter),
  `Contents` (`Key`, `LastModified`, `ETag`, `Size`, `StorageClass=STANDARD`,
  `ChecksumAlgorithm`) and `CommonPrefixes`.
- Continuation tokens are opaque and do not expire. A token encodes the last entry
  emitted — a key, or a common prefix, in which case resuming skips every key
  beneath it — so a page that ends on a common prefix never repeats it.
- A key that contains characters XML 1.0 cannot carry (control characters) makes
  a listing without `encoding-type=url` fail with `400 InvalidRequest`, which says
  to retry with `encoding-type=url`; with it the key is percent-encoded.
- Implementation note: with a delimiter, after emitting a common prefix the
  scan seeks to that prefix's upper bound instead of walking every key beneath
  it, so listing a "directory" is proportional to its direct children.

#### 5.4.7 GetObjectAttributes

`GET /{bucket}/{key}?attributes` with `x-amz-object-attributes`
(`ETag`, `Checksum`, `ObjectParts`, `StorageClass`, `ObjectSize`) — needs
`read`.

Known limitation: for a multipart object `ObjectParts` lists each part's
`PartNumber` and `Size` but not its checksum. The object record keeps the part sizes
only (§3.3), and the part rows, which hold the checksums, go with the upload when
it completes; `ListParts` of an open upload reports them.

#### 5.4.8 ListObjectVersions

`GET /{bucket}?versions` — needs `list`. Parameters: `prefix`, `delimiter`,
`max-keys` (≤ 1000), `encoding-type=url`, `key-marker`, `version-id-marker`.
Response: `Name`, `Prefix`, `Delimiter`, `MaxKeys`, `IsTruncated`, `KeyMarker`,
`VersionIdMarker`, `NextKeyMarker`, `NextVersionIdMarker`, a `Version` entry per
object version (`Key`, `VersionId`, `IsLatest`, `LastModified`, `ETag`, `Size`,
`StorageClass`, `ChecksumAlgorithm`) and a `DeleteMarker` entry per delete marker
(`Key`, `VersionId`, `IsLatest`, `LastModified`), plus `CommonPrefixes`. Order:
keys ascending (raw UTF-8 bytes), each key's versions newest first (by `seq`).
`VersionId` is `null` for the `null` version, and in an unversioned bucket every
key has exactly one such version. `version-id-marker` and `NextVersionIdMarker` are
the `VersionId`, as in S3 (`null` for the null version): paging resumes after that
version, and a marker whose version has since been purged is `InvalidArgument`.
Anonymous requests cannot list versions.

#### 5.4.9 POST Object

`POST /{bucket}` (or `POST /` on a virtual-hosted host) with a
`multipart/form-data` body lets a browser upload straight to the bucket with a
signed policy.

- **Fields.** `key` (`${filename}` is replaced by the uploaded file's name),
  `policy` (base64 JSON), `x-amz-algorithm` (`AWS4-HMAC-SHA256`),
  `x-amz-credential`, `x-amz-date`, `x-amz-signature`, and optionally
  `Content-Type`, `Cache-Control`, `Content-Disposition`, `Content-Encoding`,
  `Expires`, `x-amz-meta-*`, `tagging` (XML), `x-amz-checksum-*`,
  `x-amz-storage-class`, `x-amz-server-side-encryption`, `acl` (`private` or
  `bucket-owner-full-control`),
  `success_action_status` (`200`, `201` or `204`; default `204`) or
  `success_action_redirect`, and finally `file`, which must be the last field. The
  fields other than `file` may total at most 20 KiB.
- **Authentication.** The signature is SigV4 over the base64 policy string, made
  with a bucket token's secret. That token must grant `write` (or `create`) on the
  final key, plus `tag` if the form carries `tagging`. The policy's `expiration` may
  be at most 7 days away; it, not the clock-skew window, bounds how long the form
  stays valid.
- **Policy.** `{ "expiration": "…", "conditions": [ … ] }`. Supported conditions:
  exact matches (`{"bucket": "b"}`, `{"x-amz-meta-user": "42"}`),
  `["eq", "$field", value]`, `["starts-with", "$field", prefix]` and
  `["content-length-range", min, max]`, which is enforced while the body streams.
  Every form field except `file`, `policy`, `x-amz-signature` and `x-ignore-*`
  must be covered by a condition, otherwise `AccessDenied` ("Invalid according to
  Policy: Extra input fields").
- **Form details.** Field names are case-insensitive; a field may appear once;
  `bucket` is implied by the URL (a policy condition on it is checked against the
  bucket); `acl` takes the same two values as `x-amz-acl`; the form's `tagging`
  field is XML. A `file` part must come last.
- **Result.** The file streams into staging exactly like a PutObject body and
  follows the same path: bucket rules, `before` pipelines, versioning, and events
  with `operation: post`. Success answers with `success_action_status` — `204` or
  `200` with an empty body, or `201` with a `PostResponse` XML (`Location`,
  `Bucket`, `Key`, `ETag`) — or a `303` redirect to `success_action_redirect` with
  `bucket`, `key` and `etag` added to its query. Responses — refusals as well as the
  success — carry the bucket's CORS headers for the form's `Origin`, so scripts can
  read them.

### 5.5 Conditional requests

| Header | Operations | Condition | Failure |
|---|---|---|---|
| `If-Match` | GET, HEAD, PutObject, CompleteMultipartUpload | ETag equals | `412 PreconditionFailed` |
| `If-None-Match` | GET, HEAD | ETag differs | `304` |
| `If-None-Match: *` | PutObject, CompleteMultipartUpload | the key must have no visible object (a latest delete marker counts as none) | `412 PreconditionFailed` |
| `If-Modified-Since` | GET, HEAD | modified after | `304` |
| `If-Unmodified-Since` | GET, HEAD | not modified since | `412` |
| `x-amz-copy-source-if-match` / `-if-none-match` / `-if-modified-since` / `-if-unmodified-since` | CopyObject, UploadPartCopy | as above, on the source | `412` |

Evaluation order follows RFC 9110. Conditional **writes** are checked at
admission (fast failure) and again atomically inside the commit transaction, so
`If-None-Match: *` is a true create-only guarantee even with `before` pipelines
holding the write open. A loser of a concurrent race gets `412`. As in S3,
`If-Match` on a write to a key with no visible object is `404 NoSuchKey` (there is
nothing to match), not `412`; `If-None-Match` on a write accepts only `*`
(`NotImplemented` otherwise).

### 5.6 Multipart uploads

- **Create** returns an opaque random `UploadId` bound to bucket and key.
  `Content-Type`, metadata, tags and checksum algorithm declared here apply to
  the finished object.
- **UploadPart**: part numbers 1–10,000, each 5 MiB–5 GiB except the last.
  Re-uploading a number replaces it (a new part file with a new random `part_id`;
  the old file is deleted, §3.11). The part `ETag` is its MD5. Parts are stored
  under `uploads/` and are not events and not pipeline inputs. Part bytes count
  against the bucket's `quota_bytes` while the upload is open and are released on
  completion, abort or expiry, so unfinished uploads cannot fill the disk.
- **UploadPartCopy**: copies a byte range (`x-amz-copy-source-range`) of an
  object in the same bucket into a part. From an encrypted source it makes the whole
  upload encrypted (§3.11).
- **Complete**: validates the ordered part list (`InvalidPartOrder`,
  `InvalidPart` for an unknown part or wrong ETag, `EntityTooSmall`), enforces
  the object size cap and quota (net of the upload's own parts, which are released
  at the same moment), concatenates the parts into a staged blob, and
  proceeds through the normal commit path including `before` pipelines. The
  final `ETag` is `"<md5 of the concatenated binary part MD5s>-<N>"`. Slow
  completes use the early-`200` keep-alive described for CopyObject. Completion
  honours `If-None-Match`/`If-Match`. A repeated Complete with the identical
  part list within 10 minutes of success returns the same `200` result
  (SDK timeouts retry Complete). That lookup happens right after authentication,
  before the write-once check and the conditional headers, so a retry never turns
  a success into a `403` or `412`.
- If a `before` pipeline **rejects** the completed object, the upload is aborted
  and its parts are deleted. If the chain **fails** for any other reason (service
  down, timeout, client gone), the upload stays open so the client can retry
  Complete without re-sending parts.
- **Versioning, encryption and rules.** `CreateMultipartUpload` records an
  encryption request, and parts are stored encrypted when it applies (§3.11); the
  content-type rule is checked at part 1 and at completion (§3.13); a completed
  upload adds a version, reported in `x-amz-version-id`, in an enabled bucket.
- **Abort** deletes the parts. **ListParts** and **ListMultipartUploads** follow
  S3 paging (`part-number-marker`, `key-marker`, `upload-id-marker`,
  `max-parts`, `max-uploads`). Uploads are listed by key and, within a key, by
  initiation time (ties by id); `upload-id-marker` resumes after that upload in this
  order, and when that upload is gone (a clean-up loop aborts what it listed) the
  rest of its key is listed in full. Abort and ListParts need `create` or `write` but are
  not restricted by the write-once rule (§4.4).
- Idle uploads are aborted after `BINVAULT_MULTIPART_TTL`.

### 5.7 Tagging

`GET|PUT|DELETE /{bucket}/{key}?tagging` (with `versionId` for one version). At
most 10 tags, key ≤ 128, value ≤ 256
characters (`InvalidTag`). Keys and values use S3's tag syntax: letters, numbers,
spaces (U+0020 and the other Unicode separators) and `+ - = . _ : / @` — a control
character such as CR, LF or TAB is `InvalidTag`. In the XML each `<Tag>` needs both
`<Key>` and `<Value>` (an empty `<Value/>` is fine; a missing one is `MalformedXML`).
`x-amz-tagging-count` is returned on GET/HEAD.
Changing tags does **not** change the object's version, ETag or `Last-Modified`
and fires no event. Tags are the lightest way for a pipeline to record a result
(`scan=clean`) without rewriting the object (§7.14).

### 5.8 Checksums and payload signing

`x-amz-content-sha256` values accepted on header-signed requests:

| Value | Meaning |
|---|---|
| 64 hex characters | Signed payload hash, verified against the body (`XAmzContentSHA256Mismatch`). |
| `UNSIGNED-PAYLOAD` | Body not hashed. Presigned requests are treated as this. |
| `STREAMING-AWS4-HMAC-SHA256-PAYLOAD` | `aws-chunked` body, each chunk signed. |
| `STREAMING-AWS4-HMAC-SHA256-PAYLOAD-TRAILER` | As above plus a trailing checksum with its own signature. |
| `STREAMING-UNSIGNED-PAYLOAD-TRAILER` | `aws-chunked` body, unsigned chunks, trailing checksum. |

Additional checksums: CRC32, CRC32C, CRC64NVME, SHA1, SHA256 — supplied as
`x-amz-checksum-<algo>` or as a trailer announced by `x-amz-trailer`, declared
by `x-amz-sdk-checksum-algorithm`. binvault verifies them against the received
bytes (`BadDigest`), stores them, and returns them on GET/HEAD when
`x-amz-checksum-mode: ENABLED`. Multipart uploads verify each part's checksum
and produce the composite (`<base64>-<N>`) or full-object result according to
`x-amz-checksum-type`. A trailer announced by `x-amz-trailer` must arrive: a body
that ends without it is `400 MalformedTrailerError` and stores nothing. The newer S3
algorithms (SHA512, MD5, XXHASH64/3/128, or any other `x-amz-checksum-<x>`) are not
implemented, and a request that supplies one — as a header, as a trailer, or only
declared by `x-amz-sdk-checksum-algorithm` — is `400 InvalidRequest` rather than
accepted unverified.

This is load-bearing for compatibility: AWS SDKs released since January 2025
send a CRC32 trailer on every upload by default, so the trailer modes above are
not optional.

SDKs also add `Content-Encoding: aws-chunked` to these uploads. binvault removes
`aws-chunked` from the stored `Content-Encoding` (any other encodings stay), so
downloads are not mislabelled.

If a `before` pipeline replaces an object's bytes, the stored checksum is
recomputed over the new bytes with the same algorithm (as a single-part,
full-object checksum), so SDKs that validate downloads against it keep working.

### 5.9 Presigned URLs

GET, HEAD, PUT, DELETE and multipart part requests can be presigned by anyone
holding a token's secret, with any SigV4 implementation (`generate_presigned_url`,
`getSignedUrl`, …). `X-Amz-Expires` is 1–604800 s and counts from `X-Amz-Date`,
however long ago that was (the clock-skew window applies only to header-signed
requests, §4.5); an expired URL is
`AccessDenied` ("Request has expired"). A presigned URL carries the token's
permissions **at the time of use**: revoking or expiring the token kills every
URL it signed. `response-*` overrides are allowed in presigned GETs.

`x-amz-*` **query parameters** other than the signing ones (`X-Amz-Algorithm`,
`-Credential`, `-Date`, `-Expires`, `-SignedHeaders`, `-Signature`,
`-Security-Token`, `-Content-Sha256`) are the headers of the same name, as in S3:
SDKs such as aws-sdk-js-v3 hoist `x-amz-meta-*`, `x-amz-tagging`,
`x-amz-server-side-encryption`, `x-amz-storage-class`, `x-amz-acl`,
`x-amz-checksum-*` and `x-amz-copy-source` into the query, where the signature covers
them. Once the signature is verified they are handled exactly like the header form
(stored, verified, or refused as unsupported); a header the request also carries
wins. This holds for presigned requests only — an unsigned `x-amz-*` *header*
remains refused (§4.5), and the query of a header-signed request is not read this
way. One value is not taken at its word: aws-sdk-js-v3 signs every presigned
PutObject / UploadPart URL with `x-amz-checksum-crc32=AAAAAA==` (and
`x-amz-sdk-checksum-algorithm=CRC32`), the checksum of the empty body it has at
signing time. A checksum parameter that is the checksum of zero bytes is therefore
not verified against a request that is not known to carry an empty body; it only
declares its algorithm, and the object gets the real checksum of what was uploaded.
Any other value is verified (`BadDigest`).

### 5.10 CORS

CORS rules are bucket settings managed through the admin API (§6.3). A preflight
`OPTIONS` is answered before authentication from the bucket's rules. Actual
responses to matching origins carry `Access-Control-Allow-Origin`, `Vary:
Origin`, and `Access-Control-Expose-Headers`. With no rules a preflight is
`403 AccessDenied` ("CORS is not enabled for this bucket"). Credentials mode is
not enabled. A POST Object form submitted from another origin needs `POST` in the
rules' `allowed_methods`.

### 5.11 Errors

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>NoSuchKey</Code>
  <Message>The specified key does not exist.</Message>
  <Key>a.png</Key>
  <BucketName>photos</BucketName>
  <Resource>/photos/a.png</Resource>
  <RequestId>01J9…</RequestId>
</Error>
```

Standard S3 codes in use:

| Code | HTTP | Typical cause |
|---|---|---|
| `AccessDenied` | 403 | No grant for the action or key, admin token on the S3 API, restricted operation, expired presigned URL |
| `InvalidAccessKeyId` | 403 | Unknown, revoked or expired key |
| `SignatureDoesNotMatch` | 403 | Bad signature or secret |
| `RequestTimeTooSkewed` | 403 | Clock skew beyond `BINVAULT_CLOCK_SKEW` |
| `AuthorizationHeaderMalformed` | 400 | Malformed header or credential scope |
| `AuthorizationQueryParametersError` | 400 | Malformed presigned query |
| `AccessControlListNotSupported` | 400 | ACL headers other than private / bucket-owner-full-control, grant headers, an ACL body that grants anyone but the owner |
| `NoSuchBucket` / `NoSuchKey` / `NoSuchUpload` / `NoSuchVersion` | 404 | |
| `InvalidBucketName`, `InvalidArgument`, `InvalidRequest`, `InvalidTag`, `InvalidStorageClass`, `InvalidDigest`, `KeyTooLongError`, `MetadataTooLarge`, `MalformedXML` | 400 | Validation |
| `BadDigest`, `XAmzContentSHA256Mismatch`, `IncompleteBody`, `MalformedTrailerError` | 400 | Integrity (`MalformedTrailerError`: an announced checksum trailer never arrived, §5.8) |
| `EntityTooLarge`, `EntityTooSmall` | 400 | Size limits (single object / non-final part) |
| `InvalidPart`, `InvalidPartOrder`, `InvalidPartNumber` | 400 / 416 | Multipart completion, `partNumber` |
| `RequestTimeout` | 400 | Transfer idle longer than `BINVAULT_BODY_IDLE_TIMEOUT` |
| `MissingContentLength` | 411 | |
| `PreconditionFailed` | 412 | Failed `If-Match` / `If-None-Match: *` / `If-Unmodified-Since` |
| `ConditionalRequestConflict` | 409 | A `before` delete chain found the object replaced while it ran (§7.9); the client may retry. (The loser of a concurrent `If-Match` / `If-None-Match` race gets `412`.) |
| `InvalidRange` | 416 | |
| `MethodNotAllowed` | 405 | A version id that names a delete marker (§3.10) |
| `NotImplemented` | 501 | §5.2 |
| `SlowDown`, `ServiceUnavailable` | 503 | Throttling, shutdown, or (cluster) the bucket's home node is unreachable (§8.4) |
| `InternalError` | 500 | |

binvault-specific codes:

| Code | HTTP | When |
|---|---|---|
| `PipelineRejected` | 422 | A `before` pipeline rejected the write or the delete (§7.9). Not retried by SDKs. |
| `PipelineFailed` | 502 | A `before` service was unreachable, answered badly, or had no free slot, with `on_error: reject`. SDKs retry 5xx. |
| `PipelineTimeout` | 504 | A `before` service, or the whole chain (or a DeleteObjects request's shared budget, §5.4.4), exceeded its time. |
| `QuotaExceeded` | 403 | Bucket `quota_bytes` or `max_objects` would be exceeded. |
| `StorageFull` | 507 | Free disk below `BINVAULT_MIN_FREE_MB`, or the disk is full. |
| `ContentTypeNotAllowed` | 415 | The object's sniffed content type matches no `allowed_content_types` pattern (§3.13). |

`<Resource>` is the bucket and key, or the request path for a request that names
neither (the service root).

Pipeline statuses were chosen so stock SDK retry policies behave: a content
rejection (4xx) is final, while service failures (5xx) are retried. That holds for
ordinary responses; after an early `200` (§5.4.5, §5.6) the outcome is in the body
and the SDK applies its own rules.

Known limitation: a request target with an invalid percent escape (`/b/%zz`) is
rejected by Go's HTTP server before binvault sees the request, so the answer is
net/http's plain-text `400 Bad Request` rather than an S3 `InvalidURI` document.
Escapes that parse but do not decode to anything usable (in the query, or of a
bucket or key) are answered as S3 errors.

## 6. Admin API

### 6.1 Conventions

- Served on the admin listener (§2.3). Base path `/_admin/v1`;
  `Authorization: Bearer <admin token>`; JSON in and out (`Content-Type:
  application/json`).
- Request bodies are decoded strictly: an unknown field is `400`, so typos never
  silently pass. `PATCH` is JSON merge-patch. A body over 256 KiB is `413
  payload_too_large` on every call that takes one, and a body that stops arriving for
  `BINVAULT_BODY_IDLE_TIMEOUT` is `400`.
- Timestamps are RFC 3339 UTC with millisecond precision in every response (the
  answer to a create is exactly what the list shows), durations are Go-style strings
  (`"30s"`, `"15m"`), sizes are bytes.
- Lists take `limit` (default 50, max 500; a value outside 1 to 500 is `400`, not
  clamped) and `cursor`, and return `{ "items": [...], "next_cursor": "…" | null }`.
- The switches `?force`, `?stats`, `?catalog_only` and `?detach` take `true` or `false`;
  any other value (`?force=1`) is `400` rather than silently meaning `false`.
- Errors: `{ "error": "<code>", "detail": "…", "fields": { "<field>": "<problem>" } }`
  (`fields` only for validation). `detail` and the field problems are plain text about
  the request: they name the field and what it must be, never a Go type or package. Codes: `invalid_request` 400, `unauthorized`
  401, `not_found` 404, `conflict` 409, `precondition_failed` 412,
  `payload_too_large` 413, `rate_limited` 429, `internal` 500, `unavailable` 503
  (a bucket's home node cannot be reached, or the bucket is frozen for a move).
- Resources that can be edited carry a `revision`. `PUT`/`PATCH` honour
  `If-Match: "<revision>"` for optimistic concurrency (`412` on mismatch).
  Bucket-scoped resources have a single writer, so this is exact; pipeline
  definitions replicate last-writer-wins across nodes (§8.5).
- Secrets are never returned, except a bucket token's secret once at creation.
- Every admin call is logged (method, path, status, duration); bodies are not.
- Changes take effect immediately for subsequently admitted requests. In a
  cluster, catalog changes (pipeline writes, bucket create and delete) take effect
  on each node once replicated, normally within a second; those calls accept
  `?wait=replicated` to wait for every peer (§8.5), and every other call ignores
  it. If a peer has not applied the change in time, the call still returns its
  normal body but with status `202` and a `pending` list naming those peers.
- In a cluster any node accepts any admin call; §8.6 says which calls are sent to
  a bucket's home, which fan out, and which are node-local.

### 6.2 Server

| Method & path | Purpose |
|---|---|
| `GET /status` | Version, uptime, bucket/object/byte totals, free disk, queued and running runs per pipeline. |
| `GET /config` | The effective non-secret configuration: listeners and whether they serve TLS, `data_dir`, limits, timeouts, region, domain, trusted proxies, pipeline and log settings and, in a cluster, the cluster settings (peer URLs, timers, `node_name`). The admin token, the master keys and the cluster keys are never shown. |

Both calls are node-local; the cluster-wide view is §6.9.

`GET /_healthz` and `GET /_version` are unauthenticated and served by the public
listener, not here (§2.4, §9.3).

### 6.3 Buckets

| Method & path | Purpose |
|---|---|
| `POST /buckets` | Create. `409` if the name exists (in a cluster, on any reachable node). Optional `home` (below). |
| `GET /buckets` | List from the catalog, with `home`. `?stats=true` adds `stats`, fetched from the home nodes (omitted for unreachable ones). |
| `GET /buckets/{name}` | Detail, including attached pipelines (`"pipelines": []` when none). `POST`, `PUT` and `PATCH` answer with the same object. |
| `PUT /buckets/{name}` | Replace the settings of an existing bucket, for provisioning scripts (`404` if it does not exist: creating is `POST` only, so a script does `POST` and treats `409` as "exists"). `home` cannot change here (§8.8): leave it out, or send `auto` or the current home. Re-sending identical settings changes nothing, the `revision` included (an `If-Match` still has to match: `412` otherwise); `versioning: "off"` on an enabled bucket is `409`. |
| `PATCH /buckets/{name}` | Change settings. The name is immutable; `home` changes only through a move (§8.8). |
| `DELETE /buckets/{name}` | `409` unless the bucket holds no version rows at all (objects, noncurrent versions and delete markers all count) and no open uploads. `?force=true` deletes everything, all tokens and attachments, cancels queued runs, and fires **no** events. Blob space is reclaimed asynchronously. In a cluster the call runs on the bucket's home. `?catalog_only=true` is the one exception: the node that receives it drops the catalog entry itself, without contacting the home, for a bucket whose home is down or retired (`409` while the home answers; §8.9). |

Settings:

| Field | Default | Meaning |
|---|---|---|
| `name` | — | §3.7. |
| `home` | `"auto"` | Cluster only; set at creation, changed only by a move (§8.8). A node name, or `"auto"` = the reachable, non-cordoned node with the most free disk (§8.6). A single node always homes everything and names itself `local`. |
| `quota_bytes` | `null` | Cap on the sum of the logical sizes of all data versions, open multipart parts included. `null` = unlimited. |
| `max_objects` | `null` | Cap on the number of data versions (delete markers do not count). |
| `max_object_bytes` | `null` | Per-object cap, at most `BINVAULT_MAX_OBJECT_MB` (§2.3); enforced as in §3.13. |
| `allowed_content_types` | `[]` | Sniffed content types the bucket accepts (§3.13); empty = anything. |
| `versioning` | `"off"` | `"off"` or `"enabled"`; never back to `"off"` (§3.10). |
| `encryption` | `"none"` | `"none"` or `"sse-s3"` (§3.11). |
| `lifecycle` | `[]` | Expiry rules (§3.12). |
| `limits` | `{}` | `requests_per_second`, `burst`, `bytes_in_per_second`, `bytes_out_per_second` (§4.9). |
| `anonymous_read` | `"off"` | `"off"` or `"objects"` (§4.6). |
| `anonymous_prefixes` | `[]` | With `"objects"`: limit anonymous reads to these key prefixes; empty = whole bucket. |
| `cors` | `[]` | Rules: `allowed_origins`, `allowed_methods`, `allowed_headers`, `expose_headers`, `max_age_seconds` (§5.10). |

```json
{
  "name": "photos",
  "quota_bytes": 107374182400,
  "anonymous_read": "off",
  "versioning": "enabled",
  "encryption": "sse-s3",
  "allowed_content_types": ["image/*"],
  "cors": [{
    "allowed_origins": ["https://app.example.com"],
    "allowed_methods": ["GET", "PUT", "HEAD"],
    "allowed_headers": ["*"],
    "expose_headers": ["ETag", "x-amz-checksum-crc32"],
    "max_age_seconds": 3000
  }]
}
```

Responses add `created_at`, `home` and `stats` (`objects`, `versions`, `bytes`).

### 6.4 Bucket tokens

| Method & path | Purpose |
|---|---|
| `POST /buckets/{name}/tokens` | Create. Body: `name`, `grants`, optional `limits` (§4.9), optional `expires_at`. The `201` response includes `access_key_id` and `secret_access_key` (shown once). |
| `GET /buckets/{name}/tokens` | List (no secrets): id, name, `grants`, `limits`, `expires_at`, `created_at`, `last_used_at`. |
| `PATCH /buckets/{name}/tokens/{id}` | Edit `name`, `grants`, `limits`, `expires_at` (an `expires_at` that is not in the future is `400`, as at creation; `null` removes the expiry; an expired token can still be renamed). |
| `DELETE /buckets/{name}/tokens/{id}` | Revoke and remove. Ids are never reused. Presigned URLs it signed stop working. |

In a cluster these calls run on the bucket's home, where the token and its sealed
secret live; the home also publishes `access_key_id → bucket` for routing (§8.5).
The secret appears in the `201` response and nowhere else. Token creation does not
take `?wait=replicated`: the token works at once, and the key index matters only
for bucket-less calls such as ListBuckets.

### 6.5 Pipelines

| Method & path | Purpose |
|---|---|
| `POST /pipelines` | Create (schema in §7.2). |
| `GET /pipelines` | List. |
| `GET /pipelines/{name}` | Detail, plus `attached_to` (bucket names). |
| `PUT /pipelines/{name}` | Replace. `name` and `stage` are immutable. |
| `PATCH /pipelines/{name}` | Merge-patch, e.g. `{"paused": true}`. |
| `DELETE /pipelines/{name}` | `409` while attached, unless `?detach=true`. Cancels its queued runs. |
| `POST /pipelines/{name}/test` | One synthetic invocation (below); in a cluster it runs on the bucket's home. |

Pipelines are addressed by **name** (unique, immutable). In a cluster, pipeline
writes are catalog ops: they reach every node within about a second, and
`?wait=replicated` waits for every peer (§8.5).

Secrets: in responses every `service.headers` value is `"***"` and
`service.signing_secret` is omitted (`has_signing_secret: true` instead). On
`PUT`/`PATCH`, a header value of `"***"` keeps the stored value, and an omitted
`signing_secret` keeps the stored one (`null` removes it).

**Test.** Body `{ "bucket": "photos", "key": "scratch/test.bin", "event": "object.created" }`
(`event` defaults to the pipeline's first). binvault builds a normal
invocation with `run.test: true` — `object` describes the live object at that key
if it exists, otherwise a synthetic empty one — mints a real token from the
pipeline's grants for that bucket and key, calls the service once (no retries)
and returns `{ "http_status": 204, "latency_ms": 41, "message": null, "error": null }`.
There is no staged view in tests: token calls act on live data, so use a scratch
key. No run record is created.

### 6.6 Attachments

| Method & path | Purpose |
|---|---|
| `GET /buckets/{name}/pipelines` | The bucket's ordered attachments and their `revision`. |
| `PUT /buckets/{name}/pipelines` | Replace the whole ordered list atomically. |

```json
{
  "items": [
    { "pipeline": "content-gate", "enabled": true },
    { "pipeline": "compress-images", "enabled": true },
    { "pipeline": "thumbnails", "enabled": true, "match": { "keys": ["uploads/**"] } }
  ]
}
```

Array order is execution order, separately within each stage (§7.4). `match` is
an optional narrowing filter (§7.3) AND-ed with the pipeline's own. Validation:
every pipeline exists, none repeats, ≤ 32 attachments, ≤ 8 enabled `before`
attachments. In a cluster the call runs on the bucket's home and checks pipeline
names against that node's copy of the catalog, so create a pipeline with
`?wait=replicated` before attaching it (§8.7).

### 6.7 Runs

| Method & path | Purpose |
|---|---|
| `GET /runs` | List, newest first. Filters: `bucket`, `pipeline`, `stage`, `state`, `key`, `key_prefix`, `event_id`, `since`, `until`. In a cluster it fans out to every reachable node and merges; nodes that did not answer are named in `partial`. |
| `GET /runs/{id}` | One run (looked up on every reachable node in a cluster). |
| `POST /runs/{id}/retry` | Re-queue a `failed` `after` run with a fresh attempt series; later steps of its event that were skipped because of it are re-queued too. `409` for other states and for `before` runs. A retry never undoes newer work: if a later event for the same key has already started, the run becomes `skipped` (`superseded`) instead. |
| `POST /runs/retry` | **Bulk retry**, e.g. after a service outage. Body: the `GET /runs` filters (`pipeline` or `bucket` required; `state` defaults to `failed`) and an optional `limit`. Every matching failed `after` run is re-queued (under the same rule as a single retry), together with the steps that were skipped because of it. Returns `{ "requeued": n }`, and `skipped` when runs of a bucket that is frozen or paused for a move were left alone (§8.8). |
| `POST /runs/{id}/cancel` | Cancel a `queued` run. |
| `POST /runs/cancel` | Bulk cancel of `queued` runs; same body as bulk retry, with `state` defaulting to `queued`. Returns `{ "cancelled": n }` and `skipped` as above. A call that names a bucket which is frozen or paused is refused with `503` instead. |

```json
{
  "id": "run_01J9Z4K…",
  "event_id": "evt_01J9Z4K…",
  "pipeline": "thumbnails",
  "stage": "after",
  "bucket": "photos",
  "node": "node-b",
  "key": "uploads/u/42/photo.jpg",
  "event": "object.created",
  "operation": "put",
  "object_version": "01J9Z4J…",
  "actor": { "kind": "token", "id": "BVK3F7…", "name": "web-app" },
  "lineage": { "depth": 0, "chain": [] },
  "state": "succeeded",
  "reason": null,
  "step": 2,
  "steps": 3,
  "attempt": 1,
  "max_attempts": 5,
  "http_status": 200,
  "message": null,
  "error": null,
  "queued_at": "2026-10-02T12:00:00Z",
  "started_at": "2026-10-02T12:00:01Z",
  "finished_at": "2026-10-02T12:00:02Z",
  "duration_ms": 842
}
```

`node` is the node that executed the run: the bucket's home. States and reasons:
§7.12.

### 6.8 Backfills

Run an `after` pipeline over objects that already exist — needed whenever a
pipeline is attached to a populated bucket. (In a cluster the backfill runs on
the bucket's home.)

| Method & path | Purpose |
|---|---|
| `POST /backfills` | Start. `202` with the backfill object. |
| `GET /backfills`, `GET /backfills/{id}` | List / inspect (`state`, `scanned`, `enqueued`, `cursor`). |
| `POST /backfills/{id}/cancel` | Stop; already queued runs continue unless cancelled individually. |

```json
{ "bucket": "photos", "pipeline": "thumbnails", "prefix": "uploads/",
  "modified_after": "2026-01-01T00:00:00Z", "modified_before": null }
```

The pipeline must be `after`, enabled, attached to the bucket and subscribed to
`object.created` (the event a backfill raises), else `409`. binvault walks the
bucket's visible keys (latest versions) in order; for each key matching the
pipeline's and attachment's filters it
creates an event group containing **only that pipeline**, with
`event: object.created`, `operation: backfill` and `actor.kind: backfill`. Work
is throttled (at most `2 × max_concurrency` of the backfill's runs queued at a
time), the cursor is persisted so it resumes after a restart, and objects that
change or vanish mid-walk are handled by the normal supersession check.

### 6.9 Cluster

Available in every mode; a single node reports `"mode": "single"` and itself as
the only node.

| Method & path | Purpose |
|---|---|
| `GET /cluster` | This node's `id`, `name` and `mode`, and every node: `name`, `id`, `endpoint`, reachable, last successful pull, lag (ops behind), clock skew, version, buckets homed, free disk, `cordoned`, and for a cordoned node its `drain` (`state`, `remaining`). `alarms`: `conflicts`, `orphans`, `held_ops`, `clones`, `missing` (the catalog homes a bucket on a node that has no data for it), and mismatches of master key ids, region, domain or `BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT`. |
| `DELETE /cluster/nodes/{id}` | Retire a node that is gone for good. `409` while the catalog still lists buckets homed on it: drain the node (below) or drop them with `DELETE /buckets/{name}?catalog_only=true`. Retiring the target of a move that is in `cutover` ends that move: the old home resumes the bucket at epoch + 2 (§8.8); send the call to the old home, which is where the move is decided. (A redeployed node's predecessor is retired automatically; buckets homed on it stay assigned to its id, answer `503` and raise `missing` until its old data dir is restored or they are dropped.) |
| `POST /cluster/nodes/{id}/drain` | Cordon the node (no new buckets; `auto` placement skips it) and move every bucket it homes to other nodes, one move at a time, with `auto` placement (§8.8). `202` with `{"node", "id", "cordoned": true, "state", "remaining"}`. The progress is the `drain` object of the node's entry in `GET /cluster` — `{"state": "running" \| "done", "remaining": n}`, derived from the cordon flag and the buckets the catalog still homes there, so it survives restarts — and the moves are in `GET /moves`. |
| `POST /cluster/nodes/{id}/undrain` | Lift the cordon and stop starting further moves (a move that is under way finishes). |
| `DELETE /cluster/orphans/{generation}` | Delete the local data of an orphaned bucket (§8.5) on the node that holds it (`?node=<name>`, default: this node). |

The node-local calls `/status` and `/config` describe the node that answers;
`GET /cluster` gives the whole picture.

### 6.10 Moves

Cluster only; on a single node these calls are `409`.

| Method & path | Purpose |
|---|---|
| `POST /buckets/{name}/move` | Start moving the bucket to another node. Body: `{ "to": "c", "max_bytes_per_second": n }`; `to` is a node name, a node id or `"auto"` (the default: the node with the most free disk that can take the bucket), and the rate is optional. `202` with the move object. `409` for the node that already homes it, a target without enough free disk, an unreachable, cordoned or shutting-down node, a target whose `hello` lacks a master key id that the bucket's sealed values use, or a bucket that is already moving; `400` for a node the cluster does not know. |
| `GET /moves`, `GET /moves/{id}` | List / inspect, newest first: `id`, `role` (`source` or `target`), `bucket`, `from`, `to`, `state`, `epoch`, `bytes_total`, `bytes_copied`, `objects_copied`, `created_at`, `started_at`, `finished_at`, `error`. Filters: `bucket`, `state`, `role`. `error` is also the note of a move that is not over: a `queued` move that waits for its target (`waiting: …`: the target is busy with another move, or a pipeline of the bucket has not reached it yet) and a move in `cutover` that has no answer to `activate` yet (what the last call came back with). |
| `POST /moves/{id}/cancel` | Cancel before the final transfer: the old home keeps serving and the partial copy is discarded. Only the source node decides: the call is routed to it, and is `409` once the bucket is frozen. |

States: `queued`, `preparing`, `copying`, `frozen`, `cutover`, `moved`, `done`, `failed`,
`cancelled` for the source; `receiving`, `verified`, `activated`, `abandoned` for
the target. The procedure and its failure handling are in §8.8.

## 7. Pipelines

### 7.1 Model and guarantees

A pipeline is a procedure triggered by an object event. It is defined once,
globally, then **attached** to the buckets that want it. When it fires, binvault
calls an external service and gives it a token for the S3 API; the service does
its work through S3 calls and answers with an HTTP status. That is the entire
integration contract.

Pick the stage by what the work must guarantee:

- **`before`** — the file must be *checked or changed before anyone can see it*:
  validation, malware and content scanning, format enforcement, compression,
  resizing, metadata stripping, watermarking. Synchronous; gates the write.
- **`after`** — the file is already stored and the work is a *reaction*:
  thumbnails and other derivatives, transcoding, text extraction, indexing,
  tagging, mirroring to another system, notifications, cleaning up derivatives
  when the source is deleted. Asynchronous; never blocks the client.

| Property | `before` | `after` |
|---|---|---|
| Visibility | Object invisible until the whole chain passes | Object visible immediately |
| Client | Waits for the chain, then gets the final result | Unaffected |
| Atomicity | Replacements and the commit are all-or-nothing | Each run independent; steps in order |
| Delivery | Synchronous, optional short retries inside the request | At-least-once, persisted, retried with backoff |
| Order | Attachment order | Attachment order per event; per-key events in commit order |
| Default on failure | Reject the write (fail closed) | Stop the event's remaining steps; object untouched |
| Token reach | The staged object (and read-only elsewhere) | Live objects, per grants |

### 7.2 Definition

```json
{
  "name": "compress-images",
  "description": "Recompress JPEG/PNG before they become visible",
  "enabled": true,
  "stage": "before",
  "events": ["object.created", "object.updated"],
  "match": {
    "keys": ["uploads/**"],
    "exclude_keys": ["uploads/raw/**"],
    "content_type": ["image/jpeg", "image/png"],
    "content_type_source": "sniffed",
    "operations": ["put", "post", "multipart"],
    "min_size": 1024,
    "max_size": 52428800
  },
  "service": {
    "url": "http://compressor:8080/hooks/binvault",
    "headers": { "Authorization": "Bearer service-secret" },
    "signing_secret": "at-least-32-characters-of-randomness",
    "timeout": "20s"
  },
  "token": {
    "grants": [ { "actions": ["read", "write"], "keys": ["{key}"] } ]
  },
  "limits": { "max_concurrency": 8, "queue_timeout": "5s" },
  "retry": { "max_attempts": 2, "backoff": ["1s"] },
  "on_error": "reject"
}
```

| Field | Default | Rules |
|---|---|---|
| `name` | — | `^[a-z0-9][a-z0-9_-]{0,62}$`, unique, immutable. |
| `description` | `""` | ≤ 500 characters. |
| `enabled` | `true` | `false` turns the pipeline off in every bucket: `before` is skipped; for `after` no new runs are created and queued runs are **held** (not cancelled), continuing when it is enabled again. Held runs hold their keys (§7.10). Delete, detach and bucket removal cancel them. |
| `paused` | `false` | `after` only; rejected on a `before` pipeline (use `on_error` or `enabled`). While `true`, events still enqueue runs but none is dispatched; clearing it drains the backlog in order. Use it during a service outage or deploy. A held run holds its key: later events for the same key wait behind it whatever their pipelines (§7.10); `POST /runs/cancel` releases them. |
| `stage` | — | `before` or `after`. Immutable. |
| `events` | `["object.created","object.updated"]` | Non-empty subset of `object.created`, `object.updated`, `object.deleted` (§7.5). |
| `match` | `{}` | §7.3. |
| `service.url` | — | `http` or `https`, host required, no userinfo or fragment. |
| `service.headers` | `{}` | Static headers sent to the service (typically `Authorization`). ≤ 16; may not set `Host`, `Content-Length` or `X-Binvault-*`; names and values may not contain control characters. Values are sealed and redacted. |
| `service.signing_secret` | none | ≥ 32 characters. When set, every call is HMAC-signed (§7.6). Sealed. |
| `service.timeout` | `before`: `20s`; `after`: `30s` | Per attempt. `before`: 1s up to `BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT` (the same on every node, so the check at save time gives the same answer everywhere). `after`: 1s–30m; work that needs longer see §7.7. |
| `service.s3_endpoint` | `BINVAULT_ENDPOINT_URL` | Override the endpoint handed to this service. |
| `token.grants` | `[{"actions":["read"],"keys":["{key}"]}]` | §7.8. `[]` means no token is minted (notification-only). The token lives only for its call: it is revoked when the attempt ends, and expires at the call's deadline plus 30 s if that fails. |
| `retry.max_attempts` | `before`: 1; `after`: 5 | `before` ≤ 3, `after` ≤ 10. |
| `retry.backoff` | `before`: `["1s"]`; `after`: `["10s","1m","10m","1h"]` | Delay before attempt 2, 3, …; the last value repeats. `before` delays ≤ 5s. ±20% jitter. |
| `limits.max_concurrency` | `8` | 1–256 simultaneous calls to this service across all buckets homed on a node. In a cluster each node enforces its own limit (§8.7). |
| `limits.queue_timeout` | `5s` | `before` only: how long a write waits for a free slot. |
| `on_error` | `before`: `reject`; `after`: `stop` | `before`: `reject` or `continue`. `after`: `stop` or `continue`. |

Read-only: `revision`, `created_at`, `updated_at`. An edit applies to events
processed afterwards; queued `after` runs use the definition current when they
execute.

### 7.3 Matching

A pipeline (and an attachment's narrowing filter) matches an object when **every**
condition present is satisfied; a list matches if **any** element does; an empty
filter matches everything.

- `keys` / `exclude_keys` — glob patterns over the full key. `*` any characters
  except `/`; `**` any characters including `/`; `?` one character except `/`;
  `[a-z]` classes; `{a,b}` alternatives; `\` escapes. Case-sensitive — write
  `**/*.{jpg,jpeg,JPG,JPEG}` or match on `content_type` instead.
- `content_type` — patterns like `image/png` or `image/*`, case-insensitive,
  parameters ignored.
- `content_type_source` — `declared` (default): the `Content-Type` of the write
  (stored value for `after`/delete). `sniffed`: detected from the first 512
  bytes, ignoring what the client claimed — use it for security gates, since
  clients can label anything `image/png`. For `object.deleted` events there are
  no bytes to sniff and the stored declared type is used. Where an event's bytes
  were not read (a copy that keeps the blob, an uncovered version, a backfill) the
  condition counts as met: the pipeline runs and its service decides, so
  relabelling cannot dodge a scanner.
- `min_size` / `max_size` — bytes, inclusive. A `before` chain is chosen once, when
  the upload is staged (§7.9), so they are evaluated against the object as it
  arrived; a replacement made by an earlier pipeline does not change which
  pipelines run.
- `operations` — a subset of `put`, `post`, `copy`, `multipart`, `delete`,
  `delete_version`, `lifecycle`, `backfill` (the
  `operation` of §7.5); default: all. A `before` compressor that should not
  re-run on server-side copies lists `["put", "post", "multipart"]`. Only `put`,
  `post`, `copy`, `multipart` and `delete` can run a `before` chain;
  `delete_version`, `lifecycle` and `backfill` are `after`-only.

**`match` selects; it does not enforce.** An object that does not match is not
processed by the pipeline and is committed as usual — including by a `before`
gate. A security gate must therefore see every object in its scope: give it only
`keys` (or an empty `match`), let the service decide what is acceptable, and
enforce size and type limits with the bucket's rules (`max_object_bytes`,
`allowed_content_types`, §3.13), which *reject* instead of skipping. Put `content_type`, `min_size` or `max_size` on a gate
only when skipping the other objects is what you want.

### 7.4 Attachment and ordering

- A pipeline does nothing until attached to a bucket (§6.6). The bucket's array
  is the execution order, applied separately to `before` and to `after`
  pipelines.
- `enabled` on the attachment turns a pipeline off for one bucket; `match` on the
  attachment narrows it for one bucket (it can only narrow).
- Changes apply to anything not yet fixed: a `before` chain is fixed when its upload
  has been received and staged (§7.9), an `after` event's steps when it commits.
- To restrict a pipeline in a way `match` cannot express, define a second pipeline
  — definitions are cheap.

### 7.5 Events

| Trigger | Event | `operation` |
|---|---|---|
| PutObject, key had no visible object | `object.created` | `put` |
| PutObject, key had a visible object | `object.updated` | `put` |
| POST Object | created / updated | `post` |
| CopyObject (destination) | created / updated | `copy` |
| CompleteMultipartUpload | created / updated | `multipart` |
| DeleteObject, DeleteObjects without a version id (`versionId=null` in an unversioned bucket counts as none), when a visible object existed (in an enabled bucket: a delete marker is added) | `object.deleted` | `delete` |
| Permanent deletion of a version (`purge`) that changes what a plain GET returns: the latest visible version removed (an older one uncovered → `object.updated`; none left → `object.deleted`), or a delete marker removed (the key reappears → `object.created`). Raises `after` events only: no `before` chain | as stated | `delete_version` |
| Lifecycle expiration of a visible object | `object.deleted` | `lifecycle` |
| Write or delete made with a pipeline token | created / updated / deleted | as above, with pipeline lineage (§7.11) |
| Backfill (§6.8) | `object.created` | `backfill` |
| *No event:* tagging calls, multipart parts or aborts, changes to noncurrent versions, lifecycle removal of noncurrent versions or delete markers, admin actions, forced bucket deletion, bucket moves | | |

"Visible" means what a plain `GET` returns (§3.10). Created versus updated is
decided at admission for `before` chains and at commit for `after` runs; they
differ only under concurrent writes to the same key.

What each stage means for each event:

| | `before` | `after` |
|---|---|---|
| created / updated | Gate or transform the staged object | React to the committed object |
| deleted | Veto the delete | React to the deletion; the object is gone |

### 7.6 Invocation request

binvault makes one `POST` per attempt:

```
POST {service.url}
Content-Type: application/json
User-Agent: binvault/<version>
X-Binvault-Run: run_01J9Z4K…
X-Binvault-Attempt: 1
X-Binvault-Pipeline: compress-images
X-Binvault-Stage: before
X-Binvault-Event: object.created
X-Binvault-Timestamp: 1790942400
X-Binvault-Signature: v1=<hex>        (only when signing_secret is set)
<each service.headers entry>
```

`X-Binvault-Signature` is `v1=` + hex HMAC-SHA256, keyed with the signing secret,
of `"<timestamp>.<raw request body>"`. Services should verify it and reject
timestamps more than five minutes old.

```json
{
  "run": { "id": "run_01J9Z4K…", "attempt": 1, "deadline": "2026-10-02T12:00:20Z", "test": false },
  "pipeline": "compress-images",
  "stage": "before",
  "event": "object.created",
  "operation": "put",
  "bucket": "photos",
  "key": "uploads/u/42/photo.png",
  "object": {
    "version": "01J9Z4J…",
    "size": 482113,
    "etag": "9b2cf535f27731c974343645a3985328",
    "sha256": "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
    "content_type": "image/png",
    "last_modified": "2026-10-02T12:00:00Z",
    "metadata": { "uploaded-by": "42" },
    "tags": { "kind": "avatar" }
  },
  "copy_source": null,
  "actor": { "kind": "token", "id": "BVK3F7…", "name": "web-app" },
  "lineage": { "depth": 0, "chain": [] },
  "s3": {
    "endpoint": "http://binvault:9000",
    "region": "us-east-1",
    "path_style": true,
    "access_key_id": "BVPK2…",
    "secret_access_key": "…",
    "bearer": "BVPK2….…",
    "expires_at": "2026-10-02T12:00:50Z",
    "grants": [ { "actions": ["read", "write"], "keys": ["uploads/u/42/photo.png"] } ]
  }
}
```

- `object` is the staged object for a `before` created/updated run (as modified
  by earlier pipelines), the committed object for `after`, and the snapshot of the
  removed object for `object.deleted`.
- `previous` (`{version, size, etag, last_modified}`, as in the object block)
  appears for updates — the live object being replaced — and is absent otherwise,
  as in the example above, which is a create. `copy_source` (`{bucket, key}`)
  appears for copies.
- `actor.kind` is `token` (client), `pipeline` (`{pipeline, run}`), `backfill` or
  `lifecycle`. In an enabled bucket a delete event has `object.delete_marker:
  true` and the marker's `version`.
- `s3` is omitted when the pipeline has no grants. `grants` shows the grants
  with templates already expanded, so the service sees exactly what it may touch.
- `run.deadline` is when binvault abandons this attempt; the token expires 30 s
  later (`s3.expires_at`) if it was not revoked sooner.

### 7.7 Service response

The HTTP status is the only thing binvault acts on.

| Response | `before` | `after` |
|---|---|---|
| `200`, `201`, `204` | Done; continue. The staged object may have been replaced or deleted through the token. | Succeeded. |
| `422` | **Rejected** — the write (or delete) fails with `PipelineRejected`. | Permanent failure, no retry. |
| `408`, `425`, `429`, `5xx`, timeout, connection error | Transient failure: retried per `retry` (default: not), then `on_error`. | Retried with backoff; `Retry-After` honoured (capped at 1h). |
| any other status — `202` and every other `2xx`, any `3xx`, other `4xx` | Failure (usually misconfiguration), then `on_error`. Redirects are never followed. | Permanent failure, no retry. |

An optional `Content-Type: application/json` body `{"message": "…"}` (≤ 512
characters) is shown to the client in the `PipelineRejected` text and stored in
the run record. No other part of the body is interpreted; the first 4 KiB is
logged.

A `before` service can therefore reject in two equivalent ways: **delete the
staged object** with its token and then answer `200`/`201`/`204` (changes apply
only if the attempt succeeds, §7.8), or answer **422**. The 422 route needs no S3
call and carries a message; deletion is available to services that only speak S3.

There is no "accepted, still working" answer. The token is revoked the moment a
call ends, so a service answers when its work is done; an `after` call may stay
open for up to 30 minutes (`service.timeout`). Work that needs longer belongs to
the service's own queue, finishing with a regular bucket token that the admin
creates for it (§6.4), not with the ephemeral one.

### 7.8 Pipeline tokens

A pipeline token is an ephemeral credential minted for each attempt of each run
that has grants.

- **Form.** Access key id `BVP` + 17 characters, 40-character secret. Usable as
  SigV4 (so `boto3`, the Go or JS SDKs and `aws` work with just the key pair) or
  as bearer `BVP….<secret>`.
- **Lifetime.** One attempt. The token is revoked the moment the attempt ends —
  response, timeout or client gone — and any of its requests still in flight are
  aborted, so nothing it started can land afterwards. If a revocation is somehow
  missed it expires 30 s after the attempt's deadline. Tokens exist only in memory:
  they are never written to disk, and a restart invalidates them (the affected
  runs are retried or fail).
- **Scope.** One bucket. Only the actions and keys in its grants. Never the
  admin API; never `ListBuckets` beyond the single bucket; never another bucket.
- **Attribution.** Every request with the token is logged as
  `pipeline:<name>/<run id>`, and writes it makes carry that lineage (§7.11).
- It is otherwise an ordinary S3 client: same size limits, quota and checksums, and
  it can presign (a presigned URL dies with the token). Unlike a bucket token it is
  exempt from rate limits (§4.9), because its load is bounded by the pipeline's
  concurrency.

**Grants.**

```json
"token": {
  "grants": [
    { "actions": ["read"],          "keys": ["{key}"] },
    { "actions": ["write", "list"], "keys": ["derived/{key}/*"] }
  ]
}
```

`actions` are the seven of §4.4. `keys` are the patterns of §4.4 (literal text,
optionally ending in a single `*`) plus the variables below. Substituted values
are inserted escaped (`*` and `\` become `\*` and `\\`), so they are always
literal — a key containing `*` can never widen a grant.

| Variable | For key `photos/2026/a.b.png` |
|---|---|
| `{key}` | `photos/2026/a.b.png` |
| `{dir}` | `photos/2026` (empty if the key has no `/`; the `/` that follows an empty `{dir}` is dropped) |
| `{base}` | `a.b.png` |
| `{name}` | `a.b` |
| `{ext}` | `png` |

So `{dir}/{name}.webp` → `photos/2026/a.b.webp`, and `thumbs/{key}` →
`thumbs/photos/2026/a.b.png`. If a template ends in `*` and a variable expands to
nothing (an empty `{dir}` in `thumbs/{dir}/*` for a top-level key, an empty `{base}`
in `derived/{base}*` for a folder marker), that grant is dropped for the run: what
is left would cover more than the key's own directory or name, up to the whole
bucket. A template without a trailing `*` stays exact (`{dir}/{name}.webp` is
`a.webp` for `a.png`).

Rules:

- `list` is honoured when the request's `prefix` starts with the literal part of
  a granted pattern, and results are filtered to granted keys.
- A copy needs `read` on the source and `write` (or `create`) on the destination,
  both granted. In `after` runs, large outputs may use multipart upload on any
  `write`-granted key.
- **`before` runs** work on the staged view of the triggering key (below):
  `GET`/`HEAD`, one `PUT` (the replacement), `DELETE` and tagging, on `{key}`
  exactly. When a `before` pipeline is saved, its `create`, `write`, `delete` and
  `tag` grants must be `{key}` exactly and `purge` is not allowed. At run time
  multipart upload, a copy whose destination is `{key}`, and any request carrying a
  `versionId` are refused with `AccessDenied`: a replacement is a single `PUT` (up
  to the object size limit). `read` and `list` may cover other keys (committed
  data, e.g. a rules file). Writing derivatives belongs in an `after` pipeline.
- A `before` delete chain (`object.deleted`) gets a read-only token; the veto is a
  `422`.
- Default when `grants` is omitted: `read` on `{key}`. `grants: []` mints no token.

**Staged view (`before` runs).** While a `before` run is active, its token sees
the *staged* object at the triggering key, and only the token of that run does:

- `GET`/`HEAD` return the staged bytes, ETag, content headers, metadata and tags.
- `PUT` **replaces** the staged object. Content headers, user metadata and tags
  the request does not specify are *inherited* from the staged object, and
  metadata keys it does specify are merged over them — so a compressor that PUTs
  bytes without a `Content-Type` does not lose `image/jpeg`. Send
  `x-binvault-replace-metadata: true` for full S3 replace semantics. Checksums
  and `Content-MD5` are verified as usual.
- `DELETE` marks the staged object rejected: the write will fail with
  `PipelineRejected`.
- Tagging calls change the staged tags.
- Everything else — other keys, listings, other clients — shows committed state;
  the previous committed object at the key stays visible to everyone else.
- If a service deletes and then PUTs again, the final state of the slot wins.
- Changes are **per attempt**. A replacement, a `DELETE` and tag changes are
  pending while the attempt runs (the token's own reads see them) and are applied
  to the slot only if the attempt succeeds. When an attempt ends, its token is
  revoked and its in-flight requests are aborted *before* the slot is inspected, so
  a late `PUT` can never land after a later pipeline has looked at the object. A
  failed, timed-out or retried attempt leaves the slot exactly as it was before
  that attempt.

**Stale-write guard (`after` runs).** Every request that names the triggering
key — a read, a copy *from* it, a write, a delete, tagging — is implicitly
conditional on that object still being the one the event is about: for
created/updated events the live `version` must equal `object.version`; for deleted
events the key must still have no visible object. Otherwise the call fails with
`412 PreconditionFailed` ("the object changed since this event"). A scanner that
decides "unsafe" about version 1 therefore can never delete a clean version 2
uploaded meanwhile, and a service that promotes a scanned object (copies it
elsewhere) can never promote a newer, unscanned one: the copy checks its source
version inside the commit transaction (§3.5). A request that *pins* the event's
version — `?versionId=<object.version>` in an enabled bucket, on a read, as a copy
source, on tagging, or as a `purge` — is always allowed while that version exists
(it can only touch that exact version). Writes to other granted
keys (derivatives) are not guarded. (An `after` run that rewrites `{key}` itself
creates a new version, so its own later requests on `{key}` get `412`: it should do
that last.)

### 7.9 `before` lifecycle

1. **Admit and receive** (§3.5 steps 1–4): the upload is staged.
2. **Select the chain, once, now that the upload is staged:** the bucket's enabled
   `before` attachments, in order, whose pipeline subscribes to the event and whose
   `match` (pipeline AND attachment) matches the staged object as it arrived — at
   most 8. The chain is fixed here: later attachment changes and replacements
   made by earlier pipelines do not change it. No match → go to step 5.
3. **For each pipeline, sequentially:**
   1. Acquire one of its `max_concurrency` slots, waiting up to `queue_timeout`;
      otherwise the run fails with "no capacity".
   2. Mint the token, then call the service with `service.timeout`, bounded by the
      remaining chain budget (`BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT`), retrying
      transient failures per `retry`. Every attempt has its own token and its own
      pending changes (§7.8).
   3. When the attempt ends, revoke its token and abort its in-flight requests,
      then read the response (§7.7) and look at the staged slot: *unchanged*,
      *replaced* or *deleted* (only a successful attempt changes it).
4. **Outcome of each run:**
   - Slot *deleted*, or response `422` → **rejected**: stop, discard the staged
     data, fail the request with `422 PipelineRejected` (message `rejected by
     pipeline "<name>"`, plus the service's `message` if any).
   - **Failure** (after retries) with `on_error: reject` → stop, fail the request
     with `502 PipelineFailed` or `504 PipelineTimeout`. With `continue` → record
     it and move on; the next pipeline sees the staged object as it was before
     the failed attempt.
   - **Success** → if the slot was *replaced*, size, ETag, SHA-256 and checksum
     are recomputed and the next pipeline sees the new bytes.
   - If the chain budget runs out, the chain stops: the write fails with
     `PipelineTimeout` unless every unfinished pipeline has `on_error: continue`,
     in which case they are skipped and the write commits.
5. **Commit** (§3.5 step 6) and respond. Pipelines that did not run (match,
   disabled) cost nothing.

Event `object.deleted` in a `before` chain: the client's `DELETE` without a
version id (`versionId=null` in an unversioned bucket counts as none, §3.10), or a
DeleteObjects entry (which shares one budget, §5.4.4), runs the chain with
`object` = the existing object and a read-only token. A delete with a
version id (`purge`) and lifecycle expiry run no `before` chain. `200`/`201`/`204`
lets the delete proceed, `422` vetoes it (`PipelineRejected`), failures follow
`on_error`. If
the object was replaced while the chain ran, the delete is refused with
`409 ConditionalRequestConflict` so a vetted object is never swapped for an
unvetted one; the client may retry.

If the client disconnects mid-chain, binvault aborts the in-flight call, revokes
the token and discards the staged data (a multipart upload stays open for a
retry of Complete).

**Time budget.** A `before` chain holds the client's request open, and stock
clients and proxies give up after 30–60 s (nginx `proxy_read_timeout` 60 s,
boto3 and the AWS CLI 60 s, AWS SDK for Java v2 30 s). When the client gives up,
binvault sees the disconnect and discards the upload. The default chain budget is
therefore 25 s (`BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT`), and `service.timeout`
may not exceed it. Raise it only if every client and proxy in the path is
configured to wait; work that takes longer belongs in an `after` pipeline (see
the slow-gate pattern in §7.14).

What the client sees:

| Situation | Response |
|---|---|
| Every run succeeded or was skipped | Normal success; `ETag` of the final bytes; `x-binvault-modified: true` if replaced |
| Service deleted the staged object, or answered 422 | `422 PipelineRejected` |
| Service failure, `on_error: reject` | `502 PipelineFailed` |
| Timeout, `on_error: reject` | `504 PipelineTimeout` |
| Failure, `on_error: continue` | Chain continues |

### 7.10 `after` lifecycle

1. **Enqueue.** In the commit transaction (§3.5), binvault creates an *event
   group* (`evt_…`) with one run per enabled `after` attachment that subscribes
   to the event and matches the committed object, in attachment order. Matching is
   evaluated once, then. Queues are not capped, so no event is ever dropped: watch
   `binvault_pipeline_queue_depth` and cancel with `POST /runs/cancel` if an outage
   grows one.
2. **Schedule.** A run is runnable when it is the first unfinished step of its
   group, its backoff time has passed, its pipeline and attachment are enabled and
   the pipeline is not paused, and no earlier group for the same `(bucket, key)`
   is unfinished. A run held by pause or disable counts as unfinished, so it holds
   its key until it runs or is cancelled. Groups for different keys are independent
   and unordered. Dispatch is oldest-first within `limits.max_concurrency` per
   pipeline and `BINVAULT_PIPELINE_WORKERS` overall.
3. **Execute a step.**
   - Pipeline deleted or attachment removed → `cancelled`. (A disabled or paused
     pipeline, or a disabled attachment, is never dispatched at all: the run
     just stays `queued`, §7.2.)
   - For created/updated events, if the live object's version is no longer the
     event's → `skipped` (`superseded`), as are the group's remaining steps. (A
     pipeline that must see every version subscribes to both `object.created` and
     `object.updated`; a created-only pipeline does not see an object that was
     updated before its run started.) Deleted events are not superseded: per-key
     ordering already runs them before any later event for that key.
   - Mint the token, call the service, read the response (§7.7).
4. **After the call.** Success → next step. Transient failure → retry after
   `retry.backoff` (`Retry-After` honoured) until `max_attempts` or until the run
   has been runnable for 24 h (time held by disable or pause does not count) →
   `failed`. Permanent failure → `failed`. A failed step then
   applies `on_error`: `stop` skips the group's remaining steps
   (`earlier_step_failed`); `continue` runs the next one. The object is never
   changed by a failure.
5. **Guarantees.** At-least-once. The run id is stable across attempts
   (`X-Binvault-Run`, with `X-Binvault-Attempt`), so services should be idempotent.
   Runs are persisted; a run that was `running` at a crash (or at the freeze of a
   bucket move, §8.8) is re-queued. On shutdown dispatching stops, in-flight calls
   get up to `BINVAULT_SHUTDOWN_TIMEOUT`, and the rest stay queued.
6. **Operate.** Inspect, retry and cancel through the admin API (§6.7); backfill
   existing objects (§6.8). After a service outage, `POST /runs/retry` re-queues
   every failed run in one call. A retry whose key has meanwhile moved on is
   skipped (`superseded`), so a stale `object.deleted` run can never delete the
   derivatives of an object that was uploaded again.

### 7.11 Loop protection

Pipelines can write objects, and writes raise events, so cycles must be
impossible. Every event carries a `lineage` — `depth` and `chain` (names of the
pipelines that caused it). Client writes have depth 0 and an empty chain. A write
made with a pipeline token yields an event with `depth + 1` and the pipeline
appended to `chain`.

- A pipeline never runs for an event whose `chain` contains it, so a compressor
  that rewrites its own input does not re-trigger itself.
- `after` runs for events deeper than `BINVAULT_PIPELINE_MAX_DEPTH` (default 4)
  are not created; a `skipped` (`depth_limit`) record is kept for visibility. This
  also stops cycles between two pipelines. The limit never applies to `before`
  chains: a gate sees every write, whatever its depth.
- `before` replacements are part of the original write and add no event.
- Other pipelines still react to a pipeline's output — a scanner attached to the
  same bucket will see `derived/…` objects unless excluded with `exclude_keys`.
  Derivative pipelines should exclude their own output prefix.

### 7.12 Run records

`before` runs are recorded when they finish; `after` runs from the moment they
are enqueued. Records are kept for `BINVAULT_PIPELINE_RUN_RETENTION`.

| State | Meaning |
|---|---|
| `queued` | Waiting (`after`): for a worker, its backoff, earlier steps, or because the pipeline is paused or disabled (`reason`: `paused`, `disabled`). |
| `running` | The service call is in flight. |
| `succeeded` | Finished successfully. |
| `rejected` | `before` only: the pipeline rejected the write or delete. |
| `failed` | Permanent failure, or retries exhausted. `error` and `http_status` say why. |
| `skipped` | Not executed. `reason`: `superseded`, `earlier_step_failed`, `depth_limit`, `chain_aborted` (an earlier `before` pipeline rejected or failed), `budget_exhausted`. |
| `cancelled` | Dropped before executing. `reason`: `pipeline_removed`, `attachment_removed`, `bucket_removed`, `admin`. |

### 7.13 Outbound safety

- `http` and `https` only. TLS verification is always on; extra roots come from
  `BINVAULT_PIPELINE_CA_FILE`. There is no per-pipeline skip-verify. Redirects
  are never followed.
- The target address is resolved for each call and the connection is made to the
  address that was checked (dial-time validation, which defeats DNS rebinding).
  Link-local (`169.254.0.0/16`, `fe80::/10`) and cloud-metadata addresses are
  **always** refused: nothing legitimate lives there. With
  `BINVAULT_PIPELINE_ALLOW_PRIVATE=false`, loopback, RFC 1918 and unique-local
  addresses are refused too. The default allows them because the usual deployment
  is a sibling container; only the admin can create pipelines.
- `service.headers` values and `signing_secret` are sealed at rest and redacted
  everywhere.
- The token travels in the request body, so use HTTPS beyond a trusted network.
  Its short life and narrow scope bound the exposure.
- Responses are read up to 64 KiB; 4 KiB is logged; `message` is capped at 512
  characters.
- `limits.max_concurrency` and `queue_timeout` protect services from overload
  and binvault from stalls; services should answer `429` when saturated.

### 7.14 Patterns

All of these are ordinary pipeline definitions; binvault knows nothing about the
work itself.

**Content gate (`before`, reject).** Validation, malware scan, content
moderation, format enforcement. Read the staged object, then answer `422` — or
delete it and answer `204`.

```json
{
  "name": "content-gate", "stage": "before",
  "events": ["object.created", "object.updated"],
  "match": { "keys": ["uploads/**"] },
  "service": { "url": "http://scanner:8080/hooks/binvault", "headers": { "Authorization": "Bearer …" }, "timeout": "20s" },
  "token": { "grants": [ { "actions": ["read", "delete"], "keys": ["{key}"] } ] },
  "on_error": "reject"
}
```

The gate has no `content_type` or size filter on purpose: an object that does not
match is skipped, so a filter would let exactly the odd or oversized files
through (§7.3). The service sniffs the bytes and decides, and the bucket's
`max_object_bytes` bounds the size.

**Transform before visible (`before`, replace).** Compression, resize, EXIF
stripping, re-encoding (§7.2 is exactly this one). Grants `read` + `write` on
`{key}`; the service PUTs the new bytes back. The key cannot change — produce
alternate formats as derivatives.

**Derivatives (`after`, extra keys).** Thumbnails, previews, transcodes.

```json
{
  "name": "thumbnails", "stage": "after",
  "events": ["object.created", "object.updated"],
  "match": { "keys": ["uploads/**"], "exclude_keys": ["derived/**"], "content_type": ["image/*"] },
  "service": { "url": "http://thumbs:8080/hooks/binvault", "timeout": "60s" },
  "token": { "grants": [
    { "actions": ["read"],  "keys": ["{key}"] },
    { "actions": ["write"], "keys": ["derived/{key}/*"] }
  ] }
}
```

**Cascade cleanup (`after`, deleted).** Remove derivatives when the source goes.

```json
{
  "name": "derived-cleanup", "stage": "after", "events": ["object.deleted"],
  "match": { "keys": ["uploads/**"] },
  "service": { "url": "http://thumbs:8080/hooks/binvault/cleanup" },
  "token": { "grants": [ { "actions": ["list", "delete"], "keys": ["derived/{key}/*"] } ] }
}
```

**Extraction → tags (`after`).** OCR, classification, metadata extraction. Grants
`read` + `tag` on `{key}`; the service records results with PutObjectTagging.
Tag changes neither alter the object nor raise events, and the stale-write guard
still stops a tag landing on a newer object.

**Quarantine (`after`).** Grants `read` + `delete` on `{key}` and `write` on
`quarantine/{key}`; the service copies the object there and deletes the original.
In an enabled bucket `delete` only adds a marker and the bytes stay as a noncurrent
version: also grant `purge` on `{key}` and delete `?versionId=<object.version>`
when they must really go, or let a `noncurrent_days` lifecycle rule remove them.

**Slow gate (`after`, promote).** A check that can exceed the `before` budget
(large files, deep scans, transcodes). Uploads land under `incoming/`, which
neither anonymous access nor application tokens can read; the service checks for
as long as it needs, then copies clean objects to `clean/…` (the only prefix in
`anonymous_prefixes`, or the only one application tokens may read) and deletes the
original. Grants: `read` + `delete` on `{key}`, `write` on `clean/*`. The
stale-write guard covers reads and the copy source (§7.8), so an upload replaced
during the scan is never promoted: the copy fails with `412` and the new version
gets its own run. In an enabled bucket add `purge` on `{key}` and delete
`?versionId=<object.version>` so the unscanned bytes do not linger.

**Notify or mirror (`after`).** Webhook-only (`"grants": []`) to tell another
system, or `read` on `{key}` to push the bytes to an external store.

### 7.15 Writing a service

```python
@app.post("/hooks/binvault")
def hook():
    ev = request.get_json()
    c = ev["s3"]
    s3 = boto3.client(
        "s3", endpoint_url=c["endpoint"], region_name=c["region"],
        aws_access_key_id=c["access_key_id"], aws_secret_access_key=c["secret_access_key"],
        config=Config(s3={"addressing_style": "path"}))
    data = s3.get_object(Bucket=ev["bucket"], Key=ev["key"])["Body"].read()   # staged bytes in a before run
    if not acceptable(data):
        return {"message": "not a valid image"}, 422        # reject; no S3 call needed
    s3.put_object(Bucket=ev["bucket"], Key=ev["key"], Body=recompress(data))  # replace the staged object
    return "", 204
```

Checklist:

- Verify `X-Binvault-Signature` and the timestamp, or your static auth header.
- Be idempotent: `after` runs are at-least-once, and `run.id` is stable.
- Answer within `service.timeout`, and only when the work is done: the token is
  revoked when the call ends (there is no `202` hand-off). Work longer than 30
  minutes belongs to your own queue, finished with a regular bucket token (§6.4).
- Treat `412 PreconditionFailed` from the S3 API as "superseded": stop quietly
  and answer `200`/`204`. It can appear on a read or a copy of the triggering key
  too (§7.8).
- Do not trust `Content-Type`; sniff the bytes.
- Stream large objects instead of buffering them, and discard the token after
  the run.

## 8. Clustering (sharding by bucket)

### 8.1 Model

binvault runs as one node or as a cluster. In a cluster:

- Each bucket has exactly one **home node**. The home stores the bucket's
  objects, uploads, settings, tokens, attachments, runs and counters, and is the
  only node that ever writes them. Everything in §2–§7 therefore holds **per
  bucket, unchanged**: strong consistency, atomic overwrites, conditional
  writes, `before` and `after` pipelines, quotas, immediate token revocation.
- The nodes share a small **catalog** (§8.2) — which node homes which bucket, the
  pipeline definitions, an access-key index — kept in sync by a replicated op log
  (§8.5). Object data and object metadata are never replicated.
- **Any node accepts any request.** When the bucket is homed elsewhere, the node
  forwards the request to the home and streams the response back (§8.4).
  Clients, SDKs and pipeline services see one endpoint.
- **Nothing changes for a single node.** Without cluster configuration a node is
  a cluster of one: it homes every bucket, the peer listener is not started, and
  this section does not apply.

What this gives, and what it does not:

| It gives you | It does not give you |
|---|---|
| **Capacity.** Every node's disk counts; add nodes and spread buckets. | **Redundancy.** A bucket's data exists on one node. If that node's disk is lost, so is the data, unless it is restored from backup (§9.5). |
| **Throughput.** Unrelated buckets run on different nodes in parallel. | **One bucket beyond one node.** Its disk, CPU and SQLite writer are the limit. |
| **Partial failure.** A node outage affects only the buckets it homes. | **Availability of those buckets** while their home is down: `503` until it returns. |
| **A control plane that survives partitions.** Catalog writes continue on both sides and converge. | **Automatic rebalancing.** A bucket moves only when an admin asks (§8.8). |

### 8.2 What lives where

| State | Written by | Stored on |
|---|---|---|
| **Bucket entries** — name, home (a node id), epoch, generation, creation time, names of the attached pipelines | the home | every node (replicated) |
| **Pipeline definitions**, secrets sealed | any node | every node (replicated) |
| **Access-key index** — access key id → bucket, no secrets | the home | every node (replicated) |
| Objects, blobs, uploads, staged objects, tags | the home | the home |
| Bucket settings (quota, CORS, anonymous read, …), attachments (order, `enabled`, `match`), tokens and their sealed secrets | the home — admin calls for the bucket are routed there (§8.6) | the home |
| Runs, backfills, event outbox, pipeline-token registry, throttling counters | the home | the home |
| Configuration, per-node limits, metrics, logs, node identity | — | each node |

Bucket-scoped state therefore has a single writer, so `revision` / `If-Match`
stay exact and token revocation stays immediate. Only the catalog can conflict,
and it is admin-rate data (§8.5).

### 8.3 Membership, identity and trust

Adapted from zonewright's replication design (`zonewright/REPLICATION.md`).

- **Node id.** 128 random bits generated at first start, stored in `meta.db`,
  never reused. A fresh volume is a new node.
- **Node name.** `BINVAULT_NODE_NAME` (required in a cluster), unique in the
  cluster. It appears in logs, `x-binvault-node` and the admin API. A duplicate name
  is refused and reported. Buckets are bound to the node **id**: the catalog's
  `home` is an id that the admin API shows as a name, so renaming a node changes
  nothing, and a fresh volume that reuses a name homes nothing.
- **Membership is one shared list.** `BINVAULT_CLUSTER_URLS` holds the
  peer-listener URL of *every* node, itself included, identical everywhere. A node
  calls `GET /_peer/v1/hello` on each URL; the answer carries the node id and
  name, a boot nonce that changes at every start, the peer-protocol version, the
  ids of every master key the node can open (current first), `BINVAULT_DOMAIN`,
  `BINVAULT_REGION`, `BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT`, the node's public
  `endpoint` (`BINVAULT_ENDPOINT_URL`), free disk, the number of buckets homed,
  and whether it is cordoned or draining for shutdown.
  - A URL that answers with this node's id **and** boot nonce is itself.
  - Any other id is a peer; two URLs answering with one id are one peer.
  - A URL that now answers with a different id than before is a **redeployed**
    node: the old id is retired and its catalog ops stay. Buckets homed on the old
    id stay assigned to it: they answer `503` and raise `missing` until its data
    dir is restored or they are dropped (§6.9).
  - A URL that answers with this node's id but another boot nonce means a
    **cloned data dir**: sync with it is refused and alarmed.
  - Unreachable URLs are retried with backoff; the node keeps working with
    whoever answers.
- **Changes to the list take effect when a node restarts** (roll them one at a
  time). A new node bootstraps the catalog from a snapshot (§8.5) and homes
  nothing until a bucket is created on it.
- **Trust.** `BINVAULT_CLUSTER_KEY` (≥ 32 bytes, identical everywhere) is sent as
  `X-Binvault-Peer-Key` on every peer request. It has its own header because a
  forwarded request must keep the client's `Authorization`. It is compared in
  constant time; during rotation the setting may list several keys: a node sends
  the first and accepts all. Peer URLs are `https://`, verified against the system
  roots, `BINVAULT_CLUSTER_CA_FILE` or a pinned certificate, and the peer listener
  serves TLS itself or listens on loopback behind a TLS proxy. Plain HTTP needs
  `BINVAULT_CLUSTER_INSECURE_HTTP` (private network or VPN) and logs a warning at
  every start, because everything on the peer link then travels readable: the
  cluster key, forwarded object data and newly issued token secrets.
- **Peers are fully trusted**, as in zonewright: whoever holds the cluster key is a
  cluster member, so binvault does not check which node may write which catalog op
  (§8.5). The master key and the pipeline secrets are on every node anyway (§10).
  The cluster key also carries the power of the admin token: the admin call a node
  relays to a bucket's home (§8.6) is authenticated by the key alone, so a holder
  can mint tokens, delete buckets and test pipelines. Guard the key like the admin
  token, and keep failed key attempts in mind: the peer listener does not log or
  throttle them (the key is at least 32 bytes), so it must not face clients.
- **Same settings everywhere.** All nodes need the same `BINVAULT_ADMIN_TOKEN` set
  (any node accepts admin calls; the token is checked where the call is received
  and never crosses the peer link, §8.6), `BINVAULT_MASTER_KEY` (pipeline secrets
  replicate sealed), `BINVAULT_REGION`, `BINVAULT_DOMAIN` and
  `BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT`. `hello` carries the last four (master
  keys as key ids); a mismatch is reported under `alarms` in
  `GET /_admin/v1/cluster`. Sealed values go only to a peer that can open the key
  that sealed them (§4.7); otherwise the op is held, not skipped. The admin token
  is not compared: a node with a different one simply rejects calls made with the
  others.

### 8.4 Routing and forwarding

**Finding the bucket**, in order:

1. `Host`, when `BINVAULT_DOMAIN` is set and the host is `<bucket>.<domain>`;
2. the first path segment (path-style);
3. for a request that names no bucket (`GET /`, ListBuckets), the access key id
   of its credential — the `Authorization` header or the presigned `X-Amz-Credential` —
   looked up in the access-key index. (Pipeline tokens live in memory at the
   home and are not indexed: a service makes bucket-less calls against the
   endpoint it was given, which is the home.)

In path-style requests, reserved `_` paths are never bucket requests (§2.4); admin
calls are routed by §8.6.

**Deciding.**

| The catalog says | The node |
|---|---|
| the home is this node | serves the request, exactly as a single node would |
| the home is another node | forwards it (below) |
| no such bucket or access key | pulls from every reachable peer at once (at most once a second: a bucket created a moment ago may not have replicated yet) and looks again; still nothing → answers as a single node would, `NoSuchBucket` (`InvalidAccessKeyId` for an unknown key) |

**Forwarding.**

```
client ──► any node ── catalog: photos → home = node-b
              │
              └─ forward ──► node-b (peer listener) ── serves from its own disk
client ◄── the response, streamed back unchanged
```

- **Verbatim.** The node sends the request to the home's peer listener with the
  same method, raw path and query, headers (hop-by-hop headers removed) and body
  bytes, **and the original `Host`**. SigV4 signs `Host` and the exact path, so
  the home verifies the client's signature itself: header, presigned and
  streaming (`aws-chunked`) forms all work, and the entry node needs no token
  secrets.
- **Added headers.** `X-Binvault-Peer-Key` (the cluster key), `X-Binvault-Origin`
  (entry node id), `X-Binvault-Request-Id` (becomes the request id at the home, so
  one id traces both hops) and `X-Forwarded-For` (the client address as the entry
  node sees it, after its own `BINVAULT_TRUSTED_PROXIES` handling). The forwarder
  first strips every `X-Binvault-*` header the client sent. The peer listener
  honours them only with a valid key and the home uses the forwarded address for
  throttling (§4.8) and logs; on the public listener they are ignored.
- **Forwarded means marked, not named.** On the peer listener a request that carries
  `X-Binvault-Origin` is a forwarded S3 request **whatever its path** — in
  virtual-hosted style a key may begin with `_peer/` — and a request without it is
  a peer-API call (`/_peer/v1/…`, which never carries the header) or `404`. A client
  can never turn a key into a peer call, because the forwarder alone sets the
  header.
- **Streaming both ways**, no buffering, with end-to-end backpressure. A client
  abort cancels the upstream request, and the home discards the staged data
  exactly as for a direct client (§7.9).
- **`Expect: 100-continue` is relayed:** the entry node answers `100 Continue`
  only after the home has, so admission failures (authentication, quota, size)
  still arrive before a large body is sent.
- **The response** — status, headers, body — is returned unchanged. It already
  carries the home's `x-binvault-node` and request id. The early-`200` keep-alive
  of slow copies and completes (§5.4.5, §5.6) passes straight through.
- **At most one hop.** A request that arrived with a valid peer key is served
  where it landed or fails; it is never forwarded again. If two nodes' catalogs
  disagree the client gets `503`, never a loop.
- **Moved buckets.** A forwarded request carries `X-Binvault-Epoch`, the bucket's
  `epoch` as the entry node knows it. A node that is not the home at that epoch
  answers `421` with `X-Binvault-Home: <node>`. The entry node pulls the catalog
  and, if it has not yet read any of the request body (reads, deletes, and uploads
  whose client waits for `100 Continue`), forwards once more to the new home;
  otherwise the client gets `503` with `Retry-After: 1` at once and its SDK
  retries (§8.8). The entry node never replays a body it has begun to read: a
  second attempt would send only its tail.
- **Timeouts.** Dialling the home: `BINVAULT_CLUSTER_FORWARD_CONNECT_TIMEOUT`.
  Waiting for the response: what the home may legitimately take (the `before`
  budget plus 15 s). The body idle timeout applies on both hops.
- **No replays.** The entry node never retries a forwarded request, since bodies
  cannot be rewound; SDK retries do that.

The peer listener serves two things, both only with a valid cluster key:
`/_peer/v1/…` (replication, discovery, the admin calls of §8.6 and the move
protocol of §8.8) and forwarded S3 requests. Nothing else.

**What the client sees when something goes wrong** (S3 XML errors, like any
binvault error):

| Situation | Response |
|---|---|
| Home unreachable, refusing connections, or known down from `hello` (fail-fast, no dial wait) | `503 ServiceUnavailable`, `Retry-After: 5`. SDKs retry with backoff. Only that node's buckets are affected. |
| Home draining for shutdown | `503 ServiceUnavailable`, same |
| Home dies mid-request | `503` if no response bytes were sent, otherwise the connection is reset; SDKs retry, and truncated downloads are caught by `Content-Length` and checksums |
| The catalog's home has no local state for the bucket (a retired id, a re-created node) | `503 ServiceUnavailable` and a `missing` alarm; never `NoSuchBucket` |
| Bucket unknown | `404 NoSuchBucket` |

**What a hop costs.** Behind a balancer that spreads requests randomly, (N−1)/N
of bucket traffic is forwarded — 67 % with 3 nodes, 80 % with 5 — which adds one
intra-cluster round trip, and every byte of a remote bucket crosses two nodes. To
avoid it, route by bucket in front: DNS `<bucket>.<domain>` pointing at the home
node (virtual-hosted style), or a balancer map generated from
`GET /_admin/v1/buckets` (`home`) and `GET /_admin/v1/cluster` (node `endpoint`).
Forwarding stays on as the safety net, so a stale map only costs a hop.

### 8.5 Catalog replication

The protocol is zonewright's: an op log, a hybrid logical clock, per-register
last-writer-wins, pull with a nudge, snapshots and compaction. Only the registers
differ. Catalog data is admin-rate — buckets, tokens, pipelines — which is where
asynchronous last-writer-wins is acceptable.

The peer API, all on the peer listener and all requiring `X-Binvault-Peer-Key`:

| Method & path | Purpose |
|---|---|
| `GET /_peer/v1/hello` | Identity, boot nonce, protocol version, key ids, the settings that must match, endpoint, free disk, buckets homed, cordoned / draining (§8.3). |
| `POST /_peer/v1/admin` | An admin call the sending node already authenticated, to be run here (§8.6). |
| `/_peer/v1/moves/{id}/…` | The bucket-move protocol: prepare, blob and part uploads, rows, activate, discard, status (§8.8). |
| `GET /_peer/v1/ops?since=<version vector>&limit=n` | Ops the caller has not seen, from every origin; the call doubles as the caller's acknowledgement: a node sends a vector only once everything in it is in effect on that node (§8.5). |
| `POST /_peer/v1/notify` | Nudge: "I have new ops, pull now". No body. |
| `GET /_peer/v1/snapshot` | The full catalog with each register's `(hlc, origin)`, for bootstrap and long outages. |
| `GET /_peer/v1/buckets/{name}` | Does this node's catalog know the bucket? Used by the create pre-check below. |
| any request carrying `X-Binvault-Origin` | A forwarded client request, whatever its path (§8.4). Any other path is `404`. |

- **Op log.** Every catalog change is an op `(origin, seq, hlc, kind, key,
  payload)` in `meta.db`; applying an op twice is a no-op. `hlc` is a hybrid
  logical clock (48 bits of milliseconds plus a 16-bit counter), always greater
  than anything the node has seen, so cause precedes effect even when wall clocks
  disagree a little.
- **Registers.** One per key: the value (or a tombstone) and the `(hlc, origin)`
  of the op that wrote it. The higher `(hlc, origin)` wins on every node, in
  whatever order ops arrive.
  - `bucket/<name>` — `{home, epoch, generation, created_at, pipelines[]}`,
    written by the home (and, during a move, by the old home's hand-off, §8.8).
    `generation` is the id of the create op, so a deleted and recreated name starts
    clean.
  - `pipeline/<name>` — the definition, its revision and a `generation` (the id of
    its create op, so a pipeline deleted and created again is a new pipeline),
    written by whichever node took the admin call.
  - `key/<access_key_id>` — `{bucket}`, written by the home when it creates or
    deletes a token.
- **Pull loop.** Every `BINVAULT_CLUSTER_PULL_INTERVAL` a node asks each peer for
  ops beyond its version vector (`GET /_peer/v1/ops?since=…`). A node relays ops
  from every origin, so three or more nodes converge transitively. After a local
  write the node sends `POST /_peer/v1/notify` and peers pull at once, so
  replication normally takes well under a second; the timer is the fallback. A
  batch is applied in one SQLite transaction. The version vector a node pulls with
  is also its acknowledgement of every op in it, and it covers only ops that are in
  effect on that node: the change an op made has reached the node's own handlers
  (the pipeline's local definition, the key index and the bucket routing are
  updated), whichever pull loop applied the op. A node whose handlers are behind
  holds its acknowledgement back, for at most ten seconds at a time.
- **Validation on receipt.** Every op is checked for shape and must be unchanged by
  normalisation (a malformed or non-canonical op is refused). Beyond that peers are
  trusted (§8.3): there is deliberately no per-op ownership check, so whether an
  op is applied never depends on which other ops have arrived — the winner rule
  above alone decides, which is what makes "any order, identical catalogs" (§12)
  true.
- **Snapshot.** `GET /_peer/v1/snapshot` returns the full catalog, for a new node
  or one that fell behind compaction. It is merged, not swapped in, so local
  changes the sender has not seen survive.
- **Compaction.** An op or tombstone older than `BINVAULT_CLUSTER_RETENTION` that
  every known peer has acknowledged is removed. A peer that lost its state catches
  up by snapshot. Retired ids never hold compaction back; an unreachable URL does,
  and `GET /cluster` shows it, until the peer returns or its URL leaves the list.
- **Clock guard.** An op whose `hlc` is further than
  `BINVAULT_CLUSTER_MAX_CLOCK_SKEW` in the future is held, not applied, and
  alarmed. NTP on every node is required.
- **Start-up fence.** A node that starts in a cluster first asks **every** peer for
  the highest `seq` they hold from its own origin and pulls those ops back (so a
  sequence number is never reused, which matters after a restore from an old
  backup), and learns the current catalog, so it knows which buckets it still
  homes. Until every peer URL has answered, or `BINVAULT_CLUSTER_STARTUP_FENCE` has
  passed, it serves no bucket (`503`) and accepts no catalog write. If every peer
  answered, it continues its op stream above the highest `seq` any of them holds.
  If some stayed silent (a lone survivor, or a peer that is down), it goes ahead
  with a warning, serves what it has and starts a **new op stream** (a fresh origin
  id; the node id stays the same), because a silent peer may hold ops of its old
  stream that it has not seen, and its new ops must never collide with them.
  Restore a node while all its peers are up.
- **`?wait=replicated`.** Pipeline writes and `POST` / `DELETE /buckets…`
  (including `catalog_only`) accept it (§6.1); every other call ignores it. The
  response is sent once every active peer has applied the op and put it into
  effect (`200`: a read through any node's admin API or S3 endpoint right after it
  sees the change), or after a timeout as `202` naming the pending peers. Use it when the next step needs the
  change everywhere — create a pipeline, then attach it to a bucket homed
  elsewhere.

Conflicts:

| Situation | Outcome |
|---|---|
| A pipeline is edited on two nodes at once | The later `hlc` wins everywhere; the loser is logged. |
| The same bucket name is created on two nodes at once | `POST /buckets` first asks every reachable peer whether the name exists (`409` if so), which closes the window except for a simultaneous race or a partition. If it still happens the later `hlc` wins, and the loser's local bucket becomes an **orphan**: not served, data kept, listed under `orphans` in `GET /_admin/v1/cluster` until an admin deletes it (§6.9). |
| A home returns after its bucket's catalog entry was dropped with `catalog_only` | Same: its local data is an orphan, also after the tombstone has been compacted away (reason `unknown`: the catalog has no entry at all). A node publishes a local bucket that the catalog does not list only on its first cluster start (the single-node upgrade, §9.6) and for a bucket whose creation left a "to be published" marker (a crash between the local row and the catalog write); never otherwise. |
| A bucket is an orphan, or its home is still starting | Nothing of it runs here: its queued `after` runs, backfill walks, lifecycle and multipart expiry wait (§7.10); its data is kept as it is. |
| A home holds no data for a bucket the catalog gives it (restored from an older backup, lost disk) | The bucket answers `503`. `DELETE /buckets/{name}` (from any node) removes the catalog entry and the access-key index entries of its tokens, so the name can be used again; data of another incarnation of the name that the node holds stays an orphan. |
| A node comes back from a backup older than a move of one of its buckets | Its catalog sync shows the bucket homed elsewhere at a higher epoch: the stale local copy is an orphan too (not served). |
| A pipeline is deleted and created again | The new pipeline has a new `generation`. Each attachment records the generation it was made for, and a home drops attachments (and cancels their queued runs) whose generation differs from the current `pipeline/<name>` register — whether that register is a tombstone or the re-created pipeline — so the outcome does not depend on which op arrived first. The same holds for a bucket that is moving at the time: the new home checks the attachments that arrive with the rows against the catalog (§8.8 step 4). |
| Two nodes write the same value to a register at once (the old and the new home of a moved bucket both write the hand-off, §8.8) | Not a conflict: nothing is lost whichever wins, and no `conflicts` alarm is raised. A different value written at the same time is one. |
| A bucket name is reused after deletion | The new `generation` starts clean; nothing of the old bucket is visible. |

### 8.6 Admin API in a cluster

Any node accepts any admin call on its admin listener, authenticated with the same
admin token, and routes it by what it touches. The receiving node checks the
token itself; a call for another node's bucket travels to it as a peer request
(`POST /_peer/v1/admin`, authenticated by the cluster key), so the admin token
never crosses the peer link.

| Class | Calls | Behaviour |
|---|---|---|
| **Catalog** | `GET /buckets`, everything under `/pipelines` except `/test` | reads are local; writes are catalog ops (`?wait=replicated` available) |
| **Bucket-scoped** | `POST /buckets`, `PUT /buckets/{name}`, `/buckets/{name}` (detail, settings, delete) and everything under `/buckets/{name}/…` (`/move` included), `POST /backfills`, `POST /pipelines/{name}/test` | sent to the bucket's home, which runs it and answers. Exception: `DELETE /buckets/{name}?catalog_only=true` is a catalog write the receiving node makes itself, so it works when the home is down. While the bucket is frozen or paused for a move, the home answers its changes (settings, tokens, attachments, backfills, runs of the bucket) `503 unavailable` with `Retry-After: 1` |
| **Fan-out** | `GET /runs…`, `GET /backfills…`, `GET /moves…`, any call by run, backfill or move id, bulk run calls, `GET /buckets?stats=true` | sent to every reachable node in parallel and merged (newest first, composite cursor); a call by id succeeds on the node that owns the object; unreachable nodes are named in `partial`. A peer that has hung (it accepts the call and never answers) holds the first fan-out call that reaches it for the whole fan-out timeout, 30 s; after that it is skipped as unreachable. A move is known to both its nodes and listed once, as its source knows it; a cancel goes to the source |
| **Node-local** | `GET /status`, `GET /config`, `/_metrics` | answered by the node that received them (`/_healthz` and `/_version` live on the public listener only, §2.4) |
| **Cluster** | `/cluster…` (§6.9) | as described there; `drain` and `undrain` run on the node they name |

`POST /buckets` and `DELETE /buckets/{name}` write a catalog entry too, so they also
accept `?wait=replicated` (§6.1).

**Placement.** `POST /buckets` takes `home`: a node name, or `"auto"` — the
default in a cluster — meaning the reachable, non-cordoned node with the most free
disk according to the latest `hello`. The node that receives the call first asks
every reachable peer whether the name exists (`409` if so), resolves `auto` or the
node name to a node id, and sends the call to the chosen node as a peer request
(which creates the bucket locally and writes the catalog entry). Creating is `POST`
only (§6.3), so this is the one place a bucket can appear. The home changes only
through a move (§8.8). A single node always homes everything.

If a bucket's home is down, its bucket-scoped admin calls answer `503`
(`unavailable`); catalog calls, `catalog_only` deletes and everything on other
nodes keep working.

### 8.7 Pipelines in a cluster

- **Definitions** are catalog data and exist on every node. A home runs the
  pipelines attached to *its* buckets; their runs, queues, outbox, tokens and
  staged objects are local to it. Nothing about a run crosses nodes.
- **Attachments** are bucket state, written at the home. The bucket's catalog
  entry carries only the *names* of its attached pipelines, so `attached_to` and
  the delete guard (`409` unless `?detach=true`) work from any node. Deleting a
  pipeline replicates a tombstone. Each attachment records the pipeline's
  `generation`, and a home drops an attachment, and cancels its queued runs
  (`pipeline_removed`), whenever the current `pipeline/<name>` register — a
  tombstone or a re-created pipeline — carries a different generation (§8.5).
- **Propagation.** A definition change reaches each home within the replication
  delay (§8.5). A `before` chain is still fixed when its upload is staged, and
  an `after` event's steps when it commits (§7.4).
- **Limits are per node.** `limits.max_concurrency`, `limits.queue_timeout` and
  `BINVAULT_PIPELINE_WORKERS` are enforced independently on each node, so a
  service can see up to `max_concurrency` × (the number of nodes that home buckets
  attached to it) concurrent calls. Size it accordingly.
- **Services reach the home through any node.** An invocation names the
  *calling* node's `BINVAULT_ENDPOINT_URL` — the home — so a service's S3 calls
  go straight there. A service that goes through a balancer instead still works:
  a pipeline-token request for bucket X is forwarded to X's home, where the token
  and the staged object live.
- **One network.** A pipeline's `service.url` is global, so every node that homes
  an attached bucket must reach it at that URL: nodes are assumed to share one
  network, and per-site URL overrides are not supported.
- **One bucket per token.** A pipeline token is still scoped to the triggering
  bucket (§7.8), so no pipeline ever has to reach a different node (§13.1).

### 8.8 Moving a bucket

An admin can move a bucket to another node to rebalance disks or to empty a node
(`POST /buckets/{name}/move`, §6.10; `POST /cluster/nodes/{id}/drain`, §6.9). The
move is online: the blobs, which are immutable and hold nearly all the bytes, are
copied while the bucket keeps serving; the rows, which are small, are copied during
one short freeze. There is no journal of changes, so nothing can be missed.

1. **Prepare.** The old home (A) records the move — `queued`; a node takes part in
   one move at a time, so a move waits until A is free — and asks the target (B) to
   `prepare`: the bucket, its generation, the epoch it will have (`epoch + 1`), its
   bytes and the master key ids its sealed values use (§4.7). The bytes are what the
   bucket takes on disk: the stored size of the blobs its version rows reference —
   each blob once, however many versions share it — and of its open uploads' part
   files, not the sum of the sizes of its versions. B answers **`busy`** if it takes
   part in another move, or if the catalog says the bucket is attached to a pipeline
   whose register has not reached B yet (A puts the move back in the queue and asks
   again after a short random pause, so that two nodes that ask each other at once do
   not keep colliding; the move shows `waiting: pipeline "x" has not reached the
   target node yet`), and **refuses** — the move fails — if it is shutting down or
   cordoned, holds a bucket of that name (an orphan), has a catalog that does not
   list the bucket as homed on A at `epoch`, has less free disk than the bucket's
   stored bytes plus a margin (`BINVAULT_MIN_FREE_MB`, at least 64 MiB), or cannot open one of
   the key ids. The admin call has already checked what `hello` says of B
   (reachable, ready, not cordoned, free disk, key ids) and answers `409`.
2. **Copy blobs, online.** A sends every blob that the bucket's version rows
   reference, and every part file of its open uploads, to B over the peer listener
   (`BINVAULT_MOVE_STREAMS` streams in parallel, optionally rate-limited by the
   move's `max_bytes_per_second`), each verified against its SHA-256. Encrypted
   blobs travel as they are (§3.11). Each file is one request: chunked, with
   `Expect: 100-continue` (a file B has is not sent again) and the digest as an HTTP
   trailer, so that A hashes while it streams; B checks size and digest, places the
   file like any blob (file and directory synced) and records a row for it that
   nobody references, which the garbage collector and the orphan sweeper leave
   alone until the rows of the bucket arrive. Further passes copy what was added
   since the previous pass (version rows with a higher `seq`, new part files). A
   moves on to the freeze after five passes, or as soon as a pass is small (at most
   1000 files listed and 64 MiB sent) or no smaller than the one before. A serves reads and
   writes throughout. A blob that has gone from A during an online pass is skipped
   (a version was removed meanwhile); in the final pass it fails the move. A target
   that stops taking data — a transfer that has moved no bytes for
   `BINVAULT_BODY_IDLE_TIMEOUT`, or a blob or part file that is not answered within
   it (plus a second per 8 MiB of the file: the target syncs it) once it was sent —
   fails the move (before the cutover, so the bucket is as it
   was and A's slot is free); the same goes for the rows of step 4.
3. **Freeze.** A stops admitting writes and admin changes to the bucket (`503
   SlowDown` with `Retry-After: 1`, `503 unavailable` for the admin API; reads
   continue). Every write that has not yet reached its commit transaction is
   cancelled with the same `503` (the clients retry): requests still receiving a
   body, `before` chains, a Complete still assembling its parts, a copy still writing
   a new blob. A waits only for commits already running, so the freeze lasts as long
   as the next step, not as long as the slowest upload. `after` calls in flight are
   cancelled and their runs go back to `queued`. Lifecycle and the expiry of
   multipart uploads leave the bucket alone meanwhile.
4. **Copy rows.** A sends the last blobs and then **all of the bucket's rows** in
   one stream: settings, the bucket data key (sealed), version rows with their tags
   in `seq` order, open uploads (rows only: their part files are already there),
   completed-upload records, tokens,
   attachments, runs (queued, failed and finished) and backfills. Version ids and
   timestamps do not change; B re-inserts the rows in `seq` order (its own `seq`
   values continue past them) and rebuilds blob reference counts from them. B
   spools the stream to disk first and imports it in **one** write transaction, so
   that its writer is not held while the network delivers; it verifies the row count
   of every table, that every row names the bucket the stream is for (a stream that
   carries a row of another bucket is refused as a whole), that every blob row of
   the stream is one of the files it received (with the same size) and that every
   referenced blob and part file is present with the right size. Pipelines are the
   catalog's: in the same transaction B drops the attachments that came with the rows
   and were made for another generation of their pipeline than the catalog's, or for a
   pipeline that was deleted — a pipeline deleted and created again while the bucket
   was moving — together with their queued runs and backfills, as it does when it
   materialises such a change for a bucket it holds. A pipeline that B's catalog does
   not hold at all yet — or holds only as an older incarnation, because the op that
   created the attachment's generation has not reached B — is not a pipeline that was
   deleted: its register is on its way, so B answers `busy` (nothing is imported), A lifts the freeze, serves the bucket as
   before and asks again after the pause, and B keeps the blobs it has. The imported
   runs and backfills stay held until the activation. If steps 3–4 take longer than
   `BINVAULT_MOVE_FREEZE_TIMEOUT`, A lifts the freeze and the move fails.

   **What the freeze costs.** Reading the rows on A, sending them and importing them
   on B take about 20 µs per version row on the measured hardware — roughly 22 s per
   million versions with fsync on — plus the transfer of the last blobs. The writes
   to the bucket wait that long, and so do the writes to every other bucket on B for
   the one import transaction, which holds B's writer. A bucket with several million
   versions therefore needs a larger `BINVAULT_MOVE_FREEZE_TIMEOUT` (the default is
   60 s) and a quiet moment on B; the import is deliberately one transaction (a
   partial import is never visible), so there is no way to shorten it but to keep
   buckets small.
5. **Activate.** A pauses the bucket completely (`503`, reads too) and **durably
   records `cutover`**, then asks B to take it
   (`POST /_peer/v1/moves/{id}/activate`). B decides, once and durably: if it holds
   the verified copy and has not abandoned the move, it makes "home of the bucket
   at epoch + 1" durable (the move's state and the local epoch, in one transaction),
   **writes the hand-off op to the catalog**, starts serving and answers `OK`; all of
   that after the decision is B's own and runs on until it is done (it is repeated, in
   the background, if the catalog write fails), whether or not A asks again — A may
   have crashed or been retired, and the bucket must not stay unserved and B's slot
   taken; otherwise it durably marks the move abandoned and answers `REFUSED` (final:
   a late `activate` can never succeed after it). Both answers are HTTP `200`,
   `application/json`, `{"move":"<id>","result":"OK"}` or `"REFUSED"` with a
   `reason`, and nothing else counts as an answer. Only after `OK` does A durably
   record "moved to B, epoch + 1" (the move's state and its own local epoch, in one
   transaction), answer `421` for the bucket from then on and make sure the catalog
   says it (§8.5): B's op normally reaches A within milliseconds and A waits for it a
   moment; if it has not, A writes the same op itself — a register's epoch only
   rises, so the two writes are one (and the catalog does not report two writes of
   the same value as a conflict, §8.5). Only `REFUSED` lets A lift the pause and fail
   the move. Any other outcome — a timeout, a connection error, an error page from
   a proxy in front of B — is **no answer**, and silence does not tell A whether B is
   serving: A keeps the bucket paused and asks again with a growing pause (up to 15
   s; activation is idempotent), also after a restart of A; while it waits the move's
   `error` shows what the last call came back with. Entry nodes learn the new
   home from the catalog or from a `421` (§8.4); runs that were queued continue on
   B.
6. **Clean up.** A removes its local copy — rows, part files and blob references,
   its blobs following the normal grace (§3.4) — and writes **no** catalog op and
   fires no events. The rows go in pieces of 10,000, one short transaction each, so
   that a bucket with millions of versions does not hold A's writer; the move stays
   `moved` until the last piece, and a node that restarts in between carries on. (A forced bucket deletion would tombstone the bucket and its
   tokens in the catalog and make the moved bucket disappear.)

- **Epochs.** `epoch` counts a bucket's moves. A forwarded request carries the
  epoch the entry node knows; a node that is not the home at that epoch refuses it
  with `421`, so two nodes never both accept writes for a bucket. Each node also
  keeps the epoch of its **local copy** (`buckets.epoch`) and serves a bucket only
  while that equals the catalog's: A records the new epoch the moment it hands the
  bucket over, so it stops serving before the catalog says so, and B records it the
  moment it activates, so it serves at once. A copy that is behind the catalog (a
  node restored from an older backup) is therefore never served, and is reported as
  an orphan (§8.5).
- **States.** A move is `queued`, `preparing`, `copying`, `frozen`, `cutover`,
  `moved` (B took the bucket; A is removing its copy) and `done`, or ends `failed` or
  `cancelled`. The target's record of the same move, shown with `role: "target"`, is
  `receiving`, `verified` and `activated`, or `abandoned`. Records are kept.
- **Failures.** There is no resume. Before step 5 a failure of either node, a
  timeout or a cancel ends the move: A keeps serving and tells B to discard its
  partial copy (best effort; B also gives it up when it has heard nothing from A for
  five minutes plus twice A's freeze timeout, and at the latest at its next boot,
  where it marks the move abandoned). A `discard` that is the first B hears of the
  move overtook its `prepare`: B remembers the id as abandoned and refuses the
  prepare that follows it. Start the move again. From step 5 on, B's
  answer decides and A never gives up on its own: while B cannot be reached the
  bucket answers `503`. If B is gone for good, retiring it (`DELETE
  /cluster/nodes/{id}`, sent to A) ends the move: A resumes serving at epoch + 2 and
  writes that to the catalog, so a copy on B that ever returns is an orphan. Before
  it resumes, A asks the retired B for its record of the move (`GET
  /_peer/v1/moves/{id}`, at B's last known address): a B that is alive and has
  activated is the home — it may have acknowledged writes already — so the move is
  done, not taken back. A shutdown changes none of this (§9.4).
- **Cancel.** `POST /moves/{id}/cancel` is accepted only by A, the source, and only
  before step 3 (`409` after that), so the two sides never disagree about whether
  a move is happening.
- **What clients see.** Reads continue until step 5. Writes meet a freeze whose
  length grows with the number of objects, not with their size (`503`, which SDKs
  retry); a request forwarded to the old home during the switch is re-forwarded or
  answered `503` (§8.4). A `DeleteObjects` that the freeze cuts short answers `200`
  with `SlowDown` for the keys it did not reach, like the same deletes on their own.
  Between A's recording of the move and the catalog's update, a few milliseconds, a
  request for the bucket gets `503` rather than the `421` of step 5. Admin calls
  that touch the runs of every bucket of a node (`POST /runs/cancel` and `/runs/retry`
  by pipeline, §6.7) leave the runs of a frozen or paused bucket alone and count
  them as `skipped`.
- **What does not move.** The time an attachment or a pipeline spent disabled or
  paused (the holds of §7.10) is node-local bookkeeping: it starts again on B, so a
  queued run of a bucket that was held when it moved gets its 24 hours of retrying
  counted from the move. The part files of an upload that was completed or aborted
  while the blobs were being copied stay on B, about 5 MiB each at most, until the
  hourly orphan sweeper removes them.
- **Drain.** `POST /cluster/nodes/{id}/drain` cordons the node — `auto` placement
  skips it — and moves its buckets one after another, choosing each target with
  `auto` (the node with the most free disk that can take the bucket). A bucket whose
  move fails is tried again later; `undrain` lifts the cordon. The state is the
  cordon flag (persistent), the buckets the catalog still homes on the node and its
  moves, so a drain goes on after a restart.
- **Limits.** A bucket has at most one move at a time and a node takes part in one
  move at a time; others queue. There is no automatic rebalancing: the admin
  decides what moves where.

**The move protocol** is a set of peer calls (§8.5), each addressed to a move id:

| Call | Body | Answer |
|---|---|---|
| `POST /_peer/v1/moves/{id}/prepare` | JSON: bucket, generation, epoch, source node id, bytes, key ids, the source's freeze timeout | `200 {"result":"ok"}`; `409 {"result":"busy"}` or `409 {"result":"refused","detail":…}` |
| `PUT /_peer/v1/moves/{id}/blob/{blob id}` | the blob; `X-Binvault-Size`, `X-Binvault-Plain-Size`, `X-Binvault-Sse`; trailer `X-Binvault-Sha256` | `200 ok` or `exists`; `409` refused (digest, size) |
| `PUT /_peer/v1/moves/{id}/part/{upload id}/{part id}` | the part file; `X-Binvault-Size`; the same trailer | as above |
| `POST /_peer/v1/moves/{id}/rows` | the rows, as JSON lines (one header line per table, one line per row, a closing line with the number of rows of each table; a text value that is not valid UTF-8 is `{"s":"<base64>"}`, a blob value `{"b":"<base64>"}`) | `200` with the counts; `409` `busy` (a pipeline of the bucket is not in the target's catalog yet) or refused; `422` refused |
| `POST /_peer/v1/moves/{id}/activate` | — | `200 {"move":…,"result":"OK"\|"REFUSED"}` |
| `POST /_peer/v1/moves/{id}/discard` | — | `200` (an id the target does not know is remembered as abandoned); `409` for an activated move |
| `GET /_peer/v1/moves/{id}` | — | the target's state of the move |

### 8.9 Failures and operations

| Event | Effect | Recovery |
|---|---|---|
| A node is down | Its buckets answer `503`; their `after` runs wait, persisted (§7.10). The catalog and the other nodes' buckets are unaffected. | Restart it; runs resume. |
| Network partition | Each side keeps serving the buckets it can reach and keeps accepting catalog writes; they converge on healing. Creating a bucket on an unreachable node fails. | Automatic. |
| A node's disk is lost | Its buckets' data is gone. | Restore the node from backup (§9.5) while its peers are up; the start-up fence resyncs the catalog. |
| A node is lost for good | Its buckets stay in the catalog, unreachable. | `DELETE /buckets/{name}?catalog_only=true` for each, then `DELETE /cluster/nodes/{id}`. |
| A clock runs ahead | Its ops are held on the other nodes. | Fix NTP; held ops then apply. |
| Upgrade | One node at a time (§9.6). | — |
| A move is interrupted | Before activation the old home keeps serving and the move is abandoned; from activation on the new home decides (§8.8). | Start the move again. |

Adding a node: start it with the full URL list, then add its URL to the other
nodes and restart them one at a time. Removing a node: it must home no buckets
in the catalog (`409` otherwise); drop its URL everywhere, then
`DELETE /cluster/nodes/{id}`. To empty a node that still homes buckets, drain it
(`POST /cluster/nodes/{id}/drain`, §8.8): its buckets move to other nodes one at a
time.

### 8.10 Cluster tour

```bash
# On each of three hosts (a, b, c): same secrets, same URL list. This tour keeps
# the peer listener on a private network (10.0.0.x) over plain HTTP; production
# uses TLS instead (BINVAULT_CLUSTER_TLS_CERT_FILE / _KEY_FILE and https:// URLs).
docker run -d --name binvault -p 9000:9000 -p 127.0.0.1:9001:9001 -p 10.0.0.1:9100:9100 \
  -v binvault-data:/var/lib/binvault \
  -e BINVAULT_ADMIN_TOKEN=$ADMIN -e BINVAULT_MASTER_KEY=$MASTER \
  -e BINVAULT_NODE_NAME=a -e BINVAULT_CLUSTER_KEY=$CLUSTER \
  -e BINVAULT_CLUSTER_INSECURE_HTTP=true \
  -e BINVAULT_ENDPOINT_URL=http://a.example.com:9000 \
  -e BINVAULT_CLUSTER_URLS=http://10.0.0.1:9100,http://10.0.0.2:9100,http://10.0.0.3:9100 \
  ghcr.io/kalevski/toolcase/binvault     # on b and c: NODE_NAME, ENDPOINT_URL and the -p address differ

# Admin calls go to any node's admin listener (here on host a). Create a bucket
# homed on node b:
curl -sX POST "http://127.0.0.1:9001/_admin/v1/buckets?wait=replicated" \
  -H "Authorization: Bearer $ADMIN" -d '{"name":"photos","home":"b"}'

# Mint a token (sent to b, where tokens live).
curl -sX POST http://127.0.0.1:9001/_admin/v1/buckets/photos/tokens \
  -H "Authorization: Bearer $ADMIN" \
  -d '{"name":"web","grants":[{"actions":["read","write","list"]}]}'

# Use it through any node; requests for photos are forwarded to b.
AWS_ACCESS_KEY_ID=BVK… AWS_SECRET_ACCESS_KEY=… \
  aws --endpoint-url http://c.example.com:9000 s3 cp ./a.png s3://photos/a.png

# Later: move the bucket to node c, online.
curl -sX POST http://127.0.0.1:9001/_admin/v1/buckets/photos/move \
  -H "Authorization: Bearer $ADMIN" -d '{"to":"c"}'
```

## 9. Observability and operations

### 9.1 Logs

One structured line per request: time, level, request id, method, path, bucket,
key, status, bytes in/out, duration, and the **principal** — `admin`,
`token:<access key id>`, `pipeline:<name>/<run id>`, `anonymous`, or `-` for a request
whose credentials failed (it has no principal). `GET /_healthz` is the one request that
is not logged, unless it answers 5xx, so that probes do not drown the log. A `503
SlowDown` (throttling) is logged at `warn`, any other 5xx at `error`. Pipeline
runs log their outcome with the run id. In cluster mode lines also carry `node`,
and a forwarded request is logged on both nodes (`forwarded_to` on the entry node,
`via` on the home) under one request id. Never logged: secrets, tokens,
signatures (`X-Amz-Signature` is stripped from logged queries), request bodies,
object contents. What Go's HTTP server reports about a connection (a failed TLS
handshake, ...) goes through the same logger, at `warn` with the listener's name, and the
boot warnings of §2.3 are logged through it too, so `BINVAULT_LOG_FORMAT=json` is JSON on
every line.

### 9.2 Metrics

`GET /_metrics` (admin token, on the admin listener), Prometheus text
exposition. It is node-local, so scrape every node:

- `binvault_http_requests_total{op,status}` and
  `binvault_http_request_duration_seconds{op}` — `op` is the S3 or admin
  operation name, not the path.
- `binvault_bytes_total{direction}` — bytes in and out of request and response bodies,
  on both listeners (admin requests included).
- `binvault_objects{bucket}`, `binvault_object_versions{bucket}`,
  `binvault_stored_bytes{bucket}`. `BINVAULT_METRICS_PER_BUCKET=false` drops the
  `bucket` label: the three names then carry one node-wide sum each.
- `binvault_pipeline_runs_total{pipeline,stage,state}`,
  `binvault_pipeline_run_duration_seconds{pipeline,stage}`,
  `binvault_pipeline_queue_depth{pipeline}`,
  `binvault_pipeline_retries_total{pipeline}`,
  `binvault_pipeline_rejections_total{pipeline}`.
- `binvault_auth_failures_total{scheme}` (`header`, `presigned`, `bearer`, `none` on
  the S3 listener, `admin` for a failed admin-API authentication),
  `binvault_throttled_total{reason}` (`auth` — an address over the failure limit, on
  either listener — and `rate`), `binvault_lifecycle_actions_total{bucket,action}` (without
  `bucket`, counting across buckets, when `BINVAULT_METRICS_PER_BUCKET=false`).
- `binvault_disk_free_bytes`, `binvault_blob_gc_pending`,
  `binvault_scrub_mismatches_total`, `binvault_multipart_open`.
- Cluster: `binvault_cluster_peer_up{peer}`,
  `binvault_cluster_replication_lag_ops{peer}`,
  `binvault_cluster_forwarded_requests_total{peer,status}`,
  `binvault_cluster_forward_failures_total{peer,reason}`,
  `binvault_cluster_held_ops`, `binvault_cluster_conflicts`,
  `binvault_cluster_moves{state}` (move records by state), `binvault_moves_running`,
  `binvault_moves_total{outcome}` (`done`, `failed`, `cancelled`, as source),
  `binvault_move_bytes_total`, `binvault_move_freeze_seconds{outcome}` (how long a
  bucket's writes were frozen: from the freeze to the end of the cutover, or to the
  lift of the freeze), `binvault_move_passes_total` and
  `binvault_move_refusals_total{reason}` (as target).
- Go runtime and process metrics, under their standard names: `go_goroutines`,
  `go_threads`, `go_memstats_alloc_bytes`, `go_memstats_sys_bytes`, `go_gc_cycles_total`
  (a counter) and `go_gc_duration_seconds` (a summary of the recent GC pauses),
  `process_cpu_seconds_total`, `process_start_time_seconds` and `process_uptime_seconds`;
  on Linux also `process_resident_memory_bytes`, `process_open_fds` and
  `process_max_fds` (left out where the platform cannot give them).

### 9.3 Health

`GET /_healthz` is `200` while the database answers, the data dir is writable and
free space is above `BINVAULT_MIN_FREE_MB`; otherwise `503` with a fixed body naming
the failing check: `database`, `data dir not writable` or `low disk space`. The
endpoint is unauthenticated, so it never shows paths or error text; those go to the
log. In a cluster it returns `503 starting` until the start-up fence (§8.5) has ended,
so load balancers stop sending traffic to a node that cannot serve yet. From SIGTERM
on it answers `503 draining`, but only for as long as the listeners are open (§9.4):
they stay open while pipeline calls are in flight (their services need the S3 API for
their tokens) and close at once otherwise, so on a node with nothing in flight a load
balancer sees the connection refused, not `503 draining`; `binvault healthcheck` fails
either way. `binvault healthcheck` calls it for container health checks. It reports
this node only: an unreachable peer never fails it, otherwise a partition would
drain the whole cluster from the balancer (peer state is in
`GET /_admin/v1/cluster`).

### 9.4 Shutdown

On SIGTERM (SIGINT and SIGHUP do the same): report draining (`/_healthz` answers
`503 draining`, §9.3), stop starting `before` chains and dispatching `after` runs, let
the calls already in flight finish (up to `BINVAULT_SHUTDOWN_TIMEOUT`, with the S3
listener still open for their tokens; the runs not yet dispatched stay `queued` in the
database), then stop accepting connections — the listeners close at once on a node with
no such call, so a new connection is refused, not answered — let in-flight transfers
finish within the same grace period, checkpoint the WAL, exit. A `kill -9` loses
nothing acknowledged: staging files are discarded at boot, orphan blobs are swept,
and queued runs resume. In a cluster the node also stops forwarding new requests
(forwards in flight finish) and tells its peers it is draining, so they answer
`503` for its buckets at once instead of waiting for a timeout. A move in progress
that has not reached step 5 is abandoned (§8.8); start it again after the restart.
From step 5 on, both nodes finish it after the restart (A asks B again, B keeps
serving): a shutdown never ends a move that B may already have activated.

### 9.5 Backup and restore

- **Consistent snapshot:** (1) snapshot the database with `sqlite3 meta.db
  "VACUUM INTO '<file>'"` (or a filesystem/volume snapshot of the whole data
  dir); (2) copy `blobs/` afterwards. A blob dropped after step 1 is not unlinked
  for `BINVAULT_GC_GRACE`, so it is still present at step 2 — keep the grace
  longer than the copy phase. `uploads/` is optional: if it is not restored,
  binvault aborts at boot every open multipart upload that has a part whose file is
  missing (an upload with no parts yet has none to miss and survives).
- **Restore:** put `meta.db` and `blobs/` into a fresh data dir, provide the master
  key that sealed that backup (after a key rotation an older backup needs the old
  key in `BINVAULT_MASTER_KEY_OLD`, §4.7), run `binvault validate --deep` (checks
  that every referenced blob exists), start. Queued `after` runs resume.
- Back up `BINVAULT_MASTER_KEY` separately from the data: it is not in the data
  dir, and without it token secrets, pipeline secrets and encrypted objects
  (§3.11) cannot be opened.
- **Cluster:** every node holds its own buckets, so back up each node's data dir
  separately; the catalog is recoverable from peers. Restore a node while its peers
  are up: the start-up fence (§8.5) pulls its own newest catalog ops back, learns
  which buckets it still homes and serves none until then. A bucket that moved
  after the backup was taken is an orphan on the restored node and stays unserved.
  Without a backup, a lost node's buckets are lost (§8.9). Back up
  `BINVAULT_CLUSTER_KEY` with the master key.

### 9.6 Upgrades

Schema migrations are forward-only and applied at boot, inside transactions (the
one that adds bucket moves, schema 3, also builds an index over the version rows,
which takes a while on a bucket of tens of millions of them). A
binary refuses to start on a database written by a newer schema; downgrades are
not supported — restore a backup instead. Take a snapshot before upgrading
(`validate` reports the current and target schema versions; against a database that is
waiting for a migration it says `migration pending (N to M)` and leaves the sealed-value
and blob checks until after the migration, so the packaged unit's `ExecStartPre=validate`
does not stop an upgrade). In a cluster,
upgrade one node at a time: nodes advertise a peer-protocol version in `hello`,
and a node holds catalog ops from a newer protocol it does not understand (an
alarm in `GET /_admin/v1/cluster`) until it is upgraded.

## 10. Security

- **Admin token** ≥ 32 characters, constant-time comparison, accepted only on the
  admin listener — loopback by default, TLS required off-loopback — for
  `/_admin/v1/**` and `/_metrics`, never stored or logged. Boot fails closed if
  it or the master key is missing or weak.
- **Least privilege everywhere:** bucket tokens carry grants and an expiry;
  pipeline tokens are per attempt, scoped to granted keys, in-memory only, revoked
  when the call ends, and can never reach the admin API (§7.8).
- **Secrets at rest** are sealed with AES-256-GCM (§4.7). Token secrets are
  shown once. Revocation is immediate.
- **Credentials in transit:** bucket secrets are never sent — SigV4 signs each
  request — and the bearer form exists only for short-lived pipeline tokens.
- **No path traversal by construction:** blobs are named by random id; keys never
  reach the filesystem.
- **Parsing hardening:** XML bodies ≤ 2 MiB with no DTD or entity processing; JSON
  ≤ 256 KiB and strict; headers ≤ 64 KiB; metadata and tag syntax validated
  (no header injection).
- **Resource exhaustion:** header and body-idle timeouts, per-pipeline
  concurrency caps, multipart and listing limits, quota that counts open
  multipart parts, free-space guard, failed-auth throttling, per-token and
  per-bucket rate limits (§4.9), and bounded `before` chains.
- **One process per data dir, private files:** the data dir is locked by the process that
  uses it (§3.1), so a second node or a `rekey` cannot damage a live one, and what binvault
  creates in it is `0640` (files, `meta.db` and its WAL included) or `0750` (directories).
- **Replay and clock:** SigV4 skew window, presigned expiry ≤ 7 days, pipeline
  calls signed with a timestamp.
- **SSRF:** pipeline URLs are admin-controlled; HTTPS verification is mandatory,
  redirects are refused, addresses are validated at dial time (§7.13).
- **Content-type safety:** every object response carries `X-Content-Type-Options:
  nosniff`, and anonymous ones add `Content-Security-Policy: sandbox`. Public
  buckets that must serve user uploads should still use a separate origin.
- **Data at rest** can be encrypted per bucket or request with SSE-S3 (§3.11),
  which protects stolen disks and backups; for everything else (metadata, `tmp/`)
  use volume encryption.
- **TLS** is normally terminated by a reverse proxy (nginxpilot in this repo);
  built-in TLS is available. Services that receive tokens over a network should
  be reached over HTTPS.
- **Cluster:** peers authenticate with a shared key (≥ 32 bytes, constant-time
  comparison, TLS by default; plain HTTP only with an explicit flag, and then
  everything on the link is readable). Peers are fully trusted — whoever holds the
  cluster key is a cluster member (§8.3) — so the peer listener must not be
  reachable by clients: it trusts forwarded client addresses and request ids from
  authenticated peers only. Replicated ops are checked for shape, and ops stamped
  far in the future are held. The admin token never crosses the peer link (§8.6).
  Blast radius: the master key and pipeline secrets exist on every node, bucket
  token secrets only on their home. Node names are visible to clients in
  `x-binvault-node`.
- **Supply chain:** pinned module versions, `govulncheck` in CI, distroless
  non-root image, static binary.

## 11. Repository layout and delivery

```
binvault/
  cmd/binvault/        main: run | validate | healthcheck | rekey | version
  internal/
    app/               wiring: opens a node (data dir, database, engine, both
                       listeners, background jobs), validate and rekey, the cluster
                       side of a node
    config/            environment parsing, defaults, validation
    httpx/             server, request ids, access log, idle-timeout readers, client
                       addresses
    s3/                S3 handlers, error codes, listing, versions, multipart,
                       POST Object, CORS, raw-path routing
    s3xml/             the S3 XML wire types and their codec
    apierr/            the S3 error type and its code table
    sigv4/             SigV4: header, presigned, aws-chunked streaming, trailers
    auth/              principals, bucket tokens, pipeline-token registry, throttling
    admin/             admin API handlers
    clusteradmin/      the admin API in a cluster: calls routed to a bucket's home,
                       fanned out to every node, or answered from the catalog (§8.6)
    engine/            the object operations: write path, versions, copy, multipart,
                       lifecycle steps, scrub, the before/after hooks
    store/             data dir: filesystem blob store, parts, tmp/, the lock
    meta/              SQLite schema, migrations, queries
    pipeline/          definitions, matcher, grants, invoker, before-chain,
                       after-scheduler, backfill, loop protection
    seal/              AES-GCM sealing, keyring, rekey
    crypt/             SSE-S3: bucket data keys, chunked AEAD blobs, ranged reads
    lifecycle/         lifecycle rules and the expiry worker
    ratelimit/         request and bandwidth limiters
    janitor/           GC, sweeper, expiry, pruning, scrubber (the job runner)
    cluster/           node identity, membership, peer API, catalog op log
    hlc/               hybrid logical clock (catalog op ordering)
    forward/           the request forwarder (§8.4)
    mover/             bucket moves and drains (§8.8)
    checksum/          the S3 additional checksums (CRC32, CRC32C, CRC64NVME, SHA-1, SHA-256)
    glob/              key glob matching for pipelines (`match`, §7.3)
    keypat/            key patterns and templates of grants (§4.4, §7.8)
    httpcond/          conditional requests (§5.5)
    ulid/              ULID generator (version ids, request ids)
    obs/               logging, metrics, runtime and process figures
  docker/              compose examples: one node + a sample pipeline service
                       (sample-service/), and a three-node cluster
  packaging/           binvault.service
  test/                smoke.sh (container), e2e-cluster.sh (three containers),
                       conformance/ (stock S3 clients), load/ and sdkgo/ (nested modules)
  Dockerfile
  README.md
  go.mod               module github.com/kalevski/toolcase/binvault, go 1.25
```

Delivery mirrors nginxpilot / zonewright / imagewarden: a standalone Go module (not
an npm workspace), its own workflow `.github/workflows/binvault.yml` filtered to
`binvault/**` (gofmt, vet, test, `govulncheck`, the conformance suites, the cluster
end-to-end test, the container smoke test and the image build), an image
published to GHCR (`ghcr.io/kalevski/toolcase/binvault`, like its siblings), and a
systemd unit. Dependencies stay few: the standard
library for HTTP, XML and crypto, `modernc.org/sqlite`, a doublestar-style glob
matcher, and a ULID generator. The cluster package is ported from zonewright's
`internal/hlc` and `internal/cluster` — separate Go modules, so copied and
adapted rather than imported. No SKILL.md is required for v1 (none of the sibling
Go projects have one). Each sibling does have an examples-site page
(`examples/src/pages/<Name>Page.tsx`, route `/apps/<name>`); binvault gets one after
v1 ships. A README with the quick tour, configuration table and pipeline guide is
required.

**Delivery phases.** Each phase is shippable and tested before the next starts,
and the riskiest compatibility pieces come first.

| Phase | Content | Useful on its own? |
|---|---|---|
| 1 | Data dir, SQLite with the **version-table object model** (an unversioned bucket keeps one version per key), blob store with the encryption layer, node id and the `home` column (always this node); admin listener and API for buckets and tokens; S3 Put/Get/Head/Delete/List with SigV4 in header, presigned and `aws-chunked` + trailer forms; the bucket-level calls of §5.3 (ListBuckets, HeadBucket, GetBucketLocation, CreateBucket answering `200`); failed-auth throttling (§4.8); raw-path routing; the error model | Yes: a plain S3-compatible store. Gate: current AWS SDKs (CRC32 trailers), `aws`, rclone and `mc` pass the smoke matrix with objects below 8 MiB (the AWS CLI's multipart threshold) |
| 2 | Multipart (incl. UploadPartCopy), CopyObject, DeleteObjects, conditional requests, tagging, CORS, anonymous read, GetObjectAttributes, POST Object | Yes: the S3 surface of §5.2 for unversioned buckets. Gate: the smoke matrix again with multi-GB files |
| 3 | Versioning API (`versionId`, delete markers, `ListObjectVersions`, `purge`), lifecycle, SSE-S3, bucket rules, the `create` action, rate limits | Yes: backups and apps with S3 backends |
| 4 | `after` pipelines: definitions, matching, pipeline tokens and grants, outbox and scheduler, retries, runs API, backfills, stale-write guard, loop protection | Yes: derivatives, notifications, cleanup |
| 5 | `before` pipelines: staged view, chain, replace and reject, budgets | Yes: gates and transforms |
| 6 | Operations: metrics, health, `validate`, `rekey`, backup and restore, scrubber, container image, CI, smoke test | Production-ready single node |
| 7 | Cluster mode (§8): peer listener, membership, catalog replication, forwarding, admin classes, bucket moves and drain, three-node end-to-end with partition, heal and moves | Scale-out across nodes |

Phases 3 and 4 are ordered on purpose: versioning, encryption and the `create`
action change what a write and a delete mean, so they land before pipelines build
on them (the underlying layers exist from phase 1), and `after` runs shake out the
token and grant model before the staged view builds on it. Phase 7 adds code but
changes no behaviour of phases 1–6, because a single node is already a cluster of
one.

## 12. Testing strategy

- **Unit:** SigV4 (the AWS test-suite vectors, header, presigned, streaming and
  trailer forms); key and bucket name validation; glob and match semantics;
  grant template expansion and escaping; conditional-request evaluation;
  range parsing; sealing and rekey; XML round-trips.
- **S3 conformance:** `test/conformance` drives a live node with stock clients:
  `boto3` (pytest, plus a raw SigV4 client for what botocore will not produce),
  `aws-sdk-go-v2`, `aws-sdk-js-v3` (including default-checksum behaviour of current
  SDKs), AWS CLI v2, rclone, MinIO `mc` and s3cmd, path-style and virtual-hosted-style
  both, and the load test below. Known gaps are listed in
  `test/conformance/known-failures.tsv` and reported, not hidden. Third-party
  suites (`ceph/s3-tests`, `minio/mint`) are not run.
- **Pipelines:** a fake service exercising every row of §7.7 and §7.9 — pass,
  delete-to-reject, 422-to-reject, replace, replace-then-fail, `reject` and
  `continue`, timeout, retries, `202` (a failure), chain budget, disconnect
  mid-chain, a late `PUT` after its attempt ended, a failed attempt's replacement
  discarded; for `after`: ordering, per-key serialisation, backoff, supersession,
  `on_error`, restart recovery, backfill, a stale retry skipped. Security cases:
  token used on another key, another bucket, listing, the admin API, after expiry,
  after the call ended, multipart / copy-onto-`{key}` / `versionId` refused for a
  `before` token, and stale-write guard races on reads, copies, writes, deletes and
  tags (including a swap during a slow-gate scan).
- **Durability:** `kill -9` (`test/load`) during a large PUT, an overwrite, a part
  upload, a multipart Complete and a storm of small PUTs, each followed by
  `validate --deep` on the crashed data dir, a restart on it and the invariants: no
  partial or unacknowledged object visible, no acknowledged write lost with
  `BINVAULT_FSYNC=true`, `tmp/` empty. `after` runs still queued at a restart are
  re-queued (pipeline tests). A kill at a chosen point of a `before` chain is not
  injected.
- **Fuzz:** Go fuzz targets for the `aws-chunked` decoder (`FuzzStreamReader`), SigV4
  header parsing (`FuzzVerifyHeader`) and XML bodies (`FuzzDecode`). Listing
  continuation tokens are not fuzzed; paging is covered by the end-to-end tests.
- **Load:** `test/load`: a 1 GiB multipart object with the server's memory sampled
  (it must not grow with the object), 20,000 small objects written by 16 workers,
  and listings of those keys with delimiter paging.
- **Versioning and friends:** every operation in unversioned and enabled buckets
  (null versions, delete markers, `versionId` on reads, copies, tags and deletes,
  `purge` versus `delete`, DeleteObjects entries judged like DeleteObject,
  `ListObjectVersions` paging), commit-sequence ordering (overlapping writes to one
  key, a purge that must uncover the right version) and the
  event rules of §7.5, including a permanent deletion that uncovers an older
  version; lifecycle rules against a fake clock (current and noncurrent versions,
  delete markers, multipart abort, a backlog larger than one batch, an overwrite
  between selection and action); SSE-S3 round trips, ranged reads
  across chunk boundaries, truncation detection, copies that change encryption,
  multipart re-encryption and master-key rotation; POST Object policy vectors
  (every condition, extra fields, expiry, `${filename}`, `content-length-range`
  while streaming, success actions); write-once tokens, including the race at
  commit, and a retried Complete; rate limits (rejection and pacing) and bucket
  rules (sniffing, rejection after draining, bytes replaced by a pipeline).
- **Cluster:** forwarding with every auth form (header-signed, presigned,
  `aws-chunked` with trailers, bearer, anonymous) through a non-home node —
  signatures must verify at the home; large PUT and GET streaming, `Range`,
  `Expect: 100-continue`, client abort mid-upload; home down (`503`, fail-fast)
  and draining; unknown and just-created buckets; one hop only. Catalog: a
  convergence property test ported from zonewright (random ops from 2–4 origins,
  any order, with duplicates → identical catalogs, including a move's hand-off
  arriving after the new home's first ops), HLC and the clock guard, snapshot
  bootstrap, the start-up fence (a restore from an old backup, including one older
  than a move), clone detection, partition and heal, simultaneous creation of one
  bucket name (orphan), `catalog_only` deletion with the home down. Pipelines: invocation
  from a non-home entry node, a service calling through another node, per-node
  limits. Docker end-to-end in the style of `zonewright/test/e2e-cluster.sh`:
  three containers with TLS, killing and partitioning a node. Moves: writes,
  deletes and tag changes during the blob copy, uploads cancelled at the freeze, a
  crash or a cancel at every step (including after B's OK and before A records the
  hand-off), the freeze timeout, stale entry nodes (`421`), versioned and encrypted
  buckets, and drain.
- **Rules added in v0.5:** virtual-hosted keys that start with `_`, including
  `_peer/…`, sent through a non-home node must reach the home as ordinary S3
  requests and never as peer calls; `versionId=null` deletes against a `before`
  delete gate; a presigned URL and a POST policy used after the clock-skew window;
  the throttling exemptions (`BVP` keys not counted, right-most untrusted
  `X-Forwarded-For`); boot failing on a sealed value that cannot be opened, and ops
  held (not skipped) during the three-step key roll; which self-copies are rejected
  and which are accepted; an UploadPartCopy from an encrypted source;
  `PUT /buckets/{name}` answering `404` for a missing bucket; bucket `DELETE` with
  only delete markers left; ListObjectVersions paging across a move; shutdown, a
  crash, a lost reply and a proxy error during the move's activate step; retiring a
  node that is the target of a move in `cutover`.
- **Container smoke test** in the style of `imagewarden/tools/smoke.sh`
  (`test/smoke.sh`): build the image, run `validate` through the entrypoint, boot under
  `--read-only --cap-drop ALL` with a data volume, check the container `HEALTHCHECK`
  and that the admin API is not on the public port, create a bucket and token, upload,
  download, list and delete with a signed client, and restart on the same volume. It
  does not run a pipeline: `docker/compose.yml` does (a sample service behind a
  `before` and an `after` pipeline, configured by its `setup` container), and the
  in-process pipeline tests exercise §7.7 and §7.9 against fake services.

## 13. Decisions, roadmap and open questions

### 13.1 Decisions

| Decision | Why |
|---|---|
| A `before` pipeline's completion signal is the HTTP status of binvault's own call (`200`/`201`/`204` done, `422` reject, else failure) — not a callback. | Token-only integration still needs *some* signal; a status is the least that works, and it adds no callback URL or result schema. |
| The staged object is visible only to its pipeline token. | Lets a service delete or replace a file before anyone can read it. |
| `before` runs may write only the triggering key; derivatives are `after` work. | Keeps the gate atomic and avoids orphaned side effects when a chain rejects. |
| `after` steps of one event run sequentially; different keys run in parallel. | Deterministic, and a failed gate step can stop later steps. |
| Stale-write guard on the triggering key: reads, copies from it, writes, deletes and tags. | Makes asynchronous scan-and-delete, and scan-and-promote, safe against newer uploads. |
| Tag changes neither change the version nor raise events (a copy onto itself with `REPLACE` is a write, and does). | A cheap result channel for pipelines that cannot cause loops. |
| Bucket tokens authenticate with SigV4 only; the bearer form is for short-lived pipeline tokens. Secrets are sealed with a master key. | SDK compatibility needs SigV4, which needs the raw secret; a long-lived secret should never travel in a header. |
| The admin token cannot read objects, and there are no scoped admin tokens. | Clean audit trail and one admin identity; minting a short-lived bucket token is one call. |
| `ListBuckets` returns the token's bucket; `CreateBucket` answers `200` for it (as S3 does in us-east-1). | Keeps common tools working without allowing bucket creation. |
| CopyObject is same-bucket and O(1) via shared blobs. | Tokens are bucket-scoped; copies cost nothing, and a bucket never shares blobs with another, so a move is self-contained. |
| Filesystem + SQLite on each node. | Boring, strongly consistent, easy to back up; the store interface leaves room for others. |
| Service endpoints are `_`-prefixed. | `healthz`, `metrics` and `version` are legal bucket names. |
| Per-pipeline concurrency caps and queue timeouts. | Protect slow services and bound client waits. |
| Cluster mode shards **buckets**: one home node per bucket; the nodes replicate only a small catalog. | Every single-node guarantee (strong consistency, compare-and-swap writes, pipelines, quotas, immediate revocation) holds per bucket, with no object-level conflicts, distributed refcounts or cross-node GC. Cost: no data redundancy, and one bucket cannot outgrow one node. |
| A request for a remote bucket is **forwarded** by the entry node, not redirected. | SigV4 signs `Host`, so a redirect needs the client to re-sign (most won't, and presigned URLs can't), and a streamed body cannot be replayed. Forwarding keeps stock clients unmodified. |
| Bucket-scoped state (settings, attachments, tokens) is single-writer at the home; only bucket entries, pipeline definitions and the access-key index replicate. | No last-writer-wins conflicts where `If-Match` matters, token secrets stay on one node, and revocation stays immediate. |
| A bucket's home changes only by an explicit online move; there is no automatic rebalancing. | Moves are rare and deliberate; epochs and an acknowledged activation make the cutover safe, and the admin decides placement. |
| Catalog replication reuses zonewright's op log, hybrid clock and last-writer-wins, with trusted peers and no per-op ownership check. | Proven in this repo, and the catalog is admin-rate data where asynchronous last-writer-wins is acceptable. An ownership check made the outcome depend on the order ops arrive in, and the master key and pipeline secrets are on every node anyway. |
| No data redundancy in v1: losing a node loses its buckets unless they are restored from backup. | Replicating bytes is a different product; a per-bucket standby is on the roadmap. Backing up each node (§9.5) is the v1 recovery plan. |
| Bucket tokens use the same grants as pipeline tokens (§4.4). | One authorisation model instead of two. |
| Any SigV4 region is accepted. | The region only feeds the signing key; being strict breaks "change the endpoint and credentials only". |
| `match` selects; bucket rules (`max_object_bytes`, `allowed_content_types`) enforce. | A filter on a gate makes unmatched objects skip it, so size and type limits must be enforced elsewhere (§3.13, §7.3). |
| The `before` chain budget defaults to 25 s. | Stock clients and proxies give up at 30–60 s; longer work is an `after` pipeline (§7.14). |
| Versioning, lifecycle expiry, SSE-S3, POST Object, write-once tokens, rate limits and bucket rules are in v1. | Backups, public assets and apps with S3 backends all lean on them. Versioning is in the object model from the first phase: an unversioned bucket is one that keeps a single version per key. |
| Permanently deleting a version needs its own `purge` action. | A credential that can add a delete marker must not be able to destroy history; this is what makes versioning a defence against a leaked key. |
| The `create` action is write-once. | Backup credentials should be able to add data without being able to replace it. |
| Events describe changes to what a plain GET would return. | One rule covers versioned and unversioned buckets, deletes, permanent deletions and lifecycle. |
| Lifecycle bypasses `before` chains. | It is the owner's own policy; a gate vetoing expiry would make retention unreliable. |
| SSE-S3 uses a sealed bucket data key, per-blob derived keys and chunked AES-GCM. | Rotating the master key only re-seals bucket keys, ranged reads decrypt only the chunks they need, and every blob has its own key. |
| Bucket configuration (versioning, lifecycle, encryption, CORS) is admin-API only; the S3 API reads it. | Keeps "the admin manages buckets". Terraform-style configuration over the S3 API is not supported. |
| The admin API and `/_metrics` have their own listener, loopback by default. | A forgotten proxy rule cannot expose them; same convention as nginxpilot and zonewright. |
| A `before` gate cannot change the key, and pipeline tokens never leave their bucket. | Keeps PUT responses, ETags and conditional writes truthful, and keeps bucket moves self-contained. |
| Rate limits are per token and per bucket; pipeline tokens are exempt. | A bucket lives on one node, so limits are exact; pipeline load is already bounded by pipeline concurrency. |
| Object Lock is not in v1; versioning with the `create` and `purge` actions is the immutability story. | No chosen backup tool requires Object Lock; it stays on the roadmap (§13.2) until one does. |
| SSE-S3 is opt-in: a bucket's `encryption` defaults to `none`. | Encrypted reads cannot use `sendfile`, which matters for public-asset buckets; turning it on is one setting. |
| Versioning is `off` or `enabled`, one way. There is no `suspended` state. | A suspended write or delete replaces the `null` version in place, which would let a token without `purge` destroy history. A lifecycle `noncurrent_days` rule is how history stops growing. |
| Versions are ordered by a commit sequence (`seq`); the ULID is only an id. | The id exists before the commit (it is shown to `before` pipelines) and nodes' clocks differ, so ordering by it could disagree with the order writes committed in. |
| A pipeline token lives for one call: no `202` hand-off, no `token.ttl`. | A token that outlives its call cannot be revoked, escapes the concurrency bound that justifies the rate-limit exemption, and is lost on a restart or a move. Long work uses the service's own queue and a regular bucket token. |
| `before` tokens get only the staged view of `{key}` (GET, one PUT, DELETE, tags); each attempt's changes apply only if it succeeds. | Multipart, copy and `versionId` requests would bypass the staged slot and commit unvetted bytes mid-chain, and a late `PUT` must not land after a later gate looked. |
| A move copies blobs online and all rows during one short freeze, with no journal and no resume. B alone decides activation; A records `cutover` first and never gives up on its own. The new home writes the hand-off to the catalog before it answers `OK`. | Rows are small and blobs are immutable, so there is nothing to get wrong in a journal; the freeze grows with the object count, not the bytes. Restarting a failed move is simpler than resuming it, and a single deciding node means silence or a proxy error can never produce two homes. |
| A forwarded request is recognised by the `X-Binvault-Origin` header, never by its path. | In virtual-hosted style a key may start with `_peer/`; routing by path would let a client reach the peer API through the forwarder. |
| Buckets are bound to node ids; admin calls are authenticated where received and travel as peer requests. | A node re-created under an old name must not silently inherit buckets whose data is gone, and the admin token must never cross the peer link. |
| Failed authentications are counted per address only, never for pipeline tokens. | A public key id must not be able to lock a token out, and a service calling with an expired token must not lock itself out. |
| Pipeline queues are not capped. | An event is never dropped; queue depth is a metric and `POST /runs/cancel` is the escape hatch. |
| A data dir is locked (`flock` on `LOCK`) by the one process that runs on it, `rekey` included; `validate` and `healthcheck` take no lock. | A second node emptied the first one's staged files, and a `rekey` on a live node re-sealed secrets under a key it did not know. One exclusive lock makes both impossible, ends with the process whatever way it ends, and leaves the read-only commands free to inspect a running node. |
| `GET /_healthz` is unauthenticated and names only the failing check; the detail goes to the log. | An open endpoint must not show paths or driver text. |

### 13.2 Roadmap (post-v1)

- Object Lock (retention and legal hold), if `create` and `purge` prove not to be
  enough for backup tools; SSE-KMS and SSE-C.
- Scheduled pipelines; lifecycle by absolute date and storage-class transitions.
- Body-delivery pipeline mode: stream the bytes to the service and accept the
  transformed bytes in the response, for services that do not speak S3.
- Pluggable store backends (multi-disk, remote object stores).
- Cluster: a per-bucket standby (asynchronous replication of a bucket's objects to
  a second node, with manual or automatic promotion) for data redundancy; automatic
  rebalancing and placement beyond "most free disk".
- An asynchronous (`pending`) `before` mode for long gates that must hide the
  object until cleared.
- Events for tag changes; anonymous listing; bucket configuration over the S3 API
  for tokens with a `config` action; scoped admin tokens (monitor, provisioner).

### 13.3 Open questions

None. Object Lock and a per-bucket standby are deferred to the roadmap (§13.2), and
SSE-S3 stays opt-in (§13.1).
