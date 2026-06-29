// Unit coverage for the pure account-level + limit-merge rules in `types.ts`. The
// level ladder is the single label the UI shows (so an owner reads as "owner", not
// the "free" plan they hold for billing); the merge is how a per-user override
// layers over the role/plan default.

import { describe, it, expect } from 'vitest'
import { accountLevel, mergeLimits, PLAN_LIMITS, reviveLimits, UNLIMITED_LIMITS } from './types'

describe('accountLevel (role + plan → one ladder)', () => {
    it('lets the operator role win regardless of plan', () => {
        // The "owner shown as free" bug: an owner holds the free plan (no sponsorship),
        // but the level must read `owner`, never `free`.
        expect(accountLevel('owner', 'free')).toBe('owner')
        expect(accountLevel('owner', 'gold')).toBe('owner')
        expect(accountLevel('maintainer', 'free')).toBe('maintainer')
        expect(accountLevel('maintainer', 'silver')).toBe('maintainer')
    })

    it('maps a standard user by plan: any paid plan → paid, else free', () => {
        expect(accountLevel('standard', 'free')).toBe('free')
        expect(accountLevel('standard', 'bronze')).toBe('paid')
        expect(accountLevel('standard', 'silver')).toBe('paid')
        expect(accountLevel('standard', 'gold')).toBe('paid')
        expect(accountLevel('guest', 'free')).toBe('free')
    })
})

describe('mergeLimits (per-user override over a base)', () => {
    it('returns the base unchanged for an absent/empty override', () => {
        expect(mergeLimits(PLAN_LIMITS.free)).toBe(PLAN_LIMITS.free)
        expect(mergeLimits(PLAN_LIMITS.free, null)).toBe(PLAN_LIMITS.free)
        expect(mergeLimits(PLAN_LIMITS.free, {})).toEqual(PLAN_LIMITS.free)
    })

    it('overrides only the present fields, leaving the rest of the base intact', () => {
        const merged = mergeLimits(PLAN_LIMITS.free, { maxSites: 10, privateRepos: true })
        expect(merged.maxSites).toBe(10)
        expect(merged.privateRepos).toBe(true)
        // Untouched fields fall through to the free default.
        expect(merged.maxBytesPerSite).toBe(PLAN_LIMITS.free.maxBytesPerSite)
        expect(merged.customDomains).toBe(PLAN_LIMITS.free.customDomains)
    })

    it('can cap an operator below unlimited (override wins over UNLIMITED base)', () => {
        const merged = mergeLimits(UNLIMITED_LIMITS, { maxSites: 3 })
        expect(merged.maxSites).toBe(3)
        expect(merged.maxBytesPerSite).toBe(Infinity)
    })
})

describe('reviveLimits (undo the JSON Infinity→null round-trip)', () => {
    it('turns null/NaN numeric fields back into Infinity, never 0', () => {
        // What the wire actually delivers for an owner: JSON.stringify(Infinity) === "null".
        const overWire = JSON.parse(JSON.stringify(UNLIMITED_LIMITS))
        expect(overWire.maxSites).toBeNull() // sanity: the bug source
        const revived = reviveLimits(overWire)
        expect(revived.maxSites).toBe(Infinity)
        expect(revived.maxBytesPerSite).toBe(Infinity)
        expect(revived.customDomains).toBe(Infinity)
        // The fix the user asked for: a revived unlimited cap admits creation.
        expect(5 < revived.maxSites).toBe(true)
    })

    it('leaves finite limits untouched', () => {
        const revived = reviveLimits({ ...PLAN_LIMITS.free })
        expect(revived).toEqual(PLAN_LIMITS.free)
    })
})
