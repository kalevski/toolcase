# Perch

A self-hosted **control plane** that deploys a user's GitHub branch as a static
site. Perch is the human-facing UI and policy layer; it drives
[**nginxpilot**](../nginxpilot/) (the sync daemon next to nginx) entirely over
nginxpilot's admin REST API. Perch never sits in the request path and never
touches nginxpilot's filesystem — the two only share a network.

```
 user ──GitHub OAuth──► Perch (Next.js)  ──admin REST──►  nginxpilot  ──writes──► nginx docroot
                          │  SQLite state                  (fetch/deploy)
                          └─ plans, quotas, custom domains, sponsors
```

- **GitHub-authenticated.** First login bootstraps to `owner`; everyone else is a
  user. A site is "deploy this branch of this repo as static files."
- **Database-free deploys.** Perch only holds control-plane state (SQLite); the
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
- **Multi-realm.** One Perch can target several nginxpilot daemons ("realms");
  each realm's admin token is encrypted at rest (AES-256-GCM).

Built on Next.js 16 + React 19, rendered entirely with the `@toolcase/web-components`
(`tc-*`) UI kit. **Requires Node ≥ 22.5** (built-in `node:sqlite`).

## Quick start (local dev)

```bash
npm install
npm run build -w @toolcase/base -w @toolcase/web-components   # source deps
cp perch/.env.example perch/.env.local      # fill PERCH_GITHUB_* + PERCH_AUTH_SECRET + PERCH_OAUTH_REDIRECT_URI
npm -w @toolcase/perch run dev               # http://localhost:4100
```

Register a GitHub OAuth app whose **Authorization callback URL** exactly matches
`PERCH_OAUTH_REDIRECT_URI`. Generate the session secret with `openssl rand -hex 32`.

## Docker

One image; the build context is the **monorepo root** (Perch's `@toolcase/*`
deps are `file:../` workspace siblings). Perch reaches nginxpilot over a shared
Docker network — point `PERCH_NGINXPILOT_ADMIN_URL` at the daemon's service name
and keep that admin port off the public network.

```bash
# build (context = repo root)
docker build -t perch -f perch/Dockerfile .

# run — joins the nginxpilot network, keeps SQLite state on the host
docker run -d --restart unless-stopped \
  --name perch \
  --network nginxpilot-net \
  -p 4100:3000 \
  --env-file perch/.env \
  -v "$HOME/perch-workspace:/workspace" \
  -e WORKSPACE_DIR=/workspace \
  -e HOME=/workspace \
  -e PORT=3000 \
  -e HOSTNAME=0.0.0.0 \
  perch
```

`./perch/run-docker.sh` wraps this (bind-mounts state, runs as your uid so the
mounted store stays writable, and supports a `NETWORK=` proxy mode that doesn't
publish the port). Run it as the user that owns the workspace dir.

> The in-container app always listens on `3000` (the run command pins `PORT=3000`
> and maps the host port to it). `PORT` in `.env` only matters for local dev.

## Environment variables

`PERCH_*` are read by the app; `WORKSPACE_DIR`/`DB_PATH`/`PORT` are shared infra
knobs. Required vars fail fast at boot if missing.

### Required

| Variable | Description |
|---|---|
| `PERCH_GITHUB_CLIENT_ID` | GitHub OAuth app client ID. |
| `PERCH_GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret. |
| `PERCH_OAUTH_REDIRECT_URI` | OAuth callback URL — must **exactly** match the GitHub app's "Authorization callback URL". |
| `PERCH_AUTH_SECRET` | HMAC key for session cookie + OAuth state. ≥ 16 chars; use `openssl rand -hex 32`. |

### Auth / access

| Variable | Default | Description |
|---|---|---|
| `PERCH_PUBLIC_ORIGIN` | origin of `PERCH_OAUTH_REDIRECT_URI` | Public scheme+host the browser uses. Set only when it differs from the redirect URI (e.g. a proxy strips the path). |
| `PERCH_SESSION_TTL` | `86400` | Session lifetime in seconds. |
| `PERCH_ALLOWED_LOGINS` | _(open)_ | Comma-separated GitHub logins allowed to sign in. Empty = anyone. |
| `PERCH_ALLOWED_ORG` | _(none)_ | Require membership of this GitHub org to sign in. |

### nginxpilot integration

| Variable | Default | Description |
|---|---|---|
| `PERCH_NGINXPILOT_ADMIN_URL` | `http://127.0.0.1:9090` | Base URL of nginxpilot's admin REST API. Across containers, point at the daemon's service name (e.g. `http://nginxpilot:9090`). |
| `PERCH_NGINXPILOT_ADMIN_TOKEN` | _(none)_ | Bearer token matching nginxpilot's `admin.token_env`. Empty = unauthenticated (loopback only). |
| `PERCH_REALM_KEY` | HKDF from `PERCH_AUTH_SECRET` | Key encrypting each realm's stored admin token (AES-256-GCM). Any string (hashed to 32 bytes). |
| `PERCH_REALM_KEY_PREV` | _(none)_ | Previous realm key kept in the ring during a key rotation so old ciphertext still decrypts. |
| `PERCH_REALM_URL_ALLOWLIST` | _(none)_ | Comma-separated host globs an SSRF allowlist limits realm admin URLs to. |

### Plans / GitHub Sponsors

| Variable | Default | Description |
|---|---|---|
| `PERCH_SPONSORS_WEBHOOK_SECRET` | _(required for the webhook route)_ | HMAC secret GitHub signs `X-Hub-Signature-256` with. ≥ 16 chars. A forged/unsigned event can never grant a plan. |
| `PERCH_SPONSORS_TOKEN` | _(none)_ | Owner PAT the scheduled reconcile uses to read sponsorships and self-heal missed webhooks. Empty = reconcile no-ops. |
| `PERCH_SPONSORS_RECONCILE_CRON` | `*/15 * * * *` | 5-field cron for the reconcile ticker. |
| `PERCH_QUOTA_GRACE_SEC` | `86400` | Seconds an over-quota site keeps serving after it's flagged, before suspension. `0` = suspend on next pass. |

### Custom domains (certbot)

| Variable | Default | Description |
|---|---|---|
| `PERCH_INGRESS_IPV4` | _(empty → verify disabled)_ | Public IPv4 a custom domain's A record must point at; re-resolved server-side before issuing a cert. |
| `PERCH_INGRESS_IPV6` | _(none)_ | Public IPv6 for the AAAA record (optional). |
| `PERCH_NGINX_CONF_DIR` | `/etc/nginx/conf.d` | Dir Perch installs per-custom-domain vhosts into. |
| `PERCH_NGINX_RELOAD_CMD` | `nginx -s reload` | Command (argv, whitespace-split) to reload nginx after a custom-domain change. |
| `PERCH_CERTBOT_BIN` | `certbot` | certbot binary. |
| `PERCH_CERTBOT_EMAIL` | _(none)_ | ACME registration email. Empty registers without one (lab/dev). |
| `PERCH_CERTBOT_WEBROOT` | `/var/www/certbot` | Webroot the HTTP-01 challenge files are served from. |

### Storage / runtime

| Variable | Default | Description |
|---|---|---|
| `WORKSPACE_DIR` | `/workspace` | Durable state dir (holds the SQLite store). |
| `PERCH_DB_PATH` / `DB_PATH` | `$WORKSPACE_DIR/perch.db` | SQLite file path override. `PERCH_DB_PATH` wins. |
| `PORT` | `4100` (dev) / `3000` (container) | HTTP listen port. |

> Per-site GitHub tokens are stored as generated `PERCH_GH_TOKEN_<SITE_ID>` env
> names handed to nginxpilot fragments — not something you set by hand.

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

**Owner-only, and secrets are write-only.** Every Perch route is `authorize('owner')`-gated.
Private keys and provider tokens are POSTed but **never read back** — the list endpoints
return metadata only (provider names, mechanism, mtime), and nothing secret is logged or
audited (only the domain / provider name). Because these endpoints accept secret material,
exposing the realm's nginxpilot admin port **requires** its `admin.token_env` (which Perch
stores encrypted at rest per realm).

> **Two distinct cert mechanisms.** This page manages certs **on the nginxpilot daemon**
> (the per-realm, REST-driven model above). It is separate from the legacy host-level
> custom-domain path under *Custom domains (certbot)*, where Perch itself shells out to
> `certbot` and writes a vhost into its own nginx `conf.d/` (the `PERCH_CERTBOT_*` /
> `PERCH_NGINX_*` env vars). The two don't interact.
