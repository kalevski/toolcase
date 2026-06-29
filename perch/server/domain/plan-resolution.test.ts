// Unit coverage for the pure sponsorship → plan rules that back
// `services/plan.ts`. No SQLite, no `server-only` — so the bucketing/eligibility
// logic is pinned directly (the service is just these functions wrapped in
// `sponsorshipRepo.get` + `planTierRepo.list`). See §6, §8, §15.

import { describe, it, expect } from 'vitest'
import { bucketTier, effectivePlan, maxPlan } from './plan-resolution'
import type { PlanTier, Sponsorship } from './types'

// A representative owner-configured mapping (cheapest → priciest).
const TIERS: PlanTier[] = [
    { minCents: 500, plan: 'bronze' }, // $5
    { minCents: 2500, plan: 'silver' }, // $25
    { minCents: 10000, plan: 'gold' }, // $100
]

function sponsorship(over: Partial<Sponsorship>): Sponsorship {
    return {
        sponsorId: 1,
        sponsorLogin: 'alice',
        tierCents: 0,
        status: 'active',
        effectiveAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        ...over,
    }
}

describe('bucketTier', () => {
    it('picks the largest min_cents that does not exceed the tier', () => {
        expect(bucketTier(500, TIERS)).toBe('bronze') // exact floor
        expect(bucketTier(2499, TIERS)).toBe('bronze') // just under silver
        expect(bucketTier(2500, TIERS)).toBe('silver') // exact floor
        expect(bucketTier(9999, TIERS)).toBe('silver')
        expect(bucketTier(100000, TIERS)).toBe('gold') // well above the top floor
    })

    it('returns null below every threshold', () => {
        expect(bucketTier(0, TIERS)).toBeNull()
        expect(bucketTier(499, TIERS)).toBeNull()
        expect(bucketTier(100, [])).toBeNull()
    })

    it('is order-independent', () => {
        const shuffled: PlanTier[] = [TIERS[2], TIERS[0], TIERS[1]]
        expect(bucketTier(3000, shuffled)).toBe('silver')
    })
})

describe('effectivePlan', () => {
    it('yields free for an inactive, pending-cancel, or absent sponsorship', () => {
        // Inactive sponsorship → free even when the tier would otherwise map high.
        expect(effectivePlan(sponsorship({ tierCents: 100000, status: 'cancelled' }), TIERS)).toBe('free')
        expect(effectivePlan(sponsorship({ tierCents: 100000, status: 'pending_cancel' }), TIERS)).toBe('free')
        expect(effectivePlan(undefined, TIERS)).toBe('free')
    })

    it('maps an active tier above a configured threshold to the bucketed plan', () => {
        expect(effectivePlan(sponsorship({ tierCents: 3000 }), TIERS)).toBe('silver')
        expect(effectivePlan(sponsorship({ tierCents: 500 }), TIERS)).toBe('bronze')
        expect(effectivePlan(sponsorship({ tierCents: 50000 }), TIERS)).toBe('gold')
    })

    it('falls back to free when an active tier sits below every threshold', () => {
        expect(effectivePlan(sponsorship({ tierCents: 100 }), TIERS)).toBe('free')
    })
})

describe('maxPlan', () => {
    it('never undercuts the free baseline', () => {
        expect(maxPlan('free', 'gold')).toBe('gold')
        expect(maxPlan('free', 'free')).toBe('free')
        expect(maxPlan('silver', 'bronze')).toBe('silver')
    })
})
