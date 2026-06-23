---
name: taskforge
description: Use when reading or modifying the TaskForge application source (taskforge/) or when understanding how a TaskForge-managed project workspace is structured. Covers the full architecture: Next.js 15 + node:sqlite backend, 16 SQLite repositories and their schema, ~60 API routes by area, three-tier role model, multi-account LRU orchestration (account-repo / account-lru / account-secrets, per-task **Account:**, DEFAULT_ACCOUNT, cooldown/failover), cron scheduler (5-field subset), reviewer pass (review.ts, needs-review status), four bundled skills (task-creator / knowledge-writer / note-writer / commit-message), notes vs knowledge distinction, telemetry + usage gate, warm sessions, Git surface, audit / health / backups / search, webhook notifications, per-project settings, and GitHub allow-list / org membership gating.
---

# taskforge — Architecture Reference

TaskForge is a self-hosted autonomous task runner: a Next.js 15 (App Router) full-stack application that queues engineering tasks as Markdown files, delegates them one at a time to the Claude Code CLI, and surfaces progress through a real-time dashboard. All state persists in a single SQLite database via Node's built-in `node:sqlite`.

Stack baseline:

- Next.js 15 (App Router), React 19, TypeScript `strict`.
- `node:sqlite` (`DatabaseSync`) — synchronous, WAL journal, foreign keys on, 5 000 ms busy timeout.
- Prepared-statement cache (`Map<string, StatementSync>`) per `Database` singleton; re-used across calls.
- Claude Code CLI (`claude`) as the agent binary — spawned as child processes via `server/infrastructure/agent.ts`.
- GitHub OAuth for authentication; session tokens are `<base64url payload>.<base64url HMAC-SHA256 signature>`.
- Stateful singletons cached on `globalThis` (survive Next.js dev hot-reload) rather than a DI container.

---

## Table of contents

1. [Directory layout](#directory-layout)
2. [Data layer — SQLite](#data-layer--sqlite)
3. [The 16 repositories](#the-16-repositories)
4. [Schema highlights](#schema-highlights)
5. [Server layering](#server-layering)
6. [Three-tier role model](#three-tier-role-model)
7. [Multi-account orchestration](#multi-account-orchestration)
8. [Scheduler](#scheduler)
9. [Reviewer pass](#reviewer-pass)
10. [Four bundled skills](#four-bundled-skills)
11. [Notes vs knowledge](#notes-vs-knowledge)
12. [Telemetry](#telemetry)
13. [Usage tracking and usage gate](#usage-tracking-and-usage-gate)
14. [Warm sessions](#warm-sessions)
15. [Git surface](#git-surface)
16. [Audit log](#audit-log)
17. [Health](#health)
18. [Backups](#backups)
19. [Search](#search)
20. [Notifications](#notifications)
21. [Per-project settings](#per-project-settings)
22. [GitHub allow-list and org gating](#github-allow-list-and-org-gating)
23. [API routes by area](#api-routes-by-area)
24. [Task file format](#task-file-format)
25. [Environment variables](#environment-variables)
26. [SSE event types](#sse-event-types)
27. [Invariants](#invariants)

---

## Directory layout

```
taskforge/
├── app/                     # Next.js App Router
│   ├── api/                 # ~60 route handlers
│   │   ├── accounts/        # admin: account CRUD + health-check
│   │   ├── admin/           # admin: DB backup + project backup
│   │   ├── agent-defs/      # custom agent kinds
│   │   ├── audit/           # audit log (admin)
│   │   ├── auth/            # GitHub OAuth + logout
│   │   ├── health/          # liveness + readiness
│   │   ├── me/              # current user profile
│   │   ├── projects/        # project + task + run + git + knowledge + notes + …
│   │   ├── prompt-templates/
│   │   ├── skills/          # read installed skills
│   │   ├── telemetry/       # global cross-project cost
│   │   ├── usage/           # usage snapshot
│   │   └── users/           # admin: user CRUD
│   └── projects/[project]/  # dashboard pages
│       ├── page.tsx          # project overview
│       ├── tasks/            # task list
│       ├── run/              # run control
│       ├── runs/             # run history
│       ├── git/              # git panel
│       ├── knowledge/        # knowledge docs
│       ├── notes/            # notes
│       ├── agents/           # agent session panel
│       └── settings/         # project settings
├── server/                  # backend logic (no React, no Next APIs)
│   ├── config.ts            # all env vars → typed config object
│   ├── data/
│   │   ├── db.ts            # DatabaseSync wrapper + migration runner
│   │   ├── repositories/    # 16 repository files
│   │   ├── accounts.ts      # account service facade
│   │   ├── agent-sessions.ts  # agent session manager singleton
│   │   └── auth.ts          # OAuth flow + session mint/verify
│   ├── domain/
│   │   └── types.ts         # shared types + constants (no I/O)
│   ├── infrastructure/      # agent spawn, stream parser, fs-workspace, git, notify
│   ├── services/            # stateful logic (execution-manager, scheduler, review, …)
│   └── templates/           # CLAUDE.md and other text templates
└── skills/                  # four bundled Claude Code skills
    ├── task-creator/SKILL.md
    ├── knowledge-writer/SKILL.md
    ├── note-writer/SKILL.md
    └── commit-message/SKILL.md
```

---

## Data layer — SQLite

`server/data/db.ts` owns a single `DatabaseSync` instance. Boot-time initialization:

```ts
db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
`)
```

Schema migrations are an append-only `MIGRATIONS: string[][]` array. Each entry is a list of SQL statements; its position + 1 is its version number. A `schema_migrations` table tracks the applied version. On init, outstanding migrations run one at a time inside individual `tx()` calls.

`tx<T>(fn: () => T)` wraps synchronous work in `BEGIN / COMMIT / ROLLBACK`.

Prepared statements are cached by SQL text: `stmts: Map<string, StatementSync>`. The first call for a given SQL string calls `db.prepare(sql)` and caches the result; subsequent calls reuse the compiled statement.

---

## The 16 repositories

| File | Table(s) | Purpose |
|---|---|---|
| `account-repo.ts` | `account` | Register / list / pick accounts; atomic LRU pick + stamp |
| `agent-def-repo.ts` | `agent_def` | Custom agent kind definitions |
| `agent-prompt-repo.ts` | `agent_prompt`, `agent_prompt_history` | Per-project per-agent saved prompts + history |
| `audit-repo.ts` | `audit` | Append-only audit trail |
| `project-repo.ts` | `project` | Project registry; explicit cascading deletes |
| `prompt-history-repo.ts` | `prompt_template` | Shared reusable prompt templates |
| `run-event-repo.ts` | `run_event` | Durable event + log frames per run |
| `run-repo.ts` | `run` | Per-run lifecycle records |
| `schedule-repo.ts` | `schedule` | Per-project cron schedule |
| `search-repo.ts` | FTS5 virtual table | Full-text search over tasks, knowledge, notes |
| `settings-repo.ts` | `project_setting` | Per-project KV overrides |
| `task-repo.ts` | `task` | Task metadata synced from Markdown |
| `telemetry-repo.ts` | `telemetry` | Per-attempt execution records |
| `usage-repo.ts` | `usage_snapshot` | Cached `claude /usage` snapshots |
| `user-repo.ts` | `app_user` | Users, roles, first-admin bootstrap |
| `warm-session-repo.ts` | `warm_session` | Per-project warm session IDs |

---

## Schema highlights

All column names are `snake_case`. The schema was built across 6 migration versions.

**`project`** — `name` PK, `git_url`, `branch`, `created_at`.

**`task`** — composite PK `(project, id)`; `title`, `status` ∈ `'open'|'done'|'error'`, `severity`, `facet_project`, `model`, `account`, `depends` (CSV of task numbers), `last_error` (500-char cap), `synced_mtime`, `updated_at`. Indexed on `(project, status)`.

**`telemetry`** — one row per task attempt; `task`, `status` ∈ `'done'|'failed'|…`, `elapsed` (ms), `model`, `commit_sha`, `error`, `created_at`, `tokens_in`, `tokens_out`, `cost_usd`, `review` ∈ `'pass'|'fail'`, `review_note` (500-char cap). Indexed for latest-by-task lookups.

**`run`** — `id` (autoincrement), `project`, `started_at`, `finished_at`, `reason`, `options_json`, `done`, `total`, `error`, `started_by`, `branch`, `pr_url`.

**`run_event`** — `id` (autoincrement), `project`, `type`, `payload` (JSON), `run_id`, `created_at`. Indexed on `(run_id, id)`.

**`app_user`** — `github_id` PK, `login`, `name`, `avatar_url`, `role` ∈ `'admin'|'standard'|'guest'`, `added_at`.

**`account`** — `alias` PK (regex `/^[a-z0-9][a-z0-9-]{0,40}$/`); `auth` ∈ `'oauth'|'apikey'`; `dir` (workspace path); `label`; `api_key_env` (env-var **name** — never the key value); `last_used_at`; `cooling_until` (ISO-8601 or null).

**`schedule`** — `project` PK; `cron`, `options_json`, `enabled` (0|1), `only_if_pending` (0|1), `skip_above_usage` (percent or null), `last_fired_at`.

**`project_setting`** — composite PK `(project, key)`; `value` is JSON-encoded string.

**`agent_def`** — `kind` PK (regex `/^[a-z0-9][a-z0-9-]{1,40}$/`); `label`, `prompt_preamble`, `target` ∈ `'repo'|'tasks'|'knowledge'|'notes'|'project'`, `post` ∈ `'none'|'tasks'|'knowledge'|'notes'`, `created_at`.

**`audit`** — `id` (autoincrement), `at` (ISO-8601), `github_id`, `login`, `action`, `project`, `detail` (500-char cap).

**`warm_session`** — `project` PK, `session_id`, `ts` (epoch milliseconds).

**`usage_snapshot`** — `id` (autoincrement), `fetched_at`, `note`, `raw`, `max_percent`, `entries` (JSON).

---

## Server layering

```
app/api/**/route.ts          # auth-guard → parse body → call service/repo → HTTP response
server/services/             # stateful business logic — accounts, runs, scheduling, review
server/data/repositories/    # all SQL — one file per table cluster
server/data/db.ts            # single DatabaseSync handle + migration runner
server/infrastructure/       # pure helpers — agent spawn, stream parser, fs-workspace, git, notify
server/domain/types.ts       # shared TS types + constants (no I/O, innermost)
```

Route handlers use `guard(minRole)` from `server/web/http.ts`, which re-reads the calling user's role from the database on every request — the cookie role field is not trusted for authorization decisions.

Services call repositories; they never call `db.prepare()` directly. Repositories never call services.

---

## Three-tier role model

| Role | Rank | Capabilities |
|---|---|---|
| `guest` | 0 | Read-only access; cannot start runs or create tasks |
| `standard` | 1 | Full project operations (tasks, runs, knowledge, notes, settings) |
| `admin` | 2 | + user management, accounts, audit, backups, health details |

**Bootstrap**: the first user to sign in when no admin exists is automatically promoted to `admin` (`user-repo.ts: adminCount()` check at insert time).

**Last-admin guard**: `setRole()` throws if the target is the last `admin` and the new role would remove admin status.

**Per-request re-auth**: `authorize(minRole)` in `server/data/auth.ts` queries the live `app_user` row each request. An admin can promote/demote users and the change is effective on their next API call without requiring re-login.

---

## Multi-account orchestration

### Overview

TaskForge manages a pool of Claude accounts. The execution engine selects accounts via LRU rotation and cools them down on rate-limit (429) signals.

### Files

| File | Responsibility |
|---|---|
| `server/data/repositories/account-repo.ts` | Persist accounts; `pickLeastRecentlyUsed()` — atomic select + stamp |
| `server/services/account-lru.ts` | Pure LRU logic: `isEligible`, `compareLru`, `selectLru` — no I/O |
| `server/services/account-secrets.ts` | Secret redaction: `scrubSecrets`, `looksLikeApiKey` |
| `server/data/accounts.ts` | Service facade: `registerAccount`, `pickAccount`, `resolveAccount`, `verifyAccount`, `coolDownAccount` |

### Selection algorithm

`pickLeastRecentlyUsed(opts, now)` runs as a single SQLite transaction:
1. Load all eligible accounts (not currently cooling, matching optional `auth` / pool filter).
2. Sort by `last_used_at` ascending — never-used accounts first, ties broken by `alias`.
3. Stamp `last_used_at = now` on the winner atomically.
4. Return the selected account.

The pure logic lives in `account-lru.ts` (`selectLru`) and is exercised by unit tests without touching the database.

### Secret boundary

API key values are never stored. The `api_key_env` column holds only the **name** of the environment variable. `resolveAccount(alias)` reads `process.env[apiKeyEnv]` at spawn time and passes it to the child process as `ANTHROPIC_API_KEY`. `scrubSecrets` redacts any `sk-ant-*` pattern from agent stdout/stderr before logging.

### Per-task account override

A task file may include `**Account:** <alias>` in its metadata block. The execution engine reads this and selects that specific account instead of calling the LRU pool. If the named account is in a cooling period, the engine falls back to LRU selection.

### Default account

`config.defaultAccount` (env `DEFAULT_ACCOUNT`) names the account to use when no per-task override is set and only one account is registered. With multiple accounts, LRU rotation applies unconditionally.

### Cooldown and failover

On a `limit` / 429 signal from the CLI:
1. The current account is marked cooling: `coolDownAccount(alias, until)` sets `cooling_until` to the parsed reset time (or `now + limitSleepFallback` when no reset time is available).
2. The engine may retry the current task with a different LRU-eligible account.
3. If no eligible account is available, the engine sleeps (`computeLimitSleep`) — exponential back-off bounded by `config.limitSleepMax` (default 21 600 s / 6 h).
4. After at most `config.limitMaxRetries` (default 5) attempts, the task is marked `error`.

### Account health check

`verifyAccount(alias)` runs a cheap one-shot probe with `--permission-mode plan` and read-only output flags, then returns `AccountHealth { ok: boolean, detail: string }`. Secrets are scrubbed from the output before returning.

Account directories are created with mode `0o700` (owner read-write-execute only). `ensureAccountsDirSecure()` (called at boot) hard-sets the accounts directory and all children to `0o700`.

---

## Scheduler

`server/services/scheduler.ts`. Singleton on `globalThis`; started once at app boot.

### Cron expression subset

Five space-separated fields: `minute hour dom month dow`. Supported operators per field:

| Operator | Example | Meaning |
|---|---|---|
| `*` | `* * * * *` | any value |
| integer | `30` | exact match |
| list | `0,15,30,45` | any listed value |
| range | `1-5` | inclusive range |
| step | `*/15` or `0-59/5` | every N values |

`dow` value `7` is normalized to `0` (Sunday). When both `dom` and `dow` are non-`*`, standard cron semantics apply: a minute fires if **either** condition matches.

`parseCron(expr)` validates the expression and returns a parsed structure; throws `InvalidCronError` on malformed input.

### Tick loop

A `setInterval` (60 000 ms, `unref`'d) fires each minute. For each row where `enabled = 1`, the scheduler:

1. **De-dupe**: skips if `last_fired_at` is already within the current minute.
2. **Pattern match**: evaluates the cron expression against the current minute.
3. **Pre-flight guards** (all must pass):
   - Project execution lock held? → skip + log.
   - Agent session running for the project? → skip + log.
   - `skip_above_usage` configured? → probe `claude /usage`, parse `maxPercent`, skip if `maxPercent >= threshold`.
   - `only_if_pending`? → count open tasks, skip if zero.
4. **Merge options**: combines stored `options_json` with effective settings (`defaultModel`) and calls `executionManager.start(project, mergedOpts)`.
5. Stamps `last_fired_at = now`.

---

## Reviewer pass

`server/services/review.ts`. Optional post-task verification.

### When it runs

After a task finishes with status `done`, if the project's `review` setting is `true`, the execution engine invokes the reviewer before advancing to the next task.

### Mechanics

- **Model**: `config.reviewModel` (defaults to a haiku-class model).
- **Timeout**: `config.reviewTimeoutMs` (default 120 000 ms).
- **Input**: task body (capped to 6 000 chars) + staged diff (capped to 12 000 chars).
- **Prompt**: adversarial criteria — missing requirements, wrong files touched, incomplete implementation, contradicting changes.
- **Output parse**: first line must match `/^\s*(PASS|FAIL)\b/i`; remaining lines become the review note (capped to 500 chars).
- Returns `null` on timeout or spawn error — the reviewer is advisory and never blocks the run.

### Effect on task status

The verdict is stored via `telemetry.setReview(project, task, verdict, note)`:

- `review = 'pass'` → runtime status `'done'`.
- `review = 'fail'` → runtime status `'needs-review'` (the `task` row stays `done` in SQLite; the distinction is resolved in `projects.ts: getTasks()`).

A `needs-review` task must be manually reopened before it will be re-executed.

---

## Four bundled skills

Skills are SKILL.md files consumed by the Claude Code CLI (`--add-dir` makes the skills directory available in each agent run). Project workspaces get a symlink `.claude/skills → config.skillsDir` at creation time.

### task-creator

Creates numbered `.md` task files inside the project's `tasks/` directory.

- **Filename**: `<NNN>-<slug>.md` — NNN continues from the highest existing number (counting archived files in the A5 subdirectory via `nextTaskNumber()`).
- **Required metadata**: H1 title, `**Status:** open`.
- **Optional metadata**: `**Severity:**`, `**Project:**`, `**Model:**` (per-task model override), `**Depends:**` (comma-separated task numbers).
- **Sections**: `## Problem` + `## Task`.
- **Post-processing**: new files are reconciled into the `task` table and indexed in the FTS5 search table.

### knowledge-writer

Writes a single technical knowledge document into the project's `knowledge/` directory.

- **Filename**: kebab-case slug.
- **Required format**: H1 title + one-sentence summary on the immediately-following line (lifted verbatim into `knowledge/index.md`).
- `knowledge/index.md` is rebuilt automatically after each add/remove — the skill must not touch it.
- Triggered automatically after each successful task when `knowledgeAutoUpdate` is `true`.

### note-writer

Creates or edits a single free-form Markdown note in the project's `notes/` directory.

- **Edit mode**: changes only what the instruction specifies; no other files.
- **Create mode**: exactly one new `notes/<slug>.md`.
- May read `repo/` and `knowledge/` for context. Never modifies application source or commits.

### commit-message

Generates a Conventional Commits message from a staged diff.

- **Output**: plain message text only — no preamble, no code fences.
- **Format**: `type(scope): summary` — subject ≤ 72 chars, imperative mood, no trailing period.
- **Body**: optional 1–3-line explanation when the why is non-obvious.
- **Model**: `config.commitModel` (defaults to a haiku-class model).
- **Timeout**: `config.generateTimeoutMs` (default 120 000 ms).
- Returns `null` on timeout or non-zero exit; the engine falls back to the task filename as the commit message.

---

## Notes vs knowledge

| | `knowledge/` | `notes/` |
|---|---|---|
| **Purpose** | Source-anchored technical reference docs | Free-form context (decisions, scratchpad, meeting notes) |
| **Structure** | H1 + one-sentence summary + body; `index.md` auto-rebuilt | H1 + free Markdown |
| **Auto-update** | `knowledge-writer` runs after task when `knowledgeAutoUpdate = true` | Never auto-updated |
| **Written by** | `knowledge-writer` skill | `note-writer` skill |
| **Consumed by** | Agent at run time via `knowledge/index.md` | Explicit agent reference |

---

## Telemetry

One row per task attempt in the `telemetry` table.

Key `telemetry-repo.ts` methods:

| Method | Returns |
|---|---|
| `record(project, rec)` | Insert new attempt |
| `setReview(project, task, verdict, note)` | Stamp `review` + `review_note` on latest row |
| `latestByTask(project)` | `Map<taskId, TelemetryRecord>` — latest attempt per task by autoincrement id |
| `costBetween(project, fromIso, toIso)` | Sum `cost_usd` for time window |
| `summary(project, days=30)` | `TelemetrySummary` — per-day series, per-model stats, top-5 slowest/most-expensive, retried tasks, totals |
| `globalCostPerDay(days)` | `[{date, costUsd}]` — cross-project daily cost |

`TelemetrySummary` is served by `GET /api/projects/[p]/telemetry/summary` and shown on the project dashboard. `globalCostPerDay` is served by `GET /api/telemetry/global` (admin telemetry page).

---

## Usage tracking and usage gate

`server/services/usage.ts` wraps `claude /usage` — a local, read-only command that reports Anthropic account usage without spending tokens.

- `refreshUsage(now)` — spawns `claude /usage`, parses output with `/^(.+?):\s*(\d+)%\s*used/i`, persists the result to `usage_snapshot`.
- `readUsageCache()` — returns the latest snapshot without spawning.
- Snapshot shape: `{ fetchedAt, note, entries: [{label, percent, resets?}], maxPercent }`.
- `UsageError` is thrown on timeout or unparseable output.

### Usage gate

When `config.usageGateEnabled` is `true` (default), the platform checks usage before allowing new runs:

- **Execution engine**: checks `maxPercent` against the effective `usageGateThreshold` before starting a run. If `maxPercent >= threshold`, the run is rejected with an error.
- **Scheduler**: checks the same threshold as a pre-flight guard before firing a scheduled run.
- **Threshold source**: project setting `usageGateThreshold` (1–100) overrides `config.usageGateThreshold` (default 95).
- **Background poll**: usage is refreshed on a `config.usageGatePollSeconds` (default 1 800 s) cadence independent of the scheduler.

---

## Warm sessions

The Claude Code CLI supports `--resume <session-id>` to continue a prior conversation context.

- Stored in `warm_session (project PK, session_id, ts)`.
- When a task finishes, the execution engine writes the session ID emitted by the CLI to the warm-session store.
- On the next run, if `warmSession` setting is `true` and the stored session is not older than `config.warmSessionMaxAge` (default 14 400 s / 4 h), the CLI is launched with `--resume <session_id>`.
- A stale or absent session ID causes a cold start — not an error.

---

## Git surface

### Engine-side

`server/infrastructure/git.ts` provides:

| Helper | Description |
|---|---|
| `clone(name, url, branch)` | `git clone`; optionally check out a specific branch |
| `setOriginUrlWithToken(name, url)` | Embed `GIT_REMOTE_TOKEN` in the origin URL for credential-less push |
| `isClean(name)` | Returns `true` if working tree is clean |
| `dirtyFiles(name)` | Returns list of modified/untracked files |
| `assertSafeGitUrl(url)` | Rejects local file paths at project-creation time |

`config.canPush()` returns `true` if `GIT_REMOTE_TOKEN` is set or `GIT_SSH_CONFIGURED=1`.

Before each run, the engine calls `isClean`. A dirty working tree returns HTTP 412 to the caller.

When `commitAfter` is enabled, the engine commits after each successful task. When `commitMessageMode = 'ai'`, the commit-message skill is invoked; otherwise the task filename is used. When `pushAfter` is enabled, the commit is pushed to origin. When `branchPerRun + openPr` are both enabled, a new branch is created at run start and a PR is opened at run end via the GitHub REST API (`server/infrastructure/github.ts`).

### API routes (Git)

| Method | Route | Description |
|---|---|---|
| GET | `/api/projects/[p]/git` | Status (clean flag + dirty files) |
| GET | `/api/projects/[p]/git/diff` | Staged + unstaged diff |
| GET | `/api/projects/[p]/git/files` | File tree |
| GET | `/api/projects/[p]/git/branch` | Current branch name |
| GET | `/api/projects/[p]/git/branches` | All local branches |
| GET | `/api/projects/[p]/git/commits` | Commit log |
| GET | `/api/projects/[p]/git/commits/[sha]` | Single commit detail |
| GET | `/api/projects/[p]/git/issues` | Open GitHub issues |
| POST | `/api/projects/[p]/git/commit` | Create a commit |
| POST | `/api/projects/[p]/git/push` | Push to origin |
| POST | `/api/projects/[p]/git/op` | Generic git operation (e.g. checkout) |
| POST | `/api/projects/[p]/git/revert` | Revert a commit |
| POST | `/api/projects/[p]/git/exec` | Raw git command (admin) |
| POST | `/api/projects/[p]/git/stash` | Stash changes |
| POST | `/api/projects/[p]/git/discard-paths` | Discard specific paths |
| POST | `/api/projects/[p]/git/pr` | Create a pull request |

---

## Audit log

`server/data/repositories/audit-repo.ts`. Append-only; writes are best-effort (never throws). Project deletion cascades task/run/telemetry rows but preserves audit entries.

Fields: `at` (ISO-8601), `github_id`, `login`, `action`, `project`, `detail` (500-char cap).

Audited actions: `task.create`, `run.start`, `run.stop`, `run.force`, `account.create`, `account.remove`, `backup.db`, `backup.project`, `user.role`, `project.create`, `project.delete`.

API: `GET /api/audit` — paginated (cursor: `beforeId`), filterable by `project`, `login`, and `action` prefix. Admin only.

`audit-repo.ts` helpers: `actions()` returns all distinct action names for filter dropdowns; `count()` returns total row count.

---

## Health

`GET /api/health` — lightweight liveness; always returns 200 OK. No auth required.

`GET /api/health/details` — detailed readiness. Admin only. Returns:

- Agent binary version (`claude --version` output).
- Git version.
- Disk free bytes on the workspace mount.
- SQLite DB file size + applied migration version.
- Per-project engine state snapshots (`IDLE` / `RESUMING` / `RUNNING` / `PAUSED` / `SLEEPING`).
- FTS5 availability flag (`searchAvailable()`).
- Non-sensitive account summaries (alias, auth, label, lastUsedAt).
- Config snapshot — operational values only; secrets redacted.

---

## Backups

| Route | Description |
|---|---|
| `GET /api/admin/backup/db` | `VACUUM INTO` a temp file, stream as binary download (`taskforge-YYYY-MM-DD.db`) |
| `GET /api/admin/backup/project/[project]` | Archive the project workspace tree and stream as download |

Both routes require `admin` role and emit an audit entry (`backup.db` / `backup.project`).

---

## Search

`server/data/repositories/search-repo.ts`. FTS5 virtual table lazily created at first use.

| Method | Description |
|---|---|
| `indexDoc(project, type, id, title, body)` | Delete-then-insert (upsert pattern); `body` capped at 200 000 chars |
| `removeDoc(project, type, id)` | Remove a single document |
| `removeProject(project)` | Remove all documents for a project |
| `search(project, query, limit)` | Tokenize query as quoted prefix terms + FTS5 `MATCH`; returns snippets with `<mark>` tags |
| `searchAvailable()` | Returns `false` if the SQLite build lacks FTS5 |

FTS5 fields: `project` (UNINDEXED), `type` (UNINDEXED), `doc_id` (UNINDEXED), `title`, `body`.

Search degrades gracefully: if FTS5 is unavailable, `search()` returns empty results and no boot failure or error surface occurs.

---

## Notifications

`server/infrastructure/notify.ts`.

Two sinks:

1. **Slack** — `SLACK_WEBHOOK_URL` env var.
2. **Generic JSON webhook** — `NOTIFY_WEBHOOK_URL` (global config) or `notifyWebhookUrl` (per-project setting override).

`notifyEvents` (comma-separated env var `NOTIFY_EVENTS`, or per-project override) controls which SSE event types trigger a notification. Known trigger event types: `task:done`, `task:error`, `completed`, `stopped`, `limit`.

---

## Per-project settings

Stored in `project_setting (project, key)`. Unset keys fall back to global config defaults.

| Key | Type | Default | Description |
|---|---|---|---|
| `defaultModel` | string | `config.defaultModel` | Model for all tasks (unless per-task override) |
| `defaultAccount` | string | `config.defaultAccount` | Account alias for LRU selection |
| `commitAfter` | boolean | `config.commitAfterTask` | Commit after each successful task |
| `commitMessageMode` | `'taskname'` \| `'ai'` | `config.commitMessageMode` | Commit message strategy |
| `commitModel` | string | `config.commitModel` | Model for commit-message skill |
| `warmSession` | boolean | `config.warmSession` | Resume prior Claude session |
| `knowledgeAutoUpdate` | boolean | `config.knowledgeAutoUpdate` | Run knowledge-writer after task |
| `usageGateThreshold` | number (1–100) | `config.usageGateThreshold` | Usage percent threshold to pause runs |
| `pushAfter` | boolean | `false` | Push commit to origin after task |
| `branchPerRun` | boolean | `false` | Create a branch per run |
| `review` | boolean | `false` | Run reviewer pass after task |
| `openPr` | boolean | `false` | Open a pull request at run end |
| `notifyEvents` | string[] | `config.notifyEvents` | Which events trigger webhook |
| `notifyWebhookUrl` | string | `config.notifyWebhookUrl` | Per-project webhook override |

`server/services/settings.ts` validates values on write: `defaultModel` must be in `config.modelCatalog`; `defaultAccount` must be a registered alias; `commitMessageMode` ∈ `{'taskname', 'ai'}`; `usageGateThreshold` ∈ [1, 100]; `notifyEvents` must be a subset of the `NOTIFY_EVENTS` constant.

---

## GitHub allow-list and org gating

Two optional guards in `server/data/auth.ts`, evaluated in `checkAllowlist(profile, token)` during the OAuth callback:

**Login allow-list** — `config.allowedLogins` (env `ALLOWED_LOGINS`, comma-separated). If non-empty, the authenticating user's `login` must appear in the list.

**Org membership** — `config.allowedOrg` (env `ALLOWED_ORG`). When set, the OAuth authorize URL requests the `'read:user read:org'` scope and the callback verifies the user is an active member of the named org via the GitHub API.

A user that fails either guard is redirected to `/no-access`. A user that passes both proceeds to session minting.

---

## API routes by area

### Authentication

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/auth/github` | — | Redirect to GitHub OAuth authorize; set CSRF state cookie |
| GET | `/api/auth/github/callback` | — | Exchange code, verify allowlist/org, mint session cookie |
| POST | `/api/auth/logout` | any | Clear session cookie |

### Current user

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/me` | any | Current user profile + role |

### Projects

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/projects` | standard | List all projects |
| POST | `/api/projects` | standard | Create project (clone + provision workspace) |
| GET | `/api/projects/[p]` | standard | Project detail |
| DELETE | `/api/projects/[p]` | admin | Delete project + workspace |

### Tasks

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/projects/[p]/tasks` | standard | List tasks with runtime status |
| POST | `/api/projects/[p]/tasks` | standard | Create task manually |
| GET / PATCH / DELETE | `/api/projects/[p]/tasks/[...id]` | standard | Read / update / delete single task |
| POST | `/api/projects/[p]/tasks/generate` | standard | Run task-creator agent |
| POST | `/api/projects/[p]/tasks/bulk` | standard | Bulk status change |
| POST | `/api/projects/[p]/tasks/archive` | standard | Archive completed tasks |
| POST | `/api/projects/[p]/tasks/reorder` | standard | Reorder task queue |
| POST | `/api/projects/[p]/tasks/reset-errors` | standard | Reopen errored tasks |
| POST | `/api/projects/[p]/tasks/feedback` | standard | Submit feedback on a task |
| POST | `/api/projects/[p]/tasks/import-issues` | standard | Import GitHub issues as tasks |

### Run control

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/projects/[p]/status` | standard | Current engine state snapshot |
| POST | `/api/projects/[p]/run/start` | standard | Start a run |
| POST | `/api/projects/[p]/run/stop` | standard | Stop running agent (SIGTERM) |
| POST | `/api/projects/[p]/run/force` | admin | Force-stop (SIGKILL) |
| POST | `/api/projects/[p]/run/skip` | standard | Skip the current task |
| GET | `/api/projects/[p]/stream` | standard | SSE stream of run events |

### Run history

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/projects/[p]/runs` | standard | List past runs (newest first, limit 50) |
| GET | `/api/projects/[p]/runs/[id]` | standard | Single run detail + event log |

### Agent sessions

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/projects/[p]/agents/[agent]/start` | standard | Start an agent session (task-creator, knowledge-writer, etc.) |
| POST | `/api/projects/[p]/agents/[agent]/stop` | standard | Stop an agent session |
| GET | `/api/projects/[p]/agents/[agent]/prompts` | standard | Get saved prompts for agent |

### Knowledge / Notes

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/projects/[p]/knowledge` | standard | List knowledge docs |
| GET / PUT / DELETE | `/api/projects/[p]/knowledge/[...id]` | standard | Read / write / delete a doc |
| GET | `/api/projects/[p]/notes` | standard | List notes |
| GET / PUT / DELETE | `/api/projects/[p]/notes/[...id]` | standard | Read / write / delete a note |

### Schedule

| Method | Route | Auth | Description |
|---|---|---|---|
| GET / PUT | `/api/projects/[p]/schedule` | standard | Read / update project schedule |

### Settings

| Method | Route | Auth | Description |
|---|---|---|---|
| GET / PUT | `/api/projects/[p]/settings` | standard | Read / update project settings |

### Search

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/projects/[p]/search` | standard | Full-text search (tasks + knowledge + notes) |

### Telemetry

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/projects/[p]/telemetry/summary` | standard | Per-project telemetry summary (30-day default) |
| GET | `/api/telemetry/global` | standard | Cross-project daily cost series (`?days=` 1–365) |

### CLAUDE.md

| Method | Route | Auth | Description |
|---|---|---|---|
| GET / PUT | `/api/projects/[p]/claude-md` | standard | Read / write project CLAUDE.md |

### Usage

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/usage` | standard | Latest cached usage snapshot (no spawn) |
| POST | `/api/usage` | standard | Refresh usage (spawns `claude /usage`); 502 on `UsageError` |

### Users (admin)

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/users` | admin | List all users |
| GET / PATCH / DELETE | `/api/users/[githubId]` | admin | Read / update role / remove user |

### Accounts (admin)

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/accounts` | admin | List accounts (non-secret view) |
| POST | `/api/accounts` | admin | Register account; returns optional `guidance` for OAuth |
| GET / PATCH / DELETE | `/api/accounts/[alias]` | admin | Read / update / remove account |
| POST | `/api/accounts/[alias]/verify` | admin | Run health-check probe |

### Agent definitions (admin)

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/agent-defs` | standard | List custom agent kinds |
| POST | `/api/agent-defs` | admin | Create custom agent kind |
| GET / PATCH / DELETE | `/api/agent-defs/[kind]` | admin | Read / update / remove |

### Prompt templates

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/prompt-templates` | standard | List shared prompt templates |
| POST | `/api/prompt-templates` | standard | Create template |
| GET / PATCH / DELETE | `/api/prompt-templates/[id]` | standard | Read / update / delete |

### Skills

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/skills` | standard | List installed skills |
| GET | `/api/skills/[name]` | standard | Read a skill's SKILL.md content |

### Audit (admin)

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/audit` | admin | Paginated audit log; filter by project / login / action prefix / `beforeId` cursor |

### Backup (admin)

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/backup/db` | admin | Stream full SQLite backup (`taskforge-YYYY-MM-DD.db`) |
| GET | `/api/admin/backup/project/[p]` | admin | Stream project workspace archive |

### Health

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | — | Liveness check (always 200) |
| GET | `/api/health/details` | admin | Readiness + config snapshot |

---

## Task file format

Tasks live in the project's `tasks/` directory. Filename: `<NNN>-<slug>.md` (three-digit zero-padded prefix).

```markdown
# Task title

**Status:** open
**Severity:** medium
**Project:** api
**Model:** deep
**Account:** prod-account
**Depends:** 001, 003

## Problem
…

## Task
…
```

Metadata lines parsed by `server/infrastructure/fs-workspace.ts`:

| Key | Values | Meaning |
|---|---|---|
| `Status` | `open` \| `done` \| `error` | Engine-written on completion; must be `open` to be picked up |
| `Severity` | `low` \| `medium` \| `high` \| `critical` | Priority hint |
| `Project` | string | Sub-project facet label |
| `Model` | alias or full model ID | Overrides run-wide model for this task only |
| `Account` | alias | Overrides LRU account selection for this task only |
| `Depends` | `NNN[, NNN…]` | Task numbers that must be `done` before this task is eligible |

Model aliases resolved in `server/infrastructure/agent.ts`: `fast` → haiku-class, `mid` → sonnet-class, `deep` → opus-class.

---

## Environment variables

All environment variables are read once in `server/config.ts` and exported as a typed config object. Nothing reads `process.env` outside this file.

| Variable | Default | Description |
|---|---|---|
| `GITHUB_CLIENT_ID` | required | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | required | GitHub OAuth app secret |
| `OAUTH_REDIRECT_URI` | required | OAuth callback URL |
| `PUBLIC_ORIGIN` | required | App public origin (cookie domain) |
| `AUTH_SECRET` | required | HMAC signing key for session tokens |
| `SESSION_TTL` | `86400` | Session lifetime (seconds) |
| `ALLOWED_LOGINS` | — | Comma-separated GitHub logins allow-list |
| `ALLOWED_ORG` | — | GitHub org name for membership gate |
| `AGENT_BIN` | `claude` | Path or name of Claude Code CLI |
| `DEFAULT_ACCOUNT` | — | Default account alias |
| `DEFAULT_MODEL` | `claude-sonnet-4-6` | Default agent model |
| `MODEL_CATALOG` | (built-in list) | Comma-separated valid model names + aliases |
| `AGENT_EXTRA_ARGS` | — | Extra args appended to every `claude` spawn |
| `WORKSPACE_DIR` | `/workspace` | Root directory for all project workspaces |
| `DB_PATH` | under `WORKSPACE_DIR` | SQLite file path |
| `SKILLS_DIR` | — | Path to bundled skills directory |
| `LIMIT_AUTO_SLEEP` | `true` | Sleep on 429 instead of aborting |
| `LIMIT_SLEEP_BUFFER` | `60` | Extra seconds added to rate-limit cooldown |
| `LIMIT_SLEEP_FALLBACK` | `1800` | Default sleep when no reset time is available (seconds) |
| `LIMIT_SLEEP_MAX` | `21600` | Maximum sleep cap (seconds) |
| `LIMIT_MAX_RETRIES` | `5` | Max 429-triggered retries per task |
| `TRANSIENT_MAX_RETRIES` | `3` | Max non-429 error retries |
| `TRANSIENT_BASE_DELAY` | `10` | Base delay for exponential back-off (seconds) |
| `USAGE_GATE_ENABLED` | `true` | Enable usage gate |
| `USAGE_GATE_THRESHOLD` | `95` | Percent threshold to pause new runs |
| `USAGE_GATE_POLL_SECONDS` | `1800` | Background usage refresh cadence |
| `WARM_SESSION` | `false` | Enable warm session resume globally |
| `WARM_SESSION_MAX_AGE` | `14400` | Max session age before cold start (seconds) |
| `FORCE_KILL_GRACE_MS` | `5000` | SIGTERM → SIGKILL grace period |
| `GENERATE_TIMEOUT_MS` | `120000` | task-creator agent timeout |
| `KNOWLEDGE_TIMEOUT_MS` | `300000` | knowledge-writer / note-writer agent timeout |
| `REVIEW_TIMEOUT_MS` | `120000` | reviewer pass timeout |
| `KNOWLEDGE_AUTO_UPDATE` | `true` | Run knowledge-writer after each successful task |
| `COMMIT_AFTER_TASK` | `false` | Commit working tree after each successful task |
| `COMMIT_MESSAGE_MODE` | `taskname` | `'taskname'` or `'ai'` (commit-message skill) |
| `COMMIT_MODEL` | haiku-class | Model for commit-message skill |
| `GIT_AUTHOR_NAME` | — | Git author name for engine commits |
| `GIT_AUTHOR_EMAIL` | — | Git author email for engine commits |
| `GIT_REMOTE_TOKEN` | — | Token embedded in origin URL for credential-less push |
| `GIT_SSH_CONFIGURED` | — | Set to `1` if SSH push is pre-configured |
| `LOG_RETENTION_HOURS` | `168` | Run log-frame retention (1 week) |
| `SLACK_WEBHOOK_URL` | — | Slack notification sink |
| `NOTIFY_EVENTS` | — | Comma-separated event types that trigger webhooks |
| `NOTIFY_WEBHOOK_URL` | — | Generic JSON webhook sink |
| `REVIEW_MODEL` | haiku-class | Model for reviewer pass |

---

## SSE event types

`GET /api/projects/[p]/stream` emits a stream of NDJSON frames. The execution engine keeps a ring buffer of the latest 1 000 frames; agent sessions keep 500 frames. Latecomers receive a replay of the buffer on connect.

| Type | Emitted by | Payload |
|---|---|---|
| `log` | Execution engine | Terminal output line |
| `task:begin` | Execution engine | `{ task }` |
| `task:done` | Execution engine | `{ task, elapsed, tokensIn, tokensOut, costUsd }` |
| `task:error` | Execution engine | `{ task, error }` |
| `commit` | Execution engine | `{ sha, message }` |
| `limit` | Execution engine | `{ account, resets? }` |
| `completed` | Execution engine | `{ done, total }` |
| `stopped` | Execution engine | — |
| `agent:log` | Agent session manager | Terminal output line |
| `agent:state` | Agent session manager | `{ status: 'idle' | 'running' }` |
| `agent:done` | Agent session manager | `{ kind }` |
| `knowledge` | Post-processing | `{ updated: string[] }` |
| `notes` | Post-processing | `{ updated: string[] }` |

---

## Invariants

- **One DB handle per process.** A single `DatabaseSync` instance owned by the `Database` singleton; nothing else calls `new DatabaseSync(...)`.
- **One execution engine per project.** `server/data/agent-sessions.ts` and the execution engine share a per-project lock; only one Claude process runs per project at any time.
- **No SQL in services.** Services call repositories; they never call `db.prepare()` directly.
- **API key values never persist.** Only `api_key_env` (the env-var name) is stored; the key is resolved from `process.env` at spawn time.
- **Audit entries are never deleted.** Project deletion cascades task/run/telemetry rows but preserves audit rows.
- **Review is advisory.** A `fail` verdict marks the task `needs-review` but never blocks commit or push.
- **Warm session age is checked before resume.** A session older than `warmSessionMaxAge` causes a cold start, not an error.
- **FTS5 is optional.** Search degrades to empty results if the SQLite build lacks the FTS5 extension; no boot failure.
- **`canPush()` gates push and PR creation.** Attempting to push without a token or SSH config configured will fail at the git layer; the engine surfaces the error as a task error.
