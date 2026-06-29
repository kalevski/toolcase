// Unit coverage for the pure plans & sponsor view-model (task 735, §8, §11, §15).
// No SQLite, no `server-only`, no DOM — just the mapping from plan limits + the
// owner `plan_tier` mapping + the caller's plan/sites into the shapes the plans
// page's tc-* elements consume. Current-plan highlighting (§15) and the
// over-quota grace-window copy (§11) are the behaviours worth pinning down.

import { describe, it, expect } from 'vitest'
import {
    buildPricingCards,
    buildQuotaWarnings,
    buildSponsorTiers,
    centsToPrice,
    formatDuration,
    formatInterval,
    sponsorPageUrl,
    PLAN_ORDER,
    type ActiveSponsor,
} from './plans-view'
import { PLAN_LIMITS, type PlanTier, type Site } from './types'

// A representative owner-configured mapping (cheapest → priciest).
const TIERS: PlanTier[] = [
    { minCents: 500, plan: 'bronze' }, // $5
    { minCents: 2500, plan: 'silver' }, // $25
    { minCents: 10000, plan: 'gold' }, // $100
]

const SPONSOR_URL = 'https://github.com/sponsors/alice'

function site(over: Partial<Site> = {}): Site {
    return {
        id: 's1',
        ownerId: 1,
        repoOwner: 'bob',
        repoName: 'portfolio',
        branch: 'gh-pages',
        hostname: 'bob.perch.dev',
        hostKind: 'subdomain',
        realmId: 'realm-test',
        status: 'live',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        ...over,
    }
}

describe('formatters', () => {
    it('formatInterval renders the §15 poll floors', () => {
        expect(formatInterval(900)).toBe('15 min')
        expect(formatInterval(300)).toBe('5 min')
        expect(formatInterval(60)).toBe('1 min')
        expect(formatInterval(45)).toBe('45s')
    })

    it('formatDuration humanises the grace window', () => {
        expect(formatDuration(86400)).toBe('1 day')
        expect(formatDuration(2 * 86400)).toBe('2 days')
        expect(formatDuration(3600)).toBe('1 hour')
        expect(formatDuration(1800)).toBe('30 minutes')
    })

    it('centsToPrice keeps whole dollars whole', () => {
        expect(centsToPrice(500)).toBe('$5')
        expect(centsToPrice(10000)).toBe('$100')
        expect(centsToPrice(450)).toBe('$4.50')
    })

    it('sponsorPageUrl is null-safe', () => {
        expect(sponsorPageUrl('alice')).toBe('https://github.com/sponsors/alice')
        expect(sponsorPageUrl(null)).toBeNull()
        expect(sponsorPageUrl('')).toBeNull()
    })
})

describe('buildPricingCards', () => {
    it('emits one card per plan, in §15 order', () => {
        const cards = buildPricingCards('free', TIERS, SPONSOR_URL)
        expect(cards.map((c) => c.plan)).toEqual(PLAN_ORDER)
    })

    it('highlights and badges the caller’s current plan only', () => {
        const cards = buildPricingCards('silver', TIERS, SPONSOR_URL)
        const highlighted = cards.filter((c) => c.highlight)
        expect(highlighted).toHaveLength(1)
        expect(highlighted[0].plan).toBe('silver')
        expect(highlighted[0].badgeText).toBe('Current plan')
        expect(cards.find((c) => c.plan === 'silver')!.action).toMatchObject({ disabled: true, label: 'Current plan' })
        // No other card carries a badge.
        expect(cards.filter((c) => c.badgeText).map((c) => c.plan)).toEqual(['silver'])
    })

    it('prices paid plans from the owner mapping, free at $0', () => {
        const cards = buildPricingCards('free', TIERS, SPONSOR_URL)
        const byPlan = Object.fromEntries(cards.map((c) => [c.plan, c]))
        expect(byPlan.free).toMatchObject({ price: '$0', period: '/mo' })
        expect(byPlan.bronze).toMatchObject({ price: '$5', period: '/mo' })
        expect(byPlan.gold).toMatchObject({ price: '$100', period: '/mo' })
    })

    it('shows a Sponsor placeholder (no fake price) for an unmapped plan', () => {
        const cards = buildPricingCards('free', [{ minCents: 500, plan: 'bronze' }], SPONSOR_URL)
        const gold = cards.find((c) => c.plan === 'gold')!
        expect(gold.price).toBe('Sponsor')
        expect(gold.period).toBeUndefined()
        expect(gold.action).toMatchObject({ disabled: true, label: 'Not yet available' })
    })

    it('points paid actions at the owner Sponsors page; free is never purchasable', () => {
        const cards = buildPricingCards('free', TIERS, SPONSOR_URL)
        const bronze = cards.find((c) => c.plan === 'bronze')!
        expect(bronze.action).toMatchObject({ href: SPONSOR_URL, label: 'Sponsor on GitHub' })
        // Free is the baseline — disabled, no href, even when it isn't the current plan.
        const free = buildPricingCards('bronze', TIERS, SPONSOR_URL).find((c) => c.plan === 'free')!
        expect(free.action.disabled).toBe(true)
        expect(free.action.href).toBeUndefined()
    })

    it('reflects each plan’s §15 limits as included/excluded features', () => {
        const cards = buildPricingCards('free', TIERS, SPONSOR_URL)
        const free = cards.find((c) => c.plan === 'free')!
        // Free: subdomains only + no private repos are excluded rows.
        const domains = free.features.find((f) => /subdomains only/i.test(f.label))!
        expect(domains.included).toBe(false)
        expect(free.features.find((f) => f.label === 'Private repositories')!.included).toBe(false)
        expect(free.features.some((f) => f.label === '1 site')).toBe(true)

        const gold = cards.find((c) => c.plan === 'gold')!
        expect(gold.features.find((f) => /custom domain/i.test(f.label))!.included).toBe(true)
        expect(gold.features.some((f) => /Unlimited custom domains/.test(f.label))).toBe(true)
        expect(gold.features.find((f) => f.label === 'Private repositories')!.included).toBe(true)
    })
})

describe('buildQuotaWarnings', () => {
    const limits = PLAN_LIMITS.free // maxBytesPerSite = 50 MB
    const MB = 1024 * 1024

    it('returns nothing when every site is within quota', () => {
        expect(buildQuotaWarnings([site({ bytes: 10 * MB })], limits, 86400)).toEqual([])
    })

    it('warns (with the grace window) for an over-quota site', () => {
        const out = buildQuotaWarnings([site({ status: 'over_quota', bytes: 60 * MB })], limits, 86400)
        expect(out).toHaveLength(1)
        expect(out[0]).toMatchObject({ siteId: 's1', hostname: 'bob.perch.dev', variant: 'warning' })
        expect(out[0].message).toContain('1 day')
        expect(out[0].message).toContain('50 MB')
    })

    it('flags a site whose measured bytes exceed the cap even without the status', () => {
        const out = buildQuotaWarnings([site({ status: 'live', bytes: 80 * MB })], limits, 86400)
        expect(out).toHaveLength(1)
        expect(out[0].variant).toBe('warning')
    })

    it('escalates a suspended site to an error banner', () => {
        const out = buildQuotaWarnings([site({ status: 'suspended', bytes: 90 * MB })], limits, 86400)
        expect(out[0].variant).toBe('error')
        expect(out[0].title).toContain('suspended')
    })

    it('drops the grace promise when the window is zero', () => {
        const out = buildQuotaWarnings([site({ status: 'over_quota', bytes: 60 * MB })], limits, 0)
        expect(out[0].message).toContain('next check')
        expect(out[0].message).not.toContain('day')
    })
})

describe('buildSponsorTiers', () => {
    const sponsors: ActiveSponsor[] = [
        { sponsorLogin: 'whale', tierCents: 10000 }, // gold
        { sponsorLogin: 'dolphin', tierCents: 2500 }, // silver
        { sponsorLogin: 'minnow', tierCents: 500 }, // bronze
        { sponsorLogin: 'tadpole', tierCents: 100 }, // below every threshold → dropped
    ]

    it('groups active sponsors gold → bronze and drops sub-threshold ones', () => {
        const tiers = buildSponsorTiers(sponsors, TIERS)
        expect(tiers.map((t) => t.name)).toEqual(['gold', 'silver', 'bronze'])
        expect(tiers[0].logos.map((l) => l.alt)).toEqual(['whale'])
        expect(tiers[0].logos[0].src).toContain('github.com/whale.png')
        expect(tiers[0].logos[0].href).toBe('https://github.com/whale')
    })

    it('omits empty tiers entirely', () => {
        const tiers = buildSponsorTiers([{ sponsorLogin: 'minnow', tierCents: 500 }], TIERS)
        expect(tiers.map((t) => t.name)).toEqual(['bronze'])
    })

    it('returns [] when there are no qualifying sponsors', () => {
        expect(buildSponsorTiers([{ sponsorLogin: 'tadpole', tierCents: 100 }], TIERS)).toEqual([])
        expect(buildSponsorTiers([], TIERS)).toEqual([])
    })
})
