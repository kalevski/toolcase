# nginxpilot

A standalone Go daemon that runs alongside nginx and keeps directories of static files in sync with remote sources — **git repositories** or **HTTP zip archives**. nginx serves the files; the daemon never sits in the request path.

```
git remotes / zip endpoints ──fetch──► nginxpilot ──writes──► data_dir/sites/<domain>/
                                                                         releases/<ts>-<ref>/
                                                                         current -> releases/...  (atomic symlink)
                                                                                  ▲
                                                  nginx  root = .../current ─────┘
```

- **Atomic deploys** — content is staged, fsynced, then made live with a `rename(2)` symlink swap. nginx never serves a half-written directory, and content updates need **no nginx reload**.
- **Last known-good wins** — any sync failure (network, auth, corrupt zip) leaves `current` untouched.
- **Zero request-path coupling** — not a proxy, not a web server (CI builds → artifact/built branch → daemon deploys).
- **Optional [managed mode](#managed-mode)** — opt in (`nginx.manage: true`) and nginxpilot also **writes the live nginx config and reloads nginx**: TLS termination from a cert dir, per-host toggles (force-SSL/HTTP2/HSTS/cache/…), L4 `stream` blocks, and crash-proof validation (a resource that fails `nginx -t` is quarantined, never fatal). Default is the decoupled generate-only behavior above.

Full design rationale: [`nginxpilot.md`](../nginxpilot.md) in the repo root.

## Quick start

```bash
# 1. Config
sudo mkdir -p /etc/nginxpilot/sites.d
sudo tee /etc/nginxpilot/config.yml <<'EOF'
data_dir: /var/lib/nginxpilot
admin:
  listen: 127.0.0.1:9090
defaults:
  interval: 5m
  keep_releases: 3
include:
  - sites.d/*.yml
EOF

sudo tee /etc/nginxpilot/sites.d/example.com.yml <<'EOF'
sites:
  - domain: example.com
    source:
      type: git
      url: https://github.com/acme/example-site.git
      branch: gh-pages
EOF

# 2. Validate, then sync once BEFORE enabling the vhost (so `current` exists)
nginxpilot validate
nginxpilot sync example.com

# 3. Paste a starting vhost into nginx and reload
nginxpilot print-vhost example.com | sudo tee /etc/nginx/conf.d/example.com.conf
sudo nginx -t && sudo nginx -s reload

# 4. Run the daemon (or install the systemd unit from packaging/)
nginxpilot run
```

Onboarding more sites later: drop a file into `sites.d/` and `kill -HUP $(pidof nginxpilot)` (or `systemctl reload nginxpilot`).

## Configuration

YAML, strict (unknown keys are errors). Default path `/etc/nginxpilot/config.yml`, override with `--config`. Fragments pulled in via `include:` globs may contain `sites:`, `upstreams:` and/or `proxies:` lists; duplicate domains across files (sites **and** proxies share one domain namespace) are a validation error.

### git source

```yaml
sites:
  - domain: example.com
    source:
      type: git
      url: git@github.com:acme/example-site.git
      branch: main
      interval: 2m                # min 30s; default from defaults.interval
      auth:
        method: ssh-key           # ssh-key | https-token | github-token | none
        key_file: /etc/nginxpilot/keys/example_ed25519   # or key_env: SSH_KEY (key material in an env var)
        # known_hosts: /etc/nginxpilot/known_hosts   # strict; default accept-new (TOFU)
      subdir: dist/               # serve only this subtree
      require_file: [index.html]  # opt-in post-fetch gate
    exclude: ["*.map"]            # extends defaults: .env*, .htaccess, .DS_Store (.git* always stripped)
```

Clones are shallow + single-branch through the system `git` binary; the bare cache under `data_dir/cache/git/` is disposable.

**git auth methods** (all over an `https://` URL except `ssh-key`):

| `auth.method` | Needs | Use when |
|---|---|---|
| `ssh-key` | `key_file` **or** `key_env` (+ optional `known_hosts`) | `git@`/`ssh://` URL, deploy key |
| `https-token` | `username` + `token_env`/`token_file` | classic user:token HTTPS |
| `github-token` | `token_env`/`token_file` (no username) | a GitHub token from a social/web login |
| `none` | — | public repo |

#### github-token — token-only GitHub auth

For a private GitHub repo where you only have a token (no SSH key, no separate username) — e.g. one minted from a web/social login. The token alone authenticates:

```yaml
sites:
  - domain: app.example.com
    source:
      type: git
      url: https://github.com/acme/private-site.git   # https:// (not git@)
      branch: main
      auth:
        method: github-token
        token_env: GITHUB_TOKEN        # or token_file: /run/secrets/gh_token
```

Get the token however you log in to GitHub:

```bash
gh auth login            # browser/social login flow
export GITHUB_TOKEN=$(gh auth token)
nginxpilot sync app.example.com
```

A fine-grained or classic **Personal Access Token** (Contents: read) and OAuth/GitHub-App installation tokens all work the same way. The token is sent as `Authorization: Basic base64("x-access-token:<token>")` (GitHub's convention for OAuth/app tokens), injected via `GIT_CONFIG_*` so it never appears in `argv`, process listings, or on disk. Unlike `https-token`, no `auth.username` is set (supplying one is a validation error).

#### ssh-key via `key_env` — supply the key with config (no staging)

`ssh-key` takes the private key either by path (`key_file`) or by reference to an env var holding the **key material** (`key_env`) — exactly one. `key_env` suits containers: a `key_file` mounted from the host carries the host uid and `0600`, so the unprivileged daemon can't read it (and `validate` rejects a key not owned by the daemon user). With `key_env` the daemon writes the key to a `0600` temp file it owns under `data_dir/tmp` at sync time and deletes it afterward — no host-side `chown`/staging.

```yaml
source:
  type: git
  url: git@github.com:acme/private.git
  branch: main
  auth:
    method: ssh-key
    key_env: SSH_KEY          # env var holds the PEM, not a path
```
```bash
docker run -d \
  -e SSH_KEY="$(cat ~/.ssh/id_ed25519)" \
  -v /etc/nginxpilot:/etc/nginxpilot:ro \
  -v nginxpilot-sites:/var/lib/nginxpilot \
  ghcr.io/kalevski/toolcase/nginxpilot:latest
```

Inline key material in the config (`auth.key: |`) is a parse-time error, same as other inline secrets — use `key_env` (or `key_file`).

### http-zip source

```yaml
sites:
  - domain: blog.example.com
    source:
      type: http-zip
      url: https://ci.example.com/artifacts/blog/latest.zip   # https required unless allow_insecure: true
      interval: 10m
      auth:
        method: bearer            # bearer | basic | header | none
        token_env: BLOG_ARTIFACT_TOKEN
      checksum_url: https://ci.example.com/artifacts/blog/latest.zip.sha256  # optional
      # strip_components: 1       # explicit; a single shared root dir is auto-stripped
      limits:
        max_archive_size: 512MiB          # default
        max_uncompressed_size: 2GiB       # default
        max_entries: 100000               # default
        max_compression_ratio: 100        # default
```

Downloads use conditional GET (ETag / Last-Modified); unchanged content is a cheap no-op. Extraction rejects zip-slip paths and symlinks outright and enforces all four limits.

### Secrets

Inline secrets are a **parse-time error** — only `*_env` / `*_file` references are accepted, so config files stay safe to commit. Secret files must be `0600`/`0640` and owned by the daemon user or root, or the daemon refuses to start. systemd `LoadCredential` works via `*_file` + `$CREDENTIALS_DIRECTORY`.

### Reverse proxies and upstreams

`sites:` are content the daemon syncs; `upstreams:` and `proxies:` are **config-only entities** — the daemon never syncs, serves, or proxies them. They exist so `print-vhost` (and the admin `/vhost/<domain>` endpoint) can **generate** the nginx `upstream {}` + `server { … proxy_pass … }` config for you to paste and adapt. nginxpilot stays out of the request path and never writes nginx config; nginx is still the proxy.

```yaml
upstreams:
  - name: api_pool                 # [A-Za-z0-9_]+ (referenced as proxy_pass http://api_pool)
    balancer: least_conn           # round_robin (default) | least_conn | ip_hash
    keepalive: 32                  # optional keepalive connection cache
    servers:
      - address: 10.0.0.1:8080     # host:port | ip:port | unix:/path.sock
        weight: 2                  # optional
        max_fails: 3               # optional
        fail_timeout: 30s          # optional
      - address: 10.0.0.2:8080
        backup: true               # backup | down flags

proxies:
  - domain: api.example.com
    upstream: api_pool             # reference a named upstream …
    # pass: http://127.0.0.1:9000  # … OR a single inline target (exactly one)
    listen: 80                     # optional, default 80
    client_max_body_size: 20MiB    # optional
    connect_timeout: 60s           # optional proxy_connect_timeout
    read_timeout: 60s              # optional proxy_read_timeout
    send_timeout: 60s              # optional proxy_send_timeout
    locations:                     # optional; default is a single "/" → upstream/pass
      - path: /
        upstream: api_pool         # per-location override (else inherits the proxy default)
      - path: /ws
        upstream: api_pool
        websocket: true            # adds the Upgrade/Connection upgrade headers + HTTP/1.1
```

Generate the nginx config: `nginxpilot print-vhost api.example.com`. The output is **self-contained** — it emits each referenced named upstream `upstream {}` block followed by the `server {}` block. If you share one upstream across several proxies, emit it once and drop the duplicate. Standard forwarding headers (`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`) are always set; TLS stays a commented certbot hint unless you opt into [managed mode](#managed-mode).

Every location also accepts an `advanced: |` raw passthrough (the location-level twin of the server-level `advanced`), and backend targets are strictly validated — a `pass`/`address` may only be a well-formed `scheme://host[:port][/path]`, `host[:port]` or `unix:/path`; nginx metacharacters (`;`, `{`, `}`, `$`, whitespace) are rejected at validation time.

### Redirection hosts and dead (parked) hosts

Two lightweight host types share the site/proxy domain namespace and the full per-host TLS/HSTS toggles:

```yaml
redirects:
  - domain: old.example.com
    to: new.example.com        # target host (no scheme, optionally :port)
    scheme: auto               # http | https | auto (default auto → $scheme)
    code: 301                  # 301 (default) | 302 | 303 | 307 | 308
    preserve_path: true        # default true → appends $request_uri
    tls: auto                  # with a cert, https://old.example.com also redirects

dead_hosts:
  - domain: gone.example.com
    code: 404                  # 404 (default) | 410 | 444 | 503 (444 closes with no response)
    tls: auto                  # keeps the cert warm while the service is retired
    force_ssl: true            # allowed here (NOT on redirects — the redirect IS the redirect)
```

Self-redirects (`to:` equal to `domain`) and `force_ssl` on a redirect are validation errors. Both types support `enabled: false` (render nothing, keep the config) and wildcard domains.

### Wildcard vhosts

Proxies, redirects and dead hosts accept one leading `*.` label (`*.example.com`); sites do not. Managed files and API fragments use certbot's `_wildcard.` stem on disk (`proxy-_wildcard.example.com.conf`). A wildcard vhost matches a cert whose SANs carry the identical `*.example.com` pattern — issuing one requires `acme.challenge: dns`. A wildcard and an exact vhost (`*.example.com` + `app.example.com`) may coexist; nginx prefers the exact `server_name`.

## Managed mode

By default nginxpilot is a config **generator** (print-vhost + manual paste). Opt into **managed mode** and it becomes the thing that **writes the live nginx config and reloads nginx** — unlocking TLS termination, per-host toggles and `stream` blocks. The default (`nginx.manage: false`) is unchanged: existing deployments behave exactly as before.

```yaml
nginx:
  manage: true                                        # opt-in; default false
  conf_dir: /etc/nginx/conf.d/nginxpilot.d            # http-context files nginxpilot owns
  stream_conf_dir: /etc/nginx/stream.d/nginxpilot.d   # stream-context (L4) files
  managed_include_dir: /etc/nginx/conf.d/nginxpilot.d # shared snippets (block-exploits)
  test_cmd:   ["nginx", "-t"]                         # overridable (systemctl/docker variants)
  reload_cmd: ["nginx", "-s", "reload"]
tls:
  cert_dir_env: NGINXPILOT_CERT_DIR                   # env var holding the cert dir path …
  # cert_dir: /etc/nginxpilot/certs                   # … or a direct path (exactly one)
  reload_on_change: true                              # watch the cert dir, reload on renewal (default true)
  # watch_interval: 60s                               # cert-dir poll interval (default 60s)
```

Wire the managed dirs into `nginx.conf` once (the Docker image bakes this in):

```bash
nginxpilot print-include    # prints the http include + the top-level stream{} block to add
```

### Crash-proof apply (never crash nginx)

On startup, on reload, and on cert renewal, nginxpilot renders **one file per resource**, validates the whole set with `nginx -t` in a staging dir, then:

- **all valid** → atomically swaps the files into the live dirs and reloads.
- **something invalid** → a quarantine pass adds resources one at a time, `nginx -t` after each, and **disables** just the offending one (recorded with its `nginx -t` stderr) — the rest keep serving. nginx is **only ever handed config that already passed `nginx -t`**.
- a reload that somehow fails after a passing test rolls the live dirs back to the previous snapshot.

Disabled resources surface in `GET /status` under `nginx.resources` (and `nginxpilot validate` exits non-zero if any resource fails `nginx -t`). Preview without committing: `POST /nginx/test`.

### TLS termination from a cert directory

nginxpilot **consumes** certs (certbot/acme.sh/external issue and renew them) and reloads on renewal. Discovery per domain (first match wins), so a plain certbot tree works with zero config:

```
<cert_dir>/<domain>/fullchain.pem + privkey.pem      # certbot live layout
<cert_dir>/<domain>.crt           + <domain>.key     # flat layout
```

Opt in per resource with `tls:` — `off` (default, HTTP only), `auto` (use a cert if found, else serve HTTP + warn), or `required` (no cert → the resource is disabled rather than silently served plaintext).

### Automatic certificate renewal

With `acme.enabled`, the daemon checks every `check_interval` (plus one catch-up pass ~30 s after startup) and force-renews any certbot-managed cert with less than `renew_before` to expiry, then reloads nginx **once** per batch. Manual flat certs can't be renewed by certbot — they log a warning until re-uploaded.

```yaml
acme:
  enabled: true
  # ...
  renewal:
    enabled: true          # default true when acme.enabled
    check_interval: 1h     # default 1h, min 1m
    renew_before: 24h      # default 24h — consider raising it (LE recommends 30d);
                           # <= check_interval leaves zero slack and logs a warning
```

Per-cert state (`renew_managed`, `last_renew_time`, `last_renew_error`, `expires_in_seconds`) shows in `GET /certs`; the scheduler summary in `GET /status` under `certs_renewal`. `POST /certs/renew` / `POST /certs/{domain}/renew` remain the manual force paths.

### Pre-flight target checks

Backend targets are checked in three tiers: strict lexical validation always runs (the injection guard above); DNS resolution and an optional TCP reachability probe run on admin API writes:

```yaml
nginx:
  target_checks:
    dns: error        # error (default) | warn | off — API-write severity
    reachability: off # probe | off (default) — always warn-only
    timeout: 3s       # per-check budget
```

`dns: error` turns an unresolvable backend host into a `400` at `POST /proxies` time (override for DNS-lands-later bootstraps: `?skip_target_checks=true`); `warn` demotes it to a `warnings` array in the response, as reachability always is. On the apply path DNS failures never block anything — they only replace the raw `nginx -t` stderr of a quarantined resource with a self-explanatory reason. `nginxpilot validate --check-targets` runs the network tiers from the CLI (plain `validate` stays offline).

### Reconciliation loop

In managed mode the daemon re-checks the whole config against `nginx -t` (a staged dry-run, never touching live config) every `interval`:

```yaml
nginx:
  reconcile:
    enabled: true        # default true in managed mode
    interval: 1m         # default 1m, min 15s
    on_failure: warn     # warn (default) | disable
```

- A live resource that starts failing the dry-run (e.g. its backend's DNS record was deleted — nginx caches load-time resolution, so traffic still flows) is marked **`at_risk`** in `GET /status` with a `since` timestamp. **Policy `warn` (default) never touches traffic.**
- **`on_failure: disable` turns latent failures into immediate route removal**: after 2 consecutive failing ticks the loop triggers an apply whose quarantine pass disables exactly the failing resource.
- **Auto-recovery is always on**: a quarantined resource that passes 2 consecutive ticks is re-applied (strictly safe — it only ever adds a resource back after the staged `nginx -t` proves the config valid). Flap damping in both directions prevents reload ping-pong; steady state costs zero reloads.

### Per-host toggles

Booleans/structs on a `proxy` (and, where meaningful, a `site`). All render in managed mode **and** `print-vhost`:

```yaml
proxies:
  - domain: app.example.com
    upstream: app_pool
    tls: auto
    force_ssl: true              # 80 → 301 https (requires TLS)
    http2: true                  # http2 on; (requires TLS)
    hsts: true                   # or { max_age: 63072000, include_subdomains: true, preload: false }
    block_exploits: true         # deny common SQLi/scanner patterns (managed include / inline)
    websocket: true              # Upgrade/Connection headers on ALL locations
    cache:                       # http proxy cache
      enabled: true
      valid: ["200 10m", "404 1m"]
      zone_size: 10m
    gzip: true
    advanced: |                  # raw escape hatch inside the server{} block
      add_header X-Frame-Options SAMEORIGIN;
```

`force_ssl` / `http2` / `hsts` require effective TLS — without it they are a validation error (no surprise plaintext). The `advanced` escape hatch rides the same `nginx -t` gate, so a bad snippet only disables that one resource.

### Stream (TCP/UDP) resources

L4 proxying lives in nginx's top-level `stream {}` context. Streams are keyed by **name** (L4 has no Host):

```yaml
stream_upstreams:
  - name: db_pool
    balancer: least_conn         # round_robin | least_conn | hash
    servers:
      - address: 10.0.0.1:5432
      - address: 10.0.0.2:5432

streams:
  - name: postgres
    listen: 5432
    protocol: tcp                # tcp (default) | udp
    upstream: db_pool            # … or pass: 10.0.0.9:5432 (exactly one)
    proxy_protocol: false
    connect_timeout: 5s
    timeout: 10m                 # proxy_timeout
    # tls: auto                  # optional TLS-terminated TCP …
    # tls_domain: db.example.com # … cert to use (L4 has no SNI)
```

Stream and http upstream names are separate namespaces (the same name in each is fine). `print-include` emits the `stream { include …; }` line to add to `nginx.conf`.

## CLI

| Subcommand | Purpose |
|---|---|
| `run` | The daemon (default). Flags: `--config`, `--log-format logfmt\|json`, `--prune-orphans`. |
| `validate` | Parse + validate merged config, check `git` presence, verify secret refs resolve. In managed mode also renders to a temp dir and runs `nginx -t`. CI-friendly exit codes. |
| `sync <domain>` | One-shot in-process sync, no daemon needed; non-zero exit on failure. |
| `print-vhost <domain>` | Print a commented nginx snippet — a content-serving block for a static site, or `upstream {}` + `proxy_pass` blocks for a reverse proxy. Honours TLS + toggles. |
| `print-include` | Print the `nginx.conf` include snippet for managed mode (http include + the top-level `stream {}` block). |
| `status [--json]` | Human table (or raw JSON) from the daemon's `/status` endpoint. |
| `version` | Build info. |

## Admin endpoint

Loopback HTTP (default `127.0.0.1:9090`; `admin.listen: ""` disables; `admin.token_env` adds bearer auth):

- `GET /healthz` — liveness
- `GET /status` — per-site JSON: deployed ref, `bytes` (size of the live `current` release directory, measured once per sync), last success/error, failure streak, `never_synced`, next sync. In managed mode an `nginx` object reports each resource's `state` (`active`/`disabled`) and the `nginx -t` reason for any disabled one.
- `POST /sync/<domain>` — force an immediate sync
- `GET /vhost/<domain>` — `text/plain` generated nginx config for a site or reverse proxy (same output as `print-vhost`)
- `POST /reload` — diff-based config reload (same work as `SIGHUP`); lets a separate process apply config changes without signalling the daemon. An invalid on-disk config is rejected wholesale and the running config stays active (`500`); success returns `200`. In managed mode a reload also re-renders + reloads nginx.
- `POST /nginx/test` — managed-mode dry run: render + `nginx -t` with no swap/reload, returning the per-resource pass/fail set so a control plane can preview before committing (`501` when managed mode is off).
- `GET /certs` — JSON list of the TLS certificates discovered in the cert dir (certbot live or flat layout), read fresh off disk on each call so renewals show immediately. Each entry carries the index `domain` key, the leaf cert's SAN `names`, the `cert_path`/`key_path`, the key-file `mod_time`, and the leaf's `not_before`/`not_after`/`issuer` (omitted when the cert can't be parsed). Read-only — nginxpilot only consumes certs; it never reads key material (only the privkey *path*). Works in generate-only mode too; an unconfigured/missing cert dir yields an empty list.
### Config management over REST

A control plane (e.g. Perch) drives the **entire** config — sites, upstreams and reverse proxies — over the API, so `sites.d/` never has to be a hand-edited or shared-write surface. Each write parses the same YAML fragment a file-drop would contain (`config/parse.go` schema), validates the **candidate merged config** before touching disk (so a bad fragment never lands in `sites.d/`), writes it atomically under a deterministic filename, then reloads; the target directory and extension are derived from the first `include:` glob. A write must declare **exactly one** entity of its kind (and none of the others). Each kind has a deterministic filename so it maps 1:1 to its `DELETE`, and the three filename namespaces never collide:

| Endpoint | Body declares | Filename | Notes |
|---|---|---|---|
| `GET /sites` | — | — | JSON list of configured sites |
| `POST /sites` | one `sites:` entry | `<domain>.yml` | `201` created / `200` replaced |
| `DELETE /sites/{domain}` | — | `<domain>.yml` | `200` / `404` |
| `GET /upstreams` | — | — | JSON list of configured upstreams |
| `POST /upstreams` | one `upstreams:` entry | `upstream-<name>.yml` | `201` / `200` |
| `DELETE /upstreams/{name}` | — | `upstream-<name>.yml` | `200` / `404`; **`409`** if a proxy still references it (checked before any disk change, so the on-disk config never drifts into a state a restart would reject — repoint or delete the dependent proxy first) |
| `GET /proxies` | — | — | JSON list of configured reverse proxies |
| `POST /proxies` | one `proxies:` entry | `proxy-<domain>.yml` | `201` / `200`; a proxy that names an `upstream:` resolves against the upstreams **already** in the running config, so create the upstream first; unresolvable backend hosts are a `400` under `target_checks.dns: error` (`?skip_target_checks=true` overrides) |
| `DELETE /proxies/{domain}` | — | `proxy-<domain>.yml` | `200` / `404` |
| `GET /redirects` | — | — | JSON list of redirection hosts |
| `POST /redirects` | one `redirects:` entry | `redirect-<domain>.yml` | `201` / `200` |
| `DELETE /redirects/{domain}` | — | `redirect-<domain>.yml` | `200` / `404` |
| `GET /dead-hosts` | — | — | JSON list of dead (parked) hosts |
| `POST /dead-hosts` | one `dead_hosts:` entry | `dead-<domain>.yml` | `201` / `200` |
| `DELETE /dead-hosts/{domain}` | — | `dead-<domain>.yml` | `200` / `404` |
| `GET /stream-upstreams` | — | — | JSON list of stream (L4) upstreams |
| `POST /stream-upstreams` | one `stream_upstreams:` entry | `stream-upstream-<name>.yml` | `201` / `200` |
| `DELETE /stream-upstreams/{name}` | — | `stream-upstream-<name>.yml` | `200` / `404`; **`409`** if a stream still references it |
| `GET /streams` | — | — | JSON list of stream (L4) resources |
| `POST /streams` | one `streams:` entry | `stream-<name>.yml` | `201` / `200`; a stream that names an `upstream:` resolves against stream upstreams already in the running config |
| `DELETE /streams/{name}` | — | `stream-<name>.yml` | `200` / `404` |

Validation errors come back as a precise `400` (bad source, duplicate domain — sites and proxies share one domain namespace —, unknown upstream reference, unknown key, …). If the post-write reload is rejected (e.g. a concurrent edit to another file) the write is rolled back and reported as `500`. The `GET` list endpoints serialize the running merged config (main file + all fragments) as JSON; secret material is never present (auth carries only `*_env` / `*_file` references) and durations/sizes render as their human strings (`"5m"`, `"512MiB"`).

```bash
# Stand up a reverse proxy entirely over REST — no YAML files touched by hand.
BASE=http://127.0.0.1:9090

curl -fsS -X POST $BASE/upstreams --data-binary @- <<'EOF'
upstreams:
  - name: api_pool
    balancer: least_conn
    servers:
      - address: 10.0.0.1:8080
      - address: 10.0.0.2:8080
EOF

curl -fsS -X POST $BASE/proxies --data-binary @- <<'EOF'
proxies:
  - domain: api.example.com
    upstream: api_pool
EOF

curl -fsS $BASE/proxies                 # confirm it landed
curl -fsS $BASE/vhost/api.example.com   # generate the nginx config to paste
```

## Signals

- `SIGHUP` — diff-based reload. Added sites start + sync immediately; removed sites stop but content stays on disk (orphan, warned; delete with `--prune-orphans`); an invalid config is rejected wholesale and the running config stays active. In managed mode the reload also re-renders + validates + reloads nginx (quarantining any resource that fails `nginx -t`).
- `SIGTERM`/`SIGINT` — graceful shutdown: in-flight swaps finish, downloads abort.

## Failure semantics

Retries back off exponentially: `interval × 2^streak`, capped at 4× interval; the streak resets on success and is visible in `/status`. Before a site's first successful sync `current` doesn't exist and nginx 404s — run `sync <domain>` before enabling the vhost.

## systemd

`packaging/nginxpilot.service` ships `Type=notify`, `Restart=on-failure` and hardening (`ProtectSystem=strict`, `NoNewPrivileges`, `PrivateTmp`). Run as a dedicated `nginxpilot` user owning `data_dir`; the nginx worker user joins the `nginxpilot` group (dirs `0750`, files `0640`, umask `027`).

SELinux (RHEL-family): `semanage fcontext -a -t httpd_sys_content_t '/var/lib/nginxpilot/sites(/.*)?' && restorecon -R /var/lib/nginxpilot/sites`.

## Docker

The image is built on **`nginx:alpine`** — one container runs nginx *and* the sync daemon, sharing `/var/lib/nginxpilot` directly. Published to GHCR by `.github/workflows/nginxpilot.yml` (linux/amd64 + linux/arm64):

```bash
docker run -d \
  -p 80:80 \
  -p 443:443 \
  -v /etc/nginxpilot:/etc/nginxpilot:ro \
  -v ./example.com.conf:/etc/nginx/conf.d/example.com.conf:ro \
  -v nginxpilot-sites:/var/lib/nginxpilot \
  ghcr.io/kalevski/toolcase/nginxpilot:latest
```

- Mount your vhosts into `/etc/nginx/conf.d/`, each `root` pointing at `…/sites/<domain>/current` (generate a starting snippet with `print-vhost`, below) — **or** turn on [managed mode](#managed-mode) and let nginxpilot write them.
- The daemon **and nginx** both run as the unprivileged `nginxpilot` user (member of group `nginx`) — the daemon's managed-mode `nginx -t` / `nginx -s reload` need a same-uid master, and low ports come from a `cap_net_bind_service` file capability on the nginx binary (pidfile at `/run/nginxpilot/nginx.pid`). nginx is supervised by the entrypoint (restarted on crash), content swaps need no reload.
- **Managed mode in the image**: the http include and the top-level `stream {}` block are baked into `nginx.conf`, and the daemon-owned dirs under `/etc/nginx/nginxpilot/` are pre-created. Point your config at them: `nginx.conf_dir: /etc/nginx/nginxpilot/conf.d`, `nginx.stream_conf_dir: /etc/nginx/nginxpilot/stream.d`, `nginx.managed_include_dir: /etc/nginx/nginxpilot/conf.d`. Mount your cert dir and set `tls.cert_dir`.
- Port 9090 is the admin endpoint — set `admin.listen: 0.0.0.0:9090` in the config and publish the port if you want `/status` from outside.
- Any argument bypasses the supervisor and runs the CLI directly:

```bash
docker run --rm -v /etc/nginxpilot:/etc/nginxpilot:ro \
  ghcr.io/kalevski/toolcase/nginxpilot:latest validate
docker run --rm -v /etc/nginxpilot:/etc/nginxpilot:ro \
  ghcr.io/kalevski/toolcase/nginxpilot:latest print-vhost example.com
```

Note the canonical deployment model is still the static binary + systemd on the nginx host; the image bundles both processes for container-based setups.

### Environment variables

nginxpilot is **config-file driven** (`config.yml`), so its env surface is tiny — env vars are only for the container wrapper and for injecting secrets the config references by name:

| Variable | Default | Description |
|---|---|---|
| `NGINXPILOT_CONFIG` | `/etc/nginxpilot/config.yml` | Config path the entrypoint passes to `nginxpilot run`. |
| _`auth.token_env` value_ | — | Per-source: name of the env var holding a git HTTPS/GitHub token (e.g. set `token_env: GH_TOKEN`, then pass `-e GH_TOKEN=…`). |
| _`auth.key_env` value_ | — | Per-source: name of the env var holding an SSH private key (alternative to `key_file`). |
| _`admin.token_env` value_ | — | Name of the env var holding the admin-API bearer token, when the admin endpoint is exposed. |
| `TZ` | `UTC` | Timezone (image ships `tzdata`); affects release timestamps + logs. |

The `*_env` rows are **indirection**: you choose the variable name in the config, then pass that variable to the container. Everything else — data dir, intervals, sources, TLS, per-host toggles — lives in the YAML, not the environment.

## Building

```bash
go build ./cmd/nginxpilot
# static release binary:
CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X main.version=$(git describe --always)" ./cmd/nginxpilot
```

Requires Go 1.24+. Runtime dependency: the `git` binary (git sources only).
