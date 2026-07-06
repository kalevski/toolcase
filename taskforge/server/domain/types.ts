// Shared types for TaskForge.
// Pure types + constants only — safe to import from both server and client code
// (no `fs`, `child_process`, or other server-only imports here).

// ── Auth / roles ─────────────────────────────────────────────────────────────

// 'owner' is the top role — the first user ever to log in bootstraps as owner.
// 'guest' is the no-access landing role for every subsequent signup until the
// owner promotes them.
export type Role = 'owner' | 'standard' | 'guest'

/** Strict ordering used for `minRole` comparisons. Higher = more access. */
export const ROLE_RANK: Record<Role, number> = {
    guest: 0,
    standard: 1,
    owner: 2,
}

export interface UserRecord {
    githubId: number
    login: string
    name: string
    avatarUrl?: string
    role: Role
    addedAt: string
}

export interface RolesFile {
    users: UserRecord[]
}

/** The decoded, verified session payload carried in the signed cookie. */
export interface SessionPayload {
    sub: number // github id
    login: string
    iat: number
    exp: number
}

/** What `/api/me` returns and the client UI gates on. */
export interface MeResponse {
    githubId: number
    login: string
    name: string
    avatarUrl?: string
    role: Role
}

// ── Tasks / projects ───────────────────────────────────────────────────────

export type TaskStatus = 'open' | 'done' | 'error'

/**
 * Runtime status of a task, merging on-disk header + live engine state.
 * `needs-review` (B8) renders a done task whose reviewer verdict was `fail`.
 */
export type TaskRuntimeStatus = 'pending' | 'running' | 'done' | 'error' | 'needs-review'

export interface TaskInfo {
    /** Project-relative path within `tasks/`, e.g. `001-add-healthcheck.md`. Stable id. */
    id: string
    title: string
    status: TaskRuntimeStatus
    severity?: string
    project?: string
    /** Pinned model for this task (`**Model:**` facet) — overrides the run model. */
    model?: string
    /** `**Account:**` facet — pins the Claude identity for this task. */
    account?: string
    /** Task ids/number prefixes this task depends on (`**Depends:**` facet, A4). */
    depends?: string[]
    /** Last recorded attempt outcome from telemetry, if any. */
    lastElapsed?: number
    lastModel?: string
    lastCommit?: string
    lastError?: string
    /** B2 — token/cost usage of the last attempt, when the CLI reported it. */
    tokensIn?: number
    tokensOut?: number
    costUsd?: number
    /** B8 — reviewer verdict of the last attempt. */
    review?: 'pass' | 'fail'
    reviewNote?: string
}

/** A repository knowledge/ doc — a source-anchored analysis of one topic. */
export interface KnowledgeDoc {
    /** knowledge-relative path, e.g. `index.md` or `auth-flow.md`. Stable id. */
    id: string
    title: string
    /** One-line summary lifted from the doc (the index blurb). Empty for the index itself. */
    description: string
    /** True for the app-owned `index.md` entry point that links every other doc. */
    isIndex: boolean
}

export interface ProjectSummary {
    name: string
    /** Tasks not present in `.status`. */
    pending: number
    total: number
    done: number
    error: number
    state: EngineState
    /** True when the project's `tasks/` directory holds task files. */
    hasTasks: boolean
    /** Origin the repo was cloned from (from project.json). */
    gitUrl?: string
    /** Branch the repo was cloned at, if pinned (from project.json). */
    branch?: string | null
}

/** Lightweight entry for the sidebar project dropdown — cheap to build for every page. */
export interface ProjectNavItem {
    name: string
    state: EngineState
    /** True when a one-shot agent session (task-creator / knowledge-writer / note-writer) runs for the project. */
    agentBusy?: boolean
}

// ── Notes ────────────────────────────────────────────────────────────────────

/** A free-form `notes/*.md` doc at the project root (manual or agent-written). */
export interface NoteDoc {
    /** notes-relative path, e.g. `deploy-checklist.md`. Stable id. */
    id: string
    title: string
    /** ISO mtime of the file, for relative-time display. */
    updatedAt: string
}

// ── One-shot agent sessions ──────────────────────────────────────────────────

/**
 * Agent kind. The three bundled kinds are literal; C4 custom agent kinds widen
 * this to any kebab-case string defined in the `agent_def` table.
 */
export type BundledAgentKind = 'task-creator' | 'knowledge-writer' | 'note-writer'
export type AgentKind = string

export const AGENT_KINDS: BundledAgentKind[] = ['task-creator', 'knowledge-writer', 'note-writer']

/** C4 — post-processing hook a custom agent runs after it finishes. */
export type AgentPost = 'none' | 'tasks' | 'knowledge' | 'notes'

/** C4 — an admin-defined custom agent kind (`agent_def` table). */
export interface AgentDef {
    kind: string
    label: string
    /** Prepended to every user prompt for this agent. */
    promptPreamble: string
    /** Directory contract inside the project root the agent is pointed at. */
    target: 'repo' | 'tasks' | 'knowledge' | 'notes' | 'project'
    post: AgentPost
    createdAt: string
}

export interface AgentSessionSnapshot {
    project: string
    agent: AgentKind
    status: 'idle' | 'running'
    startedAt: number | null
    model: string | null
    /** last submitted prompt (also persisted — see agent_prompt table) */
    prompt: string | null
}

/** Latest persisted prompt per (project, agent) — survives restarts via SQLite. */
export interface AgentPromptRecord {
    prompt: string
    model: string
    usedAt: string
}

// ── Claude account registry (multi-account) ──────────────────────────────────

/**
 * One Claude identity in the account registry — registry **metadata only**,
 * never secrets. `dir` is the isolated `CLAUDE_CONFIG_DIR` (one config dir = one
 * logged-in identity). For `apikey` accounts the key is referenced by env-var
 * **name** (`apiKeyEnv`) and resolved at spawn time; the key value is never
 * stored. `lastUsedAt`/`coolingUntil` are mutable runtime fields used later by
 * the dispatcher for round-robin + cool-down on quota errors.
 */
export interface Account {
    /** Short kebab-case handle; primary key + config-dir folder name. */
    alias: string
    /** Isolated config dir on disk (`${accountsDir}/<alias>`). */
    dir: string
    auth: 'oauth' | 'apikey'
    label?: string
    /** Name of the env var holding the API key (apikey auth only). */
    apiKeyEnv?: string
    lastUsedAt?: string
    coolingUntil?: string
}

/**
 * Result of a live `verifyAccount` token-health check — a cheap one-shot run
 * under the account's config dir confirming the identity is usable before a
 * batch is dispatched. `detail` is a short human-readable reason on failure.
 */
export interface AccountHealth {
    ok: boolean
    detail: string
}

/**
 * Cached, non-live account summary for the health surface: the alias, its auth
 * method, and the last time the identity was successfully used/verified
 * (`lastUsedAt`). Health polling reports this without re-running a verify.
 */
export interface AccountHealthSummary {
    alias: string
    auth: 'oauth' | 'apikey'
    label?: string
    lastUsedAt?: string
}

/**
 * Non-secret registry view for the management surface (`GET /api/accounts`):
 * every account's metadata (alias, config dir, auth method, label, the API-key
 * env-var *name*) plus its cached runtime state — `lastUsedAt` as the last
 * known-good health stamp, `coolingUntil`, and a derived `cooling` flag (true
 * while a quota cool-down is still in effect). Holds no secrets: the API key
 * value is never stored, only the env-var name that references it.
 */
export interface AccountSummary {
    alias: string
    dir: string
    auth: 'oauth' | 'apikey'
    label?: string
    apiKeyEnv?: string
    lastUsedAt?: string
    coolingUntil?: string
    cooling: boolean
}

// ── Git ──────────────────────────────────────────────────────────────────────

/**
 * A saved git SSH key (deploy key) selectable when cloning a private repo.
 * Registry metadata only — the private key material lives in an owner-only
 * `0600` file at `${gitKeysDir}/<alias>` and is never stored in or returned
 * from the API (write-only on create).
 */
export interface GitKey {
    /** Short kebab-case handle; primary key + key-file name. */
    alias: string
    label?: string
    createdAt: string
}

export interface GitStatus {
    branch: string
    dirty: boolean
    dirtyFiles: string[]
    ahead: number
    behind: number
    remotes: string[]
    /** Whether a push credential is configured at the container level. */
    canPush: boolean
}

// ── Execution engine ─────────────────────────────────────────────────────────

export type EngineState = 'IDLE' | 'RUNNING' | 'STOPPING' | 'SLEEPING'

export type CommitMessageMode = 'taskname' | 'ai'

export interface RunOptions {
    model: string
    warmSession?: boolean
    commitAfter?: boolean
    commitMessageMode?: CommitMessageMode
    commitModel?: string
    /** substring filter against the task's repo-relative path */
    filter?: string
    /** lexicographic skip until path >= this prefix */
    resumeFrom?: string
    /** CSV facet filter */
    severity?: string
    /** CSV facet filter */
    project?: string
    /** clear `.status` + reset headers before the run */
    reset?: boolean
    /** drop only these task ids from `.status` (reset them to "open") before the run — used to re-run a single finished task without disturbing the rest of the ledger */
    resetTasks?: string[]
    /** exact-id allowlist (A3 bulk re-run) — only these tasks are in scope */
    onlyTasks?: string[]
    /** list invocations without executing */
    dryRun?: boolean
    /** B4 — push the branch after a run that finishes with ≥1 done and 0 errors */
    pushAfter?: boolean
    /** B5 — create/switch to `taskforge/run-<id>` before the first task */
    branchPerRun?: boolean
    /** B8 — run a cheap reviewer pass over each task's commit diff */
    review?: boolean
    /** B7 — open a GitHub PR after a successful pushAfter (requires branchPerRun) */
    openPr?: boolean
    /** B1 — who triggered the run ('user:<login>' | 'schedule'); recorded on the run row */
    startedBy?: string
}

// ── Run history (B1) ─────────────────────────────────────────────────────────

export interface RunRecord {
    id: number
    project: string
    startedAt: string
    finishedAt: string | null
    /** 'completed' | 'stopped' | 'force-stopped' | 'usage-limit' (null while running) */
    reason: string | null
    options: Partial<RunOptions>
    done: number
    error: number
    total: number
    startedBy: string | null
    branch: string | null
    prUrl: string | null
    /** B2 — summed cost of telemetry rows recorded during the run, if any. */
    costUsd: number | null
}

// ── Schedules (B3) ───────────────────────────────────────────────────────────

export interface ScheduleRecord {
    project: string
    /** 5-field cron expression (min hour dom mon dow); supports wildcards, lists, ranges and step values. */
    cron: string
    options: Partial<RunOptions>
    enabled: boolean
    /** Fire only when at least one task is pending. */
    onlyIfPending: boolean
    /** Skip firing when any usage bucket is at/above this percent (null = no gate). */
    skipAboveUsage: number | null
    lastFiredAt: string | null
}

// ── Audit log (D3) ───────────────────────────────────────────────────────────

export interface AuditRecord {
    id: number
    at: string
    githubId: number | null
    login: string | null
    action: string
    project: string | null
    detail: string | null
}

// ── Workspace search (C3) ────────────────────────────────────────────────────

export type SearchDocType = 'task' | 'knowledge' | 'note'

export interface SearchHit {
    type: SearchDocType
    id: string
    title: string
    /** Highlighted snippet (FTS5 `snippet()`, `<mark>` delimited). */
    snippet: string
}

// ── Per-project settings (E1) ────────────────────────────────────────────────

/** Persisted per-project overrides; absent keys fall back to env config. */
export interface ProjectSettings {
    defaultModel?: string
    /** Fallback Claude account alias for tasks that don't name one. */
    defaultAccount?: string
    commitAfter?: boolean
    commitMessageMode?: CommitMessageMode
    commitModel?: string
    warmSession?: boolean
    knowledgeAutoUpdate?: boolean
    usageGateThreshold?: number
    pushAfter?: boolean
    branchPerRun?: boolean
    review?: boolean
    openPr?: boolean
    /** D2 — per-event notification matrix (event keys, see NotifyEvent). */
    notifyEvents?: string[]
    /** D2 — generic outbound JSON webhook for the selected events. */
    notifyWebhookUrl?: string
}

// ── Notifications (D2) ───────────────────────────────────────────────────────

export type NotifyEvent = 'run:completed' | 'run:errored' | 'task:error' | 'limit' | 'agent:done'

export const NOTIFY_EVENTS: NotifyEvent[] = [
    'run:completed',
    'run:errored',
    'task:error',
    'limit',
    'agent:done',
]

// ── GitHub integration (B7 / E2) ─────────────────────────────────────────────

export interface GithubIssue {
    number: number
    title: string
    body: string
    labels: string[]
    url: string
}

// ── Health / diagnostics (D4) ────────────────────────────────────────────────

export interface HealthDetails {
    ok: boolean
    agentBin: string
    agentVersion: string | null
    gitVersion: string | null
    diskFree: { totalBytes: number; freeBytes: number } | null
    db: { path: string; sizeBytes: number; migrationVersion: number }
    engines: { project: string; state: EngineState }[]
    searchAvailable: boolean
    /** Registered Claude accounts with their auth method + cached last-verified time. */
    accounts: AccountHealthSummary[]
    config: Record<string, string | number | boolean>
}

/** One commit, as listed for the git page (unpushed / recent history). */
export interface GitCommit {
    sha: string
    subject: string
    /** ISO author date, for relative-time display. */
    date: string
    author: string
}

export type GitOp = 'fetch' | 'pull' | 'discard' | 'stash-push' | 'stash-pop' | 'stash-drop'

/** One working-tree entry from `git status --porcelain`, split per file. */
export interface GitStatusFile {
    path: string
    /** Index (staged) status code, e.g. `M`, `A`, `?`. */
    staged: string
    /** Working-tree (unstaged) status code. */
    unstaged: string
}

export interface GitBranchList {
    local: string[]
    remote: string[]
    current: string
}

export interface GitStashEntry {
    index: number
    message: string
    date: string
}

export interface GitCommitDetail {
    commit: GitCommit
    /** `git show --stat` summary block. */
    stat: string
    /** Unified patch, capped for transport. */
    patch: string
    /** True when the patch was truncated at the transport cap. */
    patchTruncated: boolean
}

export interface RunSnapshot {
    project: string
    state: EngineState
    /** project-relative id of the task currently running (or last touched). */
    current: string | null
    done: number
    error: number
    total: number
    /** epoch ms the engine will wake from a usage-limit sleep, if SLEEPING. */
    wakeAt: number | null
    model: string | null
    startedAt: number | null
}

// ── SSE frames ───────────────────────────────────────────────────────────────

export type SseEvent =
    | { type: 'state'; state: EngineState }
    | { type: 'log'; taskId: string | null; kind: TerminalKind; text: string }
    | { type: 'task:begin'; taskId: string }
    | { type: 'task:done'; taskId: string; commit?: string }
    | { type: 'task:error'; taskId: string; error?: string }
    | { type: 'progress'; done: number; error: number; total: number }
    | { type: 'commit'; taskId: string; sha: string; message: string }
    | { type: 'limit'; wakeAt: number; taskId: string }
    | { type: 'transient'; taskId: string; attempt: number; delay: number }
    | { type: 'git' }
    | { type: 'knowledge' }
    | { type: 'notes' }
    | { type: 'completed'; done: number; error: number; total: number; runId: number }
    | { type: 'stopped'; reason: string; runId: number }
    | {
          type: 'agent:state'
          agent: AgentKind
          status: 'idle' | 'running'
          startedAt: number | null
          model: string | null
      }
    | { type: 'agent:log'; agent: AgentKind; kind: TerminalKind; text: string }
    | {
          type: 'agent:done'
          agent: AgentKind
          ok: boolean
          created: string[]
          timedOut: boolean
          /** True when the session was killed by the user (client toasts "killed", not "failed"). */
          stopped?: boolean
          /** Session start ts — stable toast-dedupe key across SSE reconnects. */
          startedAt: number | null
      }

export type TerminalKind = 'output' | 'error' | 'comment'

// ── Telemetry ────────────────────────────────────────────────────────────────

export interface TelemetryRecord {
    task: string
    status: 'done' | 'error' | 'failed'
    elapsed: number
    model: string
    commit?: string
    timestamp: string
    error?: string
    /** B2 — usage reported by the CLI's final `result` frame. */
    tokensIn?: number
    tokensOut?: number
    costUsd?: number
    /** B8 — reviewer verdict for this attempt. */
    review?: 'pass' | 'fail'
    reviewNote?: string
}

/** D1 — aggregate rows for the telemetry dashboard. */
export interface TelemetrySummary {
    perDay: { date: string; done: number; error: number; costUsd: number }[]
    perModel: { model: string; count: number; avgElapsed: number; costUsd: number }[]
    slowest: { task: string; elapsed: number; model: string }[]
    expensive: { task: string; costUsd: number; model: string }[]
    retried: { task: string; attempts: number }[]
    totals: { done: number; error: number; costUsd: number; tokensIn: number; tokensOut: number }
}

// ── Usage (claude /usage) ──────────────────────────────────────────────────────

/** One usage bucket parsed from the agent's `/usage` output. */
export interface UsageEntry {
    /** e.g. "Current session", "Current week (all models)". */
    label: string
    /** Percent of the limit consumed, 0–100. */
    percent: number
    /** Human reset hint, e.g. "Jun 12 at 11am (Europe/Skopje)". */
    resets?: string
}

/** Cached result of running the agent's `/usage` command. */
export interface UsageSnapshot {
    /** ISO timestamp the snapshot was fetched / cached. */
    fetchedAt: string
    /** Leading prose line, e.g. the subscription/API-credit note. */
    note: string
    entries: UsageEntry[]
    /** Full raw text, kept for transparency / unparsed variants. */
    raw: string
}

// ── Skills ───────────────────────────────────────────────────────────────────

export interface SkillSummary {
    name: string
    description: string
}

// ── Model catalog ────────────────────────────────────────────────────────────

export type ModelAlias = 'fast' | 'mid' | 'deep'
