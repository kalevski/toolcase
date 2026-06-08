// Shared types for TaskForge (ai-task-manager).
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

// ── Tasks / repos ────────────────────────────────────────────────────────────

export type TaskStatus = 'open' | 'done' | 'error'

/** Runtime status of a task, merging on-disk header + live engine state. */
export type TaskRuntimeStatus = 'pending' | 'running' | 'done' | 'error'

export interface TaskInfo {
    /** Repo-relative path, e.g. `001-add-healthcheck.md`. Stable id. */
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

export interface RepoSummary {
    name: string
    /** Tasks not present in `.status`. */
    pending: number
    total: number
    done: number
    error: number
    state: EngineState
    /** True when a `tasks/<repo>` directory exists. */
    hasTasks: boolean
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
    /** list invocations without executing */
    dryRun?: boolean
}

export interface RunSnapshot {
    repo: string
    state: EngineState
    /** repo-relative id of the task currently running (or last touched). */
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

// ── Skills ───────────────────────────────────────────────────────────────────

export interface SkillSummary {
    name: string
    description: string
}

// ── Model catalog ────────────────────────────────────────────────────────────

export const MODEL_ALIASES = ['fast', 'mid', 'deep'] as const
export type ModelAlias = (typeof MODEL_ALIASES)[number]
