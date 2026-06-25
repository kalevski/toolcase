// Pure shared domain types for Perch — safe to import from client AND server, so
// this file deliberately has NO `import 'server-only'` and performs no I/O. No
// imports of db or services. See notes/static-hosting-app-design.md §6, §12, §15.

// ── Auth / roles ─────────────────────────────────────────────────────────────

export type Role = 'owner' | 'standard' | 'guest'

/** Strict ordering used for `minRole` comparisons. Higher = more access. */
export const ROLE_RANK: Record<Role, number> = {
    guest: 0,
    standard: 1,
    owner: 2,
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
    /** Last measured deployed size in bytes, if known. */
    bytes?: number
    /** Last live git ref reported by nginxpilot `/status`. */
    lastRef?: string
    /** Last error surfaced from deploy / status, if any. */
    lastError?: string
    createdAt: string
    updatedAt: string
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

/** An owner-registered base domain backing the subdomain pool (§10, §12). */
export interface BaseDomain {
    /** Fully-qualified base domain; primary key (e.g. `perch.dev`). */
    domain: string
    /** ISO timestamp the owner registered it. */
    createdAt: string
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
