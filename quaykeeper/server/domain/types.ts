// Pure shared domain types for Quaykeeper — safe to import from client AND server, so
// this file deliberately has NO `import 'server-only'` and performs no I/O. No
// imports of db or services (type-only imports from sibling pure domain modules
// are fine). See notes/static-hosting-app-design.md §6, §12, §15.

import type { DockerRunSpec } from './docker-run'
import type { FeatureKey } from './features'

// ── Auth / roles ─────────────────────────────────────────────────────────────

export type Role = 'owner' | 'standard' | 'guest'

/**
 * Strict ordering used for `minRole` comparisons. Higher = more access. The
 * hierarchy is linear: `standard` is a regular account (features gated by the
 * owner), `owner` is everything plus the admin surface and control over which
 * features each user sees. `guest` (rank 0) is the runtime-only fallback for a
 * session whose user row is gone — never stored or assigned.
 */
export const ROLE_RANK: Record<Role, number> = {
    guest: 0,
    standard: 1,
    owner: 2,
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
    /**
     * Whether the account may set a site's raw nginx `advanced` block (`Site.advanced`).
     * Standard: no. This writes arbitrary directives into the site's `server{}` — a
     * tenant who has it can set headers, rewrite, proxy, or read paths beyond their
     * own root, so it is opt-in per account exactly like {@link privateRepos}.
     */
    advancedConfig: boolean
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
    advancedConfig: false,
}

/**
 * Limits for the instance owner (§6) — exempt from quotas entirely. The owner
 * runs the instance, so they create unlimited resources and are never gated or
 * suspended: `Infinity` caps make every count/byte gate pass, the fastest poll
 * cadence applies, and private repos are allowed. `resolveLimits` returns this
 * for any `owner`-role user instead of {@link STANDARD_LIMITS}.
 */
export const UNLIMITED_LIMITS: PlanLimits = {
    maxSites: Infinity,
    maxBytesPerSite: Infinity,
    maxBytesTotal: Infinity,
    minIntervalSec: 60, // 1 min — the old top-tier cadence
    customDomains: Infinity,
    keepReleases: 5,
    privateRepos: true,
    advancedConfig: true,
}

// ── Account level (the standard/owner ladder) ─────────────────────────────────

/**
 * A single human-facing "level" for an account — purely role-derived. Strictly
 * ordered low → high.
 */
export type AccountLevel = 'standard' | 'owner'

/** Every account level, lowest first. */
export const ACCOUNT_LEVELS: readonly AccountLevel[] = ['standard', 'owner']

/** Title-case display labels for each level (badges, the user-panel micro-label). */
export const ACCOUNT_LEVEL_LABEL: Record<AccountLevel, string> = {
    standard: 'Standard',
    owner: 'Owner',
}

/**
 * The account level for a role. Pure, so the user-panel and the admin roster
 * share one rule.
 */
export function accountLevel(role: Role): AccountLevel {
    if (role === 'owner') return 'owner'
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

/**
 * How request paths map to files (nginxpilot's per-site `routing`): `static` serves
 * files as-is (unknown paths 404), `spa` falls back to `/index.html` for client-side
 * routers, `clean-urls` also tries `$uri.html` so `/about` serves `about.html`.
 */
export type SiteRouting = 'static' | 'spa' | 'clean-urls'

/**
 * Where a site's content comes from (nginxpilot `source.type`):
 *
 *   • `git`      — clone a branch and serve the tree. The default, and the only kind
 *                  the GitHub repo picker produces.
 *   • `http-zip` — download a published archive and serve its contents. For content
 *                  that is *built* elsewhere: a CI-published zip or a release tarball,
 *                  with no repo to clone and no build step to trust.
 */
export type SiteSourceType = 'git' | 'http-zip'

/**
 * How a site authenticates to its source (nginxpilot `source.auth.method`). Which
 * methods are legal depends on the source type and URL scheme, and nginxpilot enforces
 * that too — `domain/site-input.ts` mirrors the rules so a bad combination is a 400 here
 * rather than a 502 bouncing off the daemon:
 *
 *   • git over `git@`/`ssh://` — `ssh-key` (a deploy key).
 *   • git over `https://`      — `github-token` (token alone) or `https-token`
 *                                (username + token, for GitLab/Bitbucket/Gitea).
 *   • http-zip                 — `bearer`, `basic`, or `header` (a custom header, e.g.
 *                                an artifact registry's API key).
 *   • `none`                   — a public repo or archive.
 *
 * Secret material is never stored in a fragment: whatever the method needs is pushed to
 * the realm's credential store and referenced by file path (see `FragmentAuth`).
 */
export type SiteAuthMethod = 'none' | 'ssh-key' | 'https-token' | 'github-token' | 'bearer' | 'basic' | 'header'

/** Every source type. */
export const SITE_SOURCE_TYPES: readonly SiteSourceType[] = ['git', 'http-zip']

/** Every auth method. */
export const SITE_AUTH_METHODS: readonly SiteAuthMethod[] = [
    'none',
    'ssh-key',
    'https-token',
    'github-token',
    'bearer',
    'basic',
    'header',
]

/**
 * Per-site TLS mode — nginxpilot's full tri-state (`WebOptions.TLS`). Only ever
 * honoured for a **custom domain**, which terminates on its own dedicated cert:
 *
 *   • `off`      — plain HTTP, no cert, no redirect.
 *   • `auto`     — use the cert once it exists, serve plain HTTP until then (the
 *                  default: a not-yet-issued cert degrades instead of 404-ing).
 *   • `required` — HTTPS or nothing. Without a cert nginxpilot *quarantines* the
 *                  site rather than falling back to plaintext. The right choice
 *                  behind HSTS, where a plaintext gap is worse than an outage.
 *
 * A subdomain's TLS is decided by its base domain's wildcard policy
 * ({@link BaseDomain.tls}) — one cert covers every label, so a per-label override
 * would be a contradiction. The site service rejects setting this on a subdomain.
 */
export type SiteTls = 'off' | 'auto' | 'required'

/** Every per-site TLS mode. */
export const SITE_TLS: readonly SiteTls[] = ['off', 'auto', 'required']

/** Type guard: a request-supplied value is one of the per-site TLS modes. */
export function isSiteTls(value: unknown): value is SiteTls {
    return value === 'off' || value === 'auto' || value === 'required'
}

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
    /**
     * Where the content comes from; `undefined` = `git` (the original behaviour, and
     * what the GitHub repo picker creates).
     */
    sourceType?: SiteSourceType
    /**
     * The source URL, when it isn't the GitHub repo implied by
     * `repoOwner`/`repoName`. Set for a non-GitHub git host (GitLab, Bitbucket, Gitea,
     * self-hosted, an `ssh://` deploy-key remote) and always set for `http-zip`.
     * `undefined` on a git site means "derive `https://github.com/<owner>/<name>.git`".
     */
    sourceUrl?: string
    /** Git ref to deploy. Ignored (and not emitted) for an `http-zip` source. */
    branch: string
    /**
     * Optional build output subdirectory (e.g. `dist/`). Git sources only — an archive
     * uses {@link stripComponents} instead, and nginxpilot rejects `subdir` there.
     */
    subdir?: string
    /**
     * How to authenticate to the source; `undefined` = `github-token` for a private
     * GitHub repo (the OAuth token path) and `none` otherwise.
     */
    authMethod?: SiteAuthMethod
    /** Username for `https-token` / `basic` auth. Never a secret — the password/token is. */
    authUsername?: string
    /** Header name for `header` auth (e.g. `X-Api-Key`); the value is the stored secret. */
    authHeaderName?: string
    /** `http-zip`: URL of a checksum file the daemon verifies the archive against. */
    checksumUrl?: string
    /** `http-zip`: leading path components to strip from archive entries (an archive with a top-level folder wants 1). */
    stripComponents?: number
    /** `http-zip`: permit a plain `http://` archive/checksum URL. Off by default, and rightly noisy in the UI. */
    allowInsecure?: boolean
    /** Path→file routing strategy; omitted = `static` (the nginxpilot default). */
    routing?: SiteRouting
    /** Site-relative custom 404 page (e.g. `/404.html`); static/clean-urls only. */
    notFound?: string
    /** Emit immutable Cache-Control for fingerprinted assets (css/js/fonts/images). */
    cacheAssets?: boolean
    /** gzip responses (`WebOptions.Gzip`). No TLS requirement; purely per-site. */
    gzip?: boolean
    /**
     * Include nginxpilot's block-exploits snippet (`WebOptions.BlockExploits`) —
     * denies common scanner / SQLi / traversal request patterns. Additive and
     * TLS-independent, so it is a plain per-site toggle.
     */
    blockExploits?: boolean
    /**
     * TLS mode for a **custom domain** ({@link SiteTls}); `undefined` = `auto`. Never
     * read for a subdomain, whose TLS comes from its base domain's wildcard policy —
     * the site service rejects setting it there, and a rehost to a subdomain clears it.
     */
    tls?: SiteTls
    /**
     * Strict-Transport-Security for a **custom domain**. Scoped exactly like
     * {@link tls}: a subdomain inherits {@link BaseDomain.hsts} instead, since one
     * wildcard cert covers every label and `includeSubDomains` binds the whole
     * registrable domain anyway. Opt-in only — HSTS is sticky in browsers for
     * `max_age` (nginxpilot defaults to two years) even after the header stops being
     * sent, so enabling it is close to irreversible for anyone who has already visited.
     */
    hsts?: boolean
    /**
     * Raw nginx directives injected into this site's `server{}` block
     * (`WebOptions.Advanced`) — the escape hatch. Gated on
     * {@link PlanLimits.advancedConfig} because a tenant who can inject arbitrary
     * directives can set headers, rewrite, proxy, or read paths beyond their root.
     * nginxpilot's `nginx -t` gate means a bad snippet only quarantines this one site.
     */
    advanced?: string
    /**
     * Extra deny-list globs layered on nginxpilot's built-in defaults (`.env*`,
     * `.htaccess`, `.DS_Store`, `.git*`) and Quaykeeper's `*.map`. `undefined` = just
     * the defaults; an empty array means "defaults only, drop `*.map`".
     */
    exclude?: string[]
    /**
     * Post-fetch gate files (`source.require_file`): nginxpilot won't cut a release
     * live unless all of them exist, so a broken build keeps the last-known-good
     * release serving. `undefined` = the `['index.html']` default; `[]` disables the
     * gate (for a build whose entry point isn't a file we can name up front).
     */
    requireFile?: string[]
    /**
     * How many prior release directories nginxpilot retains for rollback
     * (`source.keep_releases`). `undefined` = the owner's plan value
     * ({@link PlanLimits.keepReleases}); never above it.
     */
    keepReleases?: number
    /**
     * Per-site poll cadence in seconds (`source.interval`). `undefined` = the owner's
     * plan floor ({@link PlanLimits.minIntervalSec}). A site may poll *less* often than
     * the floor (a quiet marketing page), never more — the floor is the plan's guarantee.
     */
    intervalSec?: number
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

/**
 * A site's deploy *source* — everything that decides where content is fetched from and
 * how the fetch authenticates. Grouped for the same reason as {@link SiteSettings}: it
 * travels as one value through the PATCH body, the deploy machine's change detection,
 * and one `siteRepo.updateSource` write.
 *
 * Changing anything in here changes nginxpilot's source *fingerprint*, which makes it
 * discard stored refs and resync from scratch — so these are deliberately separate from
 * the settings group, which only re-renders the server block.
 */
export const SITE_SOURCE_KEYS = [
    'sourceType',
    'sourceUrl',
    'branch',
    'subdir',
    'authMethod',
    'authUsername',
    'authHeaderName',
    'checksumUrl',
    'stripComponents',
    'allowInsecure',
] as const

/** {@link SITE_SOURCE_KEYS} as a value type — a full snapshot of a site's source spec. */
export type SiteSource = Pick<Site, (typeof SITE_SOURCE_KEYS)[number]>

/** Extract the source group from a site row (the change-detection baseline). */
export function siteSource(site: Site): SiteSource {
    return {
        sourceType: site.sourceType,
        sourceUrl: site.sourceUrl,
        branch: site.branch,
        subdir: site.subdir,
        authMethod: site.authMethod,
        authUsername: site.authUsername,
        authHeaderName: site.authHeaderName,
        checksumUrl: site.checksumUrl,
        stripComponents: site.stripComponents,
        allowInsecure: site.allowInsecure,
    }
}

/**
 * The auth method a site actually fetches with. An explicit {@link Site.authMethod} wins;
 * otherwise a private GitHub repo authenticates with `github-token` (the original
 * behaviour, from before other methods existed) and anything else is public.
 */
export function effectiveAuthMethod(site: Site): SiteAuthMethod {
    return site.authMethod ?? (site.repoPrivate ? 'github-token' : 'none')
}

/**
 * Whether a site's credential is the owner's **GitHub OAuth token** rather than a
 * per-site secret they supplied. True only for a private GitHub repo — an explicit
 * `sourceUrl` means the site fetches from somewhere Quaykeeper's GitHub token has no
 * standing, even if the method happens to also be called `github-token`.
 *
 * Both the deploy path (which secret to push) and the login-time refresh (which sites to
 * re-push to) branch on this, and they MUST agree: if the refresh were broader, every
 * sign-in would overwrite a site's stored deploy key with an unrelated GitHub token.
 */
export function usesGithubOAuthCredential(site: Site): boolean {
    return !site.sourceUrl && effectiveAuthMethod(site) === 'github-token'
}

/** Whether two source snapshots are equivalent (`git` and an absent type are the same). */
export function siteSourceEqual(a: SiteSource, b: SiteSource): boolean {
    return (
        (a.sourceType ?? 'git') === (b.sourceType ?? 'git') &&
        a.sourceUrl === b.sourceUrl &&
        a.branch === b.branch &&
        a.subdir === b.subdir &&
        a.authMethod === b.authMethod &&
        a.authUsername === b.authUsername &&
        a.authHeaderName === b.authHeaderName &&
        a.checksumUrl === b.checksumUrl &&
        a.stripComponents === b.stripComponents &&
        !!a.allowInsecure === !!b.allowInsecure
    )
}

/**
 * The per-site configuration knobs that shape the nginxpilot fragment *other than*
 * the deploy source coordinates (branch/subdir, which have their own write path).
 * Grouped so the whole set travels as one value through the PATCH body, the deploy
 * machine's change detection, and the single `siteRepo.updateSettings` write —
 * rather than as an ever-growing positional argument list.
 */
export const SITE_SETTING_KEYS = [
    'routing',
    'notFound',
    'cacheAssets',
    'gzip',
    'blockExploits',
    'tls',
    'hsts',
    'advanced',
    'exclude',
    'requireFile',
    'keepReleases',
    'intervalSec',
] as const

/** {@link SITE_SETTING_KEYS} as a value type — a full snapshot of a site's settings. */
export type SiteSettings = Pick<Site, (typeof SITE_SETTING_KEYS)[number]>

/** Extract the settings group from a site row (the change-detection baseline). */
export function siteSettings(site: Site): SiteSettings {
    return {
        routing: site.routing,
        notFound: site.notFound,
        cacheAssets: site.cacheAssets,
        gzip: site.gzip,
        blockExploits: site.blockExploits,
        tls: site.tls,
        hsts: site.hsts,
        advanced: site.advanced,
        exclude: site.exclude,
        requireFile: site.requireFile,
        keepReleases: site.keepReleases,
        intervalSec: site.intervalSec,
    }
}

/**
 * Whether two settings snapshots are equivalent. Booleans compare through
 * `!!` (an absent flag and a stored `false` are the same site), and the two
 * array fields compare element-wise — but `undefined` (inherit the default) is
 * deliberately NOT equal to `[]` (explicitly empty), since they render differently.
 */
export function siteSettingsEqual(a: SiteSettings, b: SiteSettings): boolean {
    const sameList = (x?: string[], y?: string[]): boolean => {
        if (x === undefined || y === undefined) return x === y
        return x.length === y.length && x.every((v, i) => v === y[i])
    }
    return (
        a.routing === b.routing &&
        a.notFound === b.notFound &&
        !!a.cacheAssets === !!b.cacheAssets &&
        !!a.gzip === !!b.gzip &&
        !!a.blockExploits === !!b.blockExploits &&
        a.tls === b.tls &&
        !!a.hsts === !!b.hsts &&
        (a.advanced ?? '') === (b.advanced ?? '') &&
        sameList(a.exclude, b.exclude) &&
        sameList(a.requireFile, b.requireFile) &&
        a.keepReleases === b.keepReleases &&
        a.intervalSec === b.intervalSec
    )
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
     * Effective feature visibility for this caller (features.ts): the app-wide
     * global flags merged with any owner-set per-user override. The client gates
     * nav + pages off this; owners always receive every feature enabled.
     */
    features: Record<FeatureKey, boolean>
    /**
     * The realm the caller currently operates on (multiple_realms.md §E.4): the owner's
     * switcher selection, or a non-owner's owner-assigned default. Drives the header label
     * + which realm realm-selected ops target. `null` when no realm is registered yet
     * (fresh install, or every realm was removed) — the caller has nothing to operate on.
     */
    activeRealm: Realm | null
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
    /**
     * The owner-set per-user feature overrides (features.ts). Only features the owner
     * has explicitly toggled for this user appear; an absent feature follows the global
     * default. Owners are never gated, so this is empty/ignored for an owner row.
     */
    featureOverrides: Partial<Record<FeatureKey, boolean>>
}

// ── Base domains (`base_domain` row) ─────────────────────────────────────────

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
    /** Subdomain TLS policy (§0/Phase D): one wildcard cert per base. Defaults to `auto`. */
    tls: BaseDomainTls
    /**
     * HTTP/2 for every subdomain under this base. Like {@link tls} the knob is
     * per-base, not per-subdomain, because HTTP/2 is negotiated per *certificate*:
     * a browser that sees one wildcard cert covering `a.base.dev` and `b.base.dev`
     * may coalesce both onto a single TLS connection. If the vhosts then disagree
     * on HTTP/2, nginx answers the coalesced request `421 Misdirected Request`.
     * Deciding once per base makes every label agree by construction.
     *
     * Inert while `tls` is `off` — nginxpilot rejects `http2` without TLS, so
     * `resolveWebOptions` only emits it alongside `tls: auto`. Defaults to on.
     */
    http2: boolean
    /**
     * Strict-Transport-Security for every subdomain under this base. Per-base for the
     * same reason as {@link http2}, plus a stronger one: HSTS with `includeSubDomains`
     * is declared by ONE host but binds the browser for the whole registrable domain,
     * so contradictory per-label policies under one wildcard are meaningless — the
     * strictest declaration wins in the client regardless.
     *
     * **Defaults to off, and must stay opt-in.** HSTS is sticky: once sent, a browser
     * refuses plain HTTP to the domain for `max_age` (nginxpilot's default is 2 years)
     * even if the header is later withdrawn. Enabling it is close to irreversible for
     * anyone who has already visited.
     *
     * Inert while `tls` is `off` — nginxpilot rejects `hsts` without TLS.
     */
    hsts: boolean
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
