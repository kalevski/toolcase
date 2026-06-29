# Wharf

> *Docker's metaphor is maritime — ships carrying containers. A **wharf** is where
> containers dock to load and unload cargo.* Here the cargo is each container's
> configuration: env vars, secrets, feature flags, notes.

A self-hosted control panel for the configuration that feeds Docker containers
across projects and environments — plus a machine-facing **Agent API** and a Go
client (`wharf-client`) so containers pull that config at boot, and a `docker run`
command builder. Built on the `next-fullstack-app` blueprint.

## Two faces, two ports, one process

1. **Dashboard** (`PORT`, default 3000) — the GitHub-authenticated `tc-*` UI.
2. **Agent API** (`AGENT_PORT`, default 4000) — a cookieless, read-only HTTP
   listener that serves resolved env vars + flags to machines, authenticated by a
   per-instance secret key. **Bind it to the internal network — never publish it.**

## Access model

- **Global role** (`app_user.role`): `owner` (first login bootstraps to owner) or
  `guest`. Owner manages projects, users, memberships, backups.
- **Project role** (`project_member.project_role`): `developer` (env vars, flags,
  notes, may *reference* secrets by key) or `devops` (also secrets CRUD + reveal,
  instance keys, Docker builder, env cloning). Owner is `devops`+ everywhere.
- **Machine** (per-instance key): devops-equivalent for one instance on the Agent API.

The **secret-hiding invariant**: a developer wires a secret into a container's env
by picking its key, but never learns its value — values are served only by an
audited reveal endpoint (devops/owner) or the Agent API under a valid instance key.

## Develop

```bash
npm install
npm run build --workspace=@toolcase/base
npm run build --workspace=@toolcase/web-components
cp wharf/.env.example wharf/.env.local   # fill GITHUB_*, AUTH_SECRET, ENCRYPTION_KEY, OAUTH_REDIRECT_URI
npm -w @toolcase/wharf run dev            # dashboard on :4200, agent on AGENT_PORT
npm -w @toolcase/wharf test               # pure-domain unit tests (vitest)
npm -w @toolcase/wharf run typecheck
```

Requires **Node ≥ 22.5** (built-in `node:sqlite`).

## Docker

One image, three stages (Go client → Next build → slim runner). Build context is
the **monorepo root**:

```bash
docker build -t wharf -f wharf/Dockerfile .

# run — publishes ONLY the dashboard; the Agent API stays on the internal network
docker run -d --restart unless-stopped \
  --name wharf \
  -p 3000:3000 \
  --env-file wharf/.env \
  -v "$HOME/wharf-workspace:/workspace" \
  -e WORKSPACE_DIR=/workspace -e BACKUP_DIR=/workspace/backups \
  -e HOME=/workspace -e PORT=3000 -e AGENT_PORT=4000 -e HOSTNAME=0.0.0.0 \
  wharf
```

`./wharf/run-docker.sh` wraps this — bind-mounts state, runs as your uid, and
supports a `NETWORK=` mode where target containers reach the Agent API over the
same Docker network. **Never publish `AGENT_PORT` externally** — it serves
resolved secrets to machines.

## Environment variables

### Required

| Variable | Description |
|---|---|
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID. |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret. |
| `OAUTH_REDIRECT_URI` | OAuth callback URL — must exactly match the GitHub app. |
| `AUTH_SECRET` | HMAC key for session + OAuth state, e.g. `openssl rand -hex 32`. |
| `ENCRYPTION_KEY` | AES-256-GCM key for values at rest (secrets, notes, backups). 32-byte hex (64 chars). **Distinct from `AUTH_SECRET`.** |

### Auth / storage

| Variable | Default | Description |
|---|---|---|
| `ENCRYPTION_KEY_PREV` | _(none)_ | Previous encryption key kept during a rotation so old ciphertext/backups still decrypt. |
| `PUBLIC_ORIGIN` | origin of `OAUTH_REDIRECT_URI` | Public scheme+host; set only when a proxy strips the path. |
| `GITHUB_ALLOWED_LOGINS` | _(open)_ | Comma-separated GitHub logins allowed to sign in. |
| `GITHUB_ALLOWED_ORG` | _(none)_ | Require membership of this GitHub org. |
| `SESSION_TTL` | `86400` | Session lifetime in seconds. |
| `WORKSPACE_DIR` | `/workspace` | Durable state dir (holds the SQLite store). |
| `DB_PATH` | `$WORKSPACE_DIR/wharf.db` | SQLite system-of-record path. |
| `BACKUP_DIR` | `$WORKSPACE_DIR/backups` | Where encrypted DB snapshots are written. |
| `BACKUP_INTERVAL_HOURS` / `BACKUP_RETENTION` | `24` / `14` | Snapshot cadence + how many to keep. |
| `AUDIT_RETENTION_DAYS` | `90` | Audit-log retention. |

### Ports

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | **Dashboard** (human, GitHub-authenticated) — safe to publish. |
| `AGENT_PORT` | `4000` | **Agent API** (machine, instance-key) — bind to the internal network, **never publish**. |
| `AGENT_HOST` | `0.0.0.0` | Bind address for the Agent listener. |
| `WHARF_CLIENT_DIR` | `/app/wharf/client-bin` | Where the cross-compiled `wharf-client` binaries live (baked into the image), served at `/v1/client/*`. |

## Go client (`client-go/`)

```sh
wharf-client exec -- ./app          # fetch + inject env, exec the process
wharf-client write --format dotenv --out /app/.env
wharf-client serve --addr 127.0.0.1:9000   # loopback sidecar, live values
```

Containers can bootstrap it at boot — the Agent serves `install.sh` + the binaries:

```dockerfile
ENTRYPOINT ["sh", "-c", "wget -qO- \"$WHARF_URL/install.sh\" | sh -s -- exec -- \"$@\"", "sh"]
CMD ["./my-app"]
```

## Backups & restore

Encrypted (AES-256-GCM) SQLite snapshots are taken on a schedule and on demand
(`/admin/backups`), written to `BACKUP_DIR`. **Restore is a manual procedure**
(decision #15): stop the app → decrypt the blob with `ENCRYPTION_KEY` → replace
`DB_PATH` → restart. Keep the encryption key backed up out-of-band — losing every
keyring entry makes secrets and backups unrecoverable.
