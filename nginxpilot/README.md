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
- **Zero request-path coupling** — not a proxy, not a web server, no TLS management (use certbot), no build steps (CI builds → artifact/built branch → daemon deploys).

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

Generate the nginx config: `nginxpilot print-vhost api.example.com`. The output is **self-contained** — it emits each referenced named upstream `upstream {}` block followed by the `server {}` block. If you share one upstream across several proxies, emit it once and drop the duplicate. Standard forwarding headers (`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`) are always set; TLS stays a commented certbot hint (nginxpilot does not manage certificates).

## CLI

| Subcommand | Purpose |
|---|---|
| `run` | The daemon (default). Flags: `--config`, `--log-format logfmt\|json`, `--prune-orphans`. |
| `validate` | Parse + validate merged config, check `git` presence, verify secret refs resolve. CI-friendly exit codes. |
| `sync <domain>` | One-shot in-process sync, no daemon needed; non-zero exit on failure. |
| `print-vhost <domain>` | Print a commented nginx snippet — a content-serving block for a static site, or `upstream {}` + `proxy_pass` blocks for a reverse proxy. |
| `status [--json]` | Human table (or raw JSON) from the daemon's `/status` endpoint. |
| `version` | Build info. |

## Admin endpoint

Loopback HTTP (default `127.0.0.1:9090`; `admin.listen: ""` disables; `admin.token_env` adds bearer auth):

- `GET /healthz` — liveness
- `GET /status` — per-site JSON: deployed ref, last success/error, failure streak, `never_synced`, next sync
- `POST /sync/<domain>` — force an immediate sync
- `GET /vhost/<domain>` — `text/plain` generated nginx config for a site or reverse proxy (same output as `print-vhost`)

## Signals

- `SIGHUP` — diff-based reload. Added sites start + sync immediately; removed sites stop but content stays on disk (orphan, warned; delete with `--prune-orphans`); an invalid config is rejected wholesale and the running config stays active.
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
  -v /etc/nginxpilot:/etc/nginxpilot:ro \
  -v ./example.com.conf:/etc/nginx/conf.d/example.com.conf:ro \
  -v nginxpilot-sites:/var/lib/nginxpilot \
  ghcr.io/kalevski/toolcase/nginxpilot:latest
```

- Mount your vhosts into `/etc/nginx/conf.d/`, each `root` pointing at `…/sites/<domain>/current` (generate a starting snippet with `print-vhost`, below).
- The daemon runs as the unprivileged `nginxpilot` user (member of group `nginx`) so its `0750`/`0640` content stays readable by the workers; nginx is PID-managed by the official entrypoint, content swaps need no reload.
- Port 9090 is the admin endpoint — set `admin.listen: 0.0.0.0:9090` in the config and publish the port if you want `/status` from outside.
- Any argument bypasses the supervisor and runs the CLI directly:

```bash
docker run --rm -v /etc/nginxpilot:/etc/nginxpilot:ro \
  ghcr.io/kalevski/toolcase/nginxpilot:latest validate
docker run --rm -v /etc/nginxpilot:/etc/nginxpilot:ro \
  ghcr.io/kalevski/toolcase/nginxpilot:latest print-vhost example.com
```

Note the canonical deployment model is still the static binary + systemd on the nginx host; the image bundles both processes for container-based setups.

## Building

```bash
go build ./cmd/nginxpilot
# static release binary:
CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X main.version=$(git describe --always)" ./cmd/nginxpilot
```

Requires Go 1.24+. Runtime dependency: the `git` binary (git sources only).
