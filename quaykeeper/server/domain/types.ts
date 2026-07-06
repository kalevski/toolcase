// Pure shared domain types for Quaykeeper — safe to import from client AND server, so
// this file deliberately has NO `import 'server-only'` and performs no I/O. No
// imports of db or services (type-only imports from sibling pure domain modules
// are fine). See notes/static-hosting-app-design.md §6, §12, §15.

import type { DockerRunSpec } from './docker-run'

// ── Auth / roles ─────────────────────────────────────────────────────────────

export type Role = 'owner' | 'maintainer' | 'standard' | 'guest'

/**
 * Strict ordering used for `minRole` comparisons. Higher = more access. The
 * hierarchy is linear and a superset chain: a `maintainer` is everything a
 * `standard` is plus the routing surface (proxies/upstreams) and exemption from
 * hosting quotas; an `owner` is everything a `maintainer` is plus the admin
 * surface. So `authorize('maintainer')` admits maintainers *and* owners, while
 * `authorize('owner')` (the admin endpoints) still excludes maintainers.
 */
export const ROLE_RANK: Record<Role, number> = {
    guest: 0,
    standard: 1,
    maintainer: 2,
    owner: 3,
}

/**
 * Decoded HMAC-signed session-cookie payload (§7). The GitHub access token is
 * deliberately NOT part of this — it is used only during the OAuth callback and
 * never persisted. `iat`/`exp` are unix seconds.
 */
export interface SessionPayload {
    /** GitHub numeric id (`app_user.github_id`). */
    sub: number
    login: string
    /** Role captured at sign-in; `authorize` re-reads the live role each request. */
    role: Role
    /** Issued-at (unix seconds). */
    iat: number
    /** Expiry (unix seconds). */
    exp: number
}

// ── Limits (one standard plan) ────────────────────────────────────────────────

/**
 * Per-account quota limits. Every non-operator account runs on the single
 * {@link STANDARD_LIMITS} baseline; the owner raises individual accounts via the
 * per-user `user_limit` override (§11, §15) — that override is the ONLY way above
 * baseline now that the sponsorship-driven plan tiers are gone.
 */
export interface PlanLimits {
    /** Max number of sites a user may own. Standard: 1. */
    maxSites: number
    /** Byte cap per site; exceeding it marks the site `over_quota`. Standard: 50 MB. */
    maxBytesPerSite: number
    /** Byte cap across all of a user's sites. Standard: == maxBytesPerSite. */
    maxBytesTotal: number
    /** Poll-cadence floor (seconds) written as the fragment `interval`. Standard: 900 (15m). */
    minIntervalSec: number
    /** How many custom domains the user may attach. Standard: 0 (subdomain only). */
    customDomains: number
    /** nginxpilot rollback depth (kept releases). Standard: 1. */
    keepReleases: number
    /** Whether the account may deploy private repos (via GitHub App). Standard: no. */
    privateRepos: boolean
}

const MB = 1024 * 1024

/**
 * The single baseline every standard account gets (the former free tier's §15
 * values). Deliberately strict — the owner lifts individual accounts through the
 * per-user override, not a global knob.
 */
export const STANDARD_LIMITS: PlanLimits = {
    maxSites: 1,
    maxBytesPerSite: 50 * MB,
    maxBytesTotal: 50 * MB,
    minIntervalSec: 900, // 15 min
    customDomains: 0,
    keepReleases: 1,
    privateRepos: false,
}

/**
 * Limits for instance operators (§6) — exempt from quotas entirely. The owner
 * runs the instance and maintainers help operate it, so they create unlimited
 * resources and are never gated or suspended: `Infinity` caps make every
 * count/byte gate pass, the fastest poll cadence applies, and private repos are
 * allowed. `resolveLimits` returns this for any `owner`- or `maintainer`-role
 * user instead of {@link STANDARD_LIMITS}.
 */
export const UNLIMITED_LIMITS: PlanLimits = {
    maxSites: Infinity,
    maxBytesPerSite: Infinity,
    maxBytesTotal: Infinity,
    minIntervalSec: 60, // 1 min — the old top-tier cadence
    customDomains: Infinity,
    keepReleases: 5,
    privateRepos: true,
}

// ── Account level (the unified standard/maintainer/owner ladder) ──────────────

/**
 * A single human-facing "level" for an account — now purely role-derived (the
 * sponsorship-driven paid tier is gone). Strictly ordered low → high.
 */
export type AccountLevel = 'standard' | 'maintainer' | 'owner'

/** Every account level, lowest first. */
export const ACCOUNT_LEVELS: readonly AccountLevel[] = ['standard', 'maintainer', 'owner']

/** Title-case display labels for each level (badges, the user-panel micro-label). */
export const ACCOUNT_LEVEL_LABEL: Record<AccountLevel, string> = {
    standard: 'Standard',
    maintainer: 'Maintainer',
    owner: 'Owner',
}

/**
 * The account level for a role. Pure, so the user-panel and the admin roster
 * share one rule.
 */
export function accountLevel(role: Role): AccountLevel {
    if (role === 'owner') return 'owner'
    if (role === 'maintainer') return 'maintainer'
    return 'standard'
}

// ── Per-user custom limit overrides (`user_limit` row) ─────────────────────────

/**
 * An owner-set partial override of a user's quota limits (§11, §15). Only the
 * fields present are overridden; the rest fall through to the role/plan default.
 * Stored in the `user_limit` table; a row exists only when at least one field is
 * customised. Byte/count fields are finite integers (no `Infinity` — JSON can't
 * carry it; leave a field absent to inherit the default, which may be unlimited).
 */
export type UserLimitOverride = Partial<PlanLimits>

/** The keys of {@link PlanLimits} that are numeric quotas (everything but `privateRepos`). */
export const NUMERIC_LIMIT_KEYS = [
    'maxSites',
    'maxBytesPerSite',
    'maxBytesTotal',
    'minIntervalSec',
    'customDomains',
    'keepReleases',
] as const

/**
 * Apply a {@link UserLimitOverride} on top of a base {@link PlanLimits}. Only the
 * override's present keys win; an absent/empty override returns `base` unchanged.
 * Pure (no I/O), so the resolution is unit-testable; `services/plan.ts` supplies
 * the base (role/plan defaults) and the stored override.
 */
export function mergeLimits(base: PlanLimits, override?: UserLimitOverride | null): PlanLimits {
    if (!override) return base
    return { ...base, ...override }
}

/**
 * Restore `Infinity` limits after a JSON round-trip. `JSON.stringify(Infinity)`
 * emits `null` (Infinity isn't representable in JSON), so an unlimited quota sent
 * from the server (`maxSites: Infinity` for an owner) arrives at the client as
 * `null` — and `n < null` coerces to `n < 0`, silently gating everything off. Every
 * client that reads limits off an API response MUST run them through this first:
 * any numeric field that came back non-finite (null/NaN) is treated as unlimited
 * (`Infinity`), never `0`. Pure, so it's safe on both sides of the wire.
 */
export function reviveLimits(limits: PlanLimits): PlanLimits {
    const out: PlanLimits = { ...limits }
    for (const key of NUMERIC_LIMIT_KEYS) {
        if (!Number.isFinite(out[key])) out[key] = Infinity
    }
    return out
}

// ── App user (`app_user` row) ────────────────────────────────────────────────

/** A signed-in GitHub identity. Mirrors the `app_user` table (§12). */
export interface AppUser {
    /** GitHub numeric id; primary key. */
    githubId: number
    login: string
    name: string
    avatarUrl?: string
    role: Role
    /** ISO timestamp the user first signed in. */
    addedAt: string
}

// ── Sites (`site` row) ───────────────────────────────────────────────────────

/** Site lifecycle state on the `site` row (§9, §12). */
export type SiteStatus = 'draft' | 'provisioning' | 'live' | 'failed' | 'suspended' | 'over_quota'

/** How a site's hostname is provided: an owner subdomain pool, or a custom domain (§10). */
export type SiteHostKind = 'subdomain' | 'custom'

/** A deployed (or in-progress) static site. Mirrors the `site` table (§12). */
export interface Site {
    /** Short server-generated id; also the nginxpilot fragment filename suffix. */
    id: string
    /** Owning `app_user.githubId`. */
    ownerId: number
    repoOwner: string
    repoName: string
    /**
     * Whether the source repo was private at create time (re-read from GitHub, never
     * client-trusted). Drives the fragment's `auth` block: private sites reference a
     * clone token pushed to nginxpilot's git-credentials store.
     */
    repoPrivate: boolean
    branch: string
    /** Optional build output subdirectory (e.g. `dist/`). */
    subdir?: string
    /** Fully-qualified hostname; globally unique (`alice.quaykeeper.dev` | `www.example.com`). */
    hostname: string
    hostKind: SiteHostKind
    status: SiteStatus
    /**
     * The realm (registered nginxpilot instance) this site deploys to (multiple_realms.md
     * §2.1). Set at create time to the active realm. Hostname uniqueness is scoped to
     * this realm.
     */
    realmId: string
    /** Last measured deployed size in bytes, if known. */
    bytes?: number
    /** Last live git ref reported by nginxpilot `/status`. */
    lastRef?: string
    /** Last error surfaced from deploy / status, if any. */
    lastError?: string
    createdAt: string
    updatedAt: string
}

// ── Usage & identity (`GET /api/me`) ─────────────────────────────────────────

/**
 * A user's current consumption against their plan — the count and total
 * deployed bytes of the sites they own (§7 step 4, §11). Computed per request
 * from `siteRepo`; never stored.
 */
export interface SiteUsage {
    /** Number of sites the user currently owns. */
    siteCount: number
    /** Sum of last-measured deployed bytes across those sites (unmeasured sites count 0). */
    totalBytes: number
}

/**
 * The `GET /api/me` response: identity plus the effective limits and current
 * usage, so the client can gate UI on role/quota headroom (§7 step 4, §13).
 * `role` is the freshly re-read role; `limits` come from `services/plan.ts`;
 * `usage` summarizes the caller's sites.
 */
export interface MeResponse {
    githubId: number
    login: string
    name: string
    avatarUrl?: string
    role: Role
    /** The unified standard/maintainer/owner label for the account (see {@link accountLevel}). */
    level: AccountLevel
    limits: PlanLimits
    usage: SiteUsage
    /**
     * The realm the caller currently operates on (multiple_realms.md §E.4): the owner's
     * switcher selection, or a non-owner's owner-assigned default. Drives the header label
     * + which realm realm-selected ops target.
     */
    activeRealm: Realm
    /** Whether this caller may switch realms — `true` only for the owner (§0.6). */
    canSwitchRealms: boolean
    /**
     * The full realm set the switcher lists — present ONLY for the owner. A non-owner never
     * receives the other realms (they can't switch), so this is omitted for them.
     */
    realms?: Realm[]
}

/**
 * One enriched row of the owner-only admin Users roster (`GET /api/admin/users`).
 * Bundles the stored user with everything the admin page shows per account: the
 * level, current usage, the *effective* limits (after any custom override), and
 * the raw `customLimits` override (`null` when none is set).
 */
export interface AdminUserRow {
    user: AppUser
    level: AccountLevel
    usage: SiteUsage
    /** Effective limits the user gets right now (role/plan default merged with `customLimits`). */
    limits: PlanLimits
    /** The owner-set override, or `null` when the user runs on pure role/plan defaults. */
    customLimits: UserLimitOverride | null
    /** The realms this user is granted, with their own default marked (multiple_realms.md §F.2). */
    realmGrants: UserRealmGrant[]
}

// ── Base domains (`base_domain` row) ─────────────────────────────────────────

/**
 * Which audience a base domain is offered to (§10). A strict superset chain,
 * so a caller who can see a higher tier can see every lower one:
 *
 *   • `free`  — available to everybody.
 *   • `staff` — reserved for instance operators (the `maintainer`/`owner` roles).
 *
 * The visibility a given caller gets is computed by {@link visibleBaseDomainTiers}.
 */
export type BaseDomainTier = 'free' | 'staff'

/** Every base-domain tier, lowest-audience first (the superset chain order). */
export const BASE_DOMAIN_TIERS: readonly BaseDomainTier[] = ['free', 'staff']

/** Type guard: a request-supplied value is one of the base-domain tiers. */
export function isBaseDomainTier(value: unknown): value is BaseDomainTier {
    return typeof value === 'string' && (BASE_DOMAIN_TIERS as readonly string[]).includes(value)
}

/**
 * The base-domain tiers a caller may see, keyed off role (§10):
 *
 *   • `owner` / `maintainer` (instance operators) → every tier, incl. `staff`.
 *   • everyone else                               → `free` only.
 *
 * Pure (no I/O), so the standard `/api/base-domains` projection and the create-site
 * wizard can both gate on it and it's unit-testable directly. The result is always a
 * prefix of {@link BASE_DOMAIN_TIERS} — each step strictly contains the one below.
 */
export function visibleBaseDomainTiers(role: Role): BaseDomainTier[] {
    if (role === 'owner' || role === 'maintainer') return ['free', 'staff']
    return ['free']
}

/**
 * Subdomain TLS policy for a base domain (§0/Phase D). TLS for subdomains is decided
 * once per base domain — a single wildcard cert (`*.base.dev`) covers every label — so
 * the knob lives here, never per subdomain. `required` makes no sense at wildcard scope,
 * so it's deliberately off/auto only; `auto` degrades to HTTP when the cert isn't issued
 * yet (so a missing cert never takes subdomains down).
 */
export type BaseDomainTls = 'off' | 'auto'

/** Every base-domain TLS policy. */
export const BASE_DOMAIN_TLS: readonly BaseDomainTls[] = ['off', 'auto']

/** Type guard: a request-supplied value is one of the base-domain TLS policies. */
export function isBaseDomainTls(value: unknown): value is BaseDomainTls {
    return value === 'off' || value === 'auto'
}

/** An owner-registered base domain backing the subdomain pool (§10, §12). */
export interface BaseDomain {
    /** Fully-qualified base domain; primary key (e.g. `quaykeeper.dev`). */
    domain: string
    /** The audience this domain is offered to; gates which users may pick it (§10). */
    tier: BaseDomainTier
    /** Subdomain TLS policy (§0/Phase D): one wildcard cert per base. Defaults to `auto`. */
    tls: BaseDomainTls
    /**
     * The realm (nginxpilot instance) whose wildcard serves this base domain
     * (multiple_realms.md §2.1, §10.4).
     */
    realmId: string
    /** ISO timestamp the owner registered it. */
    createdAt: string
}

// ── Realms (`realm` / `user_realm` rows) ──────────────────────────────────────

/**
 * One registered nginxpilot instance the control plane drives (multiple_realms.md §1).
 * The client-facing DTO: the admin token NEVER appears here — only {@link hasToken}
 * signals whether the instance is authenticated. Server-only code resolves the decrypted
 * token through a `RealmConnection` (`infrastructure/nginxpilot.ts`), never this shape.
 */
export interface Realm {
    id: string
    /** Human label ("prod-eu", "lab"). */
    name: string
    /** Normalized admin REST base URL (no trailing `/`). */
    adminUrl: string
    /** True when this realm is authenticated (a token is stored). The token itself never reaches the client. */
    hasToken: boolean
    /** The single global default realm — new users land here and it's the owner's fallback active realm. */
    isDefault: boolean
    /** ISO timestamp the owner registered it. */
    createdAt: string
}

/** A user's realm grant as the owner roster shows it (multiple_realms.md §2.4). */
export interface UserRealmGrant {
    realmId: string
    realmName: string
    /** This user's own operating realm among their grants (owner-set). */
    isDefault: boolean
}

// ── Audit log (`audit` row) ──────────────────────────────────────────────────

/** One append-only audit-log entry. Mirrors the `audit` table (§12, §16). */
export interface AuditEntry {
    /** Auto-increment id; also the DESC ordering key. */
    id: number
    /** ISO timestamp the action occurred. */
    at: string
    /** Acting GitHub id, or null for unauthenticated/system actions. */
    githubId: number | null
    /** Acting GitHub login, or null. */
    login: string | null
    /** Action name (e.g. `site.create`, `plan_tier.update`). */
    action: string
    /** Affected site id/hostname, if any. */
    site: string | null
    /** Free-form detail, if any. */
    detail: string | null
    /** JSON snapshot of the written object (B3), secrets stripped at the call site; null when absent. */
    meta: string | null
}

// ── Config subsystem (move_wharf_to_perch.md) ────────────────────────────────
//
// Flat, tag-organized model: two global pools (variables, secrets) plus a flat
// list of instances. No projects/environments, no override cascade, no
// interpolation — every env var is a literal or a single reference. See
// move_wharf_to_perch.md §2, §3.

/** A plain-text, app-wide key/value pair (`global_var` row). Owner-managed. */
export interface GlobalVar {
    id: string
    key: string
    value: string
    description?: string
    createdAt: string
    updatedAt: string
}

/** Secret metadata (keys-only surface, `secret` row minus `value_enc`). The
 *  plaintext value never appears on this type — only the audited reveal
 *  endpoint / the instance fetch API serve it. */
export interface SecretMeta {
    id: string
    key: string
    description?: string
    createdBy: number
    createdAt: string
    updatedAt: string
}

export type SecretGenKind = 'password' | 'token' | 'hex' | 'base64'

/** A flat instance (`instance` row). Tags plus an optional `project` label are
 *  the grouping mechanisms — both purely organizational. */
export interface Instance {
    id: string
    name: string
    description?: string
    /** Optional project label shared across instances — grouping/filter only. */
    project?: string
    tags: string[]
    /** True iff a fetch key has been minted (key_hash present); the hash itself never leaves the server. */
    hasKey: boolean
    keySetAt?: string
    keyExpiresAt?: string
    /** Last successful fetch-API read (incl. 304); the applied-as-of watermark. */
    lastFetchAt?: string
    createdAt: string
    updatedAt: string
}

/** How one env var's value is sourced — exactly one per row (`env_var` CHECK). */
export type EnvVarSource = 'literal' | 'global' | 'secret'

/** One env var row on an instance (`env_var`). */
export interface EnvVar {
    id: string
    instanceId: string
    key: string
    source: EnvVarSource
    /** Literal text (source='literal' only). */
    value?: string
    /** Referenced global variable (source='global' only). */
    globalVarId?: string
    /** The referenced global variable's key, for display (joined on read). */
    globalVarKey?: string
    /** Referenced secret (source='secret' only). */
    secretId?: string
    /** The referenced secret's key, for display (joined on read). */
    secretKey?: string
    description?: string
    createdAt: string
    updatedAt: string
}

/** A boolean-only feature flag defined directly on an instance (`feature_flag`). */
export interface FeatureFlag {
    id: string
    instanceId: string
    key: string
    enabled: boolean
    description?: string
    createdAt: string
    updatedAt: string
}

/** One resolved key in an instance's config (move_wharf_to_perch.md §4). */
export interface ResolvedEnvEntry {
    key: string
    /** Resolved value, or the masked placeholder `<hidden:KEY>` when unauthorized. */
    value: string
    source: EnvVarSource
    masked: boolean
    /** True when this row (or its reference) changed after the instance's last_fetch_at. */
    pending: boolean
}

/** Full resolver output for an instance (move_wharf_to_perch.md §4). */
export interface ResolvedConfig {
    env: ResolvedEnvEntry[]
    /** Keys whose row/reference changed after the instance's last_fetch_at. */
    pending: string[]
}

/** One instance referencing a global var/secret that's about to be deleted
 *  (the RESTRICT-delete 409 payload, move_wharf_to_perch.md §3). */
export interface ReferencingInstance {
    id: string
    name: string
}

/** An instance plus the list view's derived "has un-applied changes" flag
 *  (`GET /api/instances` response row, move_wharf_to_perch.md §4, §10). */
export interface InstanceListItem extends Instance {
    pending: boolean
}

// ── Docker-run snippets (`docker_snippet` row) ───────────────────────────────

/**
 * A saved, form-built `docker run` recipe (`docker_snippet` row) as the client
 * sees it. The recipe itself is the JSON {@link DockerRunSpec}; `instanceId`
 * optionally points at the Config instance whose resolved variables the rendered
 * command injects at container boot (inline entrypoint against the agent
 * server). `instanceName`/`instanceHasKey` are joined on read for display and
 * the "no fetch key yet" warning — the fetch secret itself never appears here.
 */
export interface DockerSnippet {
    id: string
    name: string
    description?: string
    spec: DockerRunSpec
    /** Injection target instance; absent = plain docker run (also after the instance is deleted). */
    instanceId?: string
    /** Joined instance name (display + command rendering). */
    instanceName?: string
    /** Whether the target instance has a fetch key minted (warning banner when not). */
    instanceHasKey?: boolean
    /** Creating `app_user.github_id`. */
    createdBy: number
    createdAt: string
    updatedAt: string
}

// ── Database management (quaykeeper_database_management.md) ───────────────────────
//
// The owner registers database servers (like realms: endpoint + encrypted admin
// credential); maintainers manage the databases, users, and user↔database access
// on them. Quaykeeper mirrors NOTHING — the server's catalogs are the source of truth,
// so every Db* shape below except `DbServer` is a live read, never a stored row.

/** Supported database engines (§3). MariaDB speaks the mysql protocol. */
export type DbServerKind = 'postgres' | 'mysql'

export const DB_SERVER_KINDS: readonly DbServerKind[] = ['postgres', 'mysql']

export function isDbServerKind(value: unknown): value is DbServerKind {
    return value === 'postgres' || value === 'mysql'
}

/** Registry transport policy: `require` verifies against the system CAs (§10). */
export type DbServerTls = 'off' | 'require'

export function isDbServerTls(value: unknown): value is DbServerTls {
    return value === 'off' || value === 'require'
}

/** Default engine ports, used by the registry form and create-time fallback. */
export const DB_SERVER_DEFAULT_PORT: Record<DbServerKind, number> = {
    postgres: 5432,
    mysql: 3306,
}

/** Registry row as the client sees it — the admin credential NEVER appears here
 *  (only on the server, decrypted inside the services; §10). */
export interface DbServer {
    id: string
    name: string
    kind: DbServerKind
    host: string
    port: number
    tls: DbServerTls
    adminUser: string
    /** Health snapshot from the last probe/operation. */
    lastOkAt?: string
    lastError?: string
    createdAt: string
    updatedAt: string
}

/** One live database on a server (read from the catalog, never stored). */
export interface DbDatabase {
    name: string
    /** Owning role (postgres); null on mysql (no db-owner concept). */
    owner: string | null
    /** Approximate on-disk size in bytes when the engine reports one. */
    sizeBytes: number | null
}

/** One live login-capable user/role on a server. */
export interface DbUser {
    name: string
    /** mysql account host part ('%' by default); null for postgres. */
    host: string | null
    superuser: boolean
    /** True for the registry's own admin account — locked from management (§10). */
    isAdminAccount: boolean
}

/** Simplified per-user × per-database access levels (§3), lowest first. */
export type DbAccessLevel = 'none' | 'read' | 'readwrite' | 'owner'

export const DB_ACCESS_LEVELS: readonly DbAccessLevel[] = ['none', 'read', 'readwrite', 'owner']

export function isDbAccessLevel(value: unknown): value is DbAccessLevel {
    return (
        value === 'none' || value === 'read' || value === 'readwrite' || value === 'owner'
    )
}

/** Engine-neutral per-database operations (§3) — the privilege surface common to
 *  postgres and mysql. The simplified levels are presets over these sets; the
 *  detailed editor grants an arbitrary subset. Order here is canonical (display
 *  order and the order privileges are emitted in). */
export type DbOperation =
    | 'select'
    | 'insert'
    | 'update'
    | 'delete'
    | 'references'
    | 'trigger'
    | 'execute'
    | 'ddl'
    | 'temp'

export const DB_OPERATIONS: readonly DbOperation[] = [
    'select',
    'insert',
    'update',
    'delete',
    'references',
    'trigger',
    'execute',
    'ddl',
    'temp',
]

export function isDbOperation(value: unknown): value is DbOperation {
    return typeof value === 'string' && (DB_OPERATIONS as readonly string[]).includes(value)
}

/** Editor metadata per operation: label, grouping, and the exact per-engine
 *  privileges the operation maps to (surfaced so a maintainer knows precisely
 *  what a checkbox grants on THEIR engine). */
export interface DbOperationMeta {
    label: string
    group: 'data' | 'structure' | 'routines'
    description: string
    /** Privileges granted on postgres (human-readable summary). */
    postgres: string
    /** Privileges granted on mysql/mariadb (human-readable summary). */
    mysql: string
}

export const DB_OPERATION_META: Record<DbOperation, DbOperationMeta> = {
    select: {
        label: 'Select',
        group: 'data',
        description: 'Read rows from tables and views.',
        postgres: 'SELECT on all tables (current and future)',
        mysql: 'SELECT, SHOW VIEW',
    },
    insert: {
        label: 'Insert',
        group: 'data',
        description: 'Add new rows.',
        postgres: 'INSERT on all tables; USAGE, SELECT on sequences',
        mysql: 'INSERT',
    },
    update: {
        label: 'Update',
        group: 'data',
        description: 'Modify existing rows.',
        postgres: 'UPDATE on all tables; USAGE, SELECT on sequences',
        mysql: 'UPDATE',
    },
    delete: {
        label: 'Delete',
        group: 'data',
        description: 'Remove rows.',
        postgres: 'DELETE on all tables',
        mysql: 'DELETE',
    },
    references: {
        label: 'References',
        group: 'structure',
        description: 'Create foreign keys pointing at the database’s tables.',
        postgres: 'REFERENCES on all tables',
        mysql: 'REFERENCES',
    },
    trigger: {
        label: 'Triggers',
        group: 'structure',
        description: 'Create and drop triggers on tables.',
        postgres: 'TRIGGER on all tables',
        mysql: 'TRIGGER',
    },
    ddl: {
        label: 'DDL',
        group: 'structure',
        description: 'Create, alter and drop tables, views, indexes and routines.',
        postgres: 'CREATE on schema public (creators alter/drop their own objects)',
        mysql: 'CREATE, ALTER, DROP, INDEX, CREATE VIEW, CREATE ROUTINE, ALTER ROUTINE, EVENT',
    },
    temp: {
        label: 'Temp tables',
        group: 'structure',
        description: 'Create temporary tables.',
        postgres: 'TEMPORARY on the database',
        mysql: 'CREATE TEMPORARY TABLES',
    },
    execute: {
        label: 'Execute',
        group: 'routines',
        description: 'Run stored functions and procedures.',
        postgres: 'EXECUTE on all functions (current and future)',
        mysql: 'EXECUTE',
    },
}

/** One cell of the access matrix: a user's classified level on a database.
 *  `custom` = a live grant set that matches no known level — quaykeeper shows it but
 *  never overwrites it unless a level or operation set is explicitly set (§3). */
export interface DbGrant {
    user: string
    database: string
    level: DbAccessLevel | 'custom'
    /** Engine-neutral operations fully present in the live grant — what the
     *  detailed editor pre-checks. `owner` reports every operation. */
    operations: DbOperation[]
    /** Live privilege names that fold into no operation (TRUNCATE, LOCK TABLES,
     *  a partial operation’s leftovers…) — the reason a cell reads `custom`.
     *  Applying any level/operation set is a full reset, so these get revoked. */
    extras: string[]
}
