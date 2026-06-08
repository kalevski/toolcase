// Shared types for TaskForge.
// Pure types + constants only — safe to import from both server and client code
// (no `fs`, `child_process`, or other server-only imports here).

// ── Auth / roles ─────────────────────────────────────────────────────────────

export type Role = 'admin' | 'standard' | 'guest'

/** Strict ordering used for `minRole` comparisons. Higher = more access. */
export const ROLE_RANK: Record<Role, number> = {
    guest: 0,
    standard: 1,
    admin: 2,
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
    role: Role // advisory hint; roles.json is authoritative per request
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

/** Runtime status of a task, merging on-disk header + live engine state. */
export type TaskRuntimeStatus = 'pending' | 'running' | 'done' | 'error'

export interface TaskInfo {
    /** Project-relative path within `tasks/`, e.g. `001-add-healthcheck.md`. Stable id. */
    id: string
    title: string
    status: TaskRuntimeStatus
    severity?: string
    project?: string
    /** Last recorded attempt outcome from telemetry, if any. */
    lastElapsed?: number
    lastModel?: string
    lastCommit?: string
    lastError?: string
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
}

// ── Git ──────────────────────────────────────────────────────────────────────

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
    /** list invocations without executing */
    dryRun?: boolean
}

/** One commit, as listed for the git page (unpushed / recent history). */
export interface GitCommit {
    sha: string
    subject: string
    /** ISO author date, for relative-time display. */
    date: string
    author: string
}

export type GitOp = 'fetch' | 'pull' | 'discard'

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
    | { type: 'completed'; done: number; error: number; total: number }
    | { type: 'stopped'; reason: string }

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

const MODEL_ALIASES = ['fast', 'mid', 'deep'] as const
export type ModelAlias = (typeof MODEL_ALIASES)[number]
