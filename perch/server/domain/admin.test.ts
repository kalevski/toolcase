// Unit coverage for the pure owner-admin decisions behind `services/admin.ts`
// (the `server-only` service can't be imported under vitest). The two headline
// checks the task calls for: non-owner roles fail the owner gate (→ 403), and the
// plan-tier replacement parse round-trips. See §8, §13.

import { describe, it, expect } from 'vitest'
import { checkBaseDomain, meetsMinRole, parsePlanTiers, PAID_PLANS } from './admin'
import type { PlanTier } from './types'

describe('meetsMinRole (the owner-endpoint 403 gate)', () => {
    it('denies every non-owner role at an owner endpoint', () => {
        // This is the exact decision `authorize('owner')` enforces — a session below
        // `owner` is rejected with 403. The /api/admin/** routes all guard on 'owner'.
        expect(meetsMinRole('standard', 'owner')).toBe(false)
        expect(meetsMinRole('guest', 'owner')).toBe(false)
        expect(meetsMinRole('owner', 'owner')).toBe(true)
    })

    it('orders the roles guest < standard < owner', () => {
        expect(meetsMinRole('owner', 'standard')).toBe(true)
        expect(meetsMinRole('standard', 'standard')).toBe(true)
        expect(meetsMinRole('guest', 'standard')).toBe(false)
        expect(meetsMinRole('guest', 'guest')).toBe(true)
    })
})

describe('parsePlanTiers', () => {
    it('normalizes a valid mapping to a cheapest-first sorted, deduped array', () => {
        // Deliberately out of order; parse must sort ascending by minCents so a replace
        // round-trips against planTierRepo.list()'s `ORDER BY min_cents`.
        const input = [
            { minCents: 10000, plan: 'gold' },
            { minCents: 500, plan: 'bronze' },
            { minCents: 2500, plan: 'silver' },
        ]
        const result = parsePlanTiers(input)
        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.tiers).toEqual([
            { minCents: 500, plan: 'bronze' },
            { minCents: 2500, plan: 'silver' },
            { minCents: 10000, plan: 'gold' },
        ])
    })

    it('round-trips: parsing its own normalized output is a fixed point', () => {
        const input = [
            { minCents: 2500, plan: 'silver' },
            { minCents: 500, plan: 'bronze' },
        ]
        const first = parsePlanTiers(input)
        expect(first.ok).toBe(true)
        if (!first.ok) return
        // Feeding the normalized tiers (the shape `GET /api/admin/plan-tiers` returns)
        // back through parse yields the same array — PUT(GET(x)) === GET(x).
        const second = parsePlanTiers(first.tiers)
        expect(second.ok).toBe(true)
        if (!second.ok) return
        expect(second.tiers).toEqual(first.tiers)
    })

    it('accepts an empty mapping (clears every tier — all sponsors fall back to free)', () => {
        const result = parsePlanTiers([])
        expect(result).toEqual({ ok: true, tiers: [] })
    })

    it('rejects a non-array body', () => {
        expect(parsePlanTiers({ minCents: 500, plan: 'bronze' })).toMatchObject({ ok: false, reason: 'not_array' })
        expect(parsePlanTiers(null)).toMatchObject({ ok: false, reason: 'not_array' })
    })

    it('rejects a malformed row', () => {
        expect(parsePlanTiers([42])).toMatchObject({ ok: false, reason: 'bad_row' })
        expect(parsePlanTiers([null])).toMatchObject({ ok: false, reason: 'bad_row' })
    })

    it('rejects a non-integer or negative minCents', () => {
        expect(parsePlanTiers([{ minCents: 1.5, plan: 'bronze' }])).toMatchObject({ ok: false, reason: 'bad_cents' })
        expect(parsePlanTiers([{ minCents: -100, plan: 'bronze' }])).toMatchObject({ ok: false, reason: 'bad_cents' })
        expect(parsePlanTiers([{ minCents: '500', plan: 'bronze' }])).toMatchObject({
            ok: false,
            reason: 'bad_cents',
        })
    })

    it('rejects an unknown or free plan', () => {
        expect(parsePlanTiers([{ minCents: 500, plan: 'free' }])).toMatchObject({ ok: false, reason: 'bad_plan' })
        expect(parsePlanTiers([{ minCents: 500, plan: 'platinum' }])).toMatchObject({ ok: false, reason: 'bad_plan' })
        // Every accepted plan is one of the paid plans (the free tier is never stored).
        for (const plan of PAID_PLANS) {
            expect(parsePlanTiers([{ minCents: 500, plan }]).ok).toBe(true)
        }
    })

    it('rejects duplicate minCents (it is the primary key)', () => {
        const dup: { minCents: number; plan: PlanTier['plan'] }[] = [
            { minCents: 500, plan: 'bronze' },
            { minCents: 500, plan: 'silver' },
        ]
        expect(parsePlanTiers(dup)).toMatchObject({ ok: false, reason: 'duplicate_cents' })
    })
})

describe('checkBaseDomain', () => {
    it('accepts a valid FQDN and normalizes it', () => {
        expect(checkBaseDomain('Perch.Dev')).toEqual({ ok: true, domain: 'perch.dev' })
        expect(checkBaseDomain(' pages.perch.dev ')).toEqual({ ok: true, domain: 'pages.perch.dev' })
    })

    it('rejects an empty or malformed base domain', () => {
        expect(checkBaseDomain('')).toMatchObject({ ok: false, reason: 'empty' })
        expect(checkBaseDomain('not a domain')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkBaseDomain('localhost')).toMatchObject({ ok: false, reason: 'charset' })
    })
})
