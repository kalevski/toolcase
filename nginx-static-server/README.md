# nginx-static-server

A standalone Go daemon that runs alongside nginx and keeps directories of static files in sync with remote sources — **git repositories** or **HTTP zip archives**. nginx serves the files; the daemon never sits in the request path.

```
git remotes / zip endpoints ──fetch──► nginx-static-server ──writes──► data_dir/sites/<domain>/
                                                                         releases/<ts>-<ref>/
                                                                         current -> releases/...  (atomic symlink)
                                                                                  ▲
                                                  nginx  root = .../current ─────┘
```

- **Atomic deploys** — content is staged, fsynced, then made live with a `rename(2)` symlink swap. nginx never serves a half-written directory, and content updates need **no nginx reload**.
- **Last known-good wins** — any sync failure (network, auth, corrupt zip) leaves `current` untouched.
- **Zero request-path coupling** — not a proxy, not a web server, no TLS management (use certbot), no build steps (CI builds → artifact/built branch → daemon deploys).

Full design rationale: [`nginx-static-server.md`](../nginx-static-server.md) in the repo root.

## Quick start

```bash
# 1. Config
sudo mkdir -p /etc/nginx-static-server/sites.d
sudo tee /etc/nginx-static-server/config.yml <<'EOF'
data_dir: /var/lib/nginx-static-server
admin:
  listen: 127.0.0.1:9090
defaults:
  interval: 5m
  keep_releases: 3
include:
  - sites.d/*.yml
EOF

sudo tee /etc/nginx-static-server/sites.d/example.com.yml <<'EOF'
sites:
  - domain: example.com
    source:
      type: git
      url: https://github.com/acme/example-site.git
      branch: gh-pages
EOF

# 2. Validate, then sync once BEFORE enabling the vhost (so `current` exists)
nginx-static-server validate
nginx-static-server sync example.com

# 3. Paste a starting vhost into nginx and reload
nginx-static-server print-vhost example.com | sudo tee /etc/nginx/conf.d/example.com.conf
sudo nginx -t && sudo nginx -s reload

# 4. Run the daemon (or install the systemd unit from packaging/)
nginx-static-server run
```

Onboarding more sites later: drop a file into `sites.d/` and `kill -HUP $(pidof nginx-static-server)` (or `systemctl reload nginx-static-server`).

## Configuration

YAML, strict (unknown keys are errors). Default path `/etc/nginx-static-server/config.yml`, override with `--config`. Fragments pulled in via `include:` globs may contain **only** `sites:` lists; duplicate domains across files are a validation error.

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
        method: ssh-key           # ssh-key | https-token | none
        key_file: /etc/nginx-static-server/keys/example_ed25519
        # known_hosts: /etc/nginx-static-server/known_hosts   # strict; default accept-new (TOFU)
      subdir: dist/               # serve only this subtree
      require_file: [index.html]  # opt-in post-fetch gate
    exclude: ["*.map"]            # extends defaults: .env*, .htaccess, .DS_Store (.git* always stripped)
```

Clones are shallow + single-branch through the system `git` binary; the bare cache under `data_dir/cache/git/` is disposable.

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

## CLI

| Subcommand | Purpose |
|---|---|
| `run` | The daemon (default). Flags: `--config`, `--log-format logfmt\|json`, `--prune-orphans`. |
| `validate` | Parse + validate merged config, check `git` presence, verify secret refs resolve. CI-friendly exit codes. |
| `sync <domain>` | One-shot in-process sync, no daemon needed; non-zero exit on failure. |
| `print-vhost <domain>` | Print a commented nginx server-block starting snippet. |
| `status [--json]` | Human table (or raw JSON) from the daemon's `/status` endpoint. |
| `version` | Build info. |

## Admin endpoint

Loopback HTTP (default `127.0.0.1:9090`; `admin.listen: ""` disables; `admin.token_env` adds bearer auth):

- `GET /healthz` — liveness
- `GET /status` — per-site JSON: deployed ref, last success/error, failure streak, `never_synced`, next sync
- `POST /sync/<domain>` — force an immediate sync

## Signals

- `SIGHUP` — diff-based reload. Added sites start + sync immediately; removed sites stop but content stays on disk (orphan, warned; delete with `--prune-orphans`); an invalid config is rejected wholesale and the running config stays active.
- `SIGTERM`/`SIGINT` — graceful shutdown: in-flight swaps finish, downloads abort.

## Failure semantics

Retries back off exponentially: `interval × 2^streak`, capped at 4× interval; the streak resets on success and is visible in `/status`. Before a site's first successful sync `current` doesn't exist and nginx 404s — run `sync <domain>` before enabling the vhost.

## systemd

`packaging/nginx-static-server.service` ships `Type=notify`, `Restart=on-failure` and hardening (`ProtectSystem=strict`, `NoNewPrivileges`, `PrivateTmp`). Run as a dedicated `nginx-static` user owning `data_dir`; the nginx worker user joins the `nginx-static` group (dirs `0750`, files `0640`, umask `027`).

SELinux (RHEL-family): `semanage fcontext -a -t httpd_sys_content_t '/var/lib/nginx-static-server/sites(/.*)?' && restorecon -R /var/lib/nginx-static-server/sites`.

## Docker

The image is built on **`nginx:alpine`** — one container runs nginx *and* the sync daemon, sharing `/var/lib/nginx-static-server` directly. Published to GHCR by `.github/workflows/nginx-static-server.yml` (linux/amd64 + linux/arm64):

```bash
docker run -d \
  -p 80:80 \
  -v /etc/nginx-static-server:/etc/nginx-static-server:ro \
  -v ./example.com.conf:/etc/nginx/conf.d/example.com.conf:ro \
  -v nss-sites:/var/lib/nginx-static-server \
  ghcr.io/kalevski/nginx-static-server:latest
```

- Mount your vhosts into `/etc/nginx/conf.d/`, each `root` pointing at `…/sites/<domain>/current` (generate a starting snippet with `print-vhost`, below).
- The daemon runs with group `nginx` so its `0750`/`0640` content stays readable by the workers; nginx is PID-managed by the official entrypoint, content swaps need no reload.
- Port 9090 is the admin endpoint — set `admin.listen: 0.0.0.0:9090` in the config and publish the port if you want `/status` from outside.
- Any argument bypasses the supervisor and runs the CLI directly:

```bash
docker run --rm -v /etc/nginx-static-server:/etc/nginx-static-server:ro \
  ghcr.io/kalevski/nginx-static-server:latest validate
docker run --rm -v /etc/nginx-static-server:/etc/nginx-static-server:ro \
  ghcr.io/kalevski/nginx-static-server:latest print-vhost example.com
```

Note the canonical deployment model is still the static binary + systemd on the nginx host; the image bundles both processes for container-based setups.

## Building

```bash
go build ./cmd/nginx-static-server
# static release binary:
CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X main.version=$(git describe --always)" ./cmd/nginx-static-server
```

Requires Go 1.24+. Runtime dependency: the `git` binary (git sources only).
