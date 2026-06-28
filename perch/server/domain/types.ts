// Pure shared domain types for Perch — safe to import from client AND server, so
// this file deliberately has NO `import 'server-only'` and performs no I/O. No
// imports of db or services. See notes/static-hosting-app-design.md §6, §12, §15.

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

// ── Plans & limits (sponsor-driven) ──────────────────────────────────────────

export type Plan = 'free' | 'bronze' | 'silver' | 'gold'

/**
 * Per-plan quota limits. A user's effective plan = max(free, plan derived from
 * their active GitHub sponsorship tier); these defaults are owner-tunable
 * (`plan_tier` table) but ship from the §15 starting values below.
 */
export interface PlanLimits {
    /** Max number of sites a user may own. Free: 1. */
    maxSites: number
    /** Byte cap per site; exceeding it marks the site `over_quota`. Free: 50 MB. */
    maxBytesPerSite: number
    /** Byte cap across all of a user's sites. Free: == maxBytesPerSite. */
    maxBytesTotal: number
    /** Poll-cadence floor (seconds) written as the fragment `interval`. Free: 900 (15m); Gold: 60. */
    minIntervalSec: number
    /** How many custom domains the user may attach. Free: 0 (subdomain only); paid: N. */
    customDomains: number
    /** nginxpilot rollback depth (kept releases). Free: 1; paid: 3–5. */
    keepReleases: number
    /** Whether the plan may deploy private repos (via GitHub App). Free: no. */
    privateRepos: boolean
}

const MB = 1024 * 1024
const GB = 1024 * MB

/**
 * Default plan → limits table, populated from the §15 starting values. Numbers
 * are deliberately strict on the free tier so paid value is obvious; the owner
 * can override them at runtime. `customDomains: Infinity` = "unlimited".
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
    free: {
        maxSites: 1,
        maxBytesPerSite: 50 * MB,
        maxBytesTotal: 50 * MB,
        minIntervalSec: 900, // 15 min
        customDomains: 0,
        keepReleases: 1,
        privateRepos: false,
    },
    bronze: {
        maxSites: 3,
        maxBytesPerSite: 200 * MB,
        maxBytesTotal: 3 * 200 * MB,
        minIntervalSec: 300, // 5 min
        customDomains: 1,
        keepReleases: 3,
        privateRepos: true,
    },
    silver: {
        maxSites: 10,
        maxBytesPerSite: 1 * GB,
        maxBytesTotal: 10 * GB,
        minIntervalSec: 120, // 2 min
        customDomains: 5,
        keepReleases: 3,
        privateRepos: true,
    },
    gold: {
        maxSites: 25,
        maxBytesPerSite: 5 * GB,
        maxBytesTotal: 25 * 5 * GB,
        minIntervalSec: 60, // 1 min
        customDomains: Infinity, // unlimited
        keepReleases: 5,
        privateRepos: true,
    },
}

/**
 * Limits for instance operators (§6) — exempt from all tier quotas. The owner
 * runs the instance and maintainers help operate it, so they create unlimited
 * resources and are never gated or suspended by a plan: `Infinity` caps make
 * every count/byte gate pass, the fastest poll cadence applies, and private
 * repos are allowed. `resolveLimits` returns this for any `owner`- or
 * `maintainer`-role user instead of `PLAN_LIMITS[plan]`.
 */
export const UNLIMITED_LIMITS: PlanLimits = {
    maxSites: Infinity,
    maxBytesPerSite: Infinity,
    maxBytesTotal: Infinity,
    minIntervalSec: PLAN_LIMITS.gold.minIntervalSec,
    customDomains: Infinity,
    keepReleases: PLAN_LIMITS.gold.keepReleases,
    privateRepos: true,
}

// ── Account level (the unified free/paid/maintainer/owner ladder) ─────────────

/**
 * A single human-facing "level" for an account, collapsing the two independent
 * axes (the access {@link Role} and the sponsorship-driven {@link Plan}) into one
 * ladder the UI shows everywhere — so an `owner` reads as **owner**, never as the
 * "free" plan they happen to hold for billing. Strictly ordered low → high.
 */
export type AccountLevel = 'free' | 'paid' | 'maintainer' | 'owner'

/** Every account level, lowest first. */
export const ACCOUNT_LEVELS: readonly AccountLevel[] = ['free', 'paid', 'maintainer', 'owner']

/** Title-case display labels for each level (badges, the user-panel micro-label). */
export const ACCOUNT_LEVEL_LABEL: Record<AccountLevel, string> = {
    free: 'Free',
    paid: 'Paid',
    maintainer: 'Maintainer',
    owner: 'Owner',
}

/**
 * Collapse a user's role + effective plan into one {@link AccountLevel}. The role
 * wins outright (an instance operator is shown as such regardless of any
 * sponsorship), otherwise a paid (non-free) plan reads as `paid` and everyone
 * else as `free`. Pure, so the user-panel and the admin roster share one rule.
 */
export function accountLevel(role: Role, plan: Plan): AccountLevel {
    if (role === 'owner') return 'owner'
    if (role === 'maintainer') return 'maintainer'
    return plan === 'free' ? 'free' : 'paid'
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
    branch: string
    /** Optional build output subdirectory (e.g. `dist/`). */
    subdir?: string
    /** Fully-qualified hostname; globally unique (`alice.perch.dev` | `www.example.com`). */
    hostname: string
    hostKind: SiteHostKind
    status: SiteStatus
    /**
     * The realm (registered nginxpilot instance) this site deploys to (multiple_realms.md
     * §2.1). Set at create time to the active realm; backfilled to the default realm for
     * pre-realms rows. Hostname uniqueness is scoped to this realm.
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
 * The `GET /api/me` response: identity plus the effective plan, its limits, and
 * current usage, so the client can gate UI on role/plan/quota headroom
 * (§7 step 4, §13). `role` is the freshly re-read role; `plan`/`limits` come from
 * `services/plan.ts`; `usage` summarizes the caller's sites.
 */
export interface MeResponse {
    githubId: number
    login: string
    name: string
    avatarUrl?: string
    role: Role
    plan: Plan
    /** The unified free/paid/maintainer/owner label for the account (see {@link accountLevel}). */
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
 * effective plan + level, current usage, the *effective* limits (after any custom
 * override), and the raw `customLimits` override (`null` when none is set).
 */
export interface AdminUserRow {
    user: AppUser
    plan: Plan
    level: AccountLevel
    usage: SiteUsage
    /** Effective limits the user gets right now (role/plan default merged with `customLimits`). */
    limits: PlanLimits
    /** The owner-set override, or `null` when the user runs on pure role/plan defaults. */
    customLimits: UserLimitOverride | null
    /** The realms this user is granted, with their own default marked (multiple_realms.md §F.2). */
    realmGrants: UserRealmGrant[]
}

// ── Sponsorship (`sponsorship` row) ──────────────────────────────────────────

/** Sponsorship lifecycle, from the Sponsors webhook / GraphQL reconcile (§8, §12). */
export type SponsorshipStatus = 'active' | 'pending_cancel' | 'cancelled'

/** A GitHub sponsorship, linked to a user by login. Mirrors the `sponsorship` table (§12). */
export interface Sponsorship {
    /** Sponsor GitHub login; primary key. Equals `app_user.login` for linking. */
    sponsorLogin: string
    /** Monthly sponsorship amount in cents; bucketed to a plan via `plan_tier`. */
    tierCents: number
    status: SponsorshipStatus
    /** ISO timestamp the current status takes effect. */
    effectiveAt: string
    updatedAt: string
}

// ── Base domains (`base_domain` row) ─────────────────────────────────────────

/**
 * Which audience a base domain is offered to (§10). A strict superset chain of
 * three groups, so a caller who can see a higher tier can see every lower one:
 *
 *   • `free`  — available to everybody, including free-plan accounts.
 *   • `paid`  — reserved for sponsored (paid-plan) accounts and instance operators.
 *   • `staff` — reserved for instance operators (the `maintainer`/`owner` roles).
 *
 * The visibility a given caller gets is computed by {@link visibleBaseDomainTiers}.
 */
export type BaseDomainTier = 'free' | 'paid' | 'staff'

/** Every base-domain tier, lowest-audience first (the superset chain order). */
export const BASE_DOMAIN_TIERS: readonly BaseDomainTier[] = ['free', 'paid', 'staff']

/** Type guard: a request-supplied value is one of the three base-domain tiers. */
export function isBaseDomainTier(value: unknown): value is BaseDomainTier {
    return typeof value === 'string' && (BASE_DOMAIN_TIERS as readonly string[]).includes(value)
}

/**
 * The base-domain tiers a caller may see, keyed off role first, then plan (§10):
 *
 *   • `owner` / `maintainer` (instance operators) → every tier, incl. `staff`.
 *     The role wins outright, so a maintainer on a `free` plan still sees all.
 *   • a paid plan (`bronze | silver | gold`)      → `free` + `paid`.
 *   • the `free` plan                              → `free` only.
 *
 * Pure (no I/O), so the standard `/api/base-domains` projection and the create-site
 * wizard can both gate on it and it's unit-testable directly. The result is always a
 * prefix of {@link BASE_DOMAIN_TIERS} — each step strictly contains the one below.
 */
export function visibleBaseDomainTiers(role: Role, plan: Plan): BaseDomainTier[] {
    if (role === 'owner' || role === 'maintainer') return ['free', 'paid', 'staff']
    if (plan !== 'free') return ['free', 'paid']
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
    /** Fully-qualified base domain; primary key (e.g. `perch.dev`). */
    domain: string
    /** The audience this domain is offered to; gates which users may pick it (§10). */
    tier: BaseDomainTier
    /** Subdomain TLS policy (§0/Phase D): one wildcard cert per base. Defaults to `auto`. */
    tls: BaseDomainTls
    /**
     * The realm (nginxpilot instance) whose wildcard serves this base domain
     * (multiple_realms.md §2.1, §10.4). Backfilled to the default realm for pre-realms rows.
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

// ── Plan tiers (`plan_tier` row) ─────────────────────────────────────────────

/** A paid plan a sponsorship tier can map to (the free tier is never stored). */
export type PaidPlan = Exclude<Plan, 'free'>

/**
 * One owner-editable `$ → plan` mapping row: a sponsorship of at least
 * `minCents` per month grants `plan` (highest matching `minCents` wins).
 * Mirrors the `plan_tier` table (§8, §12).
 */
export interface PlanTier {
    /** Inclusive monthly-cents floor for this tier; primary key. */
    minCents: number
    plan: PaidPlan
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
}
