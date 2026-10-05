# New apps — Storage and Mail

Status: proposal, draft v0.1 · 2026-10-02 · nothing here is built.

This file specifies two new apps for the webapp.mk platform (the `quaykeeper/` repo) and one new
toolcase project:

| # | Deliverable | Lives in | Backend it drives |
|---|---|---|---|
| 1 | **Storage** — reserved S3-compatible storage (spaces holding buckets) placed on registered binvault instances | webapp.mk (`api/` + `web/`) | [binvault](binvault.md), already specified in this repo |
| 2 | **Mail** — mailboxes on the platform's domains | webapp.mk (`api/` + `web/`) | one centrally deployed mail server (SMTP + IMAP + JMAP) |
| 3 | **webmail** — the personalised mail client mailbox owners log in to | `toolcase/webmail/` (new, Go + SPA) | the same mail server, plus a small platform API |

Parts 1 and 2 are control planes: they do not store or move bytes themselves. Part 3 is a product with
its own login, its own UI and its own release cycle, developed next to the platform web project.

---

## 0. Shared ground

Both apps copy two patterns webapp.mk already has (`database_spec.md`, `dns.md`), so nothing below
invents a new kind of feature:

1. **The owner connects shared backends** on the Realms page (a tab, like *DNS server* and *Database
   servers*; one for Mail, many instances for Storage), after a *Test connection* that must pass. Accounts then self-serve on their own page.
2. **The browser never talks to a backend's admin API.** Every call is an integration call through the
   queue. Screens read a stored snapshot; a refresh is a queued job. A page never waits on the backend.
3. **The registry is authoritative.** The platform only creates, changes or deletes what it has a row
   for. A reconcile job reports `in sync` / `drifted` / `missing on server` / `orphaned` / `foreign`
   and repairs only what it owns.
4. **Nothing is hard-deleted in the platform database**; every table has
   `created_at / updated_at / deleted_at` and partial indexes `WHERE deleted_at IS NULL`. Schema is
   edited in place in `00001_schema.sql` / `00002_seed.sql` (pre-launch, `AGENTS.md` *Project state*).
5. **Permissions and plans.** Each app has an owner-side pair (`<app>.server.read|write`) and a user
   pair (`<app>.read|write`) plus `<app>.admin` (all accounts, like `domain.admin`). User permissions
   are seeded to `member_plus`, `pro`, `maintainer`, not to `member`. Limits go in `role_limits`.
   Numbers in this file are proposals.
6. **Secrets** go through `cipher.ts` (`SECRETS_KEY`), are never returned to the browser, and a secret
   that is shown to the user (an access key secret, a generated mailbox password) is shown **once**.
7. **Audit.** One audit action per state-changing call; no per-object or per-message audit.

When built, each app becomes a knowledge area in the notegraph graph (*Storage*, *Mail*, plus *Realms —
Storage instances* and *Realms — Mail server*) and the matching part of this file is deleted.

---

# Part 1 — Storage

## 1.1 Summary

Storage is sold as **reserved capacity**. An account creates a **space**: a named reservation of N GB
that holds any number of **buckets**. The platform places the space on one of several registered
**binvault instances** that has the free capacity and that the account's role may use. Inside the space
the user creates buckets, mints access keys, browses files and uses any S3 client. The user never picks
or sees an instance, only the space and the endpoint it comes with.

| Where | Who | What |
|---|---|---|
| **Realms page → Storage tab** (`/realms/storage`) | `storage.server.read` / `storage.server.write` | register **many** binvault instances, each with a capacity and a role-based access rule; watch capacity, health, spaces and buckets per instance |
| **Storage page** (`/storage`) | `storage.read` / `storage.write` | the caller's spaces: create, resize, delete; buckets, keys and files inside each |

The API guarantees:

1. **Reservations are bounded and watched.** The sum of the spaces on an instance never exceeds its
   *reservable* size (`capacity × overcommit ratio`), and the sum of a space's bucket limits never exceeds
   its reservation. Binvault enforces each bucket limit itself. With a ratio of 1 an instance cannot be
   filled past its capacity; with a ratio above 1 the owner is betting on real use and the platform
   watches the disk and stops placement before it runs out (§1.5).
2. **Placement is automatic and role-aware.** A space lands only on an instance whose access rule admits
   one of the owner's roles (§1.4, §1.5).
3. **Nothing is saved until it is proven.** An instance is stored only after *Test connection* passes.
4. **Ownership is explicit.** Every bucket on an instance is *held* (by a space), *orphaned* or
   *unmanaged* (§1.10); the platform changes only buckets it has a row for.
5. **A user's key reaches one bucket**, limited by its grants and expiry. The admin API and pipelines
   never reach a user.

## 1.2 Vocabulary

| Term | Meaning |
|---|---|
| **instance** | One binvault deployment (a single node or a cluster) the platform is connected to. Many are allowed. One row in `storage_instances`. |
| **capacity** | Physical bytes of the instance the owner dedicates to users. Set by the owner, normally below the real disk size. |
| **overcommit ratio** | Per instance, ≥ 1.0 (default 1.0). How many times `capacity` may be reserved. |
| **reservable** | `capacity × overcommit ratio`. |
| **reserved** | Sum of `reserved_bytes` of the live spaces on the instance. |
| **free (reservable)** | `reservable − reserved`. What placement works with. |
| **pressure** | Real used bytes ÷ `capacity`. Above the instance's stop threshold it takes no new spaces or growth (§1.5). |
| **access rule** | Which roles may be placed on an instance: `everyone` or a list of roles. |
| **space** | An account's reservation of N bytes on one instance, holding many buckets. One row in `storage_spaces`. The unit that plans, placement and billing count. |
| **allocated** | Sum of the bucket limits (`quota_bytes`) inside a space. Must stay ≤ the reservation. |
| **headroom** | `reserved_bytes − allocated`: what the space can still give to new buckets. |
| **bucket** | A binvault bucket in a space. One row in `buckets`. |
| **access key** | A binvault bucket token (`BVK…` id plus secret) bound to one bucket. One row in `bucket_keys`; the secret is not stored. |
| **console key** | A platform-held token per bucket, never shown, used by the file browser (§1.9). |
| **unmanaged** | A bucket on an instance that no `buckets` row describes. |

## 1.3 Decisions

| Decision | Choice | Why |
|---|---|---|
| Engine | binvault as is; no fork, no platform-side S3 | Versioning, lifecycle, SSE-S3, quotas, rate limits and tokens are all driven by its admin API |
| Many instances | Yes; each is registered separately with its own capacity and access rule | Different disks, regions and tiers; the owner grows by adding instances |
| What a user buys | A **space** (reservation), not individual buckets | Disk is promised up front, so the owner can plan capacity and bill predictably |
| How reservation is enforced | Platform books the reservation; binvault enforces it through `quota_bytes` on every bucket; Σ bucket limits ≤ reservation ≤ free capacity at creation | No new mechanism in binvault; the invariant is checkable |
| Overcommit | Per-instance **ratio** set by the owner (default 1.0). `Σ reserved ≤ capacity × ratio`. Real disk use is watched; placement and growth stop at the pressure threshold | Most users use a fraction of what they reserve; the owner decides how much of that to sell. The cost is that a reservation is no longer a hard guarantee at ratio > 1 |
| What a space is | A **platform-only entity**: it exists in the platform database, has no object in binvault, and carries the reservation and the placement. The real limits live on its buckets (`quota_bytes`), whose sum may not exceed the reservation | Binvault caps only single buckets. Rejected: a shared "group quota" in binvault (a spec change) and platform-side polling of usage (the cap becomes soft) |
| Placement | The eligible instance with the **most free reservable bytes**; ties by name. The user does not choose | Spreads load, no scheduler to configure |
| Eligible | Instance is `accepting`, healthy, its access rule admits one of the owner's roles, and `free ≥ requested` | One line to explain, one to test |
| A space stays on its instance | No automatic or user-initiated move in v1 | Binvault moves buckets only inside one cluster; moving across instances means copying data (post-v1) |
| Role changes | A space stays where it is if its owner later loses access to that instance; new spaces and growth use the new rule | A downgrade must never strand data |
| Bucket names | Global across the platform, chosen by the user | S3 semantics; the registry checks first, binvault's `409` is the backstop |
| Reserved names | `wmk-*` and anything starting with `_` | Platform use; `bucket_name_reserved` |
| Dots in names | Not allowed | Virtual-hosted style cannot address dotted names |
| Token creation | Only the platform, through the admin API | Admin tokens never leave the API process |
| Defaults | Encryption `sse-s3` on; access private; public read is an explicit toggle | Safe by default |
| Pipelines | Owner-only in v1 | A pipeline makes binvault call an arbitrary URL with an S3 token; users must not define them |
| Delete | Space: delete its buckets first (or confirm the cascade), type the space name; bucket: type the name. Immediate (`force=true`) | Simplest rule; no paying for deleted data |
| Browser data path | Presigned URLs; bytes flow browser ⇄ binvault, never through the API | Large uploads must not pass through Node |
| Metering | Reserved bytes are what is counted and billed; actual use and egress are informational only | Reservation already caps use |

## 1.4 Storage instances (Realms page, owner)

`RealmsPage` gets one more tab, `/realms/storage` (instance list) and `/realms/storage/:id` (one
instance). Gated on `storage.server.read`, registered before `/realms/:id`; `storage` joins the reserved
realm slugs. With no instance the tab shows the empty state and `/storage` shows "Storage is not
available".

### Register an instance

| Field | Notes |
|---|---|
| Name and label | `name` is internal and unique; `label` is what users see (for example "Frankfurt SSD"). |
| Admin URL | `http(s)://…:9001`. The admin listener is private by design (binvault §2.3), so this is an internal or VPN address. Same SSRF allow-list as realm admin URLs; `http://` only for loopback or private addresses, with a warning. |
| Admin token | `BINVAULT_ADMIN_TOKEN` (any one of the comma-separated tokens). Sealed with `cipher.ts`, never returned. |
| TLS CA | Optional PEM for a private CA. |
| Public endpoint | What S3 clients and presigned URLs use. HTTPS required. Unique per instance. |
| Virtual-host domain | Optional; must equal the instance's `BINVAULT_DOMAIN`. When set, users also get `https://<bucket>.<domain>`. |
| Region name | Shown in snippets; binvault accepts any SigV4 region. |
| **Capacity** | Physical bytes dedicated to users (GB/TB input), > 0. A warning (not a refusal) if it exceeds the instance's total disk as reported by `GET /cluster`. |
| **Overcommit ratio** | 1.0 – 10.0, default 1.0. Editing is refused if `Σ reserved` would exceed the new `capacity × ratio`. The form shows the resulting reservable size and a warning above 1.0: "reservations are no longer guaranteed". |
| **Pressure thresholds** | `warn` (default 70 % of capacity) and `stop` (default 85 %). Used bytes come from the probe's `stats`. |
| **Access** | `Everyone`, or `Roles` with a multi-select of roles. At least one role in `Roles` mode. |
| Accepting new spaces | On by default. Off = **draining**: no new spaces and no growth; existing spaces keep working. |

**Test connection** (before save): `GET /_admin/v1/status` and `/cluster` with the token; then `GET
<public endpoint>/_healthz` and `/_version`; then a signed round trip through the public endpoint with
a throwaway bucket `wmk-probe-<random>` (create bucket, create token, `PUT` and `GET` one object,
delete everything with `force=true`). The last step proves the reverse proxy preserves the `Host`
header, which SigV4 signs (§1.15). Failures: `storage_unreachable`, `storage_unauthorized`,
`storage_endpoint_mismatch`.

### The list and the instance page

The list shows, per instance: label, state chip, a capacity bar (`used` inside `reserved` against
`capacity` and `reservable`), free reservable, spaces, buckets, access rule, accepting/draining.

The page has panels:

| Panel | Source | Shows |
|---|---|---|
| Overview | probe | URLs, version, state, capacity numbers, last probe |
| Capacity | rows + snapshot | reserved, allocated to buckets, actually used (`stats`), free, and the per-node disk from `GET /cluster` |
| Spaces | `storage_spaces` | every space on the instance: account, reserved, allocated, used, state |
| Buckets | `buckets` vs `GET /buckets?stats=true` | every bucket with its space, home node, objects, bytes, state (§1.10) |
| Nodes | `GET /cluster` | per node: reachable, lag, clock skew, free disk, buckets homed, `cordoned`, alarms |
| Registry | reconcile result | in sync, drifted, missing on server, orphaned, foreign |
| Pipelines | `GET /pipelines` | read-only, with the buckets each is attached to |
| Moves | `GET /moves` | bucket moves **between nodes of this instance** |

Actions: **Check now**, **Reconcile now**, **Edit** (capacity, access, label, accepting; the admin URL,
token and public endpoint are editable only while no space exists on it, otherwise
`storage_instance_in_use`), **Drain** / **Resume**, **Move bucket** (between its nodes), **Drain /
undrain node**, **Remove** (refused while spaces or unmanaged buckets exist; never deletes anything on
binvault).

### Health

`storage_probe` runs per instance every 60 s and on demand. `unreachable`: `/_healthz` or the admin call
fails. `degraded`: any cluster alarm (`conflicts`, `orphans`, `held_ops`, `clones`, `missing`,
master-key or region mismatch), a node unreachable, free disk under 10 %, a failed move, or pressure over
`warn`. Pressure over `stop` also notifies holders of `storage.server.write` as an alarm. `healthy`
otherwise. `HealthService` and `cli -- status` get a `storage` component (worst instance, with the
list). Transitions notify holders of `storage.server.write`.

An instance that is not `healthy` is **not eligible for new spaces**. An `unreachable` instance blocks
bucket and key changes for its spaces (they queue); the user page shows "Storage temporarily
unavailable".

## 1.5 Placement and reservation

### Creating a space

```
input: account, role set R, requested bytes B
1. eligible = instances where accepting AND healthy
              AND (access = everyone OR access.roles ∩ R ≠ ∅)
              AND pressure < stop threshold
              AND capacity × ratio − reserved ≥ B
2. none → capacity_unavailable   (the sheet says "No storage available right now", no instance named)
3. pick the instance with the largest (capacity × ratio − reserved); ties → lowest name
4. insert the space with that instance_id
```

Steps 1–4 run in **one transaction that locks the instance rows being compared** (`SELECT … FOR
UPDATE` in a fixed order), and the free figure is computed inside it from live rows, so two concurrent
requests cannot both take the last bytes. The result is a sentinel (`Placed` / `CapacityUnavailable`),
never a check-then-insert. Creating a space calls binvault **not at all**; buckets are created lazily.

### Growing, shrinking

- **Grow** to `B′`: needs `B′ − B ≤ free` of the space's own instance (locked, same transaction), the
  instance `accepting`, pressure under its stop threshold, and the owner's role to still be admitted (growth uses the current rule), else
  `capacity_unavailable`. It is a bookkeeping change only.
- **Shrink** to `B′`: needs `B′ ≥ allocated` (bucket limits are not touched). To shrink further the
  user first lowers a bucket limit; binvault will refuse a limit under current use, which also protects
  data.
- A plan downgrade below the account's reserved total is allowed and **blocks growth and new spaces**
  only (`storage_plan_exceeded`); nothing is clawed back.

### Invariants (checked by the reconcile job and tests)

1. `Σ reserved_bytes of live spaces on an instance ≤ capacity × overcommit ratio`.
2. `Σ quota_bytes of a space's buckets ≤ reserved_bytes` (no bucket in a space has a null limit).
3. A space's buckets live on its instance; a bucket's binvault `quota_bytes` equals its row.
4. `used ≤ quota_bytes` per bucket (binvault's own rule). At ratio 1.0 this makes real use ≤ reserved ≤
   capacity; above 1.0 it does not, which is why pressure is watched (below).

Lowering capacity or the ratio below `Σ reserved` is refused. If real disk shrinks, the probe reports
`degraded` (free disk), which stops placement without moving anyone.

### Overcommit and real disk

Binvault's quota counts logical bytes of every version of every object; SSE overhead and metadata are
small, and the owner covers them by keeping the real disk larger than `capacity` (binvault's
`BINVAULT_MIN_FREE_MB` is a last stop). Deduplicated copies only lower real use.

With a ratio above 1.0 the platform protects the instance in three steps:

1. **warn** (default 70 %): the instance goes `degraded`, the owner is notified.
2. **stop** (default 85 %): no new spaces, no growth, no raising of bucket limits on this instance; users
   see "Storage temporarily unavailable" for those actions only. Existing data and writes continue.
3. **hard** (binvault's `BINVAULT_MIN_FREE_MB` or a full disk): binvault answers `StorageFull` to every
   write on the node. The owner must add disk or capacity, or delete data; the platform never deletes
   user data to make room.

The owner raises capacity (new disk) to recover; moving spaces to another instance is post-v1 (§1.16).

## 1.6 Spaces (user page)

Routes: `/storage`, `/storage/new`, `/storage/:spaceId`, `/storage/:spaceId/:tab`. Nav item in the
`workspace` section, `requires: ['storage.read']`.

**List.** One card per space: name, reserved size, a stacked bar (`used` / `allocated` / `reserved`),
bucket count, endpoint region label, state. Holders of `storage.admin` get *Mine / All*.

**Create space** (sheet, `storage.write`): name (unique per account, 1–60 chars), size (GB, up to the
plan's remaining reservation). The result shows the instance's **label** and endpoint. If placement
fails, the sheet explains `capacity_unavailable` without exposing instance names or numbers.

**Space page.** Tabs *Buckets*, *Keys* (all keys of all its buckets), *Usage*, *Settings*, *Use it*
(endpoint, region, AWS CLI / rclone / SDK snippets, filled with the space's endpoint).
*Settings*: rename, **resize** (§1.5), delete.

**Delete a space.** Allowed when it has no buckets, or after confirming the cascade ("Delete N
buckets and all their files"). The user types the space name. The job deletes each bucket
(`DELETE …?force=true`), then soft-deletes the space; the reservation returns to the instance and the
plan. States: `active`, `suspended` (by `storage.admin`, §1.14), `deleting`.

## 1.7 Buckets (inside a space)

Created on the space's *Buckets* tab (`storage.write`):

| Field | Notes |
|---|---|
| Name | 3–63 chars, `[a-z0-9-]`, start and end alphanumeric, not an IPv4 look-alike, not reserved. Live availability check. |
| Size limit | GB, **required**; default = the space's headroom; may not exceed headroom (`space_headroom_exceeded`). |
| Versioning | Off (default) or On; turning it on is **one-way** (binvault §3.10). |
| Encryption | On (default) / Off. |

Flow: insert the row `provisioning` → queue `STORAGE_BUCKET_CREATE` on the **space's instance**
(`POST /buckets` with `quota_bytes`; `409` → registry check: not ours → `bucket_name_taken`, row
deleted; ours and half-created → continue) → create the console key → `ready`. Failure leaves `failed`
with the cause and a *Retry*.

**Settings tab** (desired state on the row; saving queues `STORAGE_BUCKET_APPLY`, a `PATCH` with
`If-Match`):

| Setting | Maps to | UI |
|---|---|---|
| Size limit | `quota_bytes` | number; raising is capped by headroom; lowering is capped by current use (binvault refuses otherwise) |
| Max object size | `max_object_bytes` | number, capped by the instance's `BINVAULT_MAX_OBJECT_MB` |
| Allowed file types | `allowed_content_types` | chips with presets *Images*, *Documents*, *Video*; the type is sniffed, not trusted (binvault §3.13) |
| Versioning | `versioning` | one-way switch |
| Keep history | lifecycle `noncurrent_days` / `noncurrent_keep` | shown when versioned |
| Auto-delete | lifecycle `expire_days` + `prefix` | simple rule list, max 10 |
| Public access | `anonymous_read` + `anonymous_prefixes` | Off / Whole bucket / These folders; confirmation when turning on |
| CORS | `cors` | rule editor |
| Rate limits | `limits` | set from the plan, read-only |

CORS: the console origin must be allowed for presigned requests. The platform stores the user's rules in
`buckets.cors` and pushes them **plus one platform rule**; the platform rule is never shown or editable.

**Delete a bucket.** Type the name. The job revokes keys and calls `DELETE …?force=true` (no events).
The bucket's limit returns to the space's headroom.

## 1.8 Access keys

`bucket_keys` rows on a bucket's *Keys* tab (and aggregated on the space's): name, preset, prefix,
expiry, last used (snapshot), created. Revoke = `DELETE /buckets/{name}/tokens/{id}`, effective
immediately.

**Create key** sheet: name; preset; optional folder (prefix); optional expiry (never / 7 d / 30 d / 90 d
/ date).

| Preset | Grants (`actions`) |
|---|---|
| Read only | `read`, `list` |
| Read & write | `read`, `list`, `write`, `delete` |
| Backup (write-once) | `read`, `list`, `create` — cannot overwrite or delete (binvault §4.4) |
| Full | `read`, `list`, `write`, `delete`, `purge`, `tag`; `purge` only on versioned buckets |

A prefix `photos/2026/` becomes `keys: ["photos/2026/*"]`. *Advanced* edits grants directly. The secret
is shown once with copy buttons and snippets filled with the endpoint, region and key id. The platform
stores only `access_key_id` and the grants. Limit: keys per bucket (plan).

## 1.9 Files tab (browser)

A file browser over one bucket, using its **console key** (a normal bucket token with all actions,
named `wmk-console`, secret sealed by the platform, never leaving the API).

| Action | How |
|---|---|
| Browse | `GET /api/storage/buckets/:id/objects?prefix=&cursor=` — the API calls `ListObjectsV2` with delimiter `/` |
| Upload | `POST …/presign {op:"put", key, size, contentType}` → presigned `PUT` (≤ 5 GiB, bucket rules apply) straight to the instance's public endpoint, with progress |
| Download / preview | `POST …/presign {op:"get", key, version?}` → presigned `GET`, 5 min; previews for images, PDF, text |
| Share link | presigned `GET`, lifetime up to 7 days |
| Delete | single and multi-select; on a versioned bucket "delete" adds a marker, and a *Versions* drawer offers restore and permanent delete (confirmation; uses `purge`) |
| New folder | zero-byte `name/` marker |
| Rename / move | copy then delete, files only, one bucket |

Presigned URLs are signed for the **instance's public endpoint host**, in one module so the host rule
cannot drift. Not in v1: resumable/multipart browser uploads, folder rename, tag and metadata editing.

## 1.10 Ownership, orphans and drift

A bucket is *held* (row exists, space active), *orphaned* (its account was deleted: the space becomes
`orphaned`, keys are revoked, uploads stop by setting each bucket's `quota_bytes` to current use; the
reservation **stays booked**) or *unmanaged* (no row).

- **Orphaned spaces.** Shown to `storage.server.write` on the instance page with *Assign to account*
  and *Delete*. Nothing is deleted automatically.
- **Unmanaged buckets.** Found by the reconcile job. The owner can *Adopt* (preview, pick an account and
  one of its spaces on **this instance** with enough headroom, else the adoption is refused) or *Ignore*.
- **Drift.** The reconcile job (every 10 minutes and on demand) compares each row with
  `GET /buckets/{name}`; a drifted bucket shows "differs from settings" with *Reapply*, and drift is
  never overwritten while a change is in flight. It also checks the §1.5 invariants and raises an alarm
  on a violation.
- **Missing on server.** Row exists, binvault has nothing: state `missing`, owner alarm; recreating is a
  manual owner action.

## 1.11 Data model

All tables carry `created_at / updated_at / deleted_at`.

**`storage_instances`**
`id`, `name` (unique where live), `label`, `admin_url`, `admin_token_enc`, `tls_ca`,
`public_endpoint` (unique where live), `vhost_domain`, `region`, `capacity_bytes`, `overcommit_ratio`
(numeric, default 1.00), `warn_pct`, `stop_pct`, `access`
(`everyone` / `roles`), `accepting` bool, `state`, `snapshot jsonb` (nodes, alarms, free disk),
`probed_at`, `last_error`.

**`storage_instance_roles`** — `instance_id`, `role_id` (unique pair; used when `access = 'roles'`).

**`storage_spaces`**
`id`, `account_id`, `instance_id`, `name` (unique per account where live), `reserved_bytes`, `state`
(`active` / `suspended` / `orphaned` / `deleting`), `used_bytes` and `allocated_bytes` (snapshots),
`stats_at`. `reserved` of an instance is `SUM(reserved_bytes) WHERE deleted_at IS NULL` computed in the
placement transaction, never cached.

**`buckets`**
`id`, `space_id`, `name` (unique platform-wide where live), `state` (`provisioning` / `ready` /
`failed` / `deleting` / `missing`), `home`, `versioning`, `encryption`, `quota_bytes` (not null),
`max_object_bytes`, `allowed_content_types text[]`, `lifecycle jsonb`, `anonymous_read`,
`anonymous_prefixes text[]`, `cors jsonb`, `console_key_id`, `console_secret_enc`, `revision`,
`stats jsonb`, `stats_at`, `last_error`.

**`bucket_keys`**
`id`, `bucket_id`, `access_key_id` (unique), `name`, `preset`, `grants jsonb`, `expires_at`,
`last_used_at` (snapshot), `created_by`.

**Seed.** Permission keys `storage.server.read|write`, `storage.read|write`, `storage.admin`; roles per
§0; `role_limits` rows (§1.13); a `storage` component in the health seed.

## 1.12 API

Routers `storageInstanceRouter` (owner) and `storageRouter` (user), contracts in
`api/src/contracts/storage.ts`. Access model: **owned** by the space's account; foreign ids answer
`404`, never `403`.

| Method & path | Gate | Purpose |
|---|---|---|
| `GET/POST /api/storage/instances` · `GET/PATCH/DELETE …/:id` | `storage.server.*` | instances (capacity, access, accepting) |
| `POST /api/storage/instances/test` | `storage.server.write` | test before save |
| `GET /api/storage/instances/:id/{capacity,spaces,nodes,registry,pipelines,moves}` | `storage.server.read` | snapshots |
| `POST /api/storage/instances/:id/{probe,reconcile}` | `storage.server.write` | queue a job |
| `POST /api/storage/instances/:id/{drain,resume}` · `…/buckets/:bid/{move,adopt}` · `…/spaces/:sid/assign` | `storage.server.write` | operations |
| `GET/POST /api/storage/spaces` · `GET/PATCH/DELETE …/:id` | `storage.read` / `write` | spaces; `PATCH` renames or resizes |
| `GET /api/storage/spaces/available?size=` | `storage.read` | "would this fit?" (yes/no only) |
| `GET/POST /api/storage/spaces/:id/buckets` · `GET/PATCH/DELETE /api/storage/buckets/:id` | `storage.read` / `write` | buckets |
| `GET /api/storage/buckets/available?name=` | `storage.read` | name check |
| `GET/POST/DELETE /api/storage/buckets/:id/keys[/:keyId]` | `storage.write` | keys; secret only in the `201` |
| `GET /api/storage/buckets/:id/objects` · `POST …/presign` · `POST …/delete` | `storage.write` | browser |

Integration operations (queue, idempotent, back-off): `STORAGE_PROBE`, `STORAGE_RECONCILE`,
`STORAGE_BUCKET_CREATE`, `STORAGE_BUCKET_APPLY`, `STORAGE_BUCKET_DELETE`, `STORAGE_KEY_CREATE`,
`STORAGE_KEY_REVOKE`, `STORAGE_STATS_SYNC` (`GET /buckets?stats=true` per instance every 5 minutes).
Creating, resizing and deleting spaces are database changes only, apart from the deletes of their
buckets.

Error causes: `storage_unreachable`, `storage_unauthorized`, `storage_endpoint_mismatch`,
`storage_instance_in_use`, `capacity_unavailable`, `storage_plan_exceeded`, `space_headroom_exceeded`,
`space_not_empty`, `bucket_name_taken`, `bucket_name_reserved`, `bucket_not_ready`,
`bucket_versioning_one_way`, `key_limit_reached`.

## 1.13 Quotas and plans

| `role_limits` resource | Meaning | member_plus | pro | maintainer |
|---|---|---|---|---|
| `storage_reserved_bytes` | sum of the account's space reservations | 10 GB | 200 GB | 2 TB |
| `storage_spaces` | spaces per account | 1 | 5 | 20 |
| `storage_buckets_per_space` | buckets per space | 5 | 50 | 200 |
| `storage_keys_per_bucket` | access keys per bucket | 10 | 50 | 100 |
| `storage_max_object_mb` | upper bound for a bucket's object cap | 1024 | 5120 | 5120 |
| `storage_requests_per_second` | applied as bucket `limits` | 50 | 500 | 1000 |

`storage_reserved_bytes` is the only number billing needs: a user pays for what they reserve. A plan
that is unlimited still has a finite request bound: reservation is always capped by what instances can
offer. A plan change re-pushes limits to every bucket (`STORAGE_BUCKET_APPLY`).

## 1.14 Security

- Admin tokens exist only in `storage_instances.admin_token_enc` and in memory while a job runs.
- Console key secrets are sealed per bucket; a missing console key is re-minted by the reconcile job.
- User keys are `BVK…` tokens; the platform never sees a secret again after the `201`.
- Public buckets carry binvault's `Content-Security-Policy: sandbox` and `nosniff` (binvault §4.6); the
  storage origin must never share cookies with the platform.
- Abuse: `storage.admin` can **suspend** a space (revoke all keys, `anonymous_read = off`, bucket limits
  set to current use). Reservation stays booked.
- Instance role rules are not a security boundary between users (a space is placed once); they are a
  commercial boundary. Isolation between users is by bucket and key.
- Bucket names and object keys in logs are fine; key secrets and presigned URLs are not logged.

## 1.15 Requirements on binvault and the edge

| Need | Where | Note |
|---|---|---|
| Public listener behind TLS per instance, `s3.<instance domain>` and `*.s3.<…>` | nginxpilot + Certificates | wildcard needs DNS-01; path-style works without it |
| **Host header preserved**, request bodies **streamed**, no body-size ceiling | nginxpilot proxy | `registry_app.md` §1 records that nginxpilot cannot yet express unlimited `client_max_body_size` or disable `proxy_request_buffering`; hard dependency, or terminate TLS in front of binvault |
| Admin listener reachable from the API, **not** from the internet | network | |
| `BINVAULT_DOMAIN` set per instance when virtual-hosted style is wanted | binvault | same on every node of that instance |
| One `BINVAULT_MASTER_KEY` per instance, backed up | owner runbook | losing it loses token secrets (binvault §4.7) |
| `capacity` set below the real disk | owner runbook | §1.5 |

## 1.16 Out of scope (v1)

Moving a space between instances (needs a cross-instance copy job); user-chosen placement;
pipelines for users; custom domains for buckets (belongs to the unified hostname work); egress billing;
cross-instance replication; resumable browser uploads; IAM-style policies; running binvault itself (the
owner deploys it; its configuration is binvault's spec). Platform *Files* could later use a bucket as an
upload source; no change is needed here.

## 1.17 Build order

1. Contracts, schema, seed; `StorageInstanceService` with *Test connection*, probe, capacity; owner tab
   (list, register, edit, drain).
2. Spaces: placement transaction, create/resize/delete as database changes, plan limits; user list.
3. Buckets in a space with the headroom rule and the queue operations; state machine.
4. Keys and presets; snippets.
5. Settings (versioning, public access, CORS, lifecycle, content types), drift/reconcile and invariant
   checks.
6. Files tab (list, presign, upload, download, delete, versions).
7. Orphans/adopt, intra-instance moves, suspend, demo dataset rows, authz sweep, graph area.

## 1.18 Open decisions

1. **Placement rule** — most free capacity (recommended) vs fill-first (consolidates, leaves whole
   instances empty to retire) vs owner-set priority per instance.
2. **Overcommit** — decided: per-instance ratio. Still open: should the reserved size be shown to users as
   a *guarantee*, or as "up to"? Recommendation: "up to", worded in the plan terms, whenever the ratio is
   above 1.
2a. **Space entity** — confirm the reading in §1.3: the space is a platform-only reservation and
    placement unit; sizes are enforced per bucket.
3. **Show the instance label to users** — yes in v1 (a "region" feel); hide it if instances should stay
   invisible.
4. **Space as billing unit** — confirm that reserved bytes, not actual use, is what is charged.
5. **Bucket-name squatting** on a global namespace — accept for v1.
6. **Plan numbers** in §1.13.
7. **Edge** — wait for nginxpilot streaming support, or put binvault behind its own TLS front.

---

# Part 2 — Mail

## 2.1 Summary

An account that has an **active domain** on the platform (managed or external, `dns.md`) can turn **mail
on** for it, create **mailboxes** and **aliases**, and the platform does the rest: it configures the
central mail server, generates the DKIM key, tells the user which DNS records to add (or writes them
itself when the domain is managed by the platform's DNS server), verifies them, and keeps watching.
Mailbox owners then sign in to [webmail](#part-3--webmail) with `name@domain` and a password, or use any
IMAP/SMTP client.

| Where | Who | What |
|---|---|---|
| **Realms page → Mail server tab** (`/realms/mail`) | `mail.server.read` / `mail.server.write` | connect **one** mail server, see health, queue, reputation checks, every domain and mailbox, suspend abusers |
| **Mail page** (`/mail`) | `mail.read` / `mail.write` | the caller's mail domains: enable, DNS status, mailboxes, aliases, quotas, webmail branding |
| **webmail** (separate product) | mailbox owners (not platform accounts) | read and send mail |

The API guarantees:

1. **Only a proven domain gets mail.** Mail can be enabled only on a domain that is already `active`
   (ownership proven by the domain checks); an inactive domain suspends its mail (§2.5).
2. **Sending is gated on DNS.** Inbound mail starts as soon as the MX is right; outbound starts only
   when SPF and DKIM verify (§2.5, §2.8).
3. **The mail server's admin API is private to the platform.** Mailbox owners authenticate to the mail
   server itself; the platform never stores a mailbox password (§2.6).
4. **The registry is authoritative.** The platform only manages domains and mailboxes it has rows for.

## 2.2 Vocabulary

| Term | Meaning |
|---|---|
| **mail server** | The one centrally deployed server (SMTP for inbound/outbound, IMAP and JMAP for access) the platform is connected to. One row in `mail_servers`. |
| **mail domain** | A platform domain (`domains` row, `active`) with mail enabled. One row in `mail_domains`, 1:1 with the domain. |
| **mailbox** | `local@domain` with its own password, quota and storage on the mail server. |
| **alias** | An address that delivers to one or more mailboxes of the same domain. |
| **catch-all** | An optional alias for "any other address at this domain". Off by default. |
| **admin mailbox** | The mailbox that receives `postmaster@`, `abuse@`, `hostmaster@` and `webmaster@` (required by RFC 5321/2142). |
| **record set** | The DNS records a mail domain needs: MX, SPF, DKIM, DMARC, client setup (§2.5). |
| **mail service** | What the user sees as **"my mail server"**: one per account, created automatically when the account enables mail on its first domain. It groups the account's mail domains and mailboxes, shows its own status and usage, and is what is billed. In fact all mail services share the one platform mail server (`mail_servers`); the interface presents it as the account's own and never shows other accounts, shared addresses or load. One row in `mail_services`. |
| **webmail** | The mail client of Part 3. |

## 2.3 Decisions

| Decision | Choice | Why |
|---|---|---|
| Mail server software | **Adopt, don't build: Stalwart Mail Server** behind a *mail server port* (like the database drivers) | One process gives SMTP, IMAP, **JMAP**, DKIM signing, spam filtering, per-domain/per-account quotas and a management API. Writing an SMTP/IMAP server is years of work and the abuse and deliverability problems are the same either way. JMAP is also the right protocol for a custom web client |
| Headless | Stalwart runs **API only**: its bundled admin screen is not deployed or exposed. All administration goes through the platform's Mail screens (Part 2) and all user access through webmail (Part 3) or IMAP/SMTP | The UI is ours to build; fewer exposed surfaces |
| Alternatives weighed | Apache James (Apache 2.0, JMAP and REST admin, but a JVM plus a database); Postfix + Dovecot (permissive, proven, but no management API and no JMAP, so a Go agent and an IMAP-speaking webmail); a server built in Go (months, own spec). Stalwart is chosen for the least work to a JMAP-capable, API-driven server | Revisit only if the licence or the pinned version fails the checks in §2.14 |
| Licence | Stalwart's open edition is AGPL-3.0 as far as I know. Running it unmodified as a service is the expected use; **modifying it obliges publishing the changes** | Confirm before building (open decision 1) |
| Presentation | Each account gets a **mail service** that looks like its own mail server: a name, a status, its hostnames for IMAP/SMTP, its domains, mailboxes and usage. The sharing is an implementation detail and is not hidden by lying: the terms say resources are shared and fair-use limits apply | A simpler mental model for users; no per-account servers to run |
| Billing | **Usage-based**, like the platform's other services: the mail service is metered on stored bytes, mailbox-days, and messages sent, and usage flows into the same billing pipeline the other services use. Plan limits (§2.13) are safety caps, not allowances to buy | Pay for what runs; matches how the rest of the platform bills |
| Backup and restore | Nightly backup of the mail server's storage, taken by the owner's tooling. The **owner** restores everything or one mailbox on request; there is no standby server and no user self-restore in v1 | Simplest safe rule; the 14-day deletion window (above) covers mistakes |
| Import | Not in v1; users move old mail with their own mail app | Keeps v1 small |
| Port, not lock-in | All server calls go through a `MailServerDriver` interface (§2.12); Stalwart is the only v1 driver | A Postfix+Dovecot driver stays possible |
| Number of servers | One logical server (it may be a cluster behind one admin URL), like the DNS server | Same pattern; no per-realm mail |
| Mail is bound to a **domain**, not to a realm | A `mail_domains` row, not a realm target | MX points at the mail server's hosts, not at a realm's ingress; realms and mail are unrelated (as in the *Realms* glossary) |
| Eligible domains | `active` domains only, external or managed, apex or subdomain | Ownership is already proven by the Domains feature |
| DNS for managed domains | The platform writes and owns the record set (locked rows, labelled "managed by Mail") | No user action needed; removed when mail is disabled |
| DNS for external domains | The platform shows the exact records and verifies them every 10 min until they pass, then every hour | Same model as external domains in `dns.md` |
| SPF | One include: `v=spf1 include:_spf.<mail zone> ~all` | The mail server's IPs change in one place; stays under the 10-lookup limit |
| DKIM | 2048-bit RSA, **plain TXT**, two selectors `wmk1` / `wmk2` used alternately for rotation | No coupling to the platform's own zone; rotation is "publish the new selector, wait, switch" |
| DMARC | `p=none` record is suggested by default; `quarantine` is an explicit domain setting after DKIM and SPF pass for 7 days | Prevents mail loss on day one |
| Password storage | **Only on the mail server**; the platform sets it and forgets it | Smaller breach surface |
| Mailbox deletion | The mailbox is disabled at once and purged after 14 days; restore until then | Simplest safe rule |
| External forwarding | **Not offered** (aliases deliver inside the domain only) | Forwarding to third parties needs SRS and is the main spam-relay vector |
| Third-party clients | IMAP (993) and submission (465/587) are on by default, switchable per domain | A mail host that only works in one web client is a trap |
| Platform sends its own mail | Out of scope, but the *Email delivery* provider port can use a mailbox over SMTP later | No coupling in v1 |

## 2.4 Mail server (Realms page, owner)

`/realms/mail`, registered before `/realms/:id`, gated on `mail.server.read`; `mail` joins the reserved
realm slugs. One connection only.

### Connect

| Field | Notes |
|---|---|
| Driver | `stalwart` (v1) |
| Admin URL | Management API base URL; private network or VPN; same SSRF allow-list as other admin URLs |
| Admin credential | An API key or admin login for the management API, sealed with `cipher.ts` |
| Public hostnames | `mx_hosts` (≥ 1; what customer MX records point at), `submission_host`, `imap_host`, `jmap_url` (internal, for webmail) |
| SPF zone | The name that carries the SPF include (`_spf.mail.example.net`). The platform checks it exists and, when the DNS server is connected and that zone is managed, can maintain it. |
| Sending pools | At least `probation`; optionally `trusted`. Each pool: public IPv4/IPv6 addresses, the HELO/PTR hostname per address, and the outbound route name the driver uses. All pools' addresses are listed in the SPF zone, so a domain can move between pools without any change in the customer's DNS. |
| Webmail URL | Where the webmail runs, e.g. `https://webmail.example.net`; used in links and for the agent token (§2.10) |
| Defaults | max message size (25 MB), max recipients (50), default mailbox quota |

**Test connection** (before save): management API reachable and authenticated; the version is one the
driver supports; each `mx_host` resolves and answers SMTP `220` on port 25; submission and IMAP
present a valid certificate; reverse DNS (PTR) of each sending IP equals a configured hostname and that
hostname resolves back to the IP; the IPs are not listed on the common DNS blocklists (a failure is a
warning, not a refusal); the SPF zone resolves. Failures: `mail_server_unreachable`,
`mail_server_unauthorized`, `mail_server_unsupported`.

### Connected

| Panel | Shows |
|---|---|
| Overview | URLs, version, state `healthy` / `degraded` / `unreachable`, last probe |
| Reputation | per pool and per IP: PTR/rDNS match, blocklist status, TLS certificate expiry, port reachability |
| Pools | which domains are in `probation` / `trusted`, promotion and demotion history |
| Queue | messages queued, oldest age, deferred and failed counts (numbers only; no message content) |
| Domains | every mail domain: account, state, mailboxes, DNS status, 24 h sent/bounced |
| Registry | reconcile result (domains and mailboxes on the server vs rows) |
| Abuse | domains/mailboxes the platform auto-held (§2.8) with *Release* / *Suspend* |

Actions: **Check now**, **Reconcile now**, **Edit**, **Disconnect** (refused while mail domains exist),
**Suspend domain / mailbox**, **Flush queue for a domain**.

`mail_probe` (60 s): `unreachable` if the management API or port 25 fails; `degraded` for a blocklist
hit, certificate under 14 days, queue age over 30 min, or a failed reconcile; otherwise `healthy`.
`HealthService` and `cli -- status` get a `mail` component. While `unreachable`, creating mailboxes is
disabled and changes queue.

## 2.5 Mail domains (user page)

The page opens on the account's **mail service** (the header shows its name, status, hostnames and this
month's usage); until the first domain is enabled it shows "Set up your mail server", which is the *Enable
mail* sheet below. Routes: `/mail`, `/mail/new`, `/mail/:domainId`, `/mail/:domainId/:tab` with tabs *Overview*,
*Mailboxes*, *Aliases*, *DNS*, *Webmail*, *Settings*. Nav item in the `workspace` section.

**Enable mail.** Pick one of the account's `active` domains; confirm. Flow: insert `mail_domains`
(`state = 'pending'`) → queue `MAIL_DOMAIN_ENSURE` (create the domain on the server, generate DKIM key
for `wmk1`) → store the DKIM public key → compute the record set → if the domain is **managed**, write
the records through the Domains service (locked, `managed_by = 'mail'`) → verification loop.

### Record set

| Purpose | Name | Type | Value |
|---|---|---|---|
| Inbound | `@` | MX | `10 <mx_host>` per MX host (equal priority; second host at `20` when configured) |
| Sender policy | `@` | TXT | `v=spf1 include:<spf zone> ~all` (merged with the user's existing SPF if present: the platform emits one record that keeps their other includes) |
| DKIM | `wmk1._domainkey` | TXT | `v=DKIM1; k=rsa; p=<public key>` |
| DMARC | `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:dmarc@<mail zone>` (suggested; warning only) |
| Client setup | `autoconfig`, `autodiscover` | CNAME | `<imap_host>` (so mail clients find settings) |
| Client setup | `_submission._tcp`, `_imaps._tcp` | SRV | submission and IMAP hosts (RFC 6186) |

For a subdomain mail domain (`shop.example.com`) the same names apply under it.

**An existing MX or SPF** (detected by the `dns.md` pre-check) is shown before enabling: "This domain
already receives mail at X. Switching MX moves your incoming mail." The user must tick a confirmation;
nothing is rewritten silently, even for managed domains.

### States and verification

`mail_verify` queries public DNS for each record (external) or checks zone content (managed), every 10
minutes while `pending`/`degraded`, hourly when `active`.

| State | Meaning |
|---|---|
| `pending` | enabled, records not yet correct. Receiving starts once MX is correct. Sending is off. |
| `active` | MX, SPF and DKIM verified, ≥ 1 mailbox, an admin mailbox set. Sending on. |
| `degraded` | was `active`, a required record now fails. Inbound continues. Sending stays on for 24 h, then pauses; a notification goes to the account at once and again at 24 h. |
| `suspended` | by abuse control, by `mail.server.write`, by plan limit, or because the underlying domain left `active`. Inbound is rejected (`4xx` so senders retry) for 72 h, then `5xx`. |
| `disabled` | the user turned mail off. Mailboxes are disabled and purged after 14 days; records the platform wrote are removed. |

DMARC and client-setup records only produce warnings. Rotating DKIM (button, or automatically every 12
months): generate the other selector, publish it, wait for it to verify, then switch signing and remove
the old one 7 days later.

## 2.6 Mailboxes

Created on the *Mailboxes* tab (`mail.write`):

| Field | Notes |
|---|---|
| Address | local part `[a-z0-9._-]`, 1–64 chars, no leading/trailing dot, no `..`; unique in the domain and not an alias; reserved: `postmaster`, `abuse`, `hostmaster`, `webmaster`, `dmarc` |
| Display name | shown as the sender name; the owner can change it in webmail |
| Password | **Generate** (shown once, copyable) or **Invite**: the admin enters the person's existing email; they receive a link to a webmail page where they choose a password (valid 72 h, single use) |
| Quota | storage in MB/GB, capped by plan |
| Admin mailbox | one per domain; the first mailbox created is the default |

Passwords: at least 12 characters, rejected against a common-password list. The platform sends the
password to the mail server in the create/update call and discards it. Resetting a password is an
admin action that generates a new one (shown once) or sends an invite; the previous password stops
working at once and the mailbox's webmail sessions are revoked (§3.3).

Mailbox states: `active`, `suspended` (mail still accepted, sign-in and sending blocked), `deleting`
(14-day window, then purge and soft-delete of the row). The list shows address, name, used/quota, last
sign-in (from the server snapshot), state.

Storage use and last-sign-in come from a snapshot (`MAIL_USAGE_SYNC`, every 15 minutes); the mailbox
quota itself is enforced by the mail server.

## 2.7 Aliases and catch-all

An alias is `local@domain → 1..10 mailboxes of the same domain`. No external targets. Catch-all: one
optional alias per domain with a mailbox target, off by default, shown with a spam warning. An alias
cannot share a name with a mailbox. Aliases can also be used as a *send-as* identity: webmail offers
every alias that targets the signed-in mailbox as a "From" choice (the server permits it per
principal).

## 2.8 Sending policy and abuse control

A hosted mail platform's main risk is being used to send spam. These rules are part of v1:

- **Gate.** No outbound mail until the domain is `active` (SPF and DKIM verified).
- **Address pools.** Every new domain sends from the `probation` pool, with warm-up: 100 messages/day
  across the domain, doubling daily up to the plan limit over 7 days. A domain is **promoted** to the
  `trusted` pool automatically after 14 days active with at least 500 messages sent, hard bounces under
  2 %, no hold, and no complaint above the threshold; it is **demoted** back to `probation` on any hold, a
  blocklist listing of a `trusted` address, or a complaint spike. Promotion and demotion change only the
  outbound route the domain uses (a driver call); DNS is unaffected. `mail.server.write` can pin a domain
  to a pool. If only the `probation` pool is configured, everything sends from it and promotion is off.
  A blocklisted address is taken out of its pool's rotation and alarmed, so one listed address does not
  stop sending.
- **Per-mailbox limits** (plan, §2.13): messages per day, recipients per message (default 50),
  recipients per hour.
- **Automatic hold.** A mailbox is held when its hard-bounce rate exceeds 10 % over 100+ messages in 24
  h, or when it reaches 3× its daily limit attempts. A held mailbox keeps receiving and signing in but
  cannot send. The account gets a notification; `mail.server.write` sees it under *Abuse* and can
  release it or suspend.
- **Suspension** is manual (`mail.server.write`) or automatic from the same signals plus a blocklist
  listing of the sending IP. It is visible to the account with the reason.
- **Feedback.** `abuse@` and `postmaster@` always reach the admin mailbox; the platform also logs
  complaint reports delivered to `dmarc@<mail zone>` into the domain's counters (aggregate counts
  only).
- **Content.** The mail server's spam filter runs on inbound and outbound mail. The platform stores no
  message content, subjects or recipient lists; only counts.

Numbers are proposals (open decision 4, §2.16).

## 2.9 Client setup

Each mailbox page and the webmail help show the same panel: IMAP server, port 993 (TLS), SMTP
submission 465 (TLS) or 587 (STARTTLS), username = full address, plus links to platform-specific
steps. `autoconfig` / `autodiscover` and SRV records (§2.5) make Thunderbird, Outlook and Apple Mail
find the settings. Per domain, *External clients* (IMAP/SMTP) can be switched off; webmail still works.
User-visible app passwords for third-party clients are post-v1 (the driver already supports them for webmail sessions).

## 2.10 The webmail agent port

webmail (Part 3) is a separate service, so it reaches the platform through a small, narrow API, not
through the admin screens. It authenticates with a platform **service account API key** with the
permission `mail.webmail.agent`, which grants only the calls below.

| Method & path | Purpose |
|---|---|
| `GET /v1/webmail/domains/:domain` | Public-safe branding and settings for a mail domain (§3.4); `404` for a domain that is not an active mail domain. Cached by webmail for 60 s. |
| `GET /v1/webmail/hosts/:host` | The same, looked up by the webmail hostname (custom hostnames, post-v1). |
| `POST /v1/webmail/invites/redeem` | `{ token, password }` → sets the mailbox password; single use. |
| `POST /v1/webmail/sessions` | `{ email, password, ip, userAgent }` → the platform verifies the password through the driver and creates a **session credential** (an app password named for the session, expiring with it); returns `{ id, credential, expiresAt }`. The real password is not kept. Rate-limited per address and per IP. |
| `DELETE /v1/webmail/sessions/:id` | Revokes that credential (sign-out, or webmail ending a session). |
| `POST /v1/webmail/password` | `{ email, current, next }` → the platform verifies `current` against the mail server through the driver, then sets `next`. Rate-limited per address and per IP; revokes every session credential of the mailbox. |
| `GET /v1/webmail/health` | For webmail's own health page. |

Everything about a mailbox's mail content goes webmail → mail server (JMAP) with the user's own
credentials; the platform is not in that path.

## 2.11 Data model

All tables carry `created_at / updated_at / deleted_at`.

**`mail_servers`** — at most one live row.
`id`, `driver`, `admin_url`, `admin_credential_enc`, `mx_hosts text[]`, `submission_host`, `imap_host`,
`jmap_url`, `spf_zone`, `sending_pools jsonb`, `webmail_url`, `defaults jsonb`, `state`,
`snapshot jsonb` (reputation, queue, cert expiry), `probed_at`, `last_error`.

**`mail_services`** — one per account, created with the first mail domain.
`id`, `account_id` (unique where live), `mail_server_id`, `name`, `state` (`active` / `suspended` /
`disabled`), `held_reason`.

**`mail_usage_daily`** — one row per service per day.
`service_id`, `day`, `stored_bytes` (end of day), `mailboxes`, `sent`, `received`, `bounced`.

**`mail_domains`** (belongs to a service: `service_id`)
`id`, `account_id`, `domain_id` (unique where live), `state`, `dkim_selector`, `dkim_next_selector`,
`dkim_public`, `dkim_rotated_at`, `dmarc_policy` (`none` / `quarantine` / `reject`), `external_clients`
bool, `catch_all_alias_id`, `admin_mailbox_id`, `records jsonb` (expected set and last check result),
`verified_at`, `sending_enabled`, `warmup_started_at`, `pool` (`probation` / `trusted`), `pool_pinned` bool,
`pool_changed_at`, `held_reason`, `stats jsonb`, `last_error`.

**`mailboxes`**
`id`, `mail_domain_id`, `local_part` (unique per domain where live), `display_name`, `state`,
`quota_bytes`, `used_bytes` (snapshot), `last_login_at` (snapshot), `held_reason`, `delete_after`.

**`mail_aliases`**
`id`, `mail_domain_id`, `local_part` (unique per domain, shared namespace with mailboxes),
`target_mailbox_ids uuid[]`.

**`mail_invites`**
`id`, `mailbox_id`, `token_hash`, `expires_at`, `redeemed_at`.

**`mail_domain_branding`** (1:1 with `mail_domains`)
`display_name`, `logo_file_id`, `theme`, `accent`, `login_title`, `login_message`, `support_email`,
`support_url`, `footer_links jsonb`, `default_locale`, `updated_by`.

DNS rows the platform writes are ordinary `domain_records` marked `managed_by = 'mail'`.

**Seed.** Permission keys `mail.server.read|write`, `mail.read|write`, `mail.admin`,
`mail.webmail.agent`; `role_limits` (§2.13); a `mail` health component.

## 2.12 API and the driver

Routers `mailServerRouter` (owner), `mailRouter` (user), `webmailAgentRouter` (`/v1/webmail/*`),
contracts in `api/src/contracts/mail.ts`. Access model: **owned** by the domain's account; foreign ids
answer `404`.

| Method & path | Gate | Purpose |
|---|---|---|
| `GET/PUT/DELETE /api/mail/server` · `POST …/test` · `POST …/{probe,reconcile}` | `mail.server.*` | connection |
| `GET /api/mail/server/{queue,reputation,domains,abuse}` | `mail.server.read` | snapshots |
| `POST /api/mail/server/{domains,mailboxes}/:id/{suspend,release}` | `mail.server.write` | abuse actions |
| `GET/POST /api/mail/domains` · `GET/PATCH/DELETE …/:id` | `mail.read` / `write` | mail domains |
| `POST /api/mail/domains/:id/{verify,rotate-dkim}` | `mail.write` | actions |
| `GET/POST/PATCH/DELETE /api/mail/domains/:id/mailboxes[/:mid]` · `POST …/:mid/{reset-password,invite,suspend}` | `mail.write` | mailboxes |
| `GET/POST/PATCH/DELETE /api/mail/domains/:id/aliases[/:aid]` | `mail.write` | aliases |
| `GET/PUT /api/mail/domains/:id/branding` | `mail.write` | webmail personalisation |

The driver interface, so the server can change without touching services:

```
MailServerDriver {
  probe(): Health
  ensureDomain(name, opts): { dkimPublic }        deleteDomain(name)
  rotateDkim(name): { selector, dkimPublic }      switchDkim(name, selector)
  createMailbox(addr, {password, quota, name})    updateMailbox(addr, patch)   deleteMailbox(addr)
  setAliases(domain, aliases[])                   setCatchAll(domain, target|null)
  verifyCredentials(addr, password): boolean
  setOutboundPool(domain, pool)                   createSessionCredential(addr, label, ttl): secret
  revokeSessionCredential(addr, id)               revokeAllSessionCredentials(addr)
  usage(domain): MailboxUsage[]                   queue(domain?): QueueStats
  setLimits(scope, {perDay, perHour, rcptPerMessage}) hold(addr, bool) / suspend(domain|addr, bool)
}
```

Integration operations: `MAIL_PROBE`, `MAIL_RECONCILE`, `MAIL_DOMAIN_ENSURE`, `MAIL_DOMAIN_REMOVE`,
`MAIL_DKIM_ROTATE`, `MAIL_MAILBOX_UPSERT`, `MAIL_MAILBOX_REMOVE`, `MAIL_ALIAS_APPLY`,
`MAIL_LIMITS_APPLY`, `MAIL_USAGE_SYNC`, `MAIL_VERIFY_DNS`, `MAIL_SESSION_SWEEP`, `MAIL_POOL_EVALUATE`, `MAIL_USAGE_ROLLUP`. Error causes: `mail_server_unreachable`,
`mail_server_unauthorized`, `mail_server_unsupported`, `mail_server_in_use`, `mail_domain_not_active`,
`mail_domain_pending`, `mail_address_taken`, `mail_address_reserved`, `mail_quota_exceeded`,
`mail_password_weak`, `mail_sending_paused`.

## 2.13 Quotas and plans

| `role_limits` resource | Meaning | member_plus | pro | maintainer |
|---|---|---|---|---|
| `mail_domains` | mail-enabled domains per account | 1 | 5 | unlimited |
| `mailboxes` | mailboxes per account | 5 | 50 | unlimited |
| `mailbox_bytes` | storage per mailbox | 2 GB | 10 GB | 50 GB |
| `mail_aliases` | aliases per account | 20 | 200 | unlimited |
| `mail_sends_per_day` | per mailbox | 200 | 1000 | 3000 |
| `mail_recipients_per_message` | per message | 50 | 100 | 200 |

These are **safety caps**, not what the customer pays for: billing is by usage (below). At a cap the
create button is disabled with the quota copy; changes are re-applied to the server on a plan change
(`MAIL_LIMITS_APPLY`).

### Usage metering

`MAIL_USAGE_SYNC` (every 15 minutes) already reads each mailbox's size. A daily job (`MAIL_USAGE_ROLLUP`)
writes `mail_usage_daily` for every service. The billable meters are:

| Meter | Measured as |
|---|---|
| Storage | average stored GB over the billing period (from the daily end-of-day sizes) |
| Mailboxes | mailbox-days |
| Outgoing mail | messages sent, in thousands |

Received mail has no meter; it is covered by storage. The rollup is published to the platform's existing
usage-billing mechanism under the product name `mail`; how invoices price the meters is a billing
decision, not part of this spec. The user sees the same numbers on the service header and a month
history.

## 2.14 Requirements on the mail server

A driver must provide all of these; the list is the acceptance checklist for a new driver. (The Stalwart
column states the intent and must be **verified against the pinned version before building**; this
document does not assume a particular endpoint.)

| Need | Why |
|---|---|
| Multi-domain, multi-account, per-account quota | core |
| Management API for domains, accounts, aliases, catch-all | the driver |
| DKIM signing per domain with selector control | §2.5 |
| JMAP (RFC 8620/8621) and IMAP over TLS, SMTP submission with auth | webmail and clients |
| Credential check without side effects | password change, §2.10 |
| Per-domain choice of outbound IP / route (several sending pools) | §2.8 |
| Revocable per-session credentials (app passwords) with expiry | webmail login, §3.3 |
| Per-account send limits and a hold flag | §2.8 |
| Spam and virus filtering inbound, outbound rate controls | §2.8 |
| Queue and delivery statistics, per domain | §2.4 |
| TLS with automatic certificates; MTA-STS and TLS-RPT optional | deliverability |
| Delivered-mail data on a volume the owner backs up | operations |

Operations the owner owns (documented in the graph, not built here): the server's own TLS certificates,
PTR records for its IPs, the SPF zone, **nightly backups of mail storage and restoring a whole server or
one mailbox on request**, upgrades.

## 2.15 Out of scope (v1)

Calendars, contacts sync (CardDAV/CalDAV), mailing lists beyond internal aliases, external forwarding,
catch-all routing to external addresses, per-user 2FA (webmail v1 too), S/MIME and PGP, shared
mailboxes and delegation, retention and legal hold, message-level audit or search by the platform,
multiple mail servers, mail for domains the platform does not manage, and billing per message.

## 2.16 Build order and open decisions

Build order:

1. Contracts, schema, seed; `MailServerService` with the driver, *Test connection*, probe; owner tab.
2. Mail domains: enable, DKIM, record set, managed-zone writes, verification loop and states.
3. Mailboxes and aliases with the password and invite flows; usage sync.
4. Sending policy, warm-up, limits and the abuse tab.
5. `webmailAgentRouter` and branding (Part 3 can start in parallel from here).
6. DKIM rotation, DMARC policy step-up, demo dataset, authz sweep, graph area.

Open decisions:

1. **Stalwart, API only** — decided. Still to do before building: check the AGPL fit with how you ship
   it, and verify the management API, app passwords, per-domain outbound routing and quotas against the
   version you pin (§2.14).
2. **Eligible domains**: external domains too (default here) or managed only? External is more useful
   but depends on the user editing DNS correctly.
3. **Invite email** is sent through the platform's *Email delivery* provider to an outside address;
   confirm that is acceptable (the alternative is show-once passwords only).
4. **Sending numbers** in §2.8 and §2.13.
4a. **Billing alignment** — confirm with the existing usage-billing code which meters and units it takes
    (§2.13). Note the difference with Storage: Storage bills the **reserved** size, Mail bills **usage**.
    Decide whether both should follow one rule.
5. **Reserved local parts** list.

---

# Part 3 — webmail

## 3.1 What it is

`toolcase/webmail/` is a new project in the toolcase repo, beside binvault, zonewright and nginxpilot:
a **web mail client** for mailboxes hosted by the Mail app. A mailbox owner opens it, signs in with
their full address and password, and gets a mail client that looks like it belongs to *their*
organisation. It is developed and released on its own; the platform only needs its URL and a service
key (§2.10).

It is a product in its own right, so it follows toolcase conventions: one static Go binary or
container, environment-only configuration, one data directory, `run` / `validate` / `healthcheck` /
`version` subcommands (as binvault §2.1), distroless non-root image `ghcr.io/kalevski/toolcase/webmail`,
a systemd unit in `packaging/`.

### Principles

1. **JMAP, not IMAP, in the browser.** The client speaks JMAP (RFC 8620/8621) to the mail server through
   the webmail server, which only adds authentication.
2. **The browser never holds a mail credential.** It holds an opaque, httpOnly session cookie.
3. **Personal by default.** Branding comes from the mailbox's domain, preferences from the mailbox.
4. **Mobile first.** Phone layout is the primary layout (touch targets ≥ 44 px, `100dvh`, no hover
   dependence); desktop adds panes.
5. **Hostile mail is the default assumption.** Every message body is untrusted HTML (§3.7).
6. **Small surface.** Mail only in v1: no calendar, contacts, chat or office suite.

## 3.2 Architecture

```
browser (SPA)
   │  HTTPS, cookie session
   ▼
webmail server (Go)  ──── JMAP over HTTPS, Basic auth with the user's own credentials ───►  mail server
   │   serves the SPA, sessions, sanitising, JMAP gateway
   │
   └── HTTPS + service key ───►  webapp.mk /v1/webmail/*   (branding, password change, invites)
```

| Piece | Choice | Why |
|---|---|---|
| Server | Go, one binary with the SPA embedded (`embed`) | Same shape as the other toolcase daemons; no Node at runtime |
| SPA | React 19 + `@toolcase/web-components` (`tc-*`) + a thin in-house JMAP client | Reuses the toolcase design system and its themes; no mail library to audit |
| State | SQLite (pure Go, as in binvault) on a data volume: sessions, preferences, rate-limit counters | Revocable server-side sessions; no external database |
| Instances | **One instance** in v1 | SQLite sessions; scaling out needs a shared store (post-v1) |
| Upstream | `WEBMAIL_JMAP_URL` (internal URL of the mail server) | The browser cannot reach the mail server directly, so its CORS is never opened |
| Platform | A service key to `/v1/webmail/*` | Branding and password change need the platform |

## 3.3 Login and sessions

- **Where.** `https://webmail.<platform domain>/` shows a login screen with one field first: the email
  address. As the address is typed, the SPA asks `GET /api/branding?domain=` (unauthenticated,
  cached, rate-limited, returns only public-safe branding) and restyles the page with that domain's
  name, logo, colours and message. Unknown domains get the neutral platform skin and no error (the page
  does not reveal which domains exist beyond what public MX records already do).
- **Sign in.** `POST /api/login {email, password, remember}`. The server forwards the pair to the
  platform (`POST /v1/webmail/sessions`, §2.10), which checks it and returns a **session credential**: a
  temporary password just for this session. The server discards the real password, opens a JMAP session
  with the session credential and keeps the JMAP session document. On failure: `401 invalid_credentials`, the same text for unknown address and wrong
  password, with a constant-time delay.
- **Session.** An opaque random id in a `__Host-` cookie (`Secure`, `HttpOnly`, `SameSite=Lax`, path
  `/`). The record in SQLite holds the address, creation and last-use times, IP and user agent, and the
  **session credential** sealed (AES-256-GCM under `WEBMAIL_SESSION_KEY`) so the server can authenticate
  upstream calls. It is useless after the session ends and never equals the user's password. Idle expiry 12 h (30 days with *Remember me*), absolute expiry 30 days. A sign-out
  deletes the record and revokes the credential through the platform. The user sees and can end other sessions in Settings.
- **Revocation.** A password change (in webmail or by an admin) makes the platform revoke every session
  credential of the mailbox, so each session's next upstream call is `401` and it ends. Expired
  credentials are swept by the platform (`MAIL_SESSION_SWEEP`, hourly). At most 20 live session
  credentials per mailbox; the oldest is revoked first.
- **Availability.** Sign-in needs the platform to be reachable; sessions already open keep working
  through a platform outage.
- **CSRF.** Mutating requests need `X-Webmail-CSRF` with a per-session token delivered in the session
  document, plus an `Origin` check.
- **Brute force.** Failed logins are limited per IP (default 20 / 15 min) and per address (10 / 15
  min), with exponential delay; limits live in SQLite; `X-Forwarded-For` is honoured only from
  `WEBMAIL_TRUSTED_PROXIES`. Counts, not secrets, are logged.
- **No 2FA in v1**; the login handler is written so a second step can be added (post-v1).

Trade-off recorded: signing in depends on the platform and on the driver supporting revocable
session credentials. In return the real password never rests in webmail, and every session can be
revoked at the mail server. OAuth2 tokens from the mail server are the cleaner long-term form (§3.12).

## 3.4 Personalisation

Two layers:

**Per domain (set by the domain admin in the platform, `mail_domain_branding`, §2.11):**

| Setting | Effect |
|---|---|
| Display name, logo | login page, header, browser title |
| Theme and accent | one of the bundled `tc-*` themes (the same list the apps use, `THEME_NAMES`) plus an accent colour, applied through `data-tc-theme` and CSS variables; contrast is validated by the platform before saving |
| Login title and message | text under the form (plain text, 280 chars) |
| Support email and URL, footer links | footer and help menu |
| Default language | the initial locale |

Branding is fetched from the platform, cached 60 s, and served to the SPA as data (never raw CSS or
HTML from the admin), so a domain admin cannot inject script.

**Per mailbox (set by the user in Settings):**

| Setting | Stored |
|---|---|
| Display name and signature (plain/simple HTML) | in the JMAP `Identity` objects on the mail server |
| Language, theme (light / dark / system), density, reading-pane layout, remote-image policy | SQLite `prefs(address, json)` |
| Vacation auto-reply | JMAP `VacationResponse` |
| Send-as identities | JMAP `Identity` (the server decides which addresses are allowed) |
| Password | via the platform (§2.10) |
| Active sessions | SQLite |

A mailbox's own theme overrides the domain's *mode* (dark/light) but not its brand accent unless the
admin allows it.

## 3.5 Features (v1)

- **Folders** — Inbox, Drafts, Sent, Junk, Trash, Archive and user folders (JMAP `Mailbox`); create,
  rename, delete, unread counts.
- **List** — conversations (JMAP threads), unread/starred filters, select + bulk actions (archive,
  delete, mark, move, mark as junk), infinite scroll with JMAP `position` + `limit`, swipe actions on
  touch.
- **Read** — sanitised HTML or plain text, inline images (cid), attachments list, sender details and
  authentication result (shown when the mail server reports SPF/DKIM/DMARC failure), *Reply*, *Reply
  all*, *Forward*, *Print*, *View source*, *Report junk*.
- **Compose** — To/Cc/Bcc with autocomplete from addresses the user has sent to or received from;
  subject; plain text and basic rich text (bold, italic, lists, links, quote); attachments (up to the
  server's message size, with progress); drafts auto-saved every 10 s; send with undo (10 s); signature
  and From identity chooser.
- **Search** — JMAP `Email/query` full-text over subject, from, to, body, with folder and date filters.
- **Live update** — JMAP EventSource through the gateway; polling fallback.
- **Settings** — everything in §3.4.
- **Quota bar** — used/quota from JMAP `Quota`.
- **Keyboard** — `c` compose, `j/k`, `e` archive, `#` delete, `r`/`a`/`f`, `/` search, `?` help.
- **Accessibility** — visible focus, ARIA live regions for new mail, `prefers-reduced-motion` honoured.
- **Languages** — English first; strings in catalogues, locale from the domain default or the browser.

Not in v1: contacts book, calendar, filters/rules editor (Sieve), shared mailboxes, labels,
snooze/schedule send, offline mode, push notifications, import/export, POP, S/MIME and PGP, drag and
drop between panes.

## 3.6 The JMAP gateway

The SPA talks JMAP to `https://webmail…/api/jmap` as if it were the mail server; the gateway rewrites it.

| Path | Behaviour |
|---|---|
| `GET /api/session` | Returns the JMAP session document with URLs rewritten to the gateway, plus CSRF token, branding and prefs |
| `POST /api/jmap` | Authenticates upstream from the session, forces `accountId` to the user's own account, **allow-lists** capabilities (`core`, `mail`, `submission`, `vacationresponse`, `quota`) and methods, rejects everything else with `403`, limits body to 1 MiB and calls per request to 32 |
| `GET /api/download/:accountId/:blobId/:name` | Streams a blob; always `Content-Disposition: attachment` for non-image types; `X-Content-Type-Options: nosniff` |
| `POST /api/upload/:accountId` | Streams an upload, size-limited to `WEBMAIL_MAX_UPLOAD_MB` |
| `GET /api/eventsource` | Proxies JMAP push as SSE |
| `GET /api/message-html/:emailId` | Server-sanitised HTML of one body part (§3.7) |
| `POST /api/login`, `/api/logout`, `/api/password`, `/api/sessions` | Auth and self-service |

All upstream calls use timeouts, never log bodies, and carry `X-Forwarded-For` of the real client so
the mail server's own login rate limit sees the user's address, not the gateway's.

## 3.7 Rendering untrusted mail

1. **Sanitise on the server.** HTML bodies go through a strict allow-list policy: no `script`,
   `iframe`, `object`, `embed`, `form`, `link`, `meta`, `base`, event handlers or `javascript:` URLs;
   CSS reduced to a safe property subset, no `@import`, no `url()` to remote hosts.
2. **Remote content is blocked.** External images, fonts and tracking pixels are not requested; a
   banner offers *Load images* per message or *Always for this sender* (stored in `prefs`). There is no
   image proxy in v1.
3. **Isolated rendering.** The sanitised body is shown in a `sandbox` iframe (no `allow-scripts`, no
   `allow-same-origin`) with `srcdoc` and a restrictive CSP, so even a sanitiser bug cannot reach the
   app's cookies or DOM.
4. **Links.** Open with `target=_blank rel="noopener noreferrer"`; when the visible text is a different
   host than the target, show a confirm sheet with the real destination.
5. **Attachments.** Downloaded, never rendered inline on the app origin (images are inlined only as
   `blob:` URLs created from fetched data with a checked media type).
6. **Plain-text** messages are escaped and auto-linked locally.
7. **Strict headers on every response**: CSP (`default-src 'self'`, `frame-ancestors 'none'`),
   `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, HSTS when behind TLS.

## 3.8 Configuration

Environment-only; unknown `WEBMAIL_*` variables warn; secrets also accept a `_FILE` form.

| Variable | Default | Meaning |
|---|---|---|
| `WEBMAIL_LISTEN` | `:8080` | HTTP bind (TLS terminated by a proxy) |
| `WEBMAIL_PUBLIC_URL` | — **required** | External URL; used for cookies, `Origin` checks and links |
| `WEBMAIL_JMAP_URL` | — **required** | Internal base URL of the mail server's JMAP |
| `WEBMAIL_PLATFORM_URL` | — **required** | webapp.mk API base URL |
| `WEBMAIL_PLATFORM_TOKEN` | — **required** | Service key with `mail.webmail.agent` |
| `WEBMAIL_SESSION_KEY` | — **required** | Base64 of 32 random bytes; seals session credentials. Back it up or users must sign in again after a restore |
| `WEBMAIL_DATA_DIR` | `/var/lib/webmail` | SQLite and nothing else |
| `WEBMAIL_SESSION_IDLE` / `WEBMAIL_SESSION_MAX` | `12h` / `720h` | Session lifetimes |
| `WEBMAIL_MAX_UPLOAD_MB` | `25` | Must not exceed the server's message size |
| `WEBMAIL_LOGIN_FAIL_LIMIT` | `20` | Failed logins per IP per 15 min |
| `WEBMAIL_TRUSTED_PROXIES` | — | CIDRs whose `X-Forwarded-For` is trusted |
| `WEBMAIL_BRANDING_TTL` | `60s` | Cache time for platform branding |
| `WEBMAIL_LOG_FORMAT` / `WEBMAIL_LOG_LEVEL` | `logfmt` / `info` | As binvault |

Subcommands: `webmail run` (default), `webmail validate` (config, data dir writable, JMAP and platform
reachable, key length), `webmail healthcheck`, `webmail version`.

## 3.9 Routing

| Path | Purpose |
|---|---|
| `/` and any non-API path | the SPA (`index.html` fallback) |
| `/api/**` | §3.6 |
| `/_healthz` | liveness/readiness, no auth |
| `/_version` | build info |
| `/_metrics` | Prometheus text, on a separate listener `WEBMAIL_ADMIN_LISTEN` (loopback by default) |

Custom hostnames (`mail.customer.com` CNAME → webmail host) are **post-v1**: the server would look the
`Host` up through `/v1/webmail/hosts/:host`, and the platform would need certificate issuance for it
(`certificates.md`). Until then every domain uses the central host and the branding follows the address.

## 3.10 Repository layout and delivery

```
toolcase/webmail/
  cmd/webmail/            main, subcommands
  internal/
    config/  server/  session/  gateway/  jmap/  sanitize/
    platform/ (agent client)  store/ (SQLite)  ratelimit/  web/ (embedded SPA assets)
  web/                    the SPA (React 19, tc-* components), built into internal/web/dist
  docker/  Dockerfile  packaging/webmail.service
  README.md
```

The SPA is a workspace of the toolcase repo only for building; the shipped artifact is the Go binary.
It consumes `@toolcase/web-components` through the workspace and its theme list, so a new bundled theme
becomes available to webmail by adding the name to the platform's branding list (the lists are
hardcoded per app, `app-theme-option-lists`).

## 3.11 Testing

- **Unit** — sanitiser (a corpus of hostile HTML including known XSS vectors and tracking pixels),
  session sealing, CSRF, rate limiting, JMAP allow-list, branding cache.
- **Contract** — a fake JMAP server and a fake platform; golden requests for every gateway route.
- **End to end** — a container with the real mail server and a seeded mailbox: sign in, list, read,
  compose, send to a second mailbox, attachments, password change, session revocation.
- **Browser** — mobile and desktop viewports, keyboard-only pass, reduced motion, dark theme.
- **Security** — sandboxed iframe cannot read `document.cookie`; every response carries the headers of
  §3.7; unauthenticated calls to every `/api/**` route except the public ones answer `401`.

## 3.12 Open decisions

1. **Session credentials vs OAuth2 tokens** (§3.3). Decided: session credentials in v1, OAuth next.
2. **Go + embedded SPA** vs a Node server like the platform. Recommendation: Go, for deployment parity
   with the other toolcase daemons.
3. **Central host only** in v1, custom hostnames later. Recommendation: yes.
4. **Rich-text compose**: build a small in-house editor or ship plain text first. Recommendation: plain
   text plus the minimal formatting listed, no third-party editor.
5. **Image proxy** (so remote images can load without leaking the reader's IP): post-v1.
6. **Contacts**: address autocomplete from history only in v1, a real address book after.

## 3.13 Build order

1. Skeleton: config, `run/validate/healthcheck`, SQLite, headers, SPA shell.
2. Login, sessions, rate limits, platform client for branding (fake platform first).
3. JMAP gateway with the allow-list; folders and message list.
4. Read view with the sanitiser and sandbox; attachments.
5. Compose, drafts, send, search, live updates.
6. Settings, vacation, identities, password change, invite redemption.
7. Branding polish, accessibility pass, mobile pass, packaging, docs and the release workflow.

---

## Cross-cutting: how the three fit together

| Event | Platform | Mail server | webmail |
|---|---|---|---|
| Owner connects servers | stores connection rows | — | — |
| User enables mail on `acme.com` | creates `mail_domains`, DKIM, writes/shows DNS | domain + DKIM key created | — |
| User creates `anna@acme.com` | row + `MAIL_MAILBOX_UPSERT` (password sent, discarded) | account created | — |
| Anna opens webmail | serves branding (`/v1/webmail/domains/acme.com`) | verifies her Basic credentials, serves JMAP | creates session, gateway |
| Anna changes password | `/v1/webmail/password` verifies the old one, sets the new | credential updated | revokes her other sessions |
| Mail sent/received | counts only (usage sync) | SMTP, DKIM, spam, storage | reads/sends over JMAP |
| Domain loses `active` | mail → `suspended`, notifies | inbound deferred, sending paused | login shows a notice |

## Overall build order

Storage and Mail do not depend on each other. Suggested sequence: **Storage** first (smallest, backend
already specified; also unblocks nginxpilot streaming work that Mail does not need), then **Mail
platform side** (Part 2, steps 1–4), then **webmail** (Part 3) in parallel with Part 2 steps 5–6.
