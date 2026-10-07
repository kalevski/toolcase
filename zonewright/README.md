# zonewright

A small Go daemon that owns a set of authoritative zones for **BIND 9** and lets you manage them — and their records — over an **HTTP API** (or YAML files). Run it on **several servers** and they **synchronize with each other**: write to any of them and every server serves the same records with the same serial — your own `ns1`/`ns2` nameservers. Sibling of [nginxpilot](../nginxpilot): same config shape, same "last known-good wins" contract.

```
HTTP API ──► zonewright ──► SQLite change log ◄──── sync (HTTPS + cluster key) ────► other zonewright servers
                 │
                 ├─ renders ──► zone_dir/<zone>.db, named.zones.conf   (atomic rename)
                 │   named-checkzone / named-checkconf gate every change
                 └─ rndc reload ──► named serves the zones on :53
```

- **BIND stays BIND** — zonewright writes ordinary master files and a `zone {}` list that `named.conf` includes. No dynamic updates, no journal files, nothing to un-learn if you remove it.
- **Checked before live** — every zone is staged and run through `named-checkzone`; the zone list through `named-checkconf`. A zone that fails keeps serving its **previous** file (`stale`); a new zone that fails is simply not loaded (`disabled`). One bad zone never blocks the others.
- **The API never commits a broken zone** — every write is pre-checked with `named-checkzone`; if BIND would refuse it, nothing is stored or replicated and you get `422` with the checker's output.
- **Multi-server replication** — every server accepts writes, even while the others are unreachable, and they converge automatically when they reconnect ([design](REPLICATION.md)). Each deployment generates its own id; all servers share one URL list and find themselves in it.
- **Serials handled for you** — `YYYYMMDDnn`-based, bumped on every change, never moving backwards, and **identical on every server** once they have synced.
- **Safe defaults** — `allow-transfer { none; }` unless you list secondaries; the image runs an authoritative-only named (no recursion).

## Quick start (Docker)

```bash
mkdir -p zonewright && cat > zonewright/config.yml <<'EOF'
data_dir: /var/lib/zonewright
admin:
  listen: 0.0.0.0:9053
  token_env: ZONEWRIGHT_TOKEN
  allow_insecure_http: true   # the port is published on the host's loopback only (below)
defaults:
  nameservers: [ns1.example.com, ns2.example.com]
  soa:
    admin_email: hostmaster@example.com
include:
  - /var/lib/zonewright/zones.d/*.yml
EOF

docker run -d --name zonewright \
  -p 53:53/udp -p 53:53/tcp -p 127.0.0.1:9053:9053 \
  -e ZONEWRIGHT_TOKEN=change-me \
  -v "$PWD/zonewright:/etc/zonewright:ro" \
  -v zonewright-data:/var/lib/zonewright \
  ghcr.io/kalevski/toolcase/zonewright:latest

# Create a zone, then add a record.
curl -H 'Authorization: Bearer change-me' -X POST localhost:9053/zones --data-binary @- <<'EOF'
zones:
  - name: example.com
    records:
      - {name: "@", type: A, value: 203.0.113.10}
      - {name: www, type: CNAME, value: "@"}
EOF
curl -H 'Authorization: Bearer change-me' -X POST localhost:9053/zones/example.com/records \
  -d '{"name":"api","type":"A","value":"203.0.113.20","ttl":"5m"}'

dig @127.0.0.1 api.example.com +short
```

The image runs named (root → drops to `named`) and the daemon (unprivileged `zonewright`, group `named`) side by side, supervises named, and generates an rndc key per container. Any argument runs the CLI instead: `docker run --rm … zonewright:latest validate`.

## Quick start (host with BIND already installed)

```bash
sudo useradd --system --no-create-home --gid bind zonewright     # group `named` on RHEL/Alpine
sudo install -d -o zonewright -g bind -m 0750 /var/lib/zonewright /var/lib/zonewright/zones.d
sudo install -d /etc/zonewright && sudo tee /etc/zonewright/config.yml <<'EOF'
data_dir: /var/lib/zonewright
defaults:
  nameservers: [ns1.example.com, ns2.example.com]
include:
  - /var/lib/zonewright/zones.d/*.yml
EOF

zonewright print-include                    # shows the include line to add
echo 'include "/var/lib/zonewright/named.zones.conf";' | sudo tee -a /etc/bind/named.conf.local
sudo -u zonewright zonewright validate
sudo cp packaging/zonewright.service /etc/systemd/system/ && sudo systemctl enable --now zonewright
```

zonewright needs to read the rndc key (`/etc/bind/rndc.key`, normally `root:bind 0640` — hence the group) and named needs to read `/var/lib/zonewright`. **Ubuntu/Debian AppArmor:** named's profile only allows `/var/lib/bind/**`; either put `data_dir` under `/var/lib/bind/zonewright`, or add `/var/lib/zonewright/** r,` to `/etc/apparmor.d/local/usr.sbin.named`.

## Configuration

YAML, strict (unknown keys are errors). Default path `/etc/zonewright/config.yml`, override with `--config`. Files matched by `include:` may only contain a `zones:` list; a zone declared twice (across any files) is a validation error.

```yaml
data_dir: /var/lib/zonewright     # zonewright.db (replicated store + node id), state.json, zone files
log_level: info                   # debug | info | warn | error
admin:
  listen: 127.0.0.1:9053          # "" disables the API
  token_env: ZONEWRIGHT_TOKEN     # or token_file: /run/secrets/zw_token (0600/0640)
  tls:                            # HTTPS for the API; required for a non-loopback listen…
    cert_file: /etc/zonewright/api.crt
    key_file: /etc/zonewright/api.key
  # allow_insecure_http: true     # …unless explicitly opted out (private network / TLS proxy in front)
  scoped_tokens:                  # optional limited tokens next to the admin token — see "Scoped tokens"
    - name: realm-fra             # [a-z0-9-]+, unique; shown in logs and 403 messages
      token_env: ZW_ACME_FRA      # or token_file: /run/secrets/zw_acme_fra
      scope: acme                 # the only scope: /lookup + _acme-challenge TXT writes
      zones: [example.com]        # the zones it may touch — or all_zones: true; neither = none
bind:
  zone_dir: /var/lib/zonewright/zones                 # default <data_dir>/zones
  conf_file: /var/lib/zonewright/named.zones.conf     # default <data_dir>/named.zones.conf
  check_zone_cmd: [named-checkzone]                   # run as <cmd> <zone> <file>
  check_conf_cmd: [named-checkconf]                   # run as <cmd> <file>
  reload_cmd: [rndc, reload]                          # [] disables a step
defaults:
  ttl: 1h                         # seconds, or s/m/h/d/w units ("1h30m")
  nameservers: [ns1.example.net, ns2.example.net]     # apex NS for every zone
  soa:
    primary_ns: ns1.example.net   # default: first nameserver
    admin_email: hostmaster@example.net   # default: hostmaster@<zone>
    refresh: 1h
    retry: 15m
    expire: 2w
    minimum: 5m                   # negative-caching TTL
  allow_transfer: []              # IPs/CIDRs, any, none (empty → none)
  also_notify: []                 # secondary IPs to NOTIFY
include:
  - zones.d/*.yml                 # hand-written LOCAL zones (read-only over the API, never replicated)
zones: []                         # local zones, same rules
cluster:                          # optional — see "Running several servers"
  key_env: ZONEWRIGHT_CLUSTER_KEY # or key_file / key_files: [new, old] during rotation (≥ 32 bytes)
  listen: 0.0.0.0:9153            # peer listener
  tls: {cert_file: /etc/zonewright/peer.crt, key_file: /etc/zonewright/peer.key}
  # ca_file: …  or  fingerprint: sha256:…   # for self-signed peer certs (default: system CA roots)
  # allow_insecure_http: false    # http:// peers — private network / VPN only
  urls:                           # SAME list on every server, itself included
    - https://ns1.example.com:9153
    - https://ns2.example.com:9153
  pull_interval: 5s               # fallback; peers are also nudged right after every write
  max_clock_skew: 2m              # ops stamped further in the future are held (keep NTP on)
  startup_fence: 30s              # how long a starting node waits to hear from peers before accepting writes
  retention: 30d                  # change history kept (and needed by a peer that was offline)
```

**Two kinds of zones.** Zones you create over the API are stored in `zonewright.db` and **replicated** to every server. Zones in config files (`zones:` or `include:`) are **local** to that server and read-only over the API. If both define the same name, the local one is served and `/status` reports the conflict.

### Zones and records

```yaml
zones:
  - name: example.com
    ttl: 30m                      # optional; else defaults.ttl
    nameservers: [ns1.example.com, ns2.example.com]   # optional; else defaults
    soa: {admin_email: dns@example.com}               # optional per-field overrides
    allow_transfer: [198.51.100.2]
    also_notify: [198.51.100.2]
    records:
      - {name: "@",        type: A,     value: 203.0.113.10}
      - {name: "@",        type: AAAA,  value: "2001:db8::10"}
      - {name: www,        type: CNAME, value: "@"}
      - {name: shop,       type: CNAME, value: shops.myshopify.com}
      - {name: "@",        type: MX,    value: mail, priority: 10}
      - {name: "@",        type: TXT,   value: "v=spf1 mx -all"}
      - {name: _dmarc,     type: TXT,   value: "v=DMARC1; p=reject"}
      - {name: _sip._tcp,  type: SRV,   value: sip, priority: 10, weight: 5, port: 5060}
      - {name: "@",        type: CAA,   tag: issue, value: letsencrypt.org}
      - {name: "*.dev",    type: A,     value: 203.0.113.30, ttl: 5m}
      - {name: sub,        type: NS,    value: ns1.other-dns.net}   # delegation
```

Supported types: `A AAAA CNAME MX NS PTR SRV TXT CAA`.

**Names and values** — the one rule to remember:

| Field | Form | Meaning |
|---|---|---|
| `name` | `@` or empty | the zone apex |
| `name` | `www`, `a.b`, `*`, `*.dev` | relative to the zone |
| `name` | `www.example.com.` (trailing dot) | absolute; must be inside the zone |
| `name` | `www.example.com` (no dot, ends in the zone) | **rejected** as ambiguous — it would mean `www.example.com.example.com` |
| hostname `value` (CNAME/NS/PTR/MX/SRV) | `@` or a single label (`mail`) | relative to the zone |
| hostname `value` | contains a dot (`mail.example.com`, trailing dot optional) | absolute |

Checked at validation time (so the API returns a precise `400`): IP families, hostname syntax, required `priority`/`weight`/`port`/`tag`, no CNAME at the apex or next to other records, no duplicate records, one TTL per name+type, and at least one apex NS. TXT values longer than 255 bytes are split into multiple strings automatically; quotes and non-printables are escaped.

## HTTP API

JSON everywhere (errors are `{"error": "…"}`); loopback by default; optional `Authorization: Bearer <token>`.

| Method & path | Does |
|---|---|
| `GET /healthz` | liveness (no auth) |
| `GET /status` | per-zone state/serial + last apply (reload errors, pending retry) |
| `POST /reload` | re-read config from disk and apply (same as `SIGHUP`) |
| `GET /lookup?name=<fqdn>` | the most specific zone that holds a name: `{"zone","name","source","writable"}`, `name` relative to the zone (`@` for the apex); `404` when no zone holds it |
| `GET /zones[?view=summary][&limit=&cursor=]` | all zones with records, serial, state, `source` (`replicated`/`local`), `etag`. `view=summary` drops the records and adds `record_count` (cheap for dashboards). Paging is opt-in — see below |
| `POST /zones` | create/replace one zone: a YAML **or** JSON fragment with exactly one zone (`201` created / `200` updated / `200` unchanged) |
| `GET /zones/{zone}` | one zone, with an `ETag` header |
| `PUT /zones/{zone}` | create/replace the zone from a bare zone object (YAML/JSON, name from the path) — removed records are deleted |
| `DELETE /zones/{zone}` | remove the zone everywhere |
| `GET /zones/{zone}/file` | the rendered zone file, as named serves it |
| `GET /zones/{zone}/records?name=&type=[&limit=&cursor=]` | list records, optionally filtered and paged |
| `POST /zones/{zone}/records` | add one record — `409` if an identical one exists |
| `PUT /zones/{zone}/records/{name}/{type}` | replace one RRset: `{"records":[{"value":"…"},…]}`; `[]` empties it |
| `DELETE /zones/{zone}/records/{name}/{type}[?value=…]` | delete the RRset, or only the matching value |
| `GET /tokens` | scoped tokens this server accepts — its config tokens and the replicated API tokens (`source`: `config` / `api`). Never secrets or hashes |
| `POST /tokens` | create an API token: `{"name","scope":"acme","zones":[…]}` (or `"all_zones": true`; neither = no zone yet) → `201` with its secret in `token` (`zwt_…`), shown **only here** |
| `PUT /tokens/{name}` | replace an API token's `scope`, `zones` and `all_zones`; the secret stays |
| `POST /tokens/{name}/rotate` | new secret for an API token (returned once); the old one stops working |
| `DELETE /tokens/{name}` | revoke an API token on every server |
| `GET /cluster/status` | this node's id; per URL: which server answered, self/peer, lag, last pull, clock skew, alarms; conflicts; log size |
| `DELETE /cluster/peers/{id}` | retire the id of a server removed for good (a redeployed server is retired automatically) |

**Paging.** `GET /zones` and `GET /zones/{zone}/records` return everything unless you pass `limit` (1–500) and/or `cursor`; there is no default cap. With either, the list is in stable order (zones by name; records by name, type, value) and the body gains `"total"` (items before the cursor is applied) and `"next_cursor"` (`null` on the last page). A cursor is opaque and means "everything after this item", so zones or records added or removed between pages never skip or repeat items. Bad `limit`, `cursor` or `view` values are `400`.

```bash
curl -H 'Authorization: Bearer change-me' 'localhost:9053/zones?view=summary&limit=200'
# {"next_cursor":"eyJ…","total":412,"zones":[{"name":"a.example.","serial":…,"record_count":12,"etag":"\"…\"",…}, …]}
curl -H 'Authorization: Bearer change-me' 'localhost:9053/zones?view=summary&limit=200&cursor=eyJ…'
```

**JSON formatting.** Responses are compact, one line. Add `?pretty=1` for indented output when reading by eye (`curl … | jq` works too). Error bodies are always compact.

**On every write:**
- `If-Match: <etag>` → `412` if the zone changed since you read it (`If-Match: *` = "must exist").
- `?wait=replicated[&timeout=10s]` → respond only once every other server has the change (`200`, `"replicated": true`), or `202` + `pending_peers` on timeout. Use it for ACME DNS-01: the CA may ask either nameserver.
- Re-sending identical content is a no-op (`"status": "unchanged"`, serial unchanged) — safe for sync scripts to repeat.

```bash
# Dynamic-DNS style: point home.example.com at a new IP
curl -X PUT localhost:9053/zones/example.com/records/home/A -d '{"records":[{"value":"198.51.100.7","ttl":60}]}'

# ACME DNS-01: publish, then remove, a challenge token
curl -X PUT localhost:9053/zones/example.com/records/_acme-challenge/TXT -d '{"records":[{"value":"gfj9Xq...Rg85nM","ttl":60}]}'
curl -X DELETE localhost:9053/zones/example.com/records/_acme-challenge/TXT

# MX at the apex ("@" is fine in a path)
curl -X PUT localhost:9053/zones/example.com/records/@/MX -d '{"records":[{"priority":10,"value":"mail.example.com"}]}'
```

A write response looks like `{"status":"created","zone":"example.com","serial":2026092503,"state":"active","reloaded":true,"op":"n-4f1c…:17","etag":"\"…\""}`. Status codes: `400` invalid input, `404` unknown zone/record, `409` duplicate record or a local (read-only) zone, `412` stale `If-Match`, `422` BIND rejected the result (nothing committed), `503` the server is still in its startup fence. If named is unreachable the change is still published on disk and the response carries `reload_error` + `pending_reload: true`; zonewright retries the reload every 30s.

## Scoped tokens

The admin token can do everything, including deleting every zone. When another program only needs to publish ACME DNS-01 challenges — certbot on a web server, nginxpilot on every edge — give it a **scoped token** instead. There are two kinds, with the same powers:

- **API tokens**: created, updated, rotated and revoked over the API with the admin token, and **replicated**, so one works on every server within a second (below).
- **Config tokens**: listed in `admin.scoped_tokens`, read at startup, and known to that server only. They suit a fixed setup managed as files.

Config tokens:

```yaml
admin:
  token_env: ZONEWRIGHT_TOKEN          # required: scoped tokens only exist next to an admin token
  scoped_tokens:
    - name: edge-fra
      token_env: ZW_ACME_EDGE_FRA
      scope: acme
      zones: [example.com, example.org]   # or all_zones: true (never both)
```

**A token reaches exactly the zones it lists.** An empty or missing `zones` means **no** zone, not every zone. Reaching every zone takes an explicit `all_zones: true`, which cannot be combined with `zones`. A bug that sends an empty list therefore locks a token out instead of handing it every domain.

An `acme` token may call exactly these, and gets `403` for everything else:

| Allowed | Limited to |
|---|---|
| `GET /lookup?name=` | answers only with zones in its `zones` list |
| `POST /zones/{zone}/records` | a `TXT` record named `_acme-challenge` or `_acme-challenge.<name>` |
| `PUT /zones/{zone}/records/{name}/{type}` | the same |
| `DELETE /zones/{zone}/records/{name}/{type}` | the same (with or without `?value=`) |

It cannot read zones or records, list anything, touch any other record or type, change zone settings, reload, or see the cluster. A request outside its zones is refused before any work is done; a refused record write commits nothing. Each config token must have its own value (the daemon refuses to start if one equals the admin token or another config token), and config tokens, like the admin token, are read at startup — restart to change them, or use API tokens.

What a leaked `acme` token still allows: getting a certificate issued for a name in its zones, since that is exactly what a challenge proves. It cannot redirect traffic or change any other record. Limit `zones` to what that client actually certifies.

### API tokens

```bash
# create — the secret is in the response once, and never again
curl -H "Authorization: Bearer $ADMIN" -X POST 'localhost:9053/tokens?wait=replicated' \
  -d '{"name":"edge-fra","scope":"acme","zones":["example.com"]}'
# → {"status":"created","name":"edge-fra","scope":"acme","zones":["example.com"],"all_zones":false,"source":"api",
#    "created_at":"2026-09-26T10:00:00Z","token":"zwt_3f9c…","replicated":true}

curl -H "Authorization: Bearer $ADMIN" -X PUT localhost:9053/tokens/edge-fra -d '{"zones":["example.com","example.org"]}'
curl -H "Authorization: Bearer $ADMIN" -X POST localhost:9053/tokens/edge-fra/rotate
curl -H "Authorization: Bearer $ADMIN" -X DELETE 'localhost:9053/tokens/edge-fra?wait=replicated'
```

- **Only the admin token manages tokens.** A scoped token gets `403` on `/tokens`, including for itself, so a token can never widen its own zones or mint another.
- **Only a hash is stored.** The secret is 32 random bytes (`zwt_` + 64 hex characters), generated by the server; clients cannot choose it. The replicated log and backups hold only its SHA-256.
- **Replicated like records**: a token is a last-writer-wins register (REPLICATION.md §4). A change on any server reaches the others within one pull; `?wait=replicated` waits for all of them. A token revoked on one server stops working everywhere once the change arrives. A partitioned server keeps honouring it until the partition heals.
- `PUT` replaces `scope`, `zones` and `all_zones` but keeps the secret, so a client can be given more or fewer zones without redistributing anything. A `PUT` that lists no zones and no `all_zones` leaves the token able to change nothing. `rotate` changes only the secret.
- A token can be created with no zones and given them later: a client can hold its credentials before it is allowed to certify anything.
- Names are `[a-z0-9-]+`, at most 64 characters, and must not clash with a config token on the server that receives the request. A deleted name can be reused.
- API tokens need an admin token: without one the API is unauthenticated, and `POST /tokens` answers `409`.

## Certificates over DNS-01 (certbot)

[`certbot-dns-zonewright`](certbot-dns-zonewright/) is a certbot authenticator plugin for this API. It finds the zone with `GET /lookup`, adds the challenge with `POST …/records?wait=replicated` — so the record is on **every** server before the CA asks either nameserver — and afterwards deletes exactly the value it added. Apex and wildcard in one certificate (two values on one name) work.

```bash
pip install ./certbot-dns-zonewright
cat > zonewright.ini <<'EOF'
dns_zonewright_url = https://ns1.example.net:9053
dns_zonewright_token = <an acme-scoped token>
EOF
chmod 600 zonewright.ini
certbot certonly -a dns-zonewright --dns-zonewright-credentials zonewright.ini \
  -d example.com -d '*.example.com'
```

## Running several servers (replication)

Every server runs the same zonewright with the same `cluster:` block. Write to any of them; the others follow within about a second. Full design and edge cases: [REPLICATION.md](REPLICATION.md).

**1. One shared secret**, identical everywhere:
```bash
openssl rand -hex 32        # → ZONEWRIGHT_CLUSTER_KEY on every server
```

**2. A certificate for the peer port** on each server (`ns1.example.com:9153`, …): a normal Let's Encrypt certificate works as-is. For self-signed certificates set `ca_file` (or pin `fingerprint: sha256:…`). Alternatively bind `listen: 127.0.0.1:9153` and let a TLS proxy (nginxpilot) publish it.

**3. The same URL list on every server**, itself included:
```yaml
cluster:
  key_env: ZONEWRIGHT_CLUSTER_KEY
  listen: 0.0.0.0:9153
  tls: {cert_file: /etc/zonewright/peer.crt, key_file: /etc/zonewright/peer.key}
  urls: [https://ns1.example.com:9153, https://ns2.example.com:9153]
```
Each server generates its own node id on first start (stored in `zonewright.db`), asks every URL "who are you?", recognises itself, and syncs with the rest. `zonewright status` shows the result.

**4. Use them as your domain's nameservers:** in each zone, `nameservers: [ns1.example.com, ns2.example.com]` plus A/AAAA records for `ns1`/`ns2` (BIND refuses an in-zone nameserver without an address). At your registrar, register `ns1`/`ns2` as **host (glue) records** with the two server IPs, then set them as the domain's nameservers. Open 53/udp, 53/tcp and the peer port.

**Behaviour to know:**
- **Outages:** a server that can't reach the others keeps serving and keeps accepting writes; it catches up when the link returns. `?wait=replicated` returns `202` meanwhile.
- **Simultaneous edits** of the same name+type on two servers: the later one wins on every server. Two edits that are each valid but invalid together (a CNAME on one server, an A record at the same name on the other) are repaired deterministically (the newer wins) and reported under `conflicts`. Anything else unresolvable keeps each server on its last good version, with an alarm, until you fix it with one more write.
- **Adding a server:** deploy it with the full list, then add its URL to every server's list and `SIGHUP`. It downloads everything on its first sync. **Removing one:** drop its URL everywhere, then `DELETE /cluster/peers/{id}`.
- **Never copy a data dir to create a new server** — both would share one id. zonewright detects this ("clone detected" alarm) and refuses to sync with the copy; delete its data dir so it generates a fresh id.
- **Restoring a backup** (`zonewright backup <file>`) is safe: on start the server first pulls back from its peers any of its own changes the backup is missing (`startup_fence`).
- **Keep NTP running.** Clock differences up to `max_clock_skew` are harmless; beyond that a server's future-stamped changes are held and flagged.

## Upgrading from a single-node version

- API-managed zones (`zones.d/<zone>.yml` written by the old API) are **imported automatically** into `zonewright.db` on first start; the files are renamed to `*.yml.migrated` and serials keep going up. Hand-written zone files under other names stay local.
- A non-loopback `admin.listen` now requires `admin.tls` — or, for the Docker image where the API is only published on the host's loopback, `allow_insecure_http: true` (as in [`docker/config.yml`](docker/config.yml)). Without it the daemon refuses to start with a clear error; named keeps serving DNS meanwhile.
- To go multi-server: upgrade each server alone first, then add the `cluster:` block everywhere.

## Security model

The API decides what a domain resolves to, so it is treated as highly privileged:

- **Scoped tokens for narrow clients.** A client that only publishes ACME challenges gets an `acme`-scoped token: `GET /lookup` and `_acme-challenge` TXT writes in the zones it lists (every zone only with an explicit `all_zones`), nothing else ([Scoped tokens](#scoped-tokens)).
- **No token → loopback only; remote → HTTPS.** zonewright refuses to start if `admin.listen` is non-loopback without a token, or without `admin.tls` (unless `allow_insecure_http` is set deliberately), so the token never crosses a network in clear text.
- **Peers: TLS + shared key.** Every peer request carries the cluster key (compared in constant time, ≥ 32 bytes); plain-HTTP peers need an explicit opt-in. URLs and node ids only *locate* servers — the key is what makes one a peer. Every change received from a peer is re-validated and must already be in canonical form, so a buggy or hostile peer cannot inject zone-file syntax either. Ops stamped too far in the future are held, not applied.
- **Browsers are refused.** There is no browser client, so any request carrying `Origin` or `Sec-Fetch-*` headers gets `403`. This blocks cross-site request forgery (a web page POSTing to `127.0.0.1:9053`). Without a token, the `Host` header must also be a loopback name, which defeats DNS rebinding.
- **Inputs never reach the zone file raw.** Names, hostnames and IPs are validated against strict grammars, TXT/CAA payloads are quoted and escaped, and the SOA `admin_email` local part is limited to `[A-Za-z0-9._+-]`. Zone-file directives (`$INCLUDE`, `$GENERATE`) cannot be injected.
- **Bounded requests.** Bodies are capped at 1 MiB and every connection phase has a timeout (header 5s, body 30s, response 3m).
- **Container privilege split.** named drops to `named` after binding :53, and the daemon runs as `zonewright`. The root entrypoint never touches paths inside the daemon-writable data dir, so a compromised daemon cannot plant symlinks there to escalate. The rndc key is regenerated on every container start, never baked into the image. named is authoritative-only, with response-rate limiting and `minimal-any` against reflection/amplification.
- **Residual trust:** the daemon writes the zone list that named includes, so a *compromised* daemon can change named's zone configuration. That is inherent to its job (the same holds for nginxpilot and nginx). Keep the API token secret and the listener private.

## CLI

```
zonewright [run]              run the daemon (default)
zonewright validate           validate config, then named-checkzone every zone in a temp dir (CI-friendly exit code)
zonewright print-zone <zone>  print the rendered zone file
zonewright print-include      print the named.conf zone list + the include line
zonewright status [--json]    per-zone table (+ cluster view) from the running daemon
zonewright backup <file>      consistent online copy of zonewright.db
zonewright version
```

`SIGHUP` (`systemctl reload zonewright`) re-reads the config; an invalid config is rejected whole and the running one is kept. `validate` skips BIND checks with a warning when the binaries aren't on `PATH`, so it still works on a workstation.

## Development

```bash
go test -race ./...
go build ./cmd/zonewright
docker build -t zonewright:dev .
```

Unit and in-process cluster tests (partition/heal, clone detection, restore fence, snapshot bootstrap, a convergence property test over random concurrent histories) stand in a fake runner for `named-checkzone` / `rndc`, so they run without BIND installed.
