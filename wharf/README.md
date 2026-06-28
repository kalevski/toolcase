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
./wharf/run-docker.sh        # publishes PORT; keeps AGENT_PORT internal; bind-mounts state
```

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
