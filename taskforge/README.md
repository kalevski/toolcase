# TaskForge

Self-hosted, single-process **Next.js** control panel that drives the
[Claude Code](https://claude.com/claude-code) CLI over a set of local git
repositories. Each repository has a queue of Markdown task files; TaskForge runs
`claude` over them one at a time, streams the output live, survives usage-limit
walls by sleeping until reset, retries transient failures, and can be gracefully
or forcibly stopped.

Durable state lives under `WORKSPACE_DIR` (default `/workspace`): a single
SQLite file (`node:sqlite`) as the system of record, with task/knowledge
markdown bodies on disk beside it. Authentication is **GitHub OAuth2**; the
first user to sign in becomes `owner`, everyone else lands as `guest` until the
owner promotes them.

See [`ai-manager.md`](../ai-manager.md) for the full specification.

## Quick start (Docker)

The build context is the **monorepo root** (TaskForge's `@toolcase/*` deps are
`file:../` workspace siblings):

```bash
cp taskforge/.env.example taskforge/.env    # fill TASKFORGE_GITHUB_* + TASKFORGE_AUTH_SECRET + TASKFORGE_OAUTH_REDIRECT_URI
docker build -t taskforge -f taskforge/Dockerfile .

# run — keeps the workspace on the host, reuses the host's logged-in claude CLI
docker run -d --restart unless-stopped \
  --name taskforge \
  -p 3000:3000 \
  --env-file taskforge/.env \
  -v "$HOME/taskforge-workspace:/workspace" \
  -v "$(readlink -f "$(command -v claude)")":/opt/claude/claude:ro \
  -v "$HOME/.claude":/host-claude \
  -e WORKSPACE_DIR=/workspace -e HOME=/workspace \
  -e CLAUDE_BIN=/opt/claude/claude -e CLAUDE_CONFIG_DIR=/host-claude \
  -e PORT=3000 -e HOSTNAME=0.0.0.0 \
  taskforge
```

`./taskforge/run-docker.sh` wraps this — it resolves the host `claude` binary +
login dir, optionally mounts SSH/git credentials, runs as your uid so mounts
stay writable, and supports a `NETWORK=` reverse-proxy mode. Run it as the user
that owns `~/.claude` and the workspace dir.

The agent uses the `claude` CLI directly — **no API key**. Either run
`claude login` inside the container, or reuse the host's logged-in CLI (below).

### Use the host's claude CLI (Docker on a Linux host)

`run-docker.sh` reuses the **host's** logged-in `claude` instead of
authenticating inside the container — this is its default behavior. It mounts the
host binary and login store, and runs as your uid so every mount stays
readable/writable. The host must share the container's CPU arch (the binary runs
unchanged inside).

1. On the host: install claude and run `claude login` once.
2. (optional) Override the host paths it mounts via env — defaults shown:

   ```bash
   HOST_CLAUDE_BIN=$(command -v claude)   # host claude binary (symlink resolved)
   HOST_CLAUDE_CONFIG=$HOME/.claude       # host login dir (.credentials.json + skills/)
   HOST_WORKSPACE=$HOME/taskforge-workspace
   ```

3. `./taskforge/run-docker.sh`. It bind-mounts the resolved binary at
   `CLAUDE_BIN=/opt/claude/claude` and the config dir at
   `CLAUDE_CONFIG_DIR=/host-claude`, so spawned `claude` processes use the host's
   binary and session. If an SSH key exists at `$HOME/.ssh/id_ed25519` it is also
   mounted (for `git push`).

If you skip the script and run the image directly without these mounts, the
image's bundled claude is used and you authenticate it inside the container.

Clone the repositories you want to manage into the mounted workspace:

```bash
git clone <url> "$HOME/taskforge-workspace/projects/<name>/repo"
```

Then open `http://localhost:3000` and sign in with GitHub (first login = owner).

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

The UI is built on a small, locally vendored component kit under
`components/ui/` (plain React + CSS, SSR-safe), plus `@toolcase/base`. It expects
`claude` and `git` on `PATH` (the Docker image installs both).

## Layout

```
app/            Next.js App Router — pages + api/** route handlers
components/     client compositions over the local components/ui kit
components/ui/  vendored React UI kit (Button, Modal, Table, charts, …) + styles.css
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

## Environment variables

The `claude` CLI authenticates itself — there is **no API-key env var**. The
table below is the high-traffic subset; [`.env.example`](./.env.example) is the
exhaustive, commented list.

Every app-owned variable is namespaced **`TASKFORGE_*`** (e.g.
`TASKFORGE_GITHUB_CLIENT_ID`); the bare name still works as a fallback for
existing deployments, and the prefixed form wins when both are set. The tables
below spell out the prefix for the required/auth vars; the remaining tables use
the short form — prefix them the same way. Shared infra knobs (`PORT`,
`DB_PATH`, `WORKSPACE_DIR`) stay bare.

### Required

| Variable | Description |
|---|---|
| `TASKFORGE_GITHUB_CLIENT_ID` | GitHub OAuth app client ID. |
| `TASKFORGE_GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret. |
| `TASKFORGE_OAUTH_REDIRECT_URI` | OAuth callback URL — must exactly match the GitHub app. |
| `TASKFORGE_AUTH_SECRET` | HMAC key for session + OAuth state. Use a long random string. |

### Auth / workspace

| Variable | Default | Description |
|---|---|---|
| `TASKFORGE_PUBLIC_ORIGIN` | origin of the redirect URI | Public scheme+host the browser uses; set only when a proxy strips the path. |
| `TASKFORGE_GITHUB_ALLOWED_LOGINS` | _(open)_ | Comma-separated GitHub logins allowed to sign in. |
| `TASKFORGE_GITHUB_ALLOWED_ORG` | _(none)_ | Require membership of this GitHub org. |
| `TASKFORGE_SESSION_TTL` | `86400` | Session lifetime in seconds. |
| `WORKSPACE_DIR` | `/workspace` | Durable state dir (projects, skills, SQLite). |
| `DB_PATH` | `$WORKSPACE_DIR/taskforge.db` | SQLite system-of-record path. |
| `PORT` | `3000` | HTTP listen port. |

### Agent / model

| Variable | Default | Description |
|---|---|---|
| `CLAUDE_BIN` | `claude` | Path to the `claude` binary the app spawns. |
| `CLAUDE_CONFIG_DIR` | _(inherited)_ | claude login/config dir (holds `.credentials.json`). |
| `SKILLS_DIR` | `$WORKSPACE_DIR/skills` | User-level skills the agent can load. |
| `DEFAULT_MODEL` | `claude-sonnet-4-6` | Model used when a task/project names none. |
| `MODEL_CATALOG` | `fast,mid,deep,…` | Models selectable in the UI (comma-separated). |
| `DEFAULT_ACCOUNT` | _(inherited identity)_ | Fallback Claude-account alias (multi-account registry). |
| `AGENT_EXTRA_ARGS` | `--print --output-format=stream-json …` | Extra args appended to every `claude` invocation. |

### Limits / retry / usage gate

| Variable | Default | Description |
|---|---|---|
| `LIMIT_AUTO_SLEEP` | `1` | Sleep until reset on a usage-limit wall instead of failing. |
| `LIMIT_SLEEP_BUFFER` / `LIMIT_SLEEP_FALLBACK` / `LIMIT_SLEEP_MAX` | `60` / `1800` / `21600` | Limit-sleep timing (seconds). |
| `LIMIT_MAX_RETRIES` | `5` | Retries after a limit wall. |
| `TRANSIENT_MAX_RETRIES` / `TRANSIENT_BASE_DELAY` | `3` / `10` | Transient-failure retry count + base backoff (s). |
| `USAGE_GATE_ENABLED` / `USAGE_GATE_THRESHOLD` / `USAGE_GATE_POLL_SECONDS` | `1` / `95` / `1800` | Pre-emptively pause near the usage cap. |

### Commit / git / notify

| Variable | Default | Description |
|---|---|---|
| `COMMIT_AFTER_TASK` | `0` | Commit the working tree after each task. |
| `COMMIT_MESSAGE_MODE` | `taskname` | `taskname` or `ai` (model-written message). |
| `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL` | `taskforge` / `bot@taskforge.local` | Commit identity. |
| `GIT_REMOTE_TOKEN` | _(none)_ | HTTPS token for `git push` (GitHub scope `repo`). |
| `SLACK_WEBHOOK_URL` / `NOTIFY_WEBHOOK_URL` | _(none)_ | Notification sinks. |
| `LOG_RETENTION_HOURS` | `168` | Run-log retention. |

`git push` requires a container-level credential — either `GIT_REMOTE_TOKEN`
(HTTPS) or a mounted SSH deploy key (set `GIT_SSH_CONFIGURED=1`). It is **not**
derived from the OAuth login.

## Multiple Claude accounts

TaskForge can drive several Claude Code identities — separate Claude.ai
subscription seats and/or API credentials — and pick one per task by **alias**.
This spreads usage limits, isolates billing per project/client, and lets agents
run in parallel without one account throttling the rest. With no accounts
registered, TaskForge uses the single inherited `claude` identity as before.

### One config dir per alias

Each alias is one isolated Claude Code config directory — Claude Code keeps an
identity's credentials and `settings.json` under the dir named by
`CLAUDE_CONFIG_DIR`, so "switch account" just means "point `claude` at a
different dir." The dirs live under the workspace:

```
${WORKSPACE_DIR}/.claude-accounts/
├── alpha/        # CLAUDE_CONFIG_DIR for alias "alpha" (OAuth seat)
│   └── .credentials.json
├── beta/         # another OAuth seat
│   └── .credentials.json
└── ci-bot/       # API-key alias — no creds file
```

A registry maps each alias to its dir and auth method. **API keys never live in
the registry** — an api-key alias references its key by the *name* of an env var
(e.g. `TASKFORGE_CIBOT_KEY`), and you supply the value as that env var (see
`.env.example`). OAuth aliases need no env var; their token lives in the dir.
Lock the `.claude-accounts/` tree down (`chmod 700`) and keep it out of git —
the `.credentials.json` tokens are secrets.

### Authorizing an account

**OAuth (personal / subscription) alias** — one-time, interactive, run on the
host (a browser must open):

```bash
CLAUDE_CONFIG_DIR=${WORKSPACE_DIR}/.claude-accounts/alpha claude /login
```

Log in with the account for that alias; the token lands in
`alpha/.credentials.json` and refreshes automatically thereafter. Repeat with a
different folder per personal alias.

**API-key alias** — no browser. Register the alias against an env-var name and
define that var (in `.env` or a secret manager); TaskForge injects it as
`ANTHROPIC_API_KEY` for that alias's runs.

### Selecting an account per task

- **Per task** — add an `**Account:**` facet to the task file; the dispatcher
  resolves it to that alias's config dir (and API key, if any) for the run.
- **Per project** — a project may set a default alias used by tasks that name
  none.
- **Global fallback** — `DEFAULT_ACCOUNT` (see `.env.example`) is the last
  resort when neither the task nor the project specifies one. Empty =
  single-account behavior.

### Round-robin and failover

Across OAuth aliases, TaskForge can round-robin / least-recently-used to spread
subscription limits, and on a `429`/quota error it marks the offending alias as
cooling-down and fails over to the next available one. Distinct config dirs mean
no credential-file races, so aliases are safe to run concurrently.

### Terms-of-service caveat

API keys are the clean path for heavy headless/batch load. Before automating
personal **subscription** seats, confirm Anthropic's terms permit programmatic
use of those seats for automated work — use personal OAuth for interactive/dev
and API keys for unattended throughput.
