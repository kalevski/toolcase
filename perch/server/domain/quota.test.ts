// Unit coverage for the pure quota-enforcement rules (§11). The `services/quota.ts`
// wrapper can't be imported under vitest (its `server-only` guard throws), so the
// load-bearing decisions — the pre-create count gate and the over-quota → grace →
// suspend transition — are exercised here directly. See §11, §15.

import { describe, it, expect } from 'vitest'
import { canCreateSite, canUseCustomDomain, intervalFor, decideByteQuota } from './quota'
import { STANDARD_LIMITS, type PlanLimits } from './types'

const MB = 1024 * 1024

function limits(over: Partial<PlanLimits> = {}): PlanLimits {
    return { ...STANDARD_LIMITS, ...over }
}

describe('canCreateSite', () => {
    it('allows a user below their site cap', () => {
        expect(canCreateSite(0, limits({ maxSites: 1 }))).toBe(true)
        expect(canCreateSite(2, limits({ maxSites: 3 }))).toBe(true)
    })

    it('rejects a user at (or past) their site cap', () => {
        expect(canCreateSite(1, limits({ maxSites: 1 }))).toBe(false)
        expect(canCreateSite(3, limits({ maxSites: 3 }))).toBe(false)
        expect(canCreateSite(5, limits({ maxSites: 3 }))).toBe(false)
    })
})

describe('canUseCustomDomain', () => {
    it('rejects the free tier (no custom domains)', () => {
        expect(canUseCustomDomain(limits({ customDomains: 0 }))).toBe(false)
    })

    it('allows any paid tier with at least one custom domain', () => {
        expect(canUseCustomDomain(limits({ customDomains: 1 }))).toBe(true)
        expect(canUseCustomDomain(limits({ customDomains: Infinity }))).toBe(true)
    })
})

describe('intervalFor', () => {
    it("formats each plan's minIntervalSec as an nginxpilot duration", () => {
        expect(intervalFor(STANDARD_LIMITS)).toBe('15m') // 900s
        expect(intervalFor(limits({ minIntervalSec: 300 }))).toBe('5m') // 300s
        expect(intervalFor(limits({ minIntervalSec: 60 }))).toBe('1m') // 60s
    })
})

describe('decideByteQuota', () => {
    const cap = 50 * MB
    const base = { maxBytesPerSite: cap, now: '2026-06-25T12:00:00.000Z', graceSec: 3600 }

    it('leaves a within-quota live site untouched', () => {
        expect(decideByteQuota({ ...base, status: 'live', bytes: 10 * MB })).toBe('ok')
    })

    it('flags a newly over-quota site (starting the grace clock)', () => {
        expect(decideByteQuota({ ...base, status: 'live', bytes: 60 * MB })).toBe('mark')
    })

    it('holds an over-quota site while the grace window is still open', () => {
        expect(
            decideByteQuota({
                ...base,
                status: 'over_quota',
                bytes: 60 * MB,
                overSince: '2026-06-25T11:30:00.000Z', // 30m ago, grace is 60m
            }),
        ).toBe('hold')
    })

    it('suspends an over-quota site once the grace window has elapsed', () => {
        expect(
            decideByteQuota({
                ...base,
                status: 'over_quota',
                bytes: 60 * MB,
                overSince: '2026-06-25T10:30:00.000Z', // 90m ago, grace is 60m
            }),
        ).toBe('suspend')
    })

    it('treats grace exactly elapsed as suspendable', () => {
        expect(
            decideByteQuota({
                ...base,
                status: 'over_quota',
                bytes: 60 * MB,
                overSince: '2026-06-25T11:00:00.000Z', // exactly 60m ago
            }),
        ).toBe('suspend')
    })

    it('suspends immediately when the grace window is zero', () => {
        expect(
            decideByteQuota({
                ...base,
                graceSec: 0,
                status: 'over_quota',
                bytes: 60 * MB,
                overSince: base.now,
            }),
        ).toBe('suspend')
    })

    it('never suspends an over-quota site without a known overSince (fail safe)', () => {
        expect(decideByteQuota({ ...base, status: 'over_quota', bytes: 60 * MB })).toBe('hold')
    })

    it('does nothing to an already-suspended site that is still over quota', () => {
        expect(decideByteQuota({ ...base, status: 'suspended', bytes: 60 * MB })).toBe('ok')
    })

    it('reinstates an over-quota site that has been trimmed back under the cap', () => {
        expect(decideByteQuota({ ...base, status: 'over_quota', bytes: 10 * MB })).toBe('reinstate')
    })

    it('reinstates a suspended site after a trim or upgrade brings it within quota', () => {
        // An upgrade raises the cap, so the same bytes are now under it.
        expect(decideByteQuota({ ...base, status: 'suspended', bytes: 60 * MB, maxBytesPerSite: 200 * MB })).toBe(
            'reinstate',
        )
    })

    it('treats bytes equal to the cap as within quota', () => {
        expect(decideByteQuota({ ...base, status: 'live', bytes: cap })).toBe('ok')
    })
})
