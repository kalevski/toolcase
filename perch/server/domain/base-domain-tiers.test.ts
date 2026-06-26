// Unit coverage for the pure base-domain audience-tier rules (§10) that gate which
// subdomain pool a caller may attach under. These live in `domain/types.ts` (pure,
// zero-import, client+server safe) so both the standard `/api/base-domains`
// projection (`services/admin.ts#listBaseDomainsFor`) and the create-site wizard
// agree on visibility. The three groups form a strict superset chain:
//   free-plan user → free; paid (sponsored) user → free+paid; operator → all.

import { describe, it, expect } from 'vitest'
import { BASE_DOMAIN_TIERS, isBaseDomainTier, visibleBaseDomainTiers } from './types'

describe('isBaseDomainTier (the POST /api/admin/base-domains tier gate)', () => {
    it('accepts the three audience tiers and rejects anything else', () => {
        expect(isBaseDomainTier('free')).toBe(true)
        expect(isBaseDomainTier('paid')).toBe(true)
        expect(isBaseDomainTier('staff')).toBe(true)
        expect([...BASE_DOMAIN_TIERS]).toEqual(['free', 'paid', 'staff'])

        expect(isBaseDomainTier('owner')).toBe(false)
        expect(isBaseDomainTier('')).toBe(false)
        expect(isBaseDomainTier(undefined)).toBe(false)
        expect(isBaseDomainTier(1)).toBe(false)
    })
})

describe('visibleBaseDomainTiers (the /api/base-domains audience filter, §10)', () => {
    it('shows a free-plan standard user only the free tier', () => {
        expect(visibleBaseDomainTiers('standard', 'free')).toEqual(['free'])
        expect(visibleBaseDomainTiers('guest', 'free')).toEqual(['free'])
    })

    it('shows a paid (sponsored) standard user the free + paid tiers, never staff', () => {
        expect(visibleBaseDomainTiers('standard', 'bronze')).toEqual(['free', 'paid'])
        expect(visibleBaseDomainTiers('standard', 'silver')).toEqual(['free', 'paid'])
        expect(visibleBaseDomainTiers('standard', 'gold')).toEqual(['free', 'paid'])
    })

    it('shows instance operators every tier — the role wins over the plan', () => {
        // A maintainer/owner sees all three even on a free plan (they are quota-exempt
        // operators, §6); the role short-circuits before the plan is consulted.
        expect(visibleBaseDomainTiers('maintainer', 'free')).toEqual(['free', 'paid', 'staff'])
        expect(visibleBaseDomainTiers('owner', 'free')).toEqual(['free', 'paid', 'staff'])
        expect(visibleBaseDomainTiers('owner', 'gold')).toEqual(['free', 'paid', 'staff'])
    })

    it('always returns a prefix of the canonical tier order (the superset chain)', () => {
        for (const [role, plan] of [
            ['standard', 'free'],
            ['standard', 'gold'],
            ['owner', 'free'],
        ] as const) {
            const visible = visibleBaseDomainTiers(role, plan)
            expect(visible).toEqual(BASE_DOMAIN_TIERS.slice(0, visible.length))
        }
    })
})
