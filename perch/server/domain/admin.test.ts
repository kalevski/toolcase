// Unit coverage for the pure owner-admin decisions behind `services/admin.ts`
// (the `server-only` service can't be imported under vitest). Headline check:
// non-owner roles fail the owner gate (→ 403). See §13.

import { describe, it, expect } from 'vitest'
import { ASSIGNABLE_ROLES, checkBaseDomain, isAssignableRole, meetsMinRole, parseUserLimits } from './admin'

describe('meetsMinRole (the owner-endpoint 403 gate)', () => {
    it('denies every non-owner role at an owner endpoint', () => {
        // This is the exact decision `authorize('owner')` enforces — a session below
        // `owner` is rejected with 403. The /api/admin/** routes all guard on 'owner'.
        // A maintainer is below owner, so the admin surface stays owner-only.
        expect(meetsMinRole('standard', 'owner')).toBe(false)
        expect(meetsMinRole('maintainer', 'owner')).toBe(false)
        expect(meetsMinRole('guest', 'owner')).toBe(false)
        expect(meetsMinRole('owner', 'owner')).toBe(true)
    })

    it('admits maintainers AND owners (but not standard) at a maintainer endpoint', () => {
        // The decision `authorize('maintainer')` enforces for /api/routing/**.
        expect(meetsMinRole('maintainer', 'maintainer')).toBe(true)
        expect(meetsMinRole('owner', 'maintainer')).toBe(true)
        expect(meetsMinRole('standard', 'maintainer')).toBe(false)
        expect(meetsMinRole('guest', 'maintainer')).toBe(false)
    })

    it('orders the roles guest < standard < maintainer < owner', () => {
        expect(meetsMinRole('owner', 'standard')).toBe(true)
        expect(meetsMinRole('maintainer', 'standard')).toBe(true)
        expect(meetsMinRole('standard', 'standard')).toBe(true)
        expect(meetsMinRole('guest', 'standard')).toBe(false)
        expect(meetsMinRole('guest', 'guest')).toBe(true)
    })
})

describe('isAssignableRole (the PATCH /api/admin/users body gate)', () => {
    it('accepts the three assignable roles', () => {
        expect(isAssignableRole('owner')).toBe(true)
        expect(isAssignableRole('maintainer')).toBe(true)
        expect(isAssignableRole('standard')).toBe(true)
        expect([...ASSIGNABLE_ROLES].sort()).toEqual(['maintainer', 'owner', 'standard'])
    })

    it('rejects guest (a runtime fallback, never stored) and any non-role value', () => {
        expect(isAssignableRole('guest')).toBe(false)
        expect(isAssignableRole('admin')).toBe(false)
        expect(isAssignableRole('')).toBe(false)
        expect(isAssignableRole(undefined)).toBe(false)
        expect(isAssignableRole(2)).toBe(false)
    })
})

describe('parseUserLimits (the per-user override PUT body)', () => {
    it('keeps only the present fields (the rest inherit the default)', () => {
        const result = parseUserLimits({ maxSites: 5, customDomains: 2 })
        expect(result).toEqual({ ok: true, override: { maxSites: 5, customDomains: 2 } })
    })

    it('treats null/undefined fields as "inherit" and drops them', () => {
        const result = parseUserLimits({ maxSites: 5, maxBytesTotal: null, keepReleases: undefined })
        expect(result).toEqual({ ok: true, override: { maxSites: 5 } })
    })

    it('accepts an empty object (clears every override)', () => {
        expect(parseUserLimits({})).toEqual({ ok: true, override: {} })
    })

    it('accepts a boolean privateRepos and rejects a non-boolean one', () => {
        expect(parseUserLimits({ privateRepos: true })).toEqual({ ok: true, override: { privateRepos: true } })
        expect(parseUserLimits({ privateRepos: false })).toEqual({ ok: true, override: { privateRepos: false } })
        expect(parseUserLimits({ privateRepos: 1 })).toMatchObject({ ok: false, reason: 'bad_flag' })
    })

    it('rejects a non-object body', () => {
        expect(parseUserLimits(null)).toMatchObject({ ok: false, reason: 'not_object' })
        expect(parseUserLimits(42)).toMatchObject({ ok: false, reason: 'not_object' })
    })

    it('rejects a non-integer, negative, or non-numeric quota', () => {
        expect(parseUserLimits({ maxSites: 1.5 })).toMatchObject({ ok: false, reason: 'bad_number' })
        expect(parseUserLimits({ maxSites: -1 })).toMatchObject({ ok: false, reason: 'bad_number' })
        expect(parseUserLimits({ maxBytesPerSite: '100' })).toMatchObject({ ok: false, reason: 'bad_number' })
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
