# TaskForge

Self-hosted, single-process **Next.js** control panel that drives the
[Claude Code](https://claude.com/claude-code) CLI over a set of local git
repositories. Each repository has a queue of Markdown task files; TaskForge runs
`claude` over them one at a time, streams the output live, survives usage-limit
walls by sleeping until reset, retries transient failures, and can be gracefully
or forcibly stopped.

It is **database-free** — all durable state lives on the filesystem under
`WORKSPACE_DIR` (default `/workspace`). Authentication is **GitHub OAuth2**; the
first user to sign in becomes `admin`, everyone else lands as `guest` until an
admin promotes them.

See [`ai-manager.md`](../ai-manager.md) for the full specification.

## Quick start (Docker)

```bash
cp .env.example .env        # fill in GitHub OAuth + AUTH_SECRET
docker compose up --build
```

The agent uses the `claude` CLI directly — no API key. Either run `claude login`
inside the container, or reuse the host's logged-in CLI (below).

### Use the host's claude CLI (Docker on a Linux host)

Mount the host's `claude` binary and login store into the container instead of
authenticating separately. The host must share the container's CPU arch (the
binary runs unchanged inside).

1. On the host: install claude and run `claude login` once.
2. In `.env`, point the compose knobs at the host paths and run as the uid that
   owns them:

   ```bash
   HOST_CLAUDE_BIN=/root/.local/bin/claude   # host claude binary
   HOST_CLAUDE_CONFIG=/root/.claude          # host login dir (.credentials.json)
   RUN_AS=0:0                                # uid:gid owning ~/.claude + /workspace
   ```

3. `docker compose up`. The compose file bind-mounts `HOST_CLAUDE_BIN` over
   `CLAUDE_BIN` (default `/usr/local/bin/claude`) and `HOST_CLAUDE_CONFIG` over
   `CLAUDE_CONFIG_DIR` (default `/home/app/.claude`), so spawned `claude`
   processes use the host's binary and session.

`RUN_AS` must match the uid/gid that owns the mounted `~/.claude` **and**
`/srv/taskforge/workspace` (else claude can't read its credentials or the engine
can't write the workspace). If you skip these knobs, the image's bundled claude
is used and you authenticate it inside the container.

Clone the repositories you want to manage into the mounted workspace:

```bash
git clone <url> /srv/taskforge/workspace/repos/<name>
```

Then open `http://localhost:3000` and sign in with GitHub (first login = admin).

## Local development

**Requires Node >= 22.5** (Node 24 recommended) for the built-in `node:sqlite`
module that backs the app's persistence layer (`server/db.ts`). On older Node the
app starts but fails fast with a clear message the first time it touches the DB.
The Docker image pins `node:24-slim`.

```bash
nvm use 24           # or any Node >= 22.5
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm run build        # produces .next/standalone
```

The app depends only on the published `@toolcase/react-components` (+ its
`@toolcase/base` peer) for UI. It expects `claude` and `git` on `PATH`
(the Docker image installs both).

## Layout

```
app/            Next.js App Router — pages + api/** route handlers
components/     client compositions over @toolcase/react-components
skills/         bundled read-only app skills (task-creator, commit-message)
middleware.ts   thin edge auth gate (full verify happens in the Node layer)
server/         server-only code, n-layer architecture (deps point downward):
  config.ts          cross-cutting config (importable by any layer)
  web/               presentation adapters: http, sse, page-guards
  services/          use-cases: execution-manager, projects, provision,
                     knowledge, generate, usage, roles, auth, migrate-fs
  infrastructure/    external IO: agent (claude CLI), git, slack, fs-workspace,
                     logs, server-log
  data/              persistence: db (node:sqlite) + repositories/*
  domain/            pure types + logic: types, limit
```

Layer rule: `web → services → {infrastructure, data, domain}`; `infrastructure →
{data, domain}`; `data → domain`; `domain` depends on nothing. `config` is the
shared kernel any layer may import.

## Filesystem contract

```
/workspace
├── projects/<name>/         self-contained project (repo/, tasks/, knowledge/)
│   └── tasks/logs/          hourly-rotated run-*.log stream logs
├── skills/<skill>/SKILL.md  user-level skills
└── taskforge.db             SQLite — system of record for app state
```

SQLite (`server/db.ts` + `server/repositories/*`) is the system of record for
runtime state: task status + completion ledger, telemetry, users/roles, `/usage`
snapshots, warm sessions, project metadata, and the durable run-event log. The
**task and knowledge markdown bodies stay on disk** (the agent reads them); the DB
mirrors their metadata so the queue renders from one query. On first boot against
an existing `/workspace`, the legacy files (`.status`, `roles.json`,
`telemetry-*.jsonl`, `.usage-cache.json`, `project.json`, `.warm_session`) are
imported once into SQLite automatically.

## Key environment variables

Required: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OAUTH_REDIRECT_URI`,
`AUTH_SECRET`. The `claude` CLI authenticates itself (no API key env). See
[`.env.example`](./.env.example) for the full list (model catalog, limit/retry
tuning, commit + push credentials, log retention, Slack webhook, …).

`git push` requires a container-level credential — either `GIT_REMOTE_TOKEN`
(HTTPS, GitHub scope `repo`) or a mounted SSH deploy key (set
`GIT_SSH_CONFIGURED=1`). It is **not** derived from the OAuth login.
