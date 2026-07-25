# Quaykeeper

A self-hosted **control plane** that deploys a user's GitHub branch as a static
site. Quaykeeper is the human-facing UI and policy layer; it drives
[**nginxpilot**](../nginxpilot/) (the sync daemon next to nginx) entirely over
nginxpilot's admin REST API. Quaykeeper never sits in the request path and never
touches nginxpilot's filesystem — the two only share a network.

```
 user ──GitHub OAuth──► Quaykeeper (Next.js)  ──admin REST──►  nginxpilot  ──writes──► nginx docroot
                          │  SQLite state                  (fetch/deploy)
                          └─ plans, quotas, custom domains, sponsors
```

- **GitHub-authenticated.** First login bootstraps to `owner`; everyone else is a
  user. A site is "deploy this branch of this repo as static files."
- **Database-free deploys.** Quaykeeper only holds control-plane state (SQLite); the
  built artifacts live wherever nginxpilot puts them. A site config is pushed to
  nginxpilot via `POST /sites`; status/sync/vhost come back over the same API.
- **Plans + quotas.** GitHub Sponsors tier → plan; over-quota sites get a grace
  window, then are suspended (fragment removed) until trimmed or upgraded.
- **Custom domains.** Hands out A/AAAA-record instructions, re-resolves the
  domain server-side to confirm it points at this ingress, then issues a cert via
  `certbot` and installs a per-domain vhost.
- **Certificate management.** The owner admin surface drives nginxpilot's
  certificate lifecycle for the active realm — issue via certbot, upload a manual
  pair, renew, delete, and store per-provider DNS credentials — all over the admin
  REST API (see [Certificate management](#certificate-management)).
- **Multi-realm.** One Quaykeeper can target several nginxpilot daemons ("realms");
  each realm's admin token is encrypted at rest (AES-256-GCM).
- **Scheduled tasks.** The owner defines shell or JavaScript scripts that run on the
  Quaykeeper host — on a 5-field cron schedule, on demand ("run now"), or both. Each
  run's stdout/stderr, exit code, and duration are captured (see
  [Scheduled tasks](#scheduled-tasks)).

Built on Next.js 16 + React 19, rendered entirely with the `@toolcase/web-components`
(`tc-*`) UI kit. **Requires Node ≥ 22.5** (built-in `node:sqlite`).

## Quick start (local dev)

```bash
npm install
npm run build -w @toolcase/base -w @toolcase/web-components   # source deps
cp quaykeeper/.env.example quaykeeper/.env.local      # fill QUAYKEEPER_GITHUB_* + QUAYKEEPER_AUTH_SECRET + QUAYKEEPER_OAUTH_REDIRECT_URI
npm -w @toolcase/quaykeeper run dev               # http://localhost:4100
```

Register a GitHub OAuth app whose **Authorization callback URL** exactly matches
`QUAYKEEPER_OAUTH_REDIRECT_URI`. Generate the session secret with `openssl rand -hex 32`.

## Docker

One image; the build context is the **monorepo root** (Quaykeeper's `@toolcase/*`
deps are `file:../` workspace siblings). Quaykeeper reaches nginxpilot over a shared
Docker network — point `QUAYKEEPER_NGINXPILOT_ADMIN_URL` at the daemon's service name
and keep that admin port off the public network.

```bash
# build (context = repo root)
docker build -t quaykeeper -f quaykeeper/Dockerfile .

# run — joins the nginxpilot network, keeps SQLite state on the host
docker run -d --restart unless-stopped \
  --name quaykeeper \
  --network nginxpilot-net \
  -p 4100:3000 \
  -p 4101:4101 \
  --env-file quaykeeper/.env \
  -v "$HOME/quaykeeper-workspace:/workspace" \
  -e WORKSPACE_DIR=/workspace \
  -e HOME=/workspace \
  -e PORT=3000 \
  -e HOSTNAME=0.0.0.0 \
  quaykeeper
```

`./quaykeeper/run-docker.sh` wraps this (bind-mounts state, runs as your uid so the
mounted store stays writable, and supports a `NETWORK=` proxy mode that doesn't
publish the ports). Run it as the user that owns the workspace dir.

> The in-container app always listens on `3000` (the run command pins `PORT=3000`
> and maps the host port to it); the agent server listens on `4101`
> (`QUAYKEEPER_AGENT_PORT`). `PORT` in `.env` only matters for local dev.

## Agent server (instance config + client download)

Alongside the UI/API port, Quaykeeper starts a second, cookieless HTTP listener —
the **agent server** — on `QUAYKEEPER_AGENT_PORT` (default `4101`). It carries the
entire machine-facing surface, so operators can expose it independently of the
admin UI:

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /v1/config` | instance key | `{ env, flags, version }` with ETag/304 |
| `GET /v1/env[?format=dotenv]` | instance key | resolved env vars |
| `GET /v1/flags` | instance key | `{ key: { enabled } }` |
| `GET /v1/client/{os}/{arch}` | none | the static `quaykeeper-client` binary |
| `GET /v1/install.sh` | none | bootstrap script (download binary + exec) |
| `GET /healthz` | none | liveness |

Data endpoints authenticate with `X-Quaykeeper-Instance: <name>` plus
`Authorization: Bearer <fetch key>`. In **Admin → Settings** set the public
**base URL** (this Quaykeeper's UI/API origin) and the **instance config URL**
(where the agent server is reachable) — the per-instance usage guides hand the
latter out as `QUAYKEEPER_URL`.

## Environment variables

`QUAYKEEPER_*` are read by the app; `WORKSPACE_DIR`/`DB_PATH`/`PORT` are shared infra
knobs. Required vars fail fast at boot if missing.

### Required

| Variable | Description |
|---|---|
| `QUAYKEEPER_GITHUB_CLIENT_ID` | GitHub OAuth app client ID. |
| `QUAYKEEPER_GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret. |
| `QUAYKEEPER_OAUTH_REDIRECT_URI` | OAuth callback URL — must **exactly** match the GitHub app's "Authorization callback URL". |
| `QUAYKEEPER_AUTH_SECRET` | HMAC key for session cookie + OAuth state (and the at-rest encryption key source when `QUAYKEEPER_REALM_KEY` is unset). ≥ 32 chars; use `openssl rand -hex 32`. |

### Auth / access

| Variable | Default | Description |
|---|---|---|
| `QUAYKEEPER_PUBLIC_ORIGIN` | origin of `QUAYKEEPER_OAUTH_REDIRECT_URI` | Public scheme+host the browser uses. Set only when it differs from the redirect URI (e.g. a proxy strips the path). |
| `QUAYKEEPER_SESSION_TTL` | `86400` | Session lifetime in seconds. |
| `QUAYKEEPER_ALLOWED_LOGINS` | _(open)_ | Comma-separated GitHub logins allowed to sign in. Empty = anyone. |
| `QUAYKEEPER_ALLOWED_ORG` | _(none)_ | Require membership of this GitHub org to sign in. |

### nginxpilot integration

| Variable | Default | Description |
|---|---|---|
| `QUAYKEEPER_NGINXPILOT_ADMIN_URL` | `http://127.0.0.1:9090` | Base URL of nginxpilot's admin REST API. Across containers, point at the daemon's service name (e.g. `http://nginxpilot:9090`). |
| `QUAYKEEPER_NGINXPILOT_ADMIN_TOKEN` | _(none)_ | Bearer token matching nginxpilot's `admin.token_env`. Empty = unauthenticated (loopback only). |
| `QUAYKEEPER_REALM_KEY` | HKDF from `QUAYKEEPER_AUTH_SECRET` | Key encrypting each realm's stored admin token (AES-256-GCM). Any string (hashed to 32 bytes). |
| `QUAYKEEPER_REALM_KEY_PREV` | _(none)_ | Previous realm key kept in the ring during a key rotation so old ciphertext still decrypts. |
| `QUAYKEEPER_REALM_URL_ALLOWLIST` | _(none)_ | Comma-separated host globs an SSRF allowlist limits realm admin URLs to. |

### Plans / GitHub Sponsors

| Variable | Default | Description |
|---|---|---|
| `QUAYKEEPER_SPONSORS_WEBHOOK_SECRET` | _(required for the webhook route)_ | HMAC secret GitHub signs `X-Hub-Signature-256` with. ≥ 16 chars. A forged/unsigned event can never grant a plan. |
| `QUAYKEEPER_SPONSORS_TOKEN` | _(none)_ | Owner PAT the scheduled reconcile uses to read sponsorships and self-heal missed webhooks. Empty = reconcile no-ops. |
| `QUAYKEEPER_SPONSORS_RECONCILE_CRON` | `*/15 * * * *` | 5-field cron for the reconcile ticker. |
| `QUAYKEEPER_QUOTA_GRACE_SEC` | `86400` | Seconds an over-quota site keeps serving after it's flagged, before suspension. `0` = suspend on next pass. |

### Custom domains (certbot)

| Variable | Default | Description |
|---|---|---|
| `QUAYKEEPER_INGRESS_IPV4` | _(empty → verify disabled)_ | Public IPv4 a custom domain's A record must point at; re-resolved server-side before issuing a cert. |
| `QUAYKEEPER_INGRESS_IPV6` | _(none)_ | Public IPv6 for the AAAA record (optional). |
| `QUAYKEEPER_NGINX_CONF_DIR` | `/etc/nginx/conf.d` | Dir Quaykeeper installs per-custom-domain vhosts into. |
| `QUAYKEEPER_NGINX_RELOAD_CMD` | `nginx -s reload` | Command (argv, whitespace-split) to reload nginx after a custom-domain change. |
| `QUAYKEEPER_CERTBOT_BIN` | `certbot` | certbot binary. |
| `QUAYKEEPER_CERTBOT_EMAIL` | _(none)_ | ACME registration email. Empty registers without one (lab/dev). |
| `QUAYKEEPER_CERTBOT_WEBROOT` | `/var/www/certbot` | Webroot the HTTP-01 challenge files are served from. |

### Storage / runtime

| Variable | Default | Description |
|---|---|---|
| `WORKSPACE_DIR` | `/workspace` | Durable state dir (holds the SQLite store). |
| `QUAYKEEPER_DB_PATH` / `DB_PATH` | `$WORKSPACE_DIR/quaykeeper.db` | SQLite file path override. `QUAYKEEPER_DB_PATH` wins. |
| `PORT` | `4100` (dev) / `3000` (container) | HTTP listen port (UI/API). |
| `QUAYKEEPER_AGENT_PORT` | `4101` | Agent-server listen port (instance-fetch API + client download). |
| `QUAYKEEPER_CLIENT_DIR` | `./client-bin` | Dir holding the cross-compiled `quaykeeper-client` binaries the agent server serves. |
| `QUAYKEEPER_JOB_SHELL` | `/bin/bash` | Interpreter for a scheduled `shell`-kind job's script. Set to `/bin/sh` on a minimal container. A missing binary surfaces as a failed run, never a crash. |

> Per-site GitHub tokens are stored as generated `QUAYKEEPER_GH_TOKEN_<SITE_ID>` env
> names handed to nginxpilot fragments — not something you set by hand.

### Database export / import

| Variable | Default | Description |
|---|---|---|
| `QUAYKEEPER_PG_DUMP_BIN` | `pg_dump` | Binary used to export a PostgreSQL database. |
| `QUAYKEEPER_PSQL_BIN` | `psql` | Binary used to restore into a PostgreSQL database. |
| `QUAYKEEPER_MYSQLDUMP_BIN` | `mysqldump` | Binary used to export a MySQL/MariaDB database. |
| `QUAYKEEPER_MYSQL_BIN` | `mysql` | Binary used to restore into a MySQL/MariaDB database. |
| `QUAYKEEPER_DB_DUMP_TIMEOUT_MS` | `1800000` | Wall-clock cap for one dump/restore process. |
| `QUAYKEEPER_DB_IMPORT_MAX_BYTES` | `2147483648` | Hard cap on an uploaded `.sql` import. |

> **Databases → Export / Import database** moves a database between registered
> servers. Export streams `pg_dump`/`mysqldump` output to the browser as a plain
> `.sql` script; Import streams an uploaded script back through `psql`/`mysql` into
> a database of any name on another server (optionally creating it first). The
> restore stops at the first error — Postgres additionally rolls the whole thing
> back — so a failed import leaves no half-populated database.
>
> The dump carries **schema + data only**: ownership and grants are excluded on
> purpose, because roles are per-server and access is Quaykeeper's own surface.
> Re-apply it from the **Access** tab after importing.
>
> These are the native clients, so they must exist on the Quaykeeper host. The
> image installs `postgresql-client` (from PGDG — Debian's is too old, and
> `pg_dump` refuses a server newer than itself) and Oracle's
> `mysql-community-client` (MariaDB's dumper rejects the MySQL-8 client flags
> Quaykeeper passes). For local dev, point the `*_BIN` vars at your own clients. A
> missing binary surfaces in the UI as "the quaykeeper host has no … installed",
> never a crash.

## Certificate management

The **Admin → Certificates** page manages TLS certificates on the **active realm's**
nginxpilot over its admin REST API (no filesystem access). It drives nginxpilot's
ACME / cert endpoints (see `nginxpilot/cert_feature.md`):

| Action | nginxpilot endpoint | Notes |
|---|---|---|
| List discovered certs | `GET /certs` | Metadata only — never key material. |
| Issue via certbot | `POST /certs` | One or more domains; a leading `*.` wildcard is allowed only when the daemon's challenge is DNS-01. A staging toggle uses the CA's staging endpoint. `501` when `acme.enabled: false`. |
| Upload a manual pair | `PUT /certs/{domain}` | Bring-your-own cert/key (no certbot). The daemon validates the pair before writing. Works whenever `tls.cert_dir` is set. |
| Force-renew one | `POST /certs/{domain}/renew` | |
| Renew all due | `POST /certs/renew` | |
| Delete | `DELETE /certs/{domain}` | certbot-managed **or** a manual pair — the daemon picks the source. |
| DNS provider credentials | `GET`/`PUT`/`DELETE /acme/credentials/{provider}` | The runtime store certbot reads at issue time (DigitalOcean / Cloudflare / Route 53 / Google / … or a raw passthrough body). |

**Owner-only, and secrets are write-only.** Every Quaykeeper route is `authorize('owner')`-gated.
Private keys and provider tokens are POSTed but **never read back** — the list endpoints
return metadata only (provider names, mechanism, mtime), and nothing secret is logged or
audited (only the domain / provider name). Because these endpoints accept secret material,
exposing the realm's nginxpilot admin port **requires** its `admin.token_env` (which Quaykeeper
stores encrypted at rest per realm).

> **Two distinct cert mechanisms.** This page manages certs **on the nginxpilot daemon**
> (the per-realm, REST-driven model above). It is separate from the legacy host-level
> custom-domain path under *Custom domains (certbot)*, where Quaykeeper itself shells out to
> `certbot` and writes a vhost into its own nginx `conf.d/` (the `QUAYKEEPER_CERTBOT_*` /
> `QUAYKEEPER_NGINX_*` env vars). The two don't interact.

## Scheduled tasks

The **Scheduled tasks** page (`/jobs`) lets the owner define scripts that run **on the
Quaykeeper host** and see their output. A task is one of:

- **shell** — run with `$QUAYKEEPER_JOB_SHELL` (bash by default).
- **node** — run as an ES module with the same node binary that serves the app.

Each task carries an optional **5-field cron** schedule (`min hour dom mon dow`,
supporting `*`, lists, ranges, and `*/n` — the same parser the quota/status tickers
use). No schedule = a **manual-only** task you run on demand. Every task also has a
**timeout** (seconds); a run that overruns is killed (its whole process group, so a
sleeping grandchild can't linger).

| Action | Endpoint | Notes |
|---|---|---|
| List / create | `GET` / `POST /api/jobs` | |
| Read + recent runs | `GET /api/jobs/{id}` | `{ job, runs }`. |
| Update | `PATCH /api/jobs/{id}` | A lone `{ enabled }` body is the list's quick toggle. |
| Delete | `DELETE /api/jobs/{id}` | Run history cascades. |
| Run now | `POST /api/jobs/{id}/run` | Awaits the run; returns it with captured `stdout`/`stderr`, exit code, duration. `409` if the same task is already running. |

The scheduler is an in-process, minute-resolution ticker started at boot
(`instrumentation.ts` → `services/job-scheduler.ts`), matching the other background
tickers — no external cron. It fires each enabled, scheduled task at most once per
matching minute and skips a task whose previous run is still going. Per-run output is
capped (256 KB per stream) and only the newest 50 runs per task are kept.

> **Owner-only, and it runs arbitrary code on the host.** Every `/api/jobs` route is
> `authorize('owner')`-gated (the highest role), and every create / update / delete /
> run is audited. This is the same host-shell trust boundary the custom-domain certbot
> path already assumes — a scheduled task runs as the Quaykeeper process user, so treat
> owner access accordingly.
