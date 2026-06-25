// Pure view-model for the plans & sponsor UI (§6, §8, §11, §14, §15, task 735).
// Maps the §15 plan-limits table + the owner-editable `plan_tier` mapping + the
// caller's effective plan into the shapes `tc-pricing-card`, `tc-sponsor-wall`,
// and the over-quota `tc-banner`/`tc-announcement-bar` warnings consume.
//
// Like `domain/usage.ts` and `domain/site-dashboard.ts` this is pure (no I/O, no
// `server-only` deps, imports only sibling pure modules + `./types`), so it is
// unit-testable in isolation AND safe to import from the client
// `components/PlansView.tsx` — the same "pure decision logic in domain/,
// server-only wiring in services/ + routes" split the rest of Perch uses.
//
// The `tc-*` data shapes (`PricingCardFeature`, `PricingCardAction`,
// `SponsorTier`/`SponsorLogo`) are re-declared locally — structurally identical
// to the web-components exports — so this module stays decoupled from
// `@toolcase/web-components`, exactly as `site-dashboard.ts` mirrors `StatusItem`.
//
// See notes/static-hosting-app-design.md §8, §11, §14, §15.

import { PLAN_LIMITS, type Plan, type PlanLimits, type PlanTier, type Site } from './types'
import { bucketTier, PLAN_RANK } from './plan-resolution'
import { formatBytes } from './site-dashboard'

// ── plan display order + names ───────────────────────────────────────────────────

/** Pricing-card display order (cheapest → priciest), matching the §15 table. */
export const PLAN_ORDER: Plan[] = ['free', 'bronze', 'silver', 'gold']

/** Human plan names for headings/cards. */
export const PLAN_NAMES: Record<Plan, string> = {
    free: 'Free',
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
}

const PLAN_BLURBS: Record<Plan, string> = {
    free: 'Get started with one small public site — no sponsorship required.',
    bronze: 'A few more sites with faster refreshes and your first custom domain.',
    silver: 'Room to grow: ten sites, gigabyte builds, and several custom domains.',
    gold: 'Maximum headroom — the most sites, the largest builds, near-instant refreshes.',
}

// ── tc-* data shapes (structural mirrors of the web-components exports) ───────────

/** Mirrors `@toolcase/web-components` `PricingCardFeature`. */
export interface PricingFeature {
    label: string
    /** Omit (or `true`) for an included feature; `false` renders the excluded (✕) row. */
    included?: boolean
}

/** Mirrors `@toolcase/web-components` `PricingCardAction`. */
export interface PricingAction {
    label: string
    href?: string
    variant?: string
    disabled?: boolean
}

/** A single `tc-pricing-card`, fully resolved for one plan. */
export interface PricingCardView {
    plan: Plan
    name: string
    /** Big price figure — `$0` for free, `$N` from the owner's `plan_tier` mapping, else `Sponsor`. */
    price: string
    /** Period suffix (`/mo`), omitted when the price is the non-numeric `Sponsor` placeholder. */
    period?: string
    description: string
    /** `Current plan` on the caller's own plan; otherwise absent. */
    badgeText?: string
    /** Highlight (ink cap + accent border) the caller's current plan. */
    highlight: boolean
    features: PricingFeature[]
    action: PricingAction
}

/** Mirrors `@toolcase/web-components` `SponsorLogo`. */
export interface SponsorWallLogo {
    src: string
    alt: string
    href?: string
}

/** Mirrors `@toolcase/web-components` `SponsorTier`. */
export interface SponsorWallTier {
    name: string
    label?: string
    logos: SponsorWallLogo[]
    size?: 'xl' | 'lg' | 'md' | 'sm'
}

/** One over-quota / grace-window warning, rendered as a `tc-banner`. */
export interface QuotaWarning {
    siteId: string
    hostname: string
    /** `tc-banner` variant — `warning` while in the grace window, `error` once suspended. */
    variant: 'warning' | 'error'
    title: string
    message: string
}

/**
 * The `GET /api/plans` response: the server-derived plan/sponsor context the
 * plans page needs but can't compute client-side (owner identity, the `$ → plan`
 * mapping, the live sponsor wall, the quota grace window). The caller's own plan,
 * limits, and sites come from `GET /api/me` + `GET /api/sites`.
 */
export interface PlansContext {
    /** Bootstrap owner's GitHub login, or `null` before anyone has signed in. */
    ownerLogin: string | null
    /** `https://github.com/sponsors/<owner>`, or `null` when there is no owner. */
    sponsorUrl: string | null
    /** Live sponsor wall, grouped by plan tier (highest first). */
    sponsorTiers: SponsorWallTier[]
    /** Owner-editable `$ → plan` mapping, so the cards can show real prices. */
    planTiers: PlanTier[]
    /** Grace window (seconds) an over-quota site keeps serving before suspension. */
    quotaGraceSec: number
}

// ── small pure formatters (exported for unit coverage) ───────────────────────────

/** Owner Sponsors page for a GitHub login (`null`-safe). */
export function sponsorPageUrl(login: string | null | undefined): string | null {
    return login ? `https://github.com/sponsors/${login}` : null
}

/** Render a poll-interval floor (seconds) as `15 min` / `1 min` / `45s`. */
export function formatInterval(sec: number): string {
    if (sec >= 60 && sec % 60 === 0) return `${sec / 60} min`
    if (sec >= 60) return `${Math.round(sec / 60)} min`
    return `${sec}s`
}

/** Render a grace window (seconds) as `1 day` / `12 hours` / `30 min`. */
export function formatDuration(sec: number): string {
    const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
    if (sec >= 86400 && sec % 86400 === 0) return plural(sec / 86400, 'day')
    if (sec >= 3600 && sec % 3600 === 0) return plural(sec / 3600, 'hour')
    if (sec >= 3600) return plural(Math.round(sec / 3600), 'hour')
    if (sec >= 60) return plural(Math.round(sec / 60), 'minute')
    return plural(sec, 'second')
}

/** Whole-dollar `$5`, or `$4.50` for a non-round cents amount. */
export function centsToPrice(cents: number): string {
    return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`
}

/**
 * The cheapest configured monthly price (cents) that grants `plan`, or `null`
 * when the owner has not mapped any sponsorship tier to it yet (so the card
 * shows a `Sponsor` placeholder instead of a fake number).
 */
function minCentsFor(plan: Plan, planTiers: PlanTier[]): number | null {
    const matches = planTiers.filter((t) => t.plan === plan).map((t) => t.minCents)
    return matches.length ? Math.min(...matches) : null
}

// ── pricing cards ────────────────────────────────────────────────────────────────

/** The §15 limits rendered as an included/excluded feature list. */
function planFeatures(limits: PlanLimits): PricingFeature[] {
    const { maxSites, maxBytesPerSite, customDomains, minIntervalSec, keepReleases, privateRepos } = limits
    const domains =
        customDomains === 0
            ? 'Perch subdomains only'
            : customDomains === Infinity
              ? 'Unlimited custom domains'
              : `${customDomains} custom domain${customDomains === 1 ? '' : 's'}`
    return [
        { label: `${maxSites} site${maxSites === 1 ? '' : 's'}` },
        { label: `${formatBytes(maxBytesPerSite)} storage per site` },
        { label: domains, included: customDomains > 0 },
        { label: `Refreshes every ${formatInterval(minIntervalSec)}` },
        { label: `${keepReleases} release${keepReleases === 1 ? '' : 's'} kept for rollback` },
        { label: 'Private repositories', included: privateRepos },
    ]
}

/** The action button for a card, given how its plan relates to the caller's plan. */
function planAction(plan: Plan, currentPlan: Plan, planTiers: PlanTier[], sponsorUrl: string | null): PricingAction {
    if (plan === currentPlan) return { label: 'Current plan', variant: 'secondary', disabled: true }
    // Free is the always-available baseline — never a thing you "buy".
    if (plan === 'free') return { label: 'Included for everyone', variant: 'outline-secondary', disabled: true }
    // A paid plan the owner hasn't priced yet (no `plan_tier` row) can't be sponsored into.
    if (minCentsFor(plan, planTiers) === null || !sponsorUrl) {
        return { label: 'Not yet available', variant: 'outline-secondary', disabled: true }
    }
    const isUpgrade = PLAN_RANK[plan] > PLAN_RANK[currentPlan]
    return { label: 'Sponsor on GitHub', href: sponsorUrl, variant: isUpgrade ? 'primary' : 'outline-primary' }
}

/** Big price figure + period for a plan, from the owner's `plan_tier` mapping. */
function planPrice(plan: Plan, planTiers: PlanTier[]): { price: string; period?: string } {
    if (plan === 'free') return { price: '$0', period: '/mo' }
    const cents = minCentsFor(plan, planTiers)
    return cents === null ? { price: 'Sponsor' } : { price: centsToPrice(cents), period: '/mo' }
}

/**
 * Build the four `tc-pricing-card` view-models (free → gold). The caller's
 * `currentPlan` (from `GET /api/me`) is highlighted and badged `Current plan`;
 * paid prices come from the owner-editable `planTiers`, and the sponsor action
 * links to `sponsorUrl` (the owner's Sponsors page).
 */
export function buildPricingCards(currentPlan: Plan, planTiers: PlanTier[], sponsorUrl: string | null): PricingCardView[] {
    return PLAN_ORDER.map((plan) => {
        const { price, period } = planPrice(plan, planTiers)
        return {
            plan,
            name: PLAN_NAMES[plan],
            price,
            period,
            description: PLAN_BLURBS[plan],
            badgeText: plan === currentPlan ? 'Current plan' : undefined,
            highlight: plan === currentPlan,
            features: planFeatures(PLAN_LIMITS[plan]),
            action: planAction(plan, currentPlan, planTiers, sponsorUrl),
        }
    })
}

// ── sponsor wall ─────────────────────────────────────────────────────────────────

const SPONSOR_TIER_META: Record<'gold' | 'silver' | 'bronze', { label: string; size: 'lg' | 'md' | 'sm' }> = {
    gold: { label: 'Gold sponsors', size: 'lg' },
    silver: { label: 'Silver sponsors', size: 'md' },
    bronze: { label: 'Bronze sponsors', size: 'sm' },
}

/** The minimal active-sponsorship shape the wall needs (subset of `Sponsorship`). */
export interface ActiveSponsor {
    sponsorLogin: string
    tierCents: number
}

/**
 * Group the owner's active sponsors into a `tc-sponsor-wall` tier list (gold →
 * bronze), bucketing each sponsorship's `tierCents` through the same
 * `plan_tier` mapping the plan resolution uses. GitHub avatars are derived from
 * the login (`github.com/<login>.png`); sponsors below every paid threshold are
 * omitted. Returns `[]` when there are no qualifying sponsors.
 */
export function buildSponsorTiers(sponsors: ActiveSponsor[], planTiers: PlanTier[]): SponsorWallTier[] {
    const byPlan: Record<'gold' | 'silver' | 'bronze', SponsorWallLogo[]> = { gold: [], silver: [], bronze: [] }
    for (const s of sponsors) {
        const plan = bucketTier(s.tierCents, planTiers)
        if (plan === 'gold' || plan === 'silver' || plan === 'bronze') {
            byPlan[plan].push({
                src: `https://github.com/${s.sponsorLogin}.png?size=120`,
                alt: s.sponsorLogin,
                href: `https://github.com/${s.sponsorLogin}`,
            })
        }
    }
    const order: Array<'gold' | 'silver' | 'bronze'> = ['gold', 'silver', 'bronze']
    return order
        .filter((plan) => byPlan[plan].length > 0)
        .map((plan) => ({
            name: plan,
            label: SPONSOR_TIER_META[plan].label,
            size: SPONSOR_TIER_META[plan].size,
            logos: byPlan[plan],
        }))
}

// ── over-quota / grace-window warnings ──────────────────────────────────────────

/** True when a site has crossed (or been flagged at) its per-site byte cap. */
function isOverQuota(site: Site, limits: PlanLimits): boolean {
    if (site.status === 'over_quota') return true
    const bytes = site.bytes ?? 0
    return limits.maxBytesPerSite > 0 && bytes >= limits.maxBytesPerSite && bytes > 0
}

/**
 * Build a `tc-banner` warning for every over-quota or suspended site (§11). A
 * suspended site reads as an `error` (it has stopped serving); an over-quota
 * site reads as a `warning` and surfaces the grace window before suspension.
 * Sites that are within quota produce no warning.
 */
export function buildQuotaWarnings(sites: Site[], limits: PlanLimits, graceSec: number): QuotaWarning[] {
    const warnings: QuotaWarning[] = []
    const cap = formatBytes(limits.maxBytesPerSite)
    for (const site of sites) {
        if (site.status === 'suspended') {
            warnings.push({
                siteId: site.id,
                hostname: site.hostname,
                variant: 'error',
                title: `${site.hostname} is suspended`,
                message:
                    `It exceeded its ${cap} storage limit and is no longer serving. ` +
                    `Trim the build below ${cap}, or upgrade your plan, to bring it back online.`,
            })
            continue
        }
        if (isOverQuota(site, limits)) {
            const used = formatBytes(site.bytes ?? 0)
            const grace =
                graceSec > 0
                    ? `It keeps serving for ${formatDuration(graceSec)} before it is suspended — `
                    : 'It may be suspended on the next check — '
            warnings.push({
                siteId: site.id,
                hostname: site.hostname,
                variant: 'warning',
                title: `${site.hostname} is over quota`,
                message:
                    `Using ${used} of its ${cap} limit. ${grace}` +
                    'trim the build or upgrade your plan to keep it online.',
            })
        }
    }
    return warnings
}
