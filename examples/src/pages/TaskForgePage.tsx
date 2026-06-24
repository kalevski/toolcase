import { Link as RouterLink } from 'react-router'
import { CodeBlock, CopyLine } from './_chrome'

const archDiagram = `GitHub OAuth ──► TaskForge (Next.js 14, single process)
                        │
                        │  per-project queue of *.md task files
                        ▼
             execution engine ──spawns──► claude CLI ──edits──► repo/ (git)
                        │                     │
                        │  live SSE stream   commit · push · PR
                        ▼
               browser UI ◄─────────────────────────────────────
                        │
                  SQLite (node:sqlite, Node ≥ 22.5)
          tasks · runs · telemetry · users · schedules
           audit · accounts · search · prompt-history`

const fsContract = `/workspace
├── projects/<name>/
│   ├── repo/            managed git repository (cloned from a git URL)
│   ├── tasks/           *.md task files + logs/ (hourly-rotated)
│   ├── knowledge/       durable project docs the agent reads and maintains
│   ├── notes/           free-form markdown notes (manual or agent-written)
│   ├── CLAUDE.md        project-root instructions for the agent (editable in UI)
│   └── .claude/skills   symlink → bundled app skills (read-only)
├── .claude-accounts/
│   ├── <alias>/         isolated CLAUDE_CONFIG_DIR per registered account
│   └── …
├── skills/<skill>/      user-level skills
└── taskforge.db         SQLite system of record (node:sqlite)`

const envExample = `# Required — GitHub OAuth2 + session signing
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/github/callback
AUTH_SECRET=...              # HMAC key for session + OAuth state

# No ANTHROPIC_API_KEY — the claude CLI authenticates itself

# Optional: access control
GITHUB_ALLOWED_LOGINS=octocat,hubot   # login allowlist
GITHUB_ALLOWED_ORG=my-org             # org membership gate
SESSION_TTL=86400                      # cookie lifetime (seconds)

# Optional: multiple accounts (see README "Multiple Claude accounts")
# DEFAULT_ACCOUNT=alpha
# TASKFORGE_CIBOT_KEY=sk-ant-…         # API key for an api-key alias

# Git push (NOT the OAuth login)
GIT_REMOTE_TOKEN=...                   # HTTPS, GitHub scope: repo
# …or mount an SSH deploy key with GIT_SSH_CONFIGURED=1

# Notifications
SLACK_WEBHOOK_URL=...
NOTIFY_WEBHOOK_URL=...                 # generic JSON webhook
NOTIFY_EVENTS=run:completed,run:errored,task:error,limit,agent:done`

const features = [
    {
        title: 'SQLite system of record',
        body: 'All runtime state lives in a single SQLite database (node:sqlite built-in, requires Node ≥ 22.5) at WORKSPACE_DIR/taskforge.db: task queue, run history, telemetry, users and roles, schedules, audit log, account registry, warm sessions, and FTS5 full-text search. Task and knowledge Markdown bodies stay on disk (the agent reads them); the DB mirrors their metadata so the queue renders from one query. On first boot against an existing workspace, legacy filesystem files (.status, roles.json, telemetry-*.jsonl, project.json, etc.) are imported into SQLite automatically.',
    },
    {
        title: 'Three-tier roles: admin · standard · guest',
        body: 'GitHub OAuth2 authentication with three roles (admin | standard | guest). The first user to sign in becomes admin; everyone else lands as guest until promoted via the Users panel. Admins manage users, account registry, agent definitions, prompt templates, and global settings. Standard users can run tasks and use all per-project features.',
    },
    {
        title: 'One task at a time, streamed live',
        body: 'The execution engine runs claude over queued *.md task files sequentially, streaming stdout to the browser over Server-Sent Events. Logs rotate hourly on disk; the browser UI reconnects automatically to the live run. Runs can be stopped gracefully or force-killed.',
    },
    {
        title: 'Survives the usage wall',
        body: 'When claude hits a usage-limit reset the engine sleeps until the window reopens — no lost queue. A pre-emptive usage gate polls /usage after each task and pauses automatically when any bucket is at or above a configurable threshold (default 95%), so the next task never fails immediately on the limit. Transient failures retry with exponential backoff.',
    },
    {
        title: 'Multiple Claude accounts',
        body: 'Register several Claude Code identities — OAuth subscription seats and/or API-key credentials — as short named aliases. Each alias gets an isolated CLAUDE_CONFIG_DIR; no credential-file races so aliases can run concurrently. The dispatcher round-robins across OAuth aliases to spread usage limits, marks a cooling alias on quota errors, and fails over to the next available one. Account selection: per-task **Account:** facet → per-project default → global DEFAULT_ACCOUNT fallback.',
    },
    {
        title: 'Scheduled cron runs',
        body: 'Per-project cron scheduler with 5-field expressions (supports wildcards, ranges, lists, and step values). Each schedule carries the full RunOptions — model, account, warmSession, commitAfter, pushAfter, branchPerRun, reviewer pass — and can be configured to fire only when tasks are pending, or only when usage is below a configurable threshold.',
    },
    {
        title: 'Reviewer pass',
        body: 'Optional post-task reviewer step: after each task completes, a cheap claude run checks the commit diff against the task spec and returns pass/fail with a short note. Failed tasks surface as needs-review status and are excluded from follow-on pushes and PR creation. Reviewer verdict and notes are stored per telemetry row.',
    },
    {
        title: 'Rich Git surface',
        body: 'Branch, commit, push, fetch, pull, and revert from the UI. Browse unpushed commits and recent history; inspect per-commit diffs; discard specific working-tree paths; manage stash (push, pop, drop). Create GitHub pull requests after a push (branchPerRun + openPr flags). Import GitHub issues directly as task Markdown files. Push requires a container-level credential — GIT_REMOTE_TOKEN or a mounted SSH deploy key — deliberately decoupled from the OAuth login.',
    },
    {
        title: 'Four bundled skills',
        body: 'Read-only app skills the agent can invoke: task-creator (generates new task files from a natural-language prompt), knowledge-writer (creates or updates project knowledge docs), note-writer (creates free-form notes), commit-message (drafts a commit message from the staged diff). Admins can define custom agent kinds — each with a prompt preamble, a target directory (repo, tasks, knowledge, notes, or project), and a post-processing hook — and save reusable prompt templates.',
    },
    {
        title: 'Notes vs. knowledge',
        body: 'Each project has two separate document stores. knowledge/ holds durable, structured analysis docs that the agent actively reads and maintains; they are indexed and linked via an index.md entry point. notes/ holds free-form Markdown pages that are written manually or by the note-writer agent and are not automatically maintained. Both stores are full-text searchable and editable from the UI.',
    },
    {
        title: 'Telemetry and usage dashboards',
        body: 'Per-task telemetry records elapsed time, model, token counts (in/out), cost in USD, and reviewer verdict. Aggregated into a dashboard: per-day completion and cost charts, per-model breakdown (count, average elapsed, cost), slowest tasks, most expensive tasks, and retry leaders. A usage panel shows the current claude /usage snapshot with bucket fill percentages and reset times.',
    },
    {
        title: 'Warm sessions',
        body: 'Optionally reuse the claude session ID between tasks in a run to skip cold-start setup time (WARM_SESSION=1). The session ID is persisted per project in SQLite and reused while it is within the configured max-age window. Warm sessions are opt-in per run or per project setting.',
    },
    {
        title: 'Run history and event ledger',
        body: 'Every run is recorded — start/finish time, outcome (completed, stopped, force-stopped, usage-limit), task counts, branch, PR URL, triggered by (user or schedule), and summed cost. A fine-grained run-event ledger captures task:begin, task:done, task:error, commit, limit, and transient events for audit and replay. Run history is browsable per project.',
    },
    {
        title: 'Deep task management',
        body: 'Bulk actions (re-run, reset to open, archive), manual task reordering, per-task feedback, error reset, and the full task drawer with last-run telemetry. Task Markdown facets: Severity, Project, Model, Account, Depends. GitHub issues import directly as task files via the Import Issues modal.',
    },
    {
        title: 'Per-project settings and CLAUDE.md editing',
        body: 'Each project exposes a settings panel for: default model, default account alias, commit behavior and commit-message mode, warm session, knowledge auto-update, usage gate threshold, reviewer pass, auto-push and PR creation, and per-event notification routing. The project CLAUDE.md is editable directly from the UI without touching the filesystem.',
    },
    {
        title: 'Audit log, health page, and backups',
        body: 'Tamper-evident audit log records every significant user action: login, role changes, run start/stop, task CRUD, settings changes. The health page shows agent binary version, git version, disk free, DB path / size / migration version, engine state per project, and account health summaries. One-click DB download and per-project workspace archive backups from the admin panel.',
    },
    {
        title: 'Full-text search and notifications',
        body: 'SQLite FTS5 full-text search (degrades gracefully when unavailable) across tasks, knowledge, and notes with highlighted result snippets. Notifications via Slack webhook and a generic outbound JSON webhook (ntfy, Discord, custom automations), configurable globally and per project across five event types: run:completed, run:errored, task:error, limit, agent:done.',
    },
    {
        title: 'Access control and session gating',
        body: 'Optional GITHUB_ALLOWED_LOGINS (comma-separated login allowlist) and GITHUB_ALLOWED_ORG (org membership check) env vars restrict who can sign in at all — checked at the OAuth callback before a user record is created. SESSION_TTL controls the signed cookie lifetime. A thin edge middleware gates every page route; the full role verification happens in the Node layer.',
    },
]

export const TaskForgePage = () => {
    return (
        <main className="site-container">
            <div className="breadcrumbs">
                <RouterLink to="/apps">Apps</RouterLink>
                <span className="sep">/</span>
                <span className="current mono">taskforge</span>
            </div>

            <section className="page-intro">
                <div>
                    <div className="eyebrow">App · Next.js 14 · Claude Code CLI</div>
                    <h1 className="page-title mono">TaskForge</h1>
                    <p className="page-lead">
                        A self-hosted, single-process Next.js control panel that drives the Claude Code
                        CLI over a set of local git repositories. Each project has a queue of Markdown
                        task files; TaskForge runs <code>claude</code> over them one at a time, streams
                        the output live, survives usage-limit walls, retries transient failures, and
                        can commit, push, and open pull requests. All state is backed by SQLite via the
                        Node built-in <code>node:sqlite</code> module (Node ≥ 22.5).
                    </p>
                    <div className="chip-row">
                        {['Next.js 14', 'SQLite · node:sqlite', 'Claude Code CLI', 'GitHub OAuth', 'SSE', 'Docker', 'multi-account', 'cron scheduler'].map((chip) => (
                            <span key={chip} className="tag">{chip}</span>
                        ))}
                    </div>
                </div>
                <dl className="page-meta">
                    <div>
                        <dt>Framework</dt>
                        <dd>Next.js 14</dd>
                    </div>
                    <div>
                        <dt>Persistence</dt>
                        <dd>SQLite (node:sqlite)</dd>
                    </div>
                    <div>
                        <dt>Node requirement</dt>
                        <dd>≥ 22.5 (24 recommended)</dd>
                    </div>
                    <div>
                        <dt>Auth</dt>
                        <dd>GitHub OAuth2</dd>
                    </div>
                    <div>
                        <dt>Roles</dt>
                        <dd>admin · standard · guest</dd>
                    </div>
                    <div>
                        <dt>License</dt>
                        <dd>MIT</dd>
                    </div>
                </dl>
            </section>

            <div className="section-head">
                <h2>How it works</h2>
                <span className="count">queue → claude → stream → commit → SQLite</span>
            </div>
            <CodeBlock file="architecture" code={archDiagram} />

            <div className="lib-grid">
                {features.map((f) => (
                    <div key={f.title} className="lib-card">
                        <div className="lib-card-head">
                            <div>
                                <h3 className="lib-name">{f.title}</h3>
                                <p className="lib-tagline">{f.body}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="section-head">
                <h2>Filesystem layout</h2>
                <span className="count">task + knowledge bodies on disk; runtime state in SQLite</span>
            </div>
            <CodeBlock file="/workspace" code={fsContract} />

            <div className="section-head">
                <h2>Configuration</h2>
                <span className="count">GitHub OAuth + session secret; claude CLI self-authenticates</span>
            </div>
            <CodeBlock file=".env" code={envExample} />

            <div className="section-head">
                <h2>Run it</h2>
                <span className="count">Docker (Node 24 image), or local dev on Node ≥ 22.5</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
                <CopyLine cmd="cp .env.example .env   # fill in GitHub OAuth + AUTH_SECRET" />
                <CopyLine cmd="docker compose up --build" />
                <CopyLine cmd="nvm use 24 && npm install && npm run dev   # local dev on http://localhost:3000" />
            </div>

            <div className="section-head">
                <h2>Source</h2>
                <span className="count">lives in the toolcase monorepo</span>
            </div>
            <div className="lib-grid">
                <a
                    href="https://github.com/kalevski/toolcase/tree/main/taskforge"
                    target="_blank"
                    rel="noreferrer"
                    className="lib-card"
                >
                    <div className="lib-card-head">
                        <div>
                            <h3 className="lib-name">kalevski/toolcase</h3>
                            <p className="lib-tagline">taskforge/ — Next.js app, execution engine, SQLite repositories, bundled skills, README, Dockerfile</p>
                        </div>
                        <span className="lib-arrow">→</span>
                    </div>
                </a>
            </div>
        </main>
    )
}
