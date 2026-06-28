// Pure shared domain types for Wharf — imported from BOTH client and server, so
// this file has NO `import 'server-only'` and performs no I/O (no fs, no node:*,
// no db/services imports). It is the contract between the two halves (blueprint
// §domain). Entity shapes mirror the `MIGRATIONS[]` tables in server/data/db.ts.

// ── Global role (app_user.role) — planning §2.1 ──────────────────────────────

export type Role = 'owner' | 'guest'

/** Strict ordering for global `minRole` comparisons. Higher = more access. */
export const ROLE_RANK: Record<Role, number> = { guest: 0, owner: 1 }

// ── Project role (project_member.project_role) — planning §2.2 ────────────────

export type ProjectRole = 'developer' | 'devops'

/**
 * Strict ordering for project-scoped `minProjectRole` comparisons. `owner`
 * (global) implicitly outranks any project role on every project — treated as
 * `devops`+ everywhere (see guardProject).
 */
export const PROJECT_ROLE_RANK: Record<ProjectRole, number> = { developer: 0, devops: 1 }

/** Roles an owner may assign on a project membership (guest is never a project role). */
export const ASSIGNABLE_PROJECT_ROLES: ReadonlySet<ProjectRole> = new Set<ProjectRole>([
    'developer',
    'devops',
])

export function isProjectRole(value: unknown): value is ProjectRole {
    return typeof value === 'string' && (ASSIGNABLE_PROJECT_ROLES as ReadonlySet<string>).has(value)
}

// ── Session / identity ────────────────────────────────────────────────────────

/**
 * Decoded HMAC-signed session-cookie payload. The GitHub access token is NOT part
 * of this — used only during the OAuth callback, never persisted. `iat`/`exp` are
 * unix seconds. `role` is captured at sign-in; `authorize` re-reads the live role.
 */
export interface SessionPayload {
    sub: number
    login: string
    role: Role
    iat: number
    exp: number
}

/** A signed-in GitHub identity. Mirrors the `app_user` table. */
export interface AppUser {
    githubId: number
    login: string
    name: string
    avatarUrl?: string
    role: Role
    addedAt: string
}

/** `GET /api/me` response — identity + global role for client-side nav gating. */
export interface MeResponse {
    githubId: number
    login: string
    name: string
    avatarUrl?: string
    role: Role
}

// ── Projects & membership — planning §4 (v2) ──────────────────────────────────

export interface Project {
    id: string
    name: string
    slug: string
    createdBy: number
    createdAt: string
}

export interface ProjectMember {
    id: string
    projectId: string
    githubId: number
    projectRole: ProjectRole
    grantedBy: number
    grantedAt: string
}

/** A project membership enriched with the member's GitHub profile (members page). */
export interface ProjectMemberRow {
    member: ProjectMember
    user: AppUser
}

/** Project summary for the dashboard cards — the caller's effective role folded in. */
export interface ProjectSummary {
    project: Project
    /** The caller's project role, or 'owner' when the global owner. */
    effectiveRole: ProjectRole | 'owner'
    environmentCount: number
    instanceCount: number
}

/** Single-project response (GET /api/projects/:id) with the caller's effective role. */
export interface ProjectDetail {
    project: Project
    effectiveRole: ProjectRole | 'owner'
    isOwner: boolean
}

// ── Environments & instances — planning §4 (v3) ───────────────────────────────

export interface Environment {
    id: string
    projectId: string
    name: string
    sortOrder: number
    /** 1 = Agent API refuses to serve an instance missing required keys (decision #11). */
    strictRequired: boolean
    createdAt: string
}

export interface Instance {
    id: string
    environmentId: string
    name: string
    /** True iff a fetch key has been minted (key_hash present); the hash itself never leaves the server. */
    hasKey: boolean
    keySetAt?: string
    keyExpiresAt?: string
    /** Last successful Agent-API fetch (incl. 304); the applied-as-of watermark (§3.2). */
    lastFetchAt?: string
    createdAt: string
}

// ── Secrets — planning §4 (v4). The VALUE never appears in a shared type. ─────

/** Secret metadata (keys-only surface). The plaintext value is served only by the
 *  audited reveal endpoint / the Agent API, never carried on this type. */
export interface SecretMeta {
    id: string
    projectId: string
    key: string
    description?: string
    createdBy: number
    createdAt: string
    updatedAt: string
}

export type SecretGenKind = 'password' | 'token' | 'hex' | 'base64'

// ── Environment variables — planning §4 (v5) + §3.1 ───────────────────────────

export type EnvVarSource = 'literal' | 'secret_ref'

/** Authoring row for one env var at one scope (env-baseline when instanceId is null). */
export interface EnvVar {
    id: string
    projectId: string
    environmentId: string
    /** null = environment-scope baseline; set = instance-scope override. */
    instanceId?: string
    key: string
    source: EnvVarSource
    /** Decrypted literal value (literals only); never set for secret_ref. Masked for developers on read. */
    value?: string
    /** Set iff source === 'secret_ref'. */
    secretId?: string
    /** The referenced secret's key, for display (joined on read). */
    secretKey?: string
    description?: string
    /** Meaningful on env-scope (baseline) rows: declares the key required for every instance. */
    required: boolean
    createdAt: string
    updatedAt: string
}

export type EnvVarScope = 'environment' | 'instance'

/** A single resolved key in an instance's final environment (planning §3.1). */
export interface ResolvedEntry {
    key: string
    /** Resolved value, OR the masked placeholder `<hidden:secretName>` for an unauthorized caller. */
    value: string
    source: EnvVarSource
    /** Whether the value is masked (developer viewing a secret-backed key). */
    masked: boolean
    /** True if this key's row/secret changed after the instance's last_fetch_at (§3.2). */
    pending?: boolean
}

/** Full resolver output for an instance (planning §3.1). */
export interface ResolvedConfig {
    env: ResolvedEntry[]
    /** Keys flagged required (env-scope) that resolve empty for this instance. */
    missingRequired: string[]
    /** Keys/flags edited after the instance's last_fetch_at (§3.2). */
    pending: string[]
}

// ── Feature flags — planning §4 (v6) + gap-7 ──────────────────────────────────

export type FlagType = 'boolean' | 'string' | 'number' | 'json'

export interface FeatureFlag {
    id: string
    projectId: string
    key: string
    description?: string
    type: FlagType
    createdAt: string
}

/** A flag's value in one environment. `value` is coerced to its typed form on read. */
export interface FeatureFlagValue {
    id: string
    flagId: string
    environmentId: string
    enabled: boolean
    /** Typed per FeatureFlag.type: boolean | string | number | decoded JSON. */
    value: boolean | string | number | unknown | null
    updatedAt: string
    pending?: boolean
}

/** A flag plus its per-environment values, for the flags grid (rows=flags, cols=envs). */
export interface FlagWithValues {
    flag: FeatureFlag
    /** environmentId → value row. */
    values: Record<string, FeatureFlagValue>
}

// ── Notes — planning §4 (v7). Content never appears in the list type. ─────────

export interface NoteMeta {
    id: string
    projectId: string
    title: string
    createdBy: number
    createdAt: string
    updatedAt: string
}

// ── Docker run command builder — planning §7 ──────────────────────────────────

export interface DockerPortMapping {
    host: number
    container: number
    protocol: 'tcp' | 'udp'
}

export interface DockerVolumeMapping {
    host: string
    container: string
    mode: 'rw' | 'ro'
}

export interface DockerKv {
    key: string
    value: string
}

export type DockerEnvSource = 'none' | 'wharf' | 'instance'

/** The structured docker-run spec stored as `docker_command.spec_json` (planning §7.1). */
export interface DockerSpec {
    image: string
    tag: string
    containerName: string
    detach: boolean
    tty: boolean
    removeOnExit: boolean
    pull: 'missing' | 'always' | 'never'
    restart: 'no' | 'on-failure' | 'always' | 'unless-stopped'
    network?: string
    ports: DockerPortMapping[]
    volumes: DockerVolumeMapping[]
    envInline: DockerKv[]
    envSource: DockerEnvSource
    labels: DockerKv[]
    memory?: string
    cpus?: string
    user?: string
    workdir?: string
    entrypoint?: string | null
    command: string[]
    extraArgs?: string
}

export interface DockerCommand {
    id: string
    projectId: string
    name: string
    spec: DockerSpec
    /** Optional: tie to an instance for env / wharf-client injection. */
    instanceId?: string
    createdBy: number
    createdAt: string
    updatedAt: string
}

export type DockerLifecycle = 'run' | 'recreate'
export type DockerRenderFormat = 'sh' | 'compose'

// ── Backups — planning §4 (v10), §8.7 ─────────────────────────────────────────

export interface Backup {
    id: string
    path: string
    sizeBytes: number
    encrypted: boolean
    kind: 'auto' | 'manual'
    /** Keyring entry that sealed this blob (gap-1). */
    keyId?: string
    createdAt: string
    createdBy?: number
}

// ── Audit — planning §4 (v1), §11 ─────────────────────────────────────────────

export interface AuditEntry {
    id: number
    at: string
    githubId: number | null
    login: string | null
    action: string
    /** null = global-scoped audit row; set = project-scoped. */
    projectId: string | null
    detail: string | null
}

// ── Shared validation ─────────────────────────────────────────────────────────

/** Env-var / flag key shape (gap-8). Enforced on create AND in the import preview. */
export const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

export function isValidKey(key: string): boolean {
    return KEY_PATTERN.test(key)
}
