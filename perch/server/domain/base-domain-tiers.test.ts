// Unit coverage for the pure base-domain audience-tier rules (§10) that gate which
// subdomain pool a caller may attach under. These live in `domain/types.ts` (pure,
// zero-import, client+server safe) so both the standard `/api/base-domains`
// projection (`services/admin.ts#listBaseDomainsFor`) and the create-site wizard
// agree on visibility. With the multi-plan system gone, visibility is role-only:
//   standard user → free; operator → all (the `paid` tier is operator-only now).

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
    it('shows a standard user only the free tier', () => {
        expect(visibleBaseDomainTiers('standard')).toEqual(['free'])
        expect(visibleBaseDomainTiers('guest')).toEqual(['free'])
    })

    it('shows instance operators every tier', () => {
        expect(visibleBaseDomainTiers('maintainer')).toEqual(['free', 'paid', 'staff'])
        expect(visibleBaseDomainTiers('owner')).toEqual(['free', 'paid', 'staff'])
    })

    it('always returns a prefix of the canonical tier order (the superset chain)', () => {
        for (const role of ['standard', 'guest', 'maintainer', 'owner'] as const) {
            const visible = visibleBaseDomainTiers(role)
            expect(visible).toEqual(BASE_DOMAIN_TIERS.slice(0, visible.length))
        }
    })
})
