# binvault

An S3-compatible object store in a single static Go binary, with **pipelines**:
admin-defined procedures that call an external service for every file, either
*before* it is saved (validate, scan, compress, resize, reject) or *after* it has
been saved (thumbnails, extraction, indexing, mirroring, cleanup). A service
integrates by receiving a short-lived S3 token. There are no callback URLs and no
result protocol: the service uses ordinary S3 calls and answers with an HTTP status.

- **S3 first.** AWS SDKs, AWS CLI v2, rclone and MinIO `mc` work unmodified apart from the endpoint
  and credentials: SigV4 (header, presigned, `aws-chunked` with CRC trailers), multipart,
  copy, conditional requests, tagging, versioning, POST Object, CORS, anonymous reads, SSE-S3.
- **Boring storage.** Blobs are plain files, metadata is embedded SQLite (pure Go, no cgo),
  strong consistency, one data directory per node to back up.
- **Safe by default.** Gates fail closed, commits are atomic, tokens carry least privilege,
  write-once (`create`) and `purge` actions protect backups, secrets are sealed at rest.
- **Optional cluster.** Shard buckets across nodes: each bucket lives on one home node,
  a small catalog is replicated, any node forwards a request to the bucket's home.

The authoritative design document is [`../binvault.md`](../binvault.md) (section numbers
below, such as §4.4, refer to it).

## Quick start

```bash
export ADMIN=$(openssl rand -hex 32)          # admin token (>= 32 characters)
export MASTER=$(openssl rand -base64 32)      # keep it: it seals token secrets at rest
docker run -d --name binvault -p 9000:9000 -p 127.0.0.1:9001:9001 -v binvault-data:/var/lib/binvault \
  -e BINVAULT_ADMIN_TOKEN=$ADMIN -e BINVAULT_MASTER_KEY=$MASTER \
  ghcr.io/kalevski/toolcase/binvault          # 9000 = S3 API, 9001 = admin API (host loopback only)

ADM=http://127.0.0.1:9001/_admin/v1
curl -sX POST $ADM/buckets -H "Authorization: Bearer $ADMIN" \
  -d '{"name":"photos","versioning":"enabled"}'
curl -sX POST $ADM/buckets/photos/tokens -H "Authorization: Bearer $ADMIN" \
  -d '{"name":"web","grants":[{"actions":["read","write","delete","list"]}]}'
# → { "access_key_id": "BVK…", "secret_access_key": "…" }      (the secret is shown once)

AWS_ACCESS_KEY_ID=BVK… AWS_SECRET_ACCESS_KEY=… \
  aws --endpoint-url http://localhost:9000 s3 cp ./a.png s3://photos/a.png
```

The `ghcr.io/kalevski/toolcase/binvault` image appears once CI has published it (a push to `main` that
passes the `binvault` workflow); until then build it yourself with `docker build -t binvault .` from this
directory and use that tag in the commands above (`docker compose -f docker/compose.yml up --build` builds
it too).

From source: `go build -o binvault ./cmd/binvault`, set the same `BINVAULT_*` variables and run
`./binvault`. `binvault validate` checks the configuration, the secrets and the data directory
without changing anything; `docker/compose.yml` starts a node plus a sample pipeline service.

## How it fits together

| Concept | Description |
|---|---|
| Admin token | `BINVAULT_ADMIN_TOKEN`. Authorises the admin API only (a separate listener, loopback by default). It cannot read or write objects. |
| Bucket | A namespace of objects, created and configured only through the admin API. |
| Bucket token | An S3 credential pair (`BVK…`) bound to **one** bucket, with grants and an optional expiry. |
| Grant | `{"actions": [...], "keys": [...]}`: seven actions on key patterns (below). |
| Pipeline | A global procedure (stage `before` or `after`, events, match filters, a service URL, token grants), attached to the buckets that want it. |
| Pipeline token | An ephemeral credential (`BVP…`) minted for each service call and revoked when the call ends. |

Actions and what they permit (§4.4):

| Action | S3 operations it permits |
|---|---|
| `read` | GetObject, HeadObject (any version), GetObjectAttributes, GetObjectTagging, GetObjectAcl, source side of CopyObject / UploadPartCopy |
| `list` | ListObjects, ListObjectsV2, ListObjectVersions, ListMultipartUploads |
| `create` | PutObject, POST Object, destination of CopyObject / UploadPartCopy, CreateMultipartUpload, UploadPart, CompleteMultipartUpload — **only where the key has no visible object** (write-once, below); also AbortMultipartUpload and ListParts, which write-once does not restrict |
| `write` | The same operations **without** that restriction (overwriting, or adding a version), and PutObjectAcl (`private` or `bucket-owner-full-control`, accepted and ignored); **implies `create` and `tag`** |
| `tag` | PutObjectTagging, DeleteObjectTagging, and tags supplied with a write (`x-amz-tagging`, POST `tagging`, `x-amz-tagging-directive: REPLACE`, CreateMultipartUpload): a write that carries tags needs `tag` as well as `create`; `write` implies it |
| `delete` | DeleteObject / DeleteObjects entries **without** a version id: permanent in an unversioned bucket (where `versionId=null` counts as no version id), a delete marker in an enabled one |
| `purge` | DeleteObject / DeleteObjects entries **with** a version id in an enabled bucket: permanent removal of one version or delete marker. Each DeleteObjects entry is judged exactly like the equivalent DeleteObject, so a token holding only `purge` can remove versions in a batch too |

A grant's `keys` are literal text with an optional single trailing `*` (`photos/*`); `\*` and `\\` write
a literal `*` and `\`. A token with `create` but not `write` can add keys but never replace one
(write-once); with `read` and `list` but no `delete` or `purge` it is a backup credential a leak cannot use
to destroy data.

## Configuration

Environment only. Every variable has a default except the admin token and master key (and, in a
cluster, the cluster key and node name). The secret variables also accept a `_FILE` form
(`BINVAULT_ADMIN_TOKEN_FILE`, `BINVAULT_MASTER_KEY_FILE`, `BINVAULT_MASTER_KEY_OLD_FILE`,
`BINVAULT_CLUSTER_KEY_FILE`). Unknown `BINVAULT_*` variables (and cluster variables on a single node) produce a
warning at boot, logged like every other line, so `BINVAULT_LOG_FORMAT=json` is JSON throughout.

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
| `BINVAULT_SHUTDOWN_TIMEOUT` | `60s` | Grace period on SIGTERM (SIGINT and SIGHUP end the node the same way). Give a supervisor a stop timeout longer than this (the shipped systemd unit and compose files do). |
| `BINVAULT_AUTH_FAIL_LIMIT` | `30` | Failed authentications per minute per client address before throttling (§4.8). |
| `BINVAULT_SCRUB_INTERVAL` | `0` (off) | Interval of the optional integrity scrubber (§3.9). The first pass runs about a minute after start. |
| `BINVAULT_LIFECYCLE_INTERVAL` | `1h` | How often lifecycle rules are evaluated (§3.12). The first pass runs about a minute after start, so a long interval does not mean "never" on a node that restarts more often. |
| `BINVAULT_LIFECYCLE_BATCH` | `1000` | Lifecycle actions applied per transaction. A run keeps going batch after batch until nothing is left or `BINVAULT_LIFECYCLE_INTERVAL` has passed. |
| `BINVAULT_PIPELINE_WORKERS` | `8` | Concurrency of `after` runs on this node. |
| `BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT` | `25s` | Time budget for the whole `before` chain of one write: `1s` to `10m`. Keep it below your clients' and proxies' timeouts (§7.9). Must be the same on every node of a cluster (`hello` reports a mismatch, §8.3). |
| `BINVAULT_PIPELINE_MAX_DEPTH` | `4` | Maximum causal depth of `after` runs triggered by pipeline writes (§7.11). |
| `BINVAULT_PIPELINE_ALLOW_PRIVATE` | `true` | Allow pipeline URLs resolving to private or loopback addresses. Link-local and cloud-metadata addresses are always refused (§7.13). |
| `BINVAULT_PIPELINE_CA_FILE` | — | Extra CA bundle trusted for pipeline HTTPS calls. |
| `BINVAULT_PIPELINE_RUN_RETENTION` | `336h` | How long finished runs are kept (14 days). |
| `BINVAULT_METRICS_PER_BUCKET` | `true` | Per-bucket metric labels; disable for many buckets. With `false` the `bucket` label disappears: the three per-bucket gauges and the lifecycle counter keep their names and become node-wide figures. |
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

## Admin API

Base path `/_admin/v1` on the admin listener, `Authorization: Bearer <admin token>`, JSON in and out,
strict decoding (unknown fields are `400`, a body over 256 KiB is `413`), `PATCH` is JSON merge-patch,
`If-Match: "<revision>"` gives optimistic concurrency (re-sending identical settings changes nothing, the
revision included). Timestamps are RFC 3339 UTC with milliseconds; the switches `?force`, `?stats`,
`?catalog_only` and `?detach` are `true` or `false` (anything else, `?force=1` included, is `400`); a list `limit`
outside 1 to 500 is `400`. Errors: `{"error": "<code>", "detail": "…", "fields": {…}}`.

| Call | Purpose |
|---|---|
| `GET /status`, `GET /config` | Node status and effective non-secret configuration (listeners, TLS flags, data dir, limits, timeouts, pipeline settings and, in a cluster, the cluster settings; never a secret) |
| `POST /buckets`, `GET /buckets`, `GET/PUT/PATCH/DELETE /buckets/{name}` | Create, list (`?stats=true`), read, replace, patch, delete (`409` unless empty; `?force=true` deletes everything) |
| `POST/GET /buckets/{name}/tokens`, `PATCH/DELETE /buckets/{name}/tokens/{id}` | Bucket tokens; the secret appears once, in the `201`; an `expires_at` must be in the future, on `PATCH` too |
| `POST/GET/PUT/PATCH/DELETE /pipelines…`, `POST /pipelines/{name}/test` | Pipeline definitions (§6.5) |
| `GET/PUT /buckets/{name}/pipelines` | A bucket's ordered pipeline attachments (§6.6) |
| `GET /runs`, `POST /runs/{id}/retry`, `POST /runs/retry`, `POST /runs/{id}/cancel`, … | Pipeline runs (§6.7) |
| `POST /backfills`, `GET /backfills…` | Run an `after` pipeline over existing objects (§6.8) |
| `GET /_metrics` (admin listener) | Prometheus metrics |

Bucket settings (§6.3):

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

## S3 API

Path-style always; virtual-hosted-style when `BINVAULT_DOMAIN` is set. Any SigV4 region is accepted.
Signature V2 is not supported, so presign with SigV4 (boto3: `Config(signature_version="s3v4")`).

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

Limits (§3.8):

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

### Clients

```bash
# AWS CLI v2
aws --endpoint-url http://localhost:9000 s3 sync ./site s3://photos/site

# rclone (env-var form)
RCLONE_CONFIG_BV_TYPE=s3 RCLONE_CONFIG_BV_PROVIDER=Other RCLONE_CONFIG_BV_ENDPOINT=http://localhost:9000 \
RCLONE_CONFIG_BV_ACCESS_KEY_ID=BVK… RCLONE_CONFIG_BV_SECRET_ACCESS_KEY=… RCLONE_CONFIG_BV_NO_CHECK_BUCKET=true \
  rclone copy ./site bv:photos/site

# MinIO mc
mc alias set bv http://localhost:9000 BVK… … && mc cp ./a.png bv/photos/

# curl (SigV4 built in; curl 8.1 or newer, which sends the x-amz-content-sha256 header S3 signing needs.
# curl 7.87 to 8.0 also work with -H "x-amz-content-sha256: UNSIGNED-PAYLOAD"; older ones are refused: use the AWS CLI)
curl --aws-sigv4 "aws:amz:us-east-1:s3" --user "$AK:$SK" http://localhost:9000/photos/a.png
```

```python
s3 = boto3.client("s3", endpoint_url="http://localhost:9000", aws_access_key_id=AK, aws_secret_access_key=SK,
                  region_name="us-east-1", config=Config(signature_version="s3v4", s3={"addressing_style": "path"}))
```

## Versioning, lifecycle, encryption, rules

- **Versioning** is `off` or `enabled` (never back). Enabled: every write adds a version, `DELETE`
  adds a delete marker, `DELETE ?versionId=` needs `purge` and removes one version for good.
  Objects written while `off` become `null` versions when it is enabled. Use a lifecycle rule with
  `noncurrent_days` to stop history growing.
- **Lifecycle** (admin-managed): `expire_days`, `noncurrent_days` + `noncurrent_keep`,
  `expire_delete_markers`, `abort_multipart_days`, filtered by prefix, tags and size.
  A janitor applies rules in batches; every action names the exact version it selected and is skipped
  if that row changed. Expiry raises `object.deleted` (`operation: lifecycle`).
- **SSE-S3**: `"encryption": "sse-s3"` on the bucket, or `x-amz-server-side-encryption: AES256` per
  request. Per-blob keys derive from a bucket data key sealed under the master key; chunked AES-256-GCM
  supports ranged reads and detects truncation. Back up the master key separately from the data.
- **Bucket rules**: `max_object_bytes`, `quota_bytes`, `max_objects` and `allowed_content_types`
  (sniffed from the first 512 bytes, not trusted from the client).
- **Rate limits**: `requests_per_second`/`burst` reject with `503 SlowDown`; `bytes_in/out_per_second`
  slow transfers down. Per token and per bucket.

## Pipelines

A pipeline is defined once (`POST /pipelines`), attached to buckets (`PUT /buckets/{name}/pipelines`)
and fires on `object.created`, `object.updated` or `object.deleted`.

```json
{
  "name": "compress-images", "stage": "before",
  "events": ["object.created", "object.updated"],
  "match": { "keys": ["uploads/**"], "content_type": ["image/jpeg", "image/png"], "content_type_source": "sniffed" },
  "service": { "url": "http://compressor:8080/hooks/binvault", "headers": { "Authorization": "Bearer service-secret" },
               "signing_secret": "at-least-32-characters-of-randomness", "timeout": "20s" },
  "token": { "grants": [ { "actions": ["read", "write"], "keys": ["{key}"] } ] },
  "limits": { "max_concurrency": 8 },
  "retry": { "max_attempts": 2 },
  "on_error": "reject"
}
```

| | `before` | `after` |
|---|---|---|
| Object visible | after the whole chain passes | immediately |
| Client | waits (budget `BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT`, 25 s) | unaffected |
| Service may | read, **replace** or **delete** the staged object, or answer `422` to reject | read, derive new keys, tag, delete (per its grants) |
| On failure | reject the write (`on_error: reject`) or continue | retried with backoff, then `failed`; the object is never changed by a failure |
| Delivery | synchronous | at-least-once, persisted, per-key ordered |

The service receives a JSON invocation (run id, pipeline, event, bucket, key, object description, actor,
and an `s3` block with an endpoint plus a `BVP…` key pair and a `bearer` form). Its HTTP status is the
only thing binvault acts on: `200/201/204` done, `422` reject, `408/425/429/5xx` or a timeout retry,
anything else a failure. Tokens live for one call, are scoped to the pipeline's grants (templates
`{key} {dir} {base} {name} {ext}`), and the **stale-write guard** makes every request that names the
triggering key conditional on it still being that version, so a scanner can never act on a newer upload.
Read §7 for the full rules; `docker/sample-service` is a stdlib-only service using the bearer form.

A service in Python:

```python
@app.post("/hooks/binvault")
def hook():
    ev = request.get_json(); c = ev["s3"]
    s3 = boto3.client("s3", endpoint_url=c["endpoint"], region_name=c["region"],
                      aws_access_key_id=c["access_key_id"], aws_secret_access_key=c["secret_access_key"],
                      config=Config(s3={"addressing_style": "path"}))
    data = s3.get_object(Bucket=ev["bucket"], Key=ev["key"])["Body"].read()   # staged bytes in a before run
    if not acceptable(data):
        return {"message": "not a valid image"}, 422                         # reject; no S3 call needed
    s3.put_object(Bucket=ev["bucket"], Key=ev["key"], Body=recompress(data))  # replace the staged object
    return "", 204
```

Checklist: verify `X-Binvault-Signature`; be idempotent (`after` runs are at-least-once, `run.id` is stable);
treat `412 PreconditionFailed` from the S3 API as "superseded" and stop quietly; do not trust `Content-Type`.

## Clustering (§8)

Give every node the same `BINVAULT_CLUSTER_URLS` (the peer-listener URL of **every** node, itself included),
the same `BINVAULT_CLUSTER_KEY`, `BINVAULT_ADMIN_TOKEN` and `BINVAULT_MASTER_KEY`, and its own
`BINVAULT_NODE_NAME`; without `BINVAULT_CLUSTER_URLS` a node is a cluster of one and nothing in this section applies.
`docker/cluster.compose.yml` is a three-node example and `test/e2e-cluster.sh` an end-to-end test of it (TLS on the
peer link, a killed node, a partition and its healing, a bucket move and a node drain).

- **Sharded by bucket.** Each bucket lives on one *home* node, which stores its objects and is its only writer, so
  everything in §2–§7 holds per bucket, unchanged. The nodes replicate only a small catalog — which node homes which
  bucket, the pipeline definitions and an access-key index — with an op log, a hybrid logical clock and
  last-writer-wins. There is no data redundancy: back up every node (§9.5).
- **Any node accepts any request.** The node that receives an S3 request finds the bucket (`Host`, the first path
  segment, or the access key id of a bucket-less call) and, when it is homed elsewhere, forwards the request
  *verbatim* to the home's peer listener — same method, raw path and query, headers and the original `Host`, so the
  home verifies the client's own SigV4 signature (header, presigned and `aws-chunked` forms alike) — and streams the
  answer back, `Expect: 100-continue` and keep-alive whitespace included. The response carries the home's
  `x-binvault-node`. A forwarded request is never forwarded again.
- **Failures.** A home that is down, draining or unknown answers `503 ServiceUnavailable` (`Retry-After: 5`) at once;
  only its buckets are affected. A node that is starting (the start-up fence, §8.5) serves nothing and reports
  `503 starting` on `/_healthz`. A bucket whose home has no data for it answers `503` and raises a `missing` alarm.
- **Admin API.** Any node's admin listener accepts any call and checks the admin token itself. Catalog calls
  (`GET /buckets`, everything under `/pipelines`) are answered from the local copy or written as catalog ops and
  accept `?wait=replicated` (`200` when every active peer applied it, `202` with a `pending` list otherwise).
  Bucket-scoped calls are sent to the bucket's home as a peer request (`POST /_peer/v1/admin`; the admin token never
  crosses the peer link). `POST /buckets` takes `home`: a node name, or `auto` (the default: the reachable,
  non-cordoned node with the most free disk). `DELETE /buckets/{name}?catalog_only=true` drops the catalog entry of
  a bucket whose home is down for good. Runs, backfills and `GET /buckets?stats=true` fan out to every reachable
  node and are merged, with the nodes that did not answer named in `partial`.
- **Cluster endpoints.** `GET /cluster` (this node and every node: reachability, lag, skew, buckets homed, free
  disk, `drain` for a cordoned node, and `alarms`: `conflicts`, `orphans`, `held_ops`, `clones`, `missing`,
  `mismatches`),
  `DELETE /cluster/nodes/{id}` (retire a node that is gone for good; `409` while buckets are homed on it) and
  `DELETE /cluster/orphans/{generation}?node=` (delete the local data of a bucket the catalog gives to another
  node, generation or home — kept, never served, until you do). A single node answers `GET /cluster` with
  `"mode": "single"`.
- **Joining a cluster.** A data dir that ran as a single node keeps everything: its buckets, tokens, pipelines and
  attachments are published to the catalog at the first start in a cluster, with their local generations.
- **Moving a bucket (§8.8).** `POST /buckets/{name}/move` with `{"to": "c"}` (a node name, an id or `auto`;
  optional `max_bytes_per_second`) moves a bucket to another node while it keeps serving. The old home copies
  the blobs online (`BINVAULT_MOVE_STREAMS` in parallel, each verified against its SHA-256), freezes the bucket's
  writes for the last blobs and **all the rows** (a freeze that grows with the number of objects, not their
  size — about 20 µs per version, roughly 22 s per million versions with fsync on, so a bucket of several million
  versions needs a larger `BINVAULT_MOVE_FREEZE_TIMEOUT` — and fails the move after it; the new home imports the
  rows in one transaction, which holds its writer, so its other buckets' writes wait for that long too), then
  pauses the bucket and asks the new home to
  activate: the new home decides once and durably, writes the hand-off to the catalog and serves; only then does
  the old home answer `421`/forward, and it removes its copy in pieces of 10,000 rows (its blobs follow the normal
  grace period). Writes
  during the freeze get `503 SlowDown`, reads continue until the cutover, tokens keep working through every node.
  `GET /moves`, `GET /moves/{id}` and `POST /moves/{id}/cancel` (before the freeze only) follow it; a node takes part
  in one move at a time and the others wait (`queued`). A node that dies before the cutover abandons the move; from
  the cutover on both nodes finish it after a restart, and a target that is gone for good is retired with
  `DELETE /cluster/nodes/{id}`, which ends the move at the source (epoch + 2).
- **Draining a node.** `POST /cluster/nodes/{id}/drain` cordons the node (`auto` placement skips it) and moves its
  buckets away one after another; the progress is the `drain` object of its entry in `GET /cluster`
  (`running`/`done`, `remaining`) and survives restarts; `POST /cluster/nodes/{id}/undrain` lifts the cordon.

```bash
# move the bucket photos to node c, watch it, then empty node b
curl -sX POST http://127.0.0.1:9001/_admin/v1/buckets/photos/move -H "Authorization: Bearer $ADMIN" -d '{"to":"c"}'
curl -s http://127.0.0.1:9001/_admin/v1/moves -H "Authorization: Bearer $ADMIN"
curl -sX POST http://127.0.0.1:9001/_admin/v1/cluster/nodes/b/drain -H "Authorization: Bearer $ADMIN"
```

## Operations

- **Health and metrics.** `GET /_healthz` (public listener) is `200`, or `503` with a fixed body naming the
  failing check (`database`, `data dir not writable`, `low disk space`; paths and error text go to the log, not
  to this unauthenticated answer) and, in a cluster, `starting`. `GET /_version` answers
  `{"version","commit","go"}`; both match their exact path only. Prometheus text at `/_metrics` on the admin
  listener, with the standard `go_*` and `process_*` series (the resident size and open files on Linux only);
  `BINVAULT_METRICS_PER_BUCKET=false` drops the `bucket` label of the per-bucket series and of
  `binvault_lifecycle_actions_total`, which then count across buckets. One structured log line per request
  with the principal (`admin`, `token:<id>`, `pipeline:<name>/<run>`, `anonymous`, or `-` when the credentials
  failed); health probes are not logged unless they fail (5xx), and a throttled `503 SlowDown` is a warning,
  not an error. Secrets and signatures are never logged.
- **One process per data dir.** A node, and `binvault rekey`, lock `<data dir>/LOCK`; a second process fails
  with "data dir … is in use by another process" (exit 1) instead of emptying the first one's `tmp/`.
  `binvault validate` and `healthcheck` only read, so they work on a live node.
- **Backup.** (1) `sqlite3 meta.db "VACUUM INTO '<file>'"` (or snapshot the whole volume), (2) copy
  `blobs/` afterwards. Blobs dropped after step 1 are kept for `BINVAULT_GC_GRACE`, so keep the grace
  longer than the copy. Back up `BINVAULT_MASTER_KEY` separately.
  **Restore** into a fresh data dir with the key that sealed the backup, run `binvault validate --deep`,
  start.
- **Key rotation.** Put the new key in `BINVAULT_MASTER_KEY` and the old one in `BINVAULT_MASTER_KEY_OLD`,
  restart, stop, run `binvault rekey` as the user that runs the node (it refuses while the node runs), start,
  then drop the old key (keep it while an older backup is needed).
  The admin token rotates the same way: list old and new, restart, switch clients, remove the old.
- **Shutdown.** On SIGTERM (SIGINT and SIGHUP too) the node reports draining (`/_healthz` answers `503 draining`),
  stops starting `before` chains and dispatching `after` runs (they stay queued), lets the pipeline calls and
  transfers in flight finish (`BINVAULT_SHUTDOWN_TIMEOUT`), stops accepting connections, checkpoints the WAL
  and exits. The listeners stay open only while pipeline calls are in flight; on an idle node they close at
  once, so a load balancer sees a refused connection (and `binvault healthcheck` fails) rather than
  `503 draining`, which is only what a request on an already open connection gets. `kill -9` loses nothing
  acknowledged. Give the supervisor a stop timeout above `BINVAULT_SHUTDOWN_TIMEOUT` (the compose files use 70s).
- **Upgrades.** Schema migrations are forward-only and run at boot; a binary refuses a database written by a
  newer schema. Take a snapshot first. `binvault validate` against a database that is waiting for a migration
  says `migration pending (N to M)` and leaves the sealed-value and blob checks until after the migration, so
  the shipped unit's `ExecStartPre=binvault validate` does not stop an upgrade.
- **Integrity.** `BINVAULT_SCRUB_INTERVAL` enables a scrubber that re-hashes blobs against their stored
  SHA-256 and counts mismatches (first pass about a minute after start); it never repairs or deletes.
  `binvault validate --deep` names the bucket, key and version of every object whose blob file is missing.

## Security notes (§10)

The admin API exists only on its own listener (loopback by default, TLS or an explicit opt-out off
loopback); the admin token cannot touch objects and is not accepted on the S3 listener. Token secrets and
bucket data keys are sealed with AES-256-GCM under the master key. Blobs are named by random id, so keys never
reach the filesystem. XML and JSON bodies are bounded and strictly parsed. Failed authentications are throttled
per client address. Pipeline URLs are admin-controlled and resolved at dial time (link-local and metadata
addresses are always refused). Put TLS in front (a reverse proxy, or `BINVAULT_TLS_CERT_FILE`).

## Development

```text
cmd/binvault/        main: run | validate | healthcheck | rekey | version
internal/            config  httpx  s3  s3xml  apierr  sigv4  auth  admin  store  meta  engine  pipeline  seal
                     crypt  lifecycle  ratelimit  janitor  cluster  hlc  forward  clusteradmin  mover  obs  app
                     checksum  glob  keypat  httpcond  ulid
                     (see ../binvault.md §11; forward = the request forwarder of §8.4, clusteradmin =
                     the admin routing of §8.6, mover = bucket moves and drains of §8.8, app = the wiring)
docker/              compose examples (one node and a sample pipeline service; a three-node cluster)
test/                smoke.sh (container), e2e-cluster.sh (three containers), conformance/ (real S3 clients), load/
```

```bash
go vet ./... && go test -race ./...        # unit and in-process end-to-end tests
bash test/smoke.sh                          # container smoke test (needs Docker)
bash test/e2e-cluster.sh                    # three-node cluster in Docker: TLS peer link, kill, partition, heal, move, drain
                                            # (SKIP_PARTITION=1 on Docker Desktop, where cutting a network cuts the published ports)
bash test/conformance/run.sh                # boto3, aws-cli, rclone, mc, Go and JS SDKs
```
