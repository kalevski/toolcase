// Unit coverage for the pure per-site access decision (§13, §16). The
// `services/sites.ts` wrapper can't be imported under vitest (its `server-only`
// guard throws), so the load-bearing tenant-isolation rule — owner bypass, owner-of
// allowed, another user's site rejected — is exercised here directly.

import { describe, it, expect } from 'vitest'
import { resolveSiteAccess } from './site-access'
import type { Site } from './types'

function site(ownerId: number): Site {
    return {
        id: 'abc123',
        ownerId,
        repoOwner: 'alice',
        repoName: 'portfolio',
        branch: 'gh-pages',
        hostname: 'alice.perch.dev',
        hostKind: 'subdomain',
        status: 'live',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    }
}

describe('resolveSiteAccess', () => {
    it('allows the owning standard user', () => {
        const access = resolveSiteAccess(site(7), { sub: 7, role: 'standard' })
        expect(access).toEqual({ ok: true, site: site(7) })
    })

    it('rejects another standard user with 403', () => {
        expect(resolveSiteAccess(site(7), { sub: 99, role: 'standard' })).toEqual({ ok: false, status: 403 })
    })

    it('lets the owner role bypass the ownership check', () => {
        const access = resolveSiteAccess(site(7), { sub: 99, role: 'owner' })
        expect(access).toEqual({ ok: true, site: site(7) })
    })

    it('rejects a guest acting on someone else’s site with 403', () => {
        expect(resolveSiteAccess(site(7), { sub: 99, role: 'guest' })).toEqual({ ok: false, status: 403 })
    })

    it('returns 404 when the site does not exist', () => {
        expect(resolveSiteAccess(undefined, { sub: 7, role: 'standard' })).toEqual({ ok: false, status: 404 })
        // Even the owner role gets 404 for a missing row (nothing to bypass to).
        expect(resolveSiteAccess(undefined, { sub: 1, role: 'owner' })).toEqual({ ok: false, status: 404 })
    })
})
