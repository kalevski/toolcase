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

```bash
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
server/         engine, auth, roles, git, agent, logs, fs, sse (server-only)
components/     client compositions over @toolcase/react-components
skills/         bundled read-only app skills (task-creator, commit-message)
middleware.ts   thin edge auth gate (full verify happens in the Node layer)
```

## Filesystem contract

```
/workspace
├── repos/<name>/            managed git repositories
├── tasks/<name>/            *.md task files + .status + logs/ (hourly-rotated)
├── skills/<skill>/SKILL.md  user-level skills
└── .auth/roles.json         GitHub user → role map
```

## Key environment variables

Required: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `OAUTH_REDIRECT_URI`,
`AUTH_SECRET`. The `claude` CLI authenticates itself (no API key env). See
[`.env.example`](./.env.example) for the full list (model catalog, limit/retry
tuning, commit + push credentials, log retention, Slack webhook, …).

`git push` requires a container-level credential — either `GIT_REMOTE_TOKEN`
(HTTPS, GitHub scope `repo`) or a mounted SSH deploy key (set
`GIT_SSH_CONFIGURED=1`). It is **not** derived from the OAuth login.
