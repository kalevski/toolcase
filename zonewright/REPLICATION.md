# zonewright replication — design

Status: **implemented** (decisions in §14, implementation notes in §15) · Scope: multi-server zonewright with built-in, self-synchronizing state

## 1. In plain words

You run zonewright on two (or more) servers in different places. You can send an API call to **either** server. Within a few seconds, the other server has the same change. Both servers answer DNS with the same records, and both show the same zone version (serial).

How:

- Every change is written down as a small **delta** ("set `www` A to 1.2.3.4", "delete `api` TXT") in a **SQLite** database on the server that received it.
- Every few seconds each server **asks the others for the deltas it hasn't seen yet** and applies them. Applying a delta twice does nothing, so retries are safe.
- You give **every server the same list of URLs** (all servers, itself included). Each server generates its own **unique ID** the first time it starts, finds out which URL is itself by asking every URL "who are you?", and syncs with all the others.
- The servers prove who they are to each other with a **shared cluster key**, over **HTTPS**.
- If a server is offline or the link breaks, **everything keeps working**. The servers catch up with each other when they can talk again.
- If the same thing is changed on both servers at the same moment, **the later change wins**. Every server applies the same rule, so they always end up agreeing.

What it deliberately is *not*: a system where both servers must agree before a change is accepted (see §3, "Why not consensus").

```
          API write (either server)                 API write
                    │                                   │
            ┌───────▼────────┐    pull deltas    ┌──────▼─────────┐
            │  zonewright A  │◄─────────────────►│  zonewright B  │
            │  SQLite:       │   TLS + cluster   │  SQLite:       │
            │   ops log      │        key        │   ops log      │
            │   state        │                   │   state        │
            └───────┬────────┘                   └──────┬─────────┘
          render + named-checkzone             render + named-checkzone
            ┌───────▼────────┐                   ┌──────▼─────────┐
            │    named A     │                   │    named B     │
            └────────────────┘                   └────────────────┘
          ns1.example.com :53                  ns2.example.com :53
```

## 2. Goals and non-goals

**Goals**

1. Any node accepts writes, including while other nodes are unreachable (availability first — DNS must never stop answering, and should keep accepting changes).
2. All nodes **converge** to identical zone content *and identical SOA serials* once they have exchanged all deltas, whatever order the deltas arrived in.
3. No separate sync process; no external database; one extra SQLite file per node.
4. Works with 2 nodes today; the same protocol works for 3+.
5. Same public API as today (plus a few additions, §9). Existing single-node installs keep working and migrate automatically.

**Non-goals**

- Instant, simultaneous visibility on all nodes (normal lag: one pull interval, ~5 s; zero for callers using `?wait=replicated`, §9).
- Multi-tenant permissions. Every node and every API token is fully trusted.
- DNSSEC and zone-transfer-based replication. Both are orthogonal and can come later.
- Replicating zones written by hand in config files. Those stay **local** to the node (§10).

## 3. Why not consensus (Raft) or BIND's own primary/secondary?

| Option | Why not |
|---|---|
| Raft / consensus | A change needs a majority of nodes. With 2 nodes, the majority is 2, so if one node is down or the link breaks, **no writes are possible anywhere**. That is the opposite of what a nameserver pair is for. |
| BIND primary → secondary (AXFR) | Only the primary accepts changes. If the primary's location is down, you cannot change DNS until it is back. Also still one-directional. |
| External DB (Postgres, etc.) | A third moving part, which itself needs replication across locations. |
| **Delta log + last-writer-wins (chosen)** | Each node works alone when it must, and the nodes merge deterministically when they reconnect. The cost is the conflict rules in §6, which DNS tolerates well. |

## 4. Data model

The replicated state is small and regular. The unit that conflicts are resolved on is the **RRset**: all records of one *(zone, name, type)*. This matches how DNS itself treats records (one TTL per RRset), and matches the API's `PUT /zones/{zone}/records/{name}/{type}`.

```
zone        — exists? + generation        (one register per zone)
settings    — ttl, soa, nameservers,       (one register per zone, per generation)
              allow_transfer, also_notify
rrset       — records[] or "deleted"       (one register per zone+name+type, per generation)
token       — {hash, scope, zones} or      (one register per token name; no zone, no generation)
              "deleted"
```

Tokens created over the API (`POST /tokens`) are registers too, keyed by name, holding only the SHA-256 of the secret. Their ops carry no zone, so they never bump a serial and never trigger a BIND apply. They are re-validated like any other op, travel in snapshots, and their tombstones are compacted like RRset tombstones.

Each **register** holds a value plus the identity of the delta that last wrote it: `(hlc, origin)` (§5). The **visible zone** is:

> the zone register says "exists", plus its current-generation settings, plus every current-generation RRset that is not deleted.

**Generation** solves "delete zone on A, add a record on B at the same time". Creating a zone mints a new generation, the ID of the create delta. Settings and RRset deltas carry the generation they were written under, and are only visible while it is still the zone's current generation. So a record written into a zone that was concurrently deleted stays invisible, and recreating the zone later starts clean instead of resurrecting old records.

Record-level API calls (`POST …/records`, `DELETE …/records/{name}/{type}?value=`) are turned into a **whole-RRset delta** on the node that receives them: read the current RRset, modify it, emit the full new RRset.

> **Decided (§14.1):** two *simultaneous* `POST`s that add different values to the *same* RRset on different nodes lose one addition (the later write wins). That is accepted: one person manages each domain, so this only happens in practice when the same change is resent, and it looks like a failed save. The more complex per-record merge (OR-Set CRDT) is not built.

## 5. Deltas (the op log)

```sql
CREATE TABLE ops (
  origin     TEXT    NOT NULL,   -- node id (generated, §8.1) that created the delta
  seq        INTEGER NOT NULL,   -- 1,2,3… per origin, no gaps
  hlc        INTEGER NOT NULL,   -- hybrid logical clock timestamp
  kind       TEXT    NOT NULL,   -- zone_create | zone_delete | settings | rrset
  zone       TEXT    NOT NULL,
  generation TEXT,               -- "origin:seq" of the zone_create it belongs to
  name       TEXT,               -- rrset only
  type       TEXT,               -- rrset only
  payload    BLOB    NOT NULL,   -- canonical JSON (records[], settings, or tombstone)
  PRIMARY KEY (origin, seq)
);
```

- **Identity** `origin:seq` is globally unique and never reused (see §8.4 on restores).
- **Idempotent**: applying an op that is already in the table is a no-op (`INSERT OR IGNORE`).
- **Hybrid logical clock (HLC)**: 48 bits of wall-clock milliseconds + 16 bits of counter. Every op a node creates gets an HLC strictly greater than every HLC that node has seen, from itself or anyone else. This gives a total order that respects cause and effect ("I saw your change, then made mine" always orders mine later), even when the server clocks disagree a little.
- **Winner rule** for each register: the higher `(hlc, origin)` wins, comparing HLC first and node id as a tie-break. It is a pure comparison, so every node picks the same winner regardless of arrival order. **This is the whole convergence guarantee**, and it gets a property-based test (§12).

**Materialized state tables** (`zones`, `settings`, `rrsets`) hold the current winner of each register, so rendering a zone never replays the log.

## 6. Conflicts

| Situation | Outcome |
|---|---|
| Same RRset changed on two nodes concurrently | Later HLC wins on every node. The losing write is logged (one line: op ids, zone, name/type), nothing more. |
| Zone deleted on A, records edited on B | The records belong to the deleted generation, so they stay invisible. The zone stays deleted. |
| Zone deleted on A, re-created on B | Whichever is later wins. If the re-create wins, it's a fresh, empty generation. |
| **Each change valid alone, invalid together.** Example: B adds `shop` CNAME while A adds `shop` A. | **Deterministic repair:** for a CNAME clash at a name, the newest RRset at that name wins and the others are hidden (not deleted — a later fix un-hides them). Reported in `/cluster/status → conflicts`. |
| Merged zone fails anything else (another validation rule, or `named-checkzone`, e.g. an in-zone NS whose A record was concurrently deleted) | Zone goes `stale`: the last good file keeps serving, and the conflict is reported with the checker's output. Fixed by any write that makes it valid. |

**Accepted limitation (§14.5):** in that last row, both nodes hold the *same* merged state and both reject it. But each keeps serving *its own* last good file, and those can differ, so the two nameservers may answer differently until someone fixes the zone. The alarm in `/cluster/status` makes this visible. This was chosen as the faster and cheaper option; automatic repair for more cases can be added rule by rule later if it ever matters.

Local API writes are still validated against the local current state **before** a delta is created, so ordinary mistakes are rejected up front exactly as today. The rules above only matter for simultaneous edits.

## 7. SOA serials — identical on every node

Requirement: once converged, all nodes publish the **same** serial. And whenever a node's visible content changes, its serial must go up (zone-checking tools and any external secondaries rely on this).

**Rule:** `serial = base + applied_ops(zone, generation)`

- `base` is chosen by the node that creates the zone and carried inside the `zone_create` delta, so every node knows it. For migrated zones it is the zone's current serial; for new zones it is today's `YYYYMMDD00`. Serials therefore never move backwards on upgrade.
- `applied_ops` counts the distinct deltas this node has applied for that zone generation. Every change is a delta, so every content change bumps the count. The count only grows. Once the nodes have exchanged all deltas they have applied the same set, so they compute the same number.
- Headroom: 2³²−2026092500 ≈ 2.2 billion changes per zone generation.

During the few seconds before convergence, two nodes can briefly show the same serial for different content. This resolves itself on the next pull. It is harmless for resolvers, which ignore serials.

*Rejected alternative:* "serial = time of latest change". It is identical across nodes, but two changes in the same second, or a late-arriving older delta that still wins its register, would change content without changing the serial.

## 8. Peer protocol

### 8.1 Membership, identity and trust

**Node identity is generated, not configured.** The first time a node starts with an empty database it generates a random **node id** (128-bit, e.g. `n-4f1c9a…`) and stores it in SQLite. Every deployment therefore has a unique id, and the id survives restarts and upgrades because it lives in the database, next to the data. A fresh volume means a new deployment, and so a new id.

**Membership is one shared URL list.** Every node gets the **same** list of URLs, itself included:

```yaml
cluster:
  urls:
    - https://ns1.example.com:9153
    - https://ns2.example.com:9153
```

**Self-discovery.** Each node periodically calls `GET /peer/hello` on every URL. The response carries the answering node's `node_id` plus a random `boot_nonce`, which is regenerated on every process start.
- A URL that answers with **our own id *and* our own boot nonce** is ourselves: it is skipped.
- Every other id is a peer. Two URLs answering with the same id are the same peer under two names, and are de-duplicated.
- A URL that doesn't answer is retried with backoff; the node keeps working with whoever is reachable. If a node can't reach its own URL (e.g. NAT without hairpinning), nothing breaks: it simply never sees itself, and every id that does answer is a real peer.
- **Replaced deployment.** A URL that used to answer with id X and now answers with id Y means that server was redeployed. X is marked **retired**: its ops are kept and still replicate, but X no longer holds back compaction (§11). No manual cleanup is needed.
- **Cloned data dir.** A URL answering with **our id but a different boot nonce** means someone copied our database to another server. Two nodes writing under one id would corrupt the log, so sync with that URL is refused and `/cluster/status` alarms: "clone detected — remove its data dir so it generates a new id".

**Trust.**
- **Shared cluster key** (≥ 32 random bytes, `cluster.key_file`, identical on every node), sent as a bearer token on every peer request, `hello` included, and compared in constant time. `key_files: [new, old]` accepts both during rotation. The key is what makes a peer a peer: URLs and ids only *locate* nodes, they don't grant anything.
- **Transport is configurable, HTTPS by default:**
  - `https://` URLs are verified against the system CA roots (Let's Encrypt etc. just work), or against `cluster.ca_file` / a pinned `fingerprint` for self-signed certificates.
  - The peer listener either serves TLS itself (`cluster.tls.cert_file`/`key_file`), **or** listens in plain HTTP on loopback behind a TLS proxy (e.g. nginxpilot) that owns the public certificate.
  - `http://` peer URLs and a non-loopback plain-HTTP listener are refused unless `cluster.allow_insecure_http: true` is set. That flag is meant for a private network or VPN, and logs a warning on every start, because over plain HTTP the cluster key travels readable.

### 8.2 Pull loop

Each node keeps a **version vector**: for every origin, the highest `seq` it has applied.

```
GET /peer/ops?since=n-4f1c9a:120,n-b27e01:87&limit=1000
→ 200 { "ops": [...], "more": false, "vv": {...}, "hlc": 1727... }
```

- A node returns ops from **every** origin it knows, not only its own, so 3+ node clusters relay changes transitively.
- Every `cluster.pull_interval` (default 5 s), each node pulls from each peer. It then applies the batch in one SQLite transaction, re-renders only the zones touched, and runs the existing check → swap → `rndc reload` engine.
- **Nudge:** after a local write, a node sends `POST /peer/notify` (no body) to its peers, and they pull immediately. Replication is typically sub-second; the timer is only the fallback.

### 8.3 Snapshot (bootstrap and long outages)

`GET /peer/snapshot` returns the full materialized state, with each register's winning `(hlc, origin)`, plus the version vector and serial counters. It is used when:
- a new node joins, or
- a peer asks for ops that were already compacted away (§11).

A snapshot is **merged**, not swapped in: each register goes through the same winner rule. So local changes the other side hasn't seen yet survive.

### 8.4 Safety checks on received data

- Every received op is **re-validated** (names normalized, record rules) exactly like an API write. A buggy or compromised peer cannot inject zone-file syntax, same guarantee as §"Security model" in the README.
- Size limits: max ops per batch, max payload per op.
- **Clock guard:** an op whose HLC is more than `cluster.max_clock_skew` (default 2 min) in the future is **held, not applied**, and raises an alarm. Otherwise one node with a broken clock would "win" every conflict for as long as its clock stayed ahead. NTP on every node is a documented requirement.
- **Restore from backup** (same id, older data): before accepting local writes, a node asks its peers for the highest `seq` they have from *its* origin. If a peer knows more than the local log does (the node was restored from an old backup), it pulls its own lost ops back first, so it can never reuse a sequence number. If no peer answers within `cluster.startup_fence` (default 30 s), writes open anyway with a warning, so a single surviving node is never locked out.

## 9. API changes

The existing endpoints stay. Writes now create deltas instead of rewriting YAML files. Additions:

| Addition | Why |
|---|---|
| `PUT /zones/{zone}` | Idempotent create-or-replace. The node turns it into the minimal set of deltas: changed settings plus changed RRsets. Re-sending identical content creates **no** deltas, so there's no churn. |
| `ETag` on `GET /zones/{zone}` + `If-Match` on every write → `412` on mismatch | Protects any read-modify-write done by a client (a UI, your own scripts). |
| `?wait=replicated[&timeout=10s]` on writes | Responds only once every peer has applied the delta (`200`), or on timeout (`202` + which peers are pending). **Needed for ACME DNS-01**: the certificate authority may ask either nameserver, so the TXT record must be on both first. |
| Write responses include `op` (`"n-4f1c9a:121"`) and `hlc` | Traceability; lets a client wait for or correlate a change. |
| `GET /cluster/status` | This node's id and which URL is itself; per URL: which id answered, reachable?, last successful pull, lag (ops behind), clock skew; retired ids; clone alarms; held ops; `conflicts`. |
| `DELETE /cluster/peers/{id}` | Retire a node whose URL was removed from the list for good (a replaced deployment is retired automatically, §8.1). |

## 10. Configuration

```yaml
data_dir: /var/lib/zonewright          # zonewright.db lives here
admin:
  listen: 127.0.0.1:9053
  token_env: ZONEWRIGHT_TOKEN
  tls: {cert_file: ..., key_file: ...}  # optional: HTTPS for the admin API (planned separately)

cluster:
  key_file: /etc/zonewright/cluster.key   # same file on every node (0600)
  urls:                                   # same list on every node, itself included
    - https://ns1.example.com:9153
    - https://ns2.example.com:9153
  listen: 0.0.0.0:9153                    # peer listener
  tls:                                    # omit when a TLS proxy fronts a loopback listener
    cert_file: /etc/zonewright/peer.crt
    key_file:  /etc/zonewright/peer.key
  # ca_file: /etc/zonewright/peers-ca.pem   # only for self-signed peer certs
  # allow_insecure_http: false              # private network / VPN only
  pull_interval: 5s
  max_clock_skew: 2m
  startup_fence: 30s
  retention: 30d                          # §11
```

- **Adding a server:** deploy it with the updated list, then add its URL to every other node's list and `SIGHUP` them. It bootstraps with a snapshot. **Removing one:** drop its URL everywhere, then `DELETE /cluster/peers/{id}`.
- **No `cluster:` block → single node.** Same SQLite store and same API, just no peers. There is one code path, and the single-node deployment is simply a cluster of one.
- **Replicated vs local zones.** Zones created over the API live in SQLite and replicate. Zones written into `config.yml` or hand-dropped into `zones.d/` stay **local and read-only over the API**, as today. If a local zone and a replicated zone share a name, the local one is served and the conflict is reported.
- **Migration (automatic, first start of the new version):** every API-managed `zones.d/<zone>.yml` is imported as a `zone_create` delta, with `base` = its current serial from `state.json`, then renamed to `<zone>.yml.migrated`. Nothing else changes. On a cluster, migrate each node **before** adding the `cluster:` block. If both nodes had the same zone, the merge picks one version (winner rule) and logs which one lost. For a clean start, migrate one node and let the others bootstrap from it.

## 11. Storage details

- **Driver:** `modernc.org/sqlite`, pure Go, so builds stay `CGO_ENABLED=0` and the Docker image is unchanged. WAL mode, one writer.
- **Compaction:** an op can be deleted from the log once it is older than `retention` **and** every known peer's version vector covers it. The materialized tables keep what matters (the winners, tombstones included).
- **Tombstones** (deleted RRsets and zones) are only purged under the same rule. Purging earlier would let a long-offline node resurrect deleted records. A peer offline for longer than `retention` catches up via snapshot (§8.3). Retired ids (§8.1) don't block compaction. A URL that stays unreachable for longer than `retention` does, and `/cluster/status` warns when that happens. Remove the URL (and retire its id) if that server is gone for good.
- **Backup:** `zonewright backup <file>` does an online, consistent copy (`VACUUM INTO`). Restoring is safe thanks to the startup fence (§8.4).

## 12. Testing plan

1. **Convergence property test:** generate random ops from 2–4 origins (creates, deletes, RRset writes, concurrent same-register writes), apply them in many random orders and with duplicates, and assert identical materialized state and identical serials every time.
2. **HLC tests:** monotonic under wall-clock regression, ordering respects cause and effect, skew guard.
3. **In-process cluster tests:** 2–3 nodes with an in-memory transport, covering partition, concurrent writes, heal and assert-converged; snapshot bootstrap; restore-from-backup fence; self-discovery (self URL, alias URLs, unreachable self URL), redeployed-URL retirement, cloned-data-dir refusal; conflict repair (CNAME clash) and `stale` reporting.
4. **Docker end-to-end:** two containers with real BIND on a Docker network, TLS with generated certs.
   - Write to A, then dig B; write to B, then dig A.
   - `docker network disconnect` to split the servers, write on both sides, reconnect, assert `dig` answers **and** SOA serials match.
   - `?wait=replicated` for the ACME flow.
5. Everything existing (API behaviour, security regression tests) keeps passing.

## 13. Delivery phases

| Phase | Content | Useful on its own? |
|---|---|---|
| 0 | HTTPS for the admin API; `PUT /zones/{zone}`; `ETag`/`If-Match` | Yes: removes today's blocker |
| 1 | SQLite store + ops log + HLC, single node; migration from `zones.d/` | Yes: history of every change |
| 2 | Peer listener, TLS, cluster key, pull loop, nudge, snapshot | **Replication works** |
| 3 | Conflict repair + reporting, `?wait=replicated`, `/cluster/status`, clock guard, startup fence | Production-ready |
| 4 | Compaction, tombstone GC, `backup` command, peer removal | Long-running operation |
| 5 | Docker two-node e2e (partition/heal), README + runbook | Confidence |

## 14. Decisions (2026-09-25)

1. **Conflict unit: RRset-level last-writer-wins.** Losing one of two simultaneous additions is fine; a single person manages each domain, and it looks like a failed save.
2. **Membership: an identical URL list on every server.** HTTPS over the public internet by default, transport configurable. Each deployment generates its own unique id once, finds itself by asking every URL, and syncs with all the others (§8.1).
3. **Config-file zones stay local** and are never replicated (§10).
4. **Retention: 30 days** of op history (§11).
5. **Divergent last-good during an unresolvable conflict is accepted**, with an alarm, as the faster and cheaper option (§6).

## 15. Implementation notes

Built as designed. The points below are where the implementation refines or extends the text above.

- **Packages:** `internal/hlc` (clock), `internal/store` (SQLite log + winner tables, snapshot, compaction), `internal/manager` (effective config, the single write path, migration), `internal/cluster` (discovery, pull loop, peer API, fence, acks), `internal/admin` (API).
- **Write path:** validate → `named-checkzone` pre-check on a scratch file → diff into the minimal deltas → commit → apply → nudge peers. A change BIND would reject is never committed, since a committed delta replicates and cannot be rolled back.
- **Serial:** `base + applied ops for the current generation`, exactly as in §7. The create delta carries `base`. A migrated zone continues from its old serial.
- **Canonical-form check:** a received op must be unchanged by normalization, not merely valid. Normalizing (rewriting) it instead would let two nodes store different content under one op id.
- **Acknowledgements:** a peer's `GET /peer/ops?since=` *is* its ack. After applying a non-empty batch, a puller immediately re-pulls, so the ack for what it just applied arrives without waiting a full interval. `?wait=replicated` returns as soon as every active peer's ack covers the op.
- **Cluster key from the environment** (`key_env`) was added next to `key_file`, because a key file mounted into a container carries the host uid and fails the secret-file ownership check.
- **Admin HTTPS** (phase 0) is `admin.tls`. A non-loopback admin listener requires it, unless `allow_insecure_http` is set.
- **Tested by:** a convergence property test (random 3-node histories × random interleavings, batch splits and duplicates → identical zones and serials); in-process cluster tests over real HTTP (both-way sync, aliases, partition/heal, clone, redeploy retirement, `wait=replicated`, restore fence, snapshot bootstrap, transitive relay, key checks, TLS pinning).
