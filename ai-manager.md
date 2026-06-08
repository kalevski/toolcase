# TaskForge — Specification

> **Name:** TaskForge (formerly `ai-task-manager`). The package/working name `ai-task-manager` still appears below where it maps to identifiers (cookie, dirs, env defaults); those are renamed during build.

## 1. Overview

**TaskForge** (`ai-task-manager`) is a self-hosted, single-process **Next.js** application that drives the [Claude Code](https://claude.com/claude-code) CLI over a set of local git repositories. It is a web control panel around the queued-execution pattern proven by the `executor.sh` reference script (§6): each repository has a queue of task files (Markdown); the app runs `claude` over them one at a time, streams the output live, survives usage-limit walls by sleeping until reset, retries transient failures, and can be gracefully or forcibly stopped.

It is intentionally **database-free**. All durable state lives on the filesystem:

- task queues and their completion status (`.status` file + a `Status:` header inside each task file),
- per-task telemetry and live run logs, **rotated hourly into a separate `logs/` directory**,
- user→role assignments (a single JSON file).

The app also performs **git actions** on the managed repositories: it requires a clean tree before a run, can optionally commit after each successful task (with an AI- or task-name-derived message), and exposes branch-create and push controls.

Runtime/transient state (what is executing *right now*) lives in process memory and is rebuilt from the filesystem on restart.

Authentication is **GitHub OAuth2**. Authorization is a three-tier role model (`admin` / `standard` / `guest`); the **first user to sign in becomes admin**, everyone else lands as `guest` with no access until an admin promotes them.

### 1.1 Goals

- Single container: SSR frontend **and** backend in one Next.js process.
- 100% of the UI assembled from `@toolcase/react-components` (v3.x).
- GitHub OAuth2 login; first user bootstraps as `admin`; role-gated features.
- Operate directly on the filesystem — no DB, no external services beyond GitHub (auth) and the Anthropic API (used by the `claude` CLI).
- Sequential, resumable, limit-aware task execution faithful to `executor.sh`.
- Per-run **model selection** in the UI before starting a run.
- **Clean-repo gate** before a run; **skip-and-continue** on failing tasks (mark error, move on).
- Optional **commit after each successful task** (AI-generated or task-name commit message), plus **branch-create** and **push** controls.
- **Hourly-rotated** logs and telemetry kept in a dedicated directory.
- A "task creator" that turns a free-text prompt into task files via a bundled skill.
- User-level skill management (create / edit / delete).
- Admin user-and-role management.

### 1.2 Non-goals

- A full identity provider or org/team sync. Auth is "is this GitHub user known, and what role did an admin give them".
- Horizontal scaling / multiple replicas (single-process, in-memory run state, file locks assume one node).
- Editing repository code in the UI (that is Claude's job). The app *does* commit/branch/push on explicit operator action, but never hand-edits source.
- A job-history database. History is what `.status` + the rotated `logs/` (telemetry + run logs) record on disk.
- Git hosting / PR management. The app pushes to an existing remote; opening PRs, merging, and review stay on GitHub.

---

## 2. Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 14+ (App Router), React 18, SSR |
| Language | TypeScript, 4-space indent, strict |
| UI library | `@toolcase/react-components@3.x` (+ peer `@toolcase/base@3.x`, `react`/`react-dom` ≥18) |
| Styling | The library's `style.css` + theme classes; **no** `border-radius` additions (library design rule) |
| Backend | Next.js Route Handlers (`app/api/**`) + Server Actions, same process |
| Auth | GitHub OAuth2 (authorization-code flow), signed `httpOnly` session cookie (HMAC-SHA256) |
| Authz | File-backed role map (`admin`/`standard`/`guest`), checked in middleware + per-route |
| Live output | Server-Sent Events (SSE) from a Route Handler |
| Process control | Node `child_process.spawn` of the `claude` CLI (args array, `detached` for process-group kill) |
| Git | `git` CLI via a `spawn` wrapper (`server/git.ts`) — status/commit/branch/push, argv array, no shell |
| Persistence | Filesystem only (no DB, no ORM) |
| Container | Multi-stage Docker, `node:20-slim`, `claude` CLI + `git` installed |

> The app depends only on `@toolcase/react-components` for UI. It does **not** import internal toolcase workspaces beyond the published package + its `@toolcase/base` peer.

---

## 3. Filesystem contract

A single root, `WORKSPACE_DIR` (default `/workspace`), holds everything. The task model mirrors `executor.sh`: **task files are never moved**; completion is tracked by a `.status` file plus a `Status:` header (`open`/`done`/`error`) the engine maintains inside each file. Logs and telemetry are **rotated hourly** into a per-repo `logs/` directory, kept separate from the task files.

```
/workspace
├── repos/                          # managed git repositories (one dir per repo)
│   ├── acme-api/                   # repo_name = "acme-api"
│   └── marketing-site/
├── tasks/                          # task queues, mirrored by repo name
│   └── acme-api/
│       ├── 001-add-healthcheck.md  # task file (Status: open|done|error inside)
│       ├── 002-fix-login.md
│       ├── .status                 # completed task rel-paths, one per line
│       ├── .lock                   # advisory run lock (held during a run)
│       ├── .warm_session           # captured session_id + timestamp (warm mode)
│       └── logs/                    # hourly-rotated logs + telemetry (§6.9)
│           ├── run-2026-06-08T14.log        # live run log, the hour 14:00–15:00
│           ├── run-2026-06-08T15.log
│           ├── telemetry-2026-06-08T14.jsonl
│           └── telemetry-2026-06-08T15.jsonl
├── skills/                         # user-level Claude skills (managed by the app)
│   └── <skill-name>/SKILL.md
└── .auth/
    └── roles.json                  # GitHub user → role map (§4.3)
```

### 3.1 Definitions

- **Repository** — a direct child directory of `/workspace/repos`. `repo_name` is the directory name.
- **Task file** — a `*.md` file under `/workspace/tasks/<repo_name>/` (discovered recursively, sorted lexicographically). Convention: zero-padded numeric prefix (`001-…md`).
- **Completed task** — a task whose relative path is listed in `.status`. On success the engine flips the file's `Status:` header from `open` to `done`. `.status` is the source of truth for resume; the header is human-facing.
- **Pending task** — a discovered task **not** present in `.status`.
- **Errored task** — a task whose run exited non-zero (non-transient) or emitted `is_error=true`. The engine sets its `Status:` header to `error`, records the failure in telemetry, and **continues to the next task** (skip-and-continue). It is **not** added to `.status`, so a later rerun retries it (an errored task is re-attempted unless filtered out).
- **`.status`** — one completed relative path per line; exact-match check (`grep -Fxq` equivalent). Resume = skip everything already in `.status`.
- **Telemetry** — append-only JSONL under `logs/telemetry-<YYYY-MM-DDTHH>.jsonl`, one object per task attempt: `{ task, status: "done"|"error", elapsed, model, commit?, timestamp, error? }`.
- **Run log** — live, append-only log under `logs/run-<YYYY-MM-DDTHH>.log` with `===== BEGIN <rel> =====` / `===== END <rel> (exit=…, …s) =====` markers; what the UI terminal tails.

### 3.2 Task file format

Plain Markdown with a `Status:` header the engine and Claude read/write. Optional facet fields (`Severity`, `Project`) drive filters (§6.7).

```markdown
# Add /healthz endpoint

**Status:** open
**Severity:** high
**Project:** api

## Problem
There is no liveness endpoint.

## Task
Add a `/healthz` route returning `{ status: "ok" }` (HTTP 200) and a test.
Do not modify unrelated routes.
```

- **Title** = first H1, else the filename stem.
- **Status** = `open` (pending), `done` (engine sets on success), or `error` (engine sets on failure).
- **Severity / Project** = optional facets; read from the `**Field:** value` bold-list style or YAML frontmatter (`priority:` / `tags:`) as a fallback — same parsing as `executor.sh`'s `task_facet`.

### 3.3 Why filesystem-as-state works

- **Completion** survives restarts (`.status` on disk), independent of process memory.
- **In-flight** is the only memory-only fact. If the process dies mid-task, the task is absent from `.status` → picked up again next run. Tasks must be authored idempotently (documented to operators).
- **One writer**: a per-repo `.lock` (advisory file lock) serializes runs and rejects a second concurrent run (`executor.sh` exit 7 → HTTP `409`).

---

## 4. Authentication & authorization

### 4.1 GitHub OAuth2 (login)

Standard authorization-code flow, all server-side:

1. Unauthenticated requests to protected routes redirect to `/login`.
2. `/login` shows a single **"Sign in with GitHub"** action (`Login` component `connect` option — its OAuth shape fits exactly).
3. `GET /api/auth/github` redirects to GitHub's authorize URL with `client_id`, `redirect_uri`, `scope=read:user`, and a signed random `state` (CSRF) stored in a short-lived cookie.
4. GitHub calls back `GET /api/auth/github/callback?code=…&state=…`. Server verifies `state`, exchanges `code` for an access token (`GITHUB_CLIENT_SECRET`), then fetches the GitHub profile (`id`, `login`, `name`, `avatar_url`).
5. Server resolves/assigns the user's role (§4.3), then issues a signed session cookie:
   - `Set-Cookie: atm_session=<payload>.<hmac>; HttpOnly; SameSite=Lax; Path=/; Secure; Max-Age=SESSION_TTL`
   - Payload: `{ sub: <github_id>, login, role, iat, exp }`, base64url; HMAC-SHA256 keyed by `AUTH_SECRET`.
6. Middleware verifies signature + expiry on every protected request and re-reads the role from `roles.json` on each request (so a demotion/promotion takes effect without re-login — the cookie `role` is a hint, the file is authoritative).
7. `POST /api/auth/logout` clears the cookie.

> The GitHub access token is used only during callback to read the profile; it is **not** persisted. The session is the app's own signed cookie.

### 4.2 Roles

Three roles, strictly ordered:

| Role | Access |
|---|---|
| `admin` | Everything: all repos/tasks/execution, task creator, skills, **and user/role management**. |
| `standard` | All features **except** user/role management. Can run executions, create tasks, manage skills. |
| `guest` | **No access.** Sees only a "your account has no permissions, ask an admin" screen + logout. |

Capability checks (enforced server-side on every endpoint, mirrored in the UI):

| Capability | admin | standard | guest |
|---|:--:|:--:|:--:|
| View repos / tasks / live log | ✅ | ✅ | — |
| Start / stop / force execution | ✅ | ✅ | — |
| Task creator | ✅ | ✅ | — |
| Skill management | ✅ | ✅ | — |
| User & role management | ✅ | — | — |

### 4.3 Bootstrap & role storage

- Roles persist in `/workspace/.auth/roles.json`:
  ```json
  {
    "users": [
      { "githubId": 12345, "login": "octocat", "name": "The Octocat", "role": "admin", "addedAt": "2026-06-08T10:00:00Z" }
    ]
  }
  ```
- **First-login bootstrap**: when `roles.json` has no `admin` (empty/missing file), the first user to complete OAuth is written as `admin`. This is the "first logged-in user gets all permissions" rule.
- **Every subsequent new user** is written as `guest` on first login (recorded so an admin can see and promote them).
- An **admin** can change any user's role via the Users page (§9). An admin cannot demote themselves if they are the **last** remaining admin (guard against lockout).
- Writes are serialized in-process (single Node process) and written atomically (temp file + rename).

### 4.4 Hardening

- Fail-fast at boot if `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `AUTH_SECRET` are unset.
- `state` parameter signed + single-use to prevent CSRF / replay on the OAuth callback.
- Role re-checked from `roles.json` per request (cookie role is advisory only).
- Optional `GITHUB_ALLOWED_LOGINS` / `GITHUB_ALLOWED_ORG` allowlist: a login outside it is rejected before any role assignment (defense in depth; default: allow any GitHub user but land them as `guest`).
- No GitHub token, no secrets ever serialized to the client or written to logs.

---

## 5. UI / pages

All screens use `@toolcase/react-components`. Default light theme is the baseline; the neon theme is optional.

### 5.1 Component map

| Screen / element | Component(s) |
|---|---|
| App shell (top bar + sidebar + content) | `DashboardLayout` (`brandComponent`, `navbarRightComponent`, `sidebarMenuComponent`) |
| Brand | `Brand` |
| Sidebar nav (role-filtered) | `SideNav` (sections: *Repositories*, *Skills*, and *Users* for admin only) |
| Logged-in user chip / logout | `UserPanel` / `Avatar` + `Dropdown` in `navbarRightComponent` |
| Login screen | `Login` with one `connect` option → **"Sign in with GitHub"** (GitHub icon), optional `backgroundPattern` |
| Guest "no access" screen | `EmptyState` (icon, "No permissions yet — ask an admin", logout button) |
| Repository list | `AdvancedTable` (or `Card` grid): name, pending count, run state; `StatusDot` + `Badge` |
| Per-repo task queue | `AdvancedTable` — columns: #, title, severity/project chips, status |
| Task status | `StatusDot` (pending/running/done/failed) + `Badge` |
| Task detail | `Drawer` rendering the task Markdown |
| Repo git bar | current branch `Badge`, clean/dirty `StatusDot`, ahead/behind `Badge`, `Button` "New branch" (→ `FormInput` in modal), `Button` "Push" (§6.16) |
| Dirty-repo block | `Banner` listing uncommitted files when the clean-repo gate fails (§6.14) |
| Run config | **`Select` (model — chosen before Start, locked during a run; §6.11)**, `Switch` (warm session), `Switch` ("Commit after each task"), `RadioGroup`/`Select` (commit message: task-name vs AI), `Select` (commit-message model, enabled only for AI), `Input` (task filter), `Select`/`TagInput` (severity/project facets) |
| Execution controls | `Button` Start (disabled while repo dirty), `IconButton` Stop-after-current, `IconButton` Force-stop, `ProgressBar` (`done/total`, with an error count) |
| Live execution output | `TerminalWindow` (`lines: TerminalLine[]`, kinds `output`/`error`/`comment`) fed by SSE, tailing the active run log |
| Limit-sleep banner | `Banner` / `AnnouncementBar` ("Usage limit hit — sleeping until ~HH:MM, will resume task N") |
| Task creator | `MarkdownEditor`/`Textarea` for the prompt + `Button` "Generate tasks" |
| Skill manager list | `Table` / `ActionRowList` of skills |
| Skill editor | `FormInput` (name) + `MarkdownEditor` (SKILL.md body) + `Button` save |
| Users management (admin) | `AdvancedTable` of users + `Select`/`ExtendedSelect` per-row role picker |
| Confirm force-stop / delete / demote | Modal via `ModalContext` + `Window` + `useModalOpen` |
| Notifications | `ToastProvider` + `toast.success/error/...` |
| Empty states | `EmptyState` |
| KPIs (dashboard header) | `StatCard` / `MetricGrid` (repos, pending tasks, running) |

`ToastProvider` and `ModalContext` wrap the app once in the root layout; `@toolcase/react-components/style.css` is imported once there.

### 5.2 Routes

| Path | Render | Min role | Purpose |
|---|---|---|---|
| `/login` | public | — | GitHub sign-in |
| `/no-access` | protected | guest | "no permissions" screen |
| `/` | SSR | standard | Dashboard: repository list + KPIs |
| `/repos/[repo]` | SSR | standard | Task queue, run config + controls, live terminal, task creator |
| `/skills` | SSR | standard | Skill management list |
| `/skills/[name]` | SSR | standard | Skill editor (also handles "new") |
| `/users` | SSR | admin | User & role management |

`[repo]` / `[name]` validated against a strict charset and resolved within their base dir before any FS access (§10). Guests hitting any `standard` route are redirected to `/no-access`; standard users hitting `/users` get `403` → redirect home.

### 5.3 `/repos/[repo]` layout (primary screen)

```
┌─ DashboardLayout ───────────────────────────────────────────────┐
│ Brand                                   [@octocat ▾] [Logout]    │
├──────────────┬──────────────────────────────────────────────────┤
│ SideNav      │  Breadcrumb: Repos / acme-api                     │
│  Repositories│  Git: [feature/x ⎇] ●clean ↑2  [New branch][Push] │
│   • acme-api │  Run config: [model▾][warm⨉][commit⨉][msg▾][flt…] │
│   • mkt-site │  ┌ ProgressBar  3 / 7 done · 1 error ──────────┐  │
│  Skills      │  │ [▶ Start] [⏸ Stop after current] [⏹ Force]  │  │
│  Users (adm) │  └─────────────────────────────────────────────┘  │
│              │  Banner (dirty repo) / AnnouncementBar (limit)     │
│              │  AdvancedTable: task queue (#, title, status)      │
│              │  ──────────────────────────────────────────────── │
│              │  TerminalWindow (live run log via SSE)             │
│              │  ──────────────────────────────────────────────── │
│              │  Task creator: [ MarkdownEditor ] [ Generate ]     │
└──────────────┴──────────────────────────────────────────────────┘
```

---

## 6. Execution engine

A single in-process singleton, `ExecutionManager`, re-implements `executor.sh` in TypeScript. It owns at most **one** running `claude` child per repo lock, streams stream-json events to SSE, and reproduces the script's resume / limit / retry / warm-session behavior. The bash script in the prompt is the behavioral source of truth; this section maps each feature onto the app.

### 6.1 State machine

```
        start(repo, opts)  [requires clean tree — §6.14]
 IDLE ───────────────────▶ RUNNING ──(task ok)──▶ .status + Status:done + opt. commit
   ▲                         │  │  │                        │
   │ queue exhausted         │  │  │ stopAfterCurrent()     │ next task?
   ├─────────────────────────┤  │  └────────────▶ STOPPING  ├─yes─▶ RUNNING
   │ (incl. all errored)     │  │                  │        └─no──▶ IDLE (completed)
   │ task errored (continue) │  │                  ▼
   ├─────────────────────────┘  │         (current ends)→IDLE
   │ limit hit (auto-sleep) → SLEEPING ──(reset)──▶ retry SAME task (RUNNING)
   └─ force() at any time → kill process group → IDLE (task left pending)
```

A failing task does **not** halt the run: the engine marks it `error` (Status header + telemetry) and advances to the next task. The run ends only when the queue is exhausted, on graceful stop, or on force.

States surfaced to the UI: `IDLE`, `RUNNING`, `STOPPING` (graceful), `SLEEPING` (limit wait).

### 6.2 Run loop (per `start(repo, opts)`)

Mirrors the `while (( i < TOTAL ))` loop:

1. **Acquire lock** on `tasks/<repo>/.lock`. If held → reject `409` (executor exit 7).
2. **Clean-repo gate** (§6.14): `git status --porcelain` must be empty. Dirty → release lock, reject `412`, return the dirty paths.
3. **Discover** `*.md` under `tasks/<repo>/` recursively, sorted. Empty → `completed`, release lock, `IDLE`.
4. For each task in order, **skip** if: matches none of the active filters (task-filter / `RESUME_FROM` / severity / project — §6.7), or is already in `.status`.
5. **Run** the next eligible task:
   - Write `BEGIN` marker to the current-hour run log.
   - `spawn(agentBin, argv, { cwd: repoPath, detached: true, env })` (§6.4), where `repoPath = /workspace/repos/<repo>`.
   - Stream stream-json events: parse newline-delimited JSON; forward assistant text/tool lines to SSE + append to the run log; capture `session_id` (warm mode) and the final `result` event's `is_error`.
   - Write `END` marker (exit, elapsed).
6. **Classify outcome** (order matters):
   1. **Limit hit** (stderr matches limit regex) → §6.5 (sleep & retry, do **not** advance).
   2. **Process exit ≠ 0** → transient? §6.6 (backoff & retry the same task). Else → set `Status: error`, telemetry `error`, **advance to next** (skip-and-continue).
   3. **`is_error=true`** on the result event → set `Status: error`, telemetry `error`, **advance to next**.
   4. **Success** → capture warm `session_id` if first task; set `Status: done`; append rel-path to `.status`; **if commit-after-task is on, commit (§6.15)**; telemetry `done` (with commit sha if any); advance.
7. After advancing: if `STOPPING` → stop (graceful). If no more tasks → `completed` (the run summary reports done vs error counts). Else continue.
8. On any terminal path: release lock, clear `.warm_session`, optional Slack batch notify (§6.9).

The engine is authoritative for the `Status:` header — it sets `done` on success and `error` on failure (more reliable than depending on the agent). The run prompt (§6.10) still instructs the agent not to commit/push; **commits, when enabled, are made by the engine** (§6.15), one per successful task. With commit-after-task off, working-tree changes accumulate across tasks for a single manual commit (executor.sh behavior).

### 6.3 Stop semantics

- **Graceful** (`stopAfterCurrent`) → `state = STOPPING`; current task finishes and is marked; no further tasks start. (The script relies on Ctrl-C; the app adds this softer stop.)
- **Forced** (`force`) → send `SIGTERM` to the **process group** (`spawn` with `detached:true`, kill `-pid`) so `claude` + any children die together — the equivalent of the script's `kill -TERM "-$CLAUDE_PID"`. If still alive after `FORCE_KILL_GRACE_MS` (default 5000), `SIGKILL`. The task stays **pending** (never added to `.status`), telemetry records `failed`; partial working-tree edits remain (operator's responsibility). Confirmed via modal.
- **Auto** → queue exhausted → `completed`. Task failure → mark `error` and continue (the run is not stopped). The lock is released on the terminal path.

### 6.4 Spawning the agent

Backend-neutral wrapper (`server/agent.ts`) reproducing `lib/agent.sh` + `agent_build_argv`:

- `AGENT=claude` (default) or `cursor`. `agentBin` resolved on the host; `claude` is the default and what the Dockerfile installs.
- **Model**: passed per-run from the UI `Select` (neutral aliases `fast`/`mid`/`deep`, or a Claude slug e.g. `claude-sonnet-4-6`), resolved to the backend slug. Default `DEFAULT_MODEL`.
- **Output format**: `--print --output-format=stream-json --verbose` so events arrive newline-delimited in real time (the engine parses them; `--verbose` is mandatory with stream-json, exactly as the script notes).
- **Permission mode**: a non-interactive mode (e.g. `--permission-mode acceptEdits`) so autonomous solving can edit files. Centralized + overridable via `AGENT_EXTRA_ARGS`.
- **Warm session**: when enabled and a `session_id` was captured, append `--resume <session_id>` (§6.8).
- **Prompt**: the run preamble (§6.10) + the task file path, delivered as the final argv prompt arg (the script passes the full prompt; we keep parity). `cwd` = repo path. `env` carries `ANTHROPIC_API_KEY`. **No `shell:true`**, argv is an array — no shell injection.

### 6.5 Usage-limit handling (auto-sleep)

Faithful to `compute_limit_sleep` + the limit branch:

- Detect on **stderr only** (stdout stream-json can contain limit-shaped strings inside tool results — false positives) using the backend's limit regex.
- Parse the reset time from Claude's own output:
  1. `limit reached|<epoch>` (10-digit s or 13-digit ms),
  2. else an ISO-8601 timestamp near a "reset" mention.
- Sleep `reset − now + LIMIT_SLEEP_BUFFER` (default +60s), clamped to `LIMIT_SLEEP_MAX` (default 6h); if nothing parseable, `LIMIT_SLEEP_FALLBACK` (default 30m).
- After sleeping, **retry the same task** (never marked done). Count back-to-back limit hits per task; after `LIMIT_MAX_RETRIES` (default 5) give up → halt (executor exit 3).
- `LIMIT_AUTO_SLEEP=0` → fail-fast: halt immediately on a limit hit (CI behavior, executor exit 3).
- While sleeping the engine is in `SLEEPING`; the UI shows an `AnnouncementBar` with the wake time. The sleep is interruptible — a force-stop aborts the whole run.

### 6.6 Transient-failure retry

Mirrors the transient branch: when a non-limit failure's stderr looks transient (network/etc., via `categorize_error`), retry the **same task** with exponential backoff — `TRANSIENT_BASE_DELAY * 2^(n-1)` (default base 10s) — up to `TRANSIENT_MAX_RETRIES` (default 3, `0` disables). Exhausted → mark `error`, continue to the next task.

### 6.7 Filters & reset

- **task filter** — substring against the task's repo-relative path (UI `Input`; script positional arg).
- **`RESUME_FROM`** — lexicographic skip until a task path sorts `>=` the given prefix (jump into the middle without touching `.status`).
- **severity / project** — CSV facet filters; a task runs only if it matches every set filter. Severity also matches the filename (`016-high-…` ⇒ `high`).
- **FORCE / reset** — clear `.status` (and start fresh `logs/` telemetry) before the run so every task reprocesses, and reset each task's `Status:` header to `open` (UI "Re-run all" with confirm modal; script `FORCE=1`).
- **DRY_RUN** — list the agent invocation per eligible task and skip execution; `.status` untouched (UI "Preview run").

### 6.8 Warm session

Optional (`Switch` / `WARM_SESSION`): capture `session_id` from the first task's init event; subsequent tasks pass `--resume <id>` to keep the prompt cache warm (system prompt + tool defs + already-read files hit cache). Persisted to `.warm_session` (id + timestamp) so a crashed run leaves a breadcrumb; a marker older than `WARM_SESSION_MAX_AGE` (default 4h) is discarded at startup. Conversation context grows across tasks — operators reset periodically (the UI exposes a "fresh session" toggle which clears `.warm_session`).

### 6.9 Telemetry, logs (hourly rotation) & Slack

Logs and telemetry live in a dedicated per-repo `logs/` directory, **rotated by the hour** — the engine writes to a file named for the current `YYYY-MM-DDTHH` and rolls to a new file when the hour changes (no mid-task rotation; a task that spans an hour boundary keeps appending to the file it started in, and the boundary is crossed at the next `BEGIN`).

- **Telemetry** — `logs/telemetry-<hour>.jsonl`, one JSON object per task attempt (`done`/`error`, elapsed, model, commit sha if committed, ISO timestamp, error hint). Powers the queue table's status column and report views; readers glob all `telemetry-*.jsonl` and merge.
- **Run log** — `logs/run-<hour>.log`, append-only with BEGIN/END markers; the SSE stream tails the active file; a bounded in-memory ring buffer (last ~1000 lines) serves late subscribers / reconnects across a rotation.
- **Retention** — files older than `LOG_RETENTION_HOURS` (default 168 = 7 days; `0` = keep forever) are pruned on each rotation.
- **Slack** (optional `SLACK_WEBHOOK_URL`) — on run completion, post a batch summary of tasks completed this session (title + first line under `## Problem`), plus any errored tasks, like `notify_slack_batch`.

### 6.10 Run prompt (preamble)

The engine prepends a standard, configurable preamble instructing the agent to: read the task file at the given path, follow repo conventions (repo-root `CLAUDE.md` + `knowledge/`), respect hard rules, implement end-to-end, update affected specs, and **not stage/commit/push** (leave changes in the working tree — the engine handles the `Status:` header and any commit). This is the generalized form of the `executor.sh` `PROMPT` block; the project-specific rules are supplied per repo (a `tasks/<repo>/PROMPT.md` override is read if present, else the app default).

### 6.11 Model selection (per run)

The model is chosen in the UI **before** a run starts and is fixed for that whole run.

- **Where**: a `Select` in the per-repo "Run config" row, next to the warm-session toggle and filters. It is disabled (locked to the running value) while `state ≠ IDLE`, so a run can never switch model mid-flight.
- **Options**: a configurable catalog from `MODEL_CATALOG` (CSV/JSON in env), surfacing the neutral aliases `fast` / `mid` / `deep` plus explicit Claude slugs (e.g. `claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-8`). The aliases resolve to slugs per backend in `server/agent.ts` (`agent_resolve_model` equivalent).
- **Default**: the `Select` pre-selects `DEFAULT_MODEL`; the operator can change it each run. The last-used value is remembered client-side (localStorage) for convenience but always re-confirmed at Start.
- **Plumbing**: the chosen value is sent in `POST /api/repos/[repo]/run/start` as `model`; the engine passes it through to the agent's `--model` arg (§6.4) and records it in every telemetry row, so historical runs show which model solved which task.
- **DRY_RUN / preview** shows the exact `--model <resolved-slug>` that each task would run with.

### 6.12 Live output (SSE)

- `GET /api/repos/[repo]/stream` (role `standard`) returns `text/event-stream`.
- `ExecutionManager` is an `EventEmitter`; the handler forwards frames: `state` (`IDLE`/`RUNNING`/`STOPPING`/`SLEEPING`), `log` (`{ taskId, kind, text }`), `task:done` (`{ commit? }`), `task:error`, `progress` (`{ done, error, total }`), `commit` (`{ task, sha, message }`), `limit` (`{ wakeAt }`), `transient` (`{ attempt, delay }`), `git` (status changed: branch/dirty/ahead/behind), `completed`, `stopped`.
- The client renders `log` into `TerminalWindow`, drives `ProgressBar`/`StatusDot` from the others, and shows the limit `AnnouncementBar` on `limit`.
- On reconnect: GET `/api/repos/[repo]/status` snapshot, then attach the stream (ring buffer replays recent lines).

### 6.13 Exit-code → outcome mapping

The script halts on most failures; the app instead **skips-and-continues** per the requirement — a per-task non-limit failure marks the task `error` and the run proceeds. Only a usage-limit wall (when not auto-sleeping / retries exhausted) ends the run early.

| `executor.sh` exit | App outcome |
|---|---|
| 0 | `completed` (all tasks attempted; summary = done vs error counts) |
| 2 | bad request → `400` |
| 3 | limit reached, not auto-sleeping / max retries → run **ends early**, UI "stopped: usage limit" |
| 4 | `is_error=true` → task marked `error`, **run continues** |
| 7 | lock held → `409` |
| dirty tree | clean-repo gate failed → `412` (run never starts) |
| other | agent CLI failure (non-transient) → task marked `error`, **run continues** |

### 6.14 Clean-repo precondition

A run will not start unless the repo working tree is clean. The engine runs `git status --porcelain` in `repoPath`; a non-empty result aborts start with `412 Precondition Failed` and returns the dirty paths. The UI surfaces them in a `Banner` and disables **Start** until the operator clears the tree — commit (via §6.16 or the commit-after tooling), stash, or discard outside the app.

Rationale: each task's commit/diff must be attributable. A dirty tree at start would entangle pre-existing edits with task output. The gate is checked **only at run start**; between tasks the tree may legitimately be dirty (uncommitted task output) when commit-after-task is off.

### 6.15 Commit after task (optional)

A run-config `Switch` ("Commit after each task"; default `COMMIT_AFTER_TASK`). When on, after a task succeeds (`Status: done`, added to `.status`) the engine stages everything (`git add -A`) and commits. An empty diff skips the commit. The **commit-message source** is chosen in run config:

- **Task name** (default, no AI) — message is the task title, prefixed with the task id: `001-add-healthcheck: Add /healthz endpoint`.
- **AI-generated** — a **separately selected model** (`commitModel` `Select`, default `COMMIT_MODEL`, independent of the execution model) is run headless on the staged diff via a bundled `commit-message` skill to produce a Conventional-Commits subject + short body. On failure/timeout it falls back to the task-name message.

Author identity comes from `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL`. The resulting sha is recorded in telemetry and emitted as a `commit` SSE frame. The engine **commits only — it never pushes automatically** (push is the explicit action in §6.16). One commit per successful task yields a clean, attributable history; with the toggle off, edits accumulate for a single manual commit.

### 6.16 Branch & push (manual git actions)

Per-repo git controls in the repo git bar, independent of task execution (role `standard`+). Branch/push are rejected with `409` while a run holds the repo lock.

- **New branch** — `Button` opens a modal with a `FormInput` (name, validated `^[A-Za-z0-9._/-]+$`, no `..`). `POST /api/repos/[repo]/git/branch` → `git switch -c <name>` (or `git switch <name>` if it exists). Current branch shown as a `Badge`.
- **Push** — `Button` → `POST /api/repos/[repo]/git/push` → `git push -u origin <current-branch>`. Ahead/behind counts shown as a `Badge`; a successful push toasts and refreshes git status.
- **Git status** — `GET /api/repos/[repo]/git` → `{ branch, dirty, dirtyFiles, ahead, behind, remotes }`, polled by the UI for the git bar.

**Push credentials**: configured at the container level, not derived from the app login (OAuth `read:user` can't push). Either an HTTPS token via a git credential helper (`GIT_REMOTE_TOKEN`, GitHub scope `repo`) or a mounted SSH deploy key. If neither is configured, **Push** is disabled with a tooltip explaining how to set it up.

All git operations route through `server/git.ts` — `spawn('git', argv, { cwd: repoPath })`, argv array, no `shell`, repo path validated (§10): the same injection-safe pattern as the agent spawn.

---

## 7. Task creator

Turns a free-text prompt into one or more task files in `/workspace/tasks/<repo>/`. Role `standard`+.

### 7.1 Mechanism

1. UI posts `{ prompt }` to `POST /api/repos/[repo]/tasks/generate`.
2. Server spawns `claude` headless **with a bundled app-level skill** (`task-creator`, shipped read-only at `/app/skills/task-creator/SKILL.md`). The skill instructs Claude to:
   - decompose the prompt into discrete, independently-solvable tasks,
   - write each as `tasks/<repo>/<NNN>-<slug>.md` with an H1 title and `**Status:** open` (plus optional `Severity`/`Project`),
   - continue the existing numeric sequence (read the highest existing prefix first),
   - emit nothing else to the working tree.
3. Rejected with `409` if a run is in progress for that repo (don't mutate a live queue). Own timeout `GENERATE_TIMEOUT_MS` (default 120000) and own SSE log channel.
4. On completion the server re-reads the queue and returns the new task list; UI toasts + refreshes the table.

### 7.2 Predefined skill (shipped with app)

`task-creator` is a normal Claude skill (`SKILL.md` with `name`/`description` frontmatter), lives in the image, not user-editable, and is the only "magic" the creator relies on. Its body fixes the file-naming convention, the `Status: open` header, and the one-task-per-file rule.

---

## 8. Skill management

Manages **user-level** skills under `SKILLS_DIR` (default `/workspace/skills`; may point at a mounted `~/.claude/skills`). Role `standard`+. Each skill is a directory with a `SKILL.md` (YAML frontmatter `name` + `description`, then body).

| Action | Endpoint | Behavior |
|---|---|---|
| List | `GET /api/skills` | Enumerate subdirs containing `SKILL.md`; parse frontmatter |
| Read | `GET /api/skills/[name]` | Return raw `SKILL.md` |
| Create | `POST /api/skills` | Validate name `^[a-z0-9-]+$`; create `<name>/SKILL.md`; reject if exists |
| Update | `PUT /api/skills/[name]` | Overwrite `SKILL.md` |
| Delete | `DELETE /api/skills/[name]` | Remove the skill directory (after modal confirm) |

- Editor uses `MarkdownEditor` for the body + `FormInput` for the name; a linter checks frontmatter has `name` + `description` before save.
- The app-level `task-creator` skill is **not** listed here (it lives in `/app`, not `SKILLS_DIR`).
- These user skills are what Claude auto-discovers during execution, so editing them changes how queued tasks are solved.

---

## 9. User & role management (admin only)

Page `/users`, endpoints under `/api/users`. Backed by `/workspace/.auth/roles.json` (§4.3).

| Action | Endpoint | Behavior |
|---|---|---|
| List | `GET /api/users` | All known users + roles (admin only) |
| Set role | `PUT /api/users/[githubId]` | `{ role: "admin"\|"standard"\|"guest" }`; admin only |

- UI: `AdvancedTable` of users (avatar, login, name, role, added date) with a per-row `Select`/`ExtendedSelect` role picker; changing it PUTs and toasts.
- **Lockout guard**: the last remaining `admin` cannot be demoted (server rejects `409`, UI disables the option).
- New users appear automatically as `guest` after their first GitHub login; the admin promotes them here.
- Role changes take effect on the user's next request (middleware re-reads `roles.json`); no re-login needed.

---

## 10. Security

- **AuthN/Z**: server-side OAuth code flow; signed single-use `state`; signed `httpOnly` session cookie; role re-read from `roles.json` per request; every endpoint enforces its minimum role server-side (UI gating is cosmetic). Last-admin demotion blocked.
- **Path traversal**: every `repo`/`task`/`skill` name validated against a strict charset (`^[A-Za-z0-9._-]+$`, skills `^[a-z0-9-]+$`), then the resolved absolute path asserted inside its base dir (`path.resolve(base, name).startsWith(base + sep)`). Reject `400` otherwise.
- **Command injection**: agent always `spawn`ed with an argv array + fixed `cwd`; task content reaches it as a file path / prompt arg, never concatenated into a shell. No `shell:true`.
- **Process isolation**: `detached:true` + process-group kill so force-stop can't orphan `claude` children.
- **Secrets**: `GITHUB_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `AUTH_SECRET`, `GIT_REMOTE_TOKEN`, `SLACK_WEBHOOK_URL` server-only; never sent to client or written to the run log (log redaction for obvious key/token patterns). GitHub access token never persisted; `GIT_REMOTE_TOKEN` reaches `git` only via the credential helper, never logged.
- **Resource bounds**: one run per repo (`.lock`); limit-sleep clamp (`LIMIT_SLEEP_MAX`) so a malformed reset can't idle for days; transient/limit retry caps; per-generate timeout; bounded log ring buffer.
- **Container**: runs as a non-root user owning `/workspace`; only port 3000 exposed.

---

## 11. Configuration (environment variables)

| Var | Required | Default | Purpose |
|---|---|---|---|
| `GITHUB_CLIENT_ID` | ✅ | — | GitHub OAuth app client id |
| `GITHUB_CLIENT_SECRET` | ✅ | — | GitHub OAuth app secret |
| `OAUTH_REDIRECT_URI` | ✅ | — | Callback URL (`https://host/api/auth/github/callback`) |
| `GITHUB_ALLOWED_LOGINS` | ❌ | — | CSV allowlist of GitHub logins (optional) |
| `GITHUB_ALLOWED_ORG` | ❌ | — | Require membership of this org (optional) |
| `AUTH_SECRET` | ✅ | — | HMAC key for session + OAuth `state` |
| `SESSION_TTL` | ❌ | `86400` | Session lifetime (seconds) |
| `ANTHROPIC_API_KEY` | ✅ | — | Passed to spawned `claude` processes |
| `WORKSPACE_DIR` | ❌ | `/workspace` | Root for `repos/`, `tasks/`, `skills/`, `.auth/` |
| `SKILLS_DIR` | ❌ | `/workspace/skills` | User-level skills root |
| `AGENT` | ❌ | `claude` | Agent backend: `claude` or `cursor` |
| `CLAUDE_BIN` / `AGENT_BIN` | ❌ | `claude` | Path to the agent CLI |
| `DEFAULT_MODEL` | ❌ | `claude-sonnet-4-6` | Pre-selected model in the run-config `Select` |
| `MODEL_CATALOG` | ❌ | `fast,mid,deep,claude-haiku-4-5,claude-sonnet-4-6,claude-opus-4-8` | Selectable models offered in the UI |
| `AGENT_EXTRA_ARGS` | ❌ | `--print --output-format=stream-json --verbose --permission-mode acceptEdits` | Spawn args |
| `LIMIT_AUTO_SLEEP` | ❌ | `1` | `0` = fail-fast on usage limit |
| `LIMIT_SLEEP_BUFFER` | ❌ | `60` | Extra seconds past reported reset |
| `LIMIT_SLEEP_FALLBACK` | ❌ | `1800` | Backoff when no reset parseable |
| `LIMIT_SLEEP_MAX` | ❌ | `21600` | Hard cap on any single sleep (6h) |
| `LIMIT_MAX_RETRIES` | ❌ | `5` | Give up after N back-to-back limit hits on one task |
| `TRANSIENT_MAX_RETRIES` | ❌ | `3` | Retry transient (network) failures (`0` disables) |
| `TRANSIENT_BASE_DELAY` | ❌ | `10` | Base backoff (s) for transient retries |
| `WARM_SESSION` | ❌ | `0` | Reuse `--resume` session across tasks |
| `WARM_SESSION_MAX_AGE` | ❌ | `14400` | Discard stale warm-session marker (s) |
| `FORCE_KILL_GRACE_MS` | ❌ | `5000` | SIGTERM→SIGKILL grace on force-stop |
| `GENERATE_TIMEOUT_MS` | ❌ | `120000` | Task-creator timeout |
| `COMMIT_AFTER_TASK` | ❌ | `0` | Default for the commit-after-each-task toggle |
| `COMMIT_MESSAGE_MODE` | ❌ | `taskname` | Default message source: `taskname` or `ai` |
| `COMMIT_MODEL` | ❌ | `claude-haiku-4-5` | Model for AI commit messages (independent of run model) |
| `GIT_AUTHOR_NAME` | ❌ | `ai-task-manager` | Commit author name |
| `GIT_AUTHOR_EMAIL` | ❌ | `bot@ai-task-manager.local` | Commit author email |
| `GIT_REMOTE_TOKEN` | ❌ | — | HTTPS token for `git push` (GitHub scope `repo`); else mounted SSH key |
| `LOG_RETENTION_HOURS` | ❌ | `168` | Prune rotated `logs/` files older than this (`0` = keep all) |
| `SLACK_WEBHOOK_URL` | ❌ | — | Post batch completion summary |
| `PORT` | ❌ | `3000` | HTTP port |

App boot validates required vars and exits with a clear message if any are missing.

---

## 12. API surface (summary)

| Method + path | Min role | Purpose |
|---|---|---|
| `GET /api/auth/github` | public | Redirect to GitHub authorize |
| `GET /api/auth/github/callback` | public | Exchange code, assign role, set session |
| `POST /api/auth/logout` | guest | Clear session |
| `GET /api/me` | guest | Current user + role (drives UI gating) |
| `GET /api/repos` | standard | Repositories + pending counts + run state |
| `GET /api/repos/[repo]/tasks` | standard | Task list with status (from `.status` + `logs/` telemetry) |
| `GET /api/repos/[repo]/tasks/[id]` | standard | Raw task Markdown |
| `GET /api/repos/[repo]/status` | standard | Engine snapshot (state, current, progress, wakeAt) |
| `GET /api/repos/[repo]/stream` | standard | SSE: state + live log |
| `POST /api/repos/[repo]/run/start` | standard | Start run (`{ model, warmSession, commitAfter, commitMessageMode, commitModel, filter, resumeFrom, severity, project, reset, dryRun }`); `412` if tree dirty |
| `POST /api/repos/[repo]/run/stop` | standard | Graceful stop (finish current) |
| `POST /api/repos/[repo]/run/force` | standard | Force stop (kill process group) |
| `GET /api/repos/[repo]/git` | standard | Git status (branch, dirty, dirtyFiles, ahead, behind, remotes) |
| `POST /api/repos/[repo]/git/branch` | standard | Create/switch branch `{ name }` |
| `POST /api/repos/[repo]/git/push` | standard | Push current branch to origin |
| `POST /api/repos/[repo]/tasks/generate` | standard | Task creator (prompt → files) |
| `GET/POST /api/skills` | standard | List / create skills |
| `GET/PUT/DELETE /api/skills/[name]` | standard | Read / update / delete a skill |
| `GET /api/users` | admin | List users + roles |
| `PUT /api/users/[githubId]` | admin | Set a user's role |

Mutating run endpoints return the new engine snapshot so the client updates without a second fetch.

---

## 13. Project structure (proposed)

```
ai-task-manager/
├── app/
│   ├── layout.tsx                  # ToastProvider + ModalContext + style.css
│   ├── login/page.tsx
│   ├── no-access/page.tsx
│   ├── page.tsx                    # dashboard (repo list)
│   ├── repos/[repo]/page.tsx
│   ├── skills/page.tsx
│   ├── skills/[name]/page.tsx
│   ├── users/page.tsx              # admin only
│   └── api/…                       # route handlers (see §12)
├── middleware.ts                   # auth + role gate
├── server/
│   ├── auth.ts                     # OAuth flow, cookie sign/verify
│   ├── roles.ts                    # roles.json read/write, bootstrap, lockout guard
│   ├── fs-workspace.ts             # safe path resolution, repo/task/skill IO, .status
│   ├── execution-manager.ts        # the singleton engine (§6)
│   ├── agent.ts                    # agent backend adapter (claude/cursor), argv, model resolve
│   ├── git.ts                      # spawn-git wrapper: status/commit/branch/push (§6.14–6.16)
│   ├── logs.ts                     # hourly-rotated run log + telemetry, retention pruning (§6.9)
│   ├── limit.ts                    # reset-time parsing + sleep computation
│   └── sse.ts                      # event-stream helpers + ring buffer
├── components/                     # compositions over @toolcase/react-components
├── skills/
│   ├── task-creator/SKILL.md       # bundled: prompt → task files (§7.2)
│   └── commit-message/SKILL.md     # bundled: staged diff → Conventional-Commits message (§6.15)
├── Dockerfile
├── docker-compose.yml
└── package.json
```

`execution-manager` is a module-level singleton, guarded against Next.js dev hot-reload double-instantiation via a `globalThis` cache.

---

## 14. Docker

### 14.1 Image

Multi-stage on `node:20-slim`:

1. **build stage** — `npm ci`, `next build` (`output: 'standalone'`).
2. **runtime stage** — copy `.next/standalone`, install `git` + the Claude Code CLI globally (`npm i -g @anthropic-ai/claude-code`), copy bundled `skills/task-creator`, create a non-root `app` user owning `/workspace`, `EXPOSE 3000`, `CMD ["node", "server.js"]`.

### 14.2 Compose

```yaml
services:
  ai-task-manager:
    build: .
    ports: ["3000:3000"]
    environment:
      GITHUB_CLIENT_ID: ${GITHUB_CLIENT_ID}
      GITHUB_CLIENT_SECRET: ${GITHUB_CLIENT_SECRET}
      OAUTH_REDIRECT_URI: ${OAUTH_REDIRECT_URI}
      AUTH_SECRET: ${AUTH_SECRET}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      WORKSPACE_DIR: /workspace
      GIT_AUTHOR_NAME: ${GIT_AUTHOR_NAME}
      GIT_AUTHOR_EMAIL: ${GIT_AUTHOR_EMAIL}
      GIT_REMOTE_TOKEN: ${GIT_REMOTE_TOKEN}   # for `git push`; or mount an SSH key instead
    volumes:
      - /srv/ai-task-manager/workspace:/workspace   # repos + tasks + skills + logs + .auth persist on host
      # - ~/.ssh/deploy_key:/home/app/.ssh/id_ed25519:ro   # alternative push credential
    restart: unless-stopped
```

The `/workspace` volume is the **only** persistent state — repos, tasks, rotated `logs/`, skills, and `.auth/roles.json`. Operators clone repos into `/workspace/repos/<name>`; tasks and skills are created via the app or by hand. Pushing requires either `GIT_REMOTE_TOKEN` or a mounted SSH key (§6.16).

---

## 15. Behavioral edge cases

- **First ever login** → user written as `admin` (bootstrap). The very next different user → `guest`.
- **Guest navigates anywhere** → `/no-access` screen; APIs return `403`.
- **Last admin self-demote** → blocked (`409`).
- **No repos** → dashboard `EmptyState`.
- **Repo with no `tasks/<repo>` dir** → zero pending; Start disabled; dir created lazily by the task creator.
- **Start with empty / all-done queue** → no-op, toast "Nothing to run".
- **Process restart while running** → run state lost (memory); in-flight task wasn't in `.status` → offered again. UI shows `IDLE`. Tasks must be idempotent.
- **Dirty repo at Start** → clean-repo gate fails (`412`); `Banner` lists uncommitted files; Start disabled until cleared.
- **Usage limit hit** → `SLEEPING`, banner with wake time, same task retried after reset (auto-sleep on) — or run ends early (auto-sleep off / max retries).
- **Transient network failure** → backoff + retry same task; exhausted → mark `error`, continue.
- **Task fails (exit≠0 / is_error)** → `Status: error` + telemetry `error`, **run continues to next task**; task stays out of `.status` so a rerun retries it.
- **Commit-after-task, empty diff** → commit skipped (task still marked done).
- **AI commit message fails/times out** → falls back to the task-name message.
- **Push without credentials** → Push disabled with a tooltip; `412`/`409` if forced via API.
- **Hour rolls over mid-run** → next task's BEGIN starts a new `run-<hour>.log` / `telemetry-<hour>.jsonl`; old files pruned past `LOG_RETENTION_HOURS`.
- **Force stop mid-task** → process group killed; task left pending; partial working-tree edits remain (no auto-revert) → repo now dirty, blocking the next Start until cleared.
- **Branch/push during a run** → `409` (lock held).
- **Concurrent start / task-creator during run** → `409` (lock held).

---

## 16. Open decisions (defaults chosen, confirm before build)

1. **Failure policy** — **skip-and-continue** (per the requirement): a failing task is marked `error` and the run proceeds to the next. (This diverges from `executor.sh`, which halts.) An errored task is retried on the next run unless filtered out. *(Default: skip-and-continue.)*
2. **Allowlist** — default: any GitHub user may sign in but lands as `guest` (admin gates access). Alternative: hard allowlist via `GITHUB_ALLOWED_LOGINS`/`GITHUB_ALLOWED_ORG`.
3. **Warm session default** — default off (context bloats across tasks); operators opt in per run.
4. **Agent backend / model set** — default `claude`; expose `fast`/`mid`/`deep` aliases + raw slugs; `cursor` supported via the adapter.
5. **Run scope** — default: one run per repo lock; multiple repos can run concurrently (separate locks). Alternative: a single global runner.
6. **Per-repo prompt** — default: read `tasks/<repo>/PROMPT.md` if present, else app-default preamble.
7. **Push credentials** — default: `GIT_REMOTE_TOKEN` (HTTPS, scope `repo`); alternative: mounted SSH deploy key. Not derived from the OAuth login.
8. **Commit granularity** — default: one commit per successful task when the toggle is on; alternative: a single squashed commit at run end. *(Default: per-task.)*

---

## 17. Acceptance criteria

- [ ] Visiting any protected route while logged out redirects to GitHub sign-in.
- [ ] First successful GitHub login is assigned `admin`; subsequent new users are `guest` and see the no-access screen.
- [ ] An admin can promote/demote users on `/users`; standard users cannot reach `/users` (`403`); the last admin cannot be demoted.
- [ ] Role changes apply on the next request without re-login.
- [ ] Dashboard lists every dir under `/workspace/repos` with pending counts and run state.
- [ ] A model is selected in the run-config `Select` before Start (default `DEFAULT_MODEL`, options from `MODEL_CATALOG`); the picker locks during a run, the chosen model is passed to the agent's `--model` and recorded in telemetry.
- [ ] Start runs tasks sequentially, `cwd` = repo, parsing stream-json; output tails into `TerminalWindow` from the active run log.
- [ ] A run refuses to start unless the repo tree is clean (`412`); the UI lists the dirty files and disables Start.
- [ ] Completion is tracked in `.status`; the engine sets each solved task's `Status:` header to `done` and each failed one to `error`; reruns skip `.status` entries.
- [ ] A failing task is marked `error` and the run **continues** to the next task; the run summary reports done vs error counts.
- [ ] A usage-limit hit puts the engine in `SLEEPING`, shows the wake time, and retries the same task after reset (auto-sleep on); honors max-retries and `LIMIT_AUTO_SLEEP=0`.
- [ ] Transient failures retry with backoff; telemetry records every attempt.
- [ ] With commit-after-task on, each successful task is committed; the message is the task name, or AI-generated by the separately selected `commitModel`, with task-name fallback; the engine never auto-pushes.
- [ ] A new branch can be created per repo, and committed changes can be pushed via the Push button using container-level credentials.
- [ ] Run logs and telemetry are written under a per-repo `logs/` directory, rotated hourly, and pruned past `LOG_RETENTION_HOURS`.
- [ ] Graceful stop finishes the current task; force stop kills the process group within the grace window and leaves the task pending.
- [ ] Warm-session mode reuses `--resume` across tasks; the marker ages out.
- [ ] Task creator turns a prompt into numbered `Status: open` task files via the bundled skill.
- [ ] Skills page can create/edit/delete user-level skills under `SKILLS_DIR`.
- [ ] Optional Slack webhook posts a batch summary on run completion.
- [ ] Entire UI composed from `@toolcase/react-components`; no `border-radius` added.
- [ ] Runs as a single Docker container with `/workspace` mounted (incl. `.auth/roles.json`); no database.
```
