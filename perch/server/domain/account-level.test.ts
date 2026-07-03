// Unit coverage for the pure account-level + limit-merge rules in `types.ts`. The
// level ladder is the single label the UI shows; the merge is how a per-user
// override layers over the role default (the only way above baseline now that the
// multi-plan system is gone).

import { describe, it, expect } from 'vitest'
import { accountLevel, mergeLimits, STANDARD_LIMITS, reviveLimits, UNLIMITED_LIMITS } from './types'

describe('accountLevel (role → one ladder)', () => {
    it('maps operator roles to their own levels', () => {
        expect(accountLevel('owner')).toBe('owner')
        expect(accountLevel('maintainer')).toBe('maintainer')
    })

    it('maps everyone else to standard', () => {
        expect(accountLevel('standard')).toBe('standard')
        expect(accountLevel('guest')).toBe('standard')
    })
})

describe('mergeLimits (per-user override over a base)', () => {
    it('returns the base unchanged for an absent/empty override', () => {
        expect(mergeLimits(STANDARD_LIMITS)).toBe(STANDARD_LIMITS)
        expect(mergeLimits(STANDARD_LIMITS, null)).toBe(STANDARD_LIMITS)
        expect(mergeLimits(STANDARD_LIMITS, {})).toEqual(STANDARD_LIMITS)
    })

    it('overrides only the present fields, leaving the rest of the base intact', () => {
        const merged = mergeLimits(STANDARD_LIMITS, { maxSites: 10, privateRepos: true })
        expect(merged.maxSites).toBe(10)
        expect(merged.privateRepos).toBe(true)
        // Untouched fields fall through to the standard default.
        expect(merged.maxBytesPerSite).toBe(STANDARD_LIMITS.maxBytesPerSite)
        expect(merged.customDomains).toBe(STANDARD_LIMITS.customDomains)
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
        const revived = reviveLimits({ ...STANDARD_LIMITS })
        expect(revived).toEqual(STANDARD_LIMITS)
    })
})
