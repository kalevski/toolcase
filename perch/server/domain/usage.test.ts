// Unit coverage for the pure usage summarization behind `GET /api/me`. No
// SQLite, no `server-only` — the route is just this function wrapped in
// `siteRepo.listByOwner`. See §7, §11, §13.

import { describe, it, expect } from 'vitest'
import { summarizeUsage } from './usage'
import type { Site } from './types'

function site(over: Partial<Site>): Site {
    return {
        id: 's1',
        ownerId: 1,
        repoOwner: 'alice',
        repoName: 'portfolio',
        repoPrivate: false,
        branch: 'gh-pages',
        hostname: 'alice.perch.dev',
        hostKind: 'subdomain',
        realmId: 'realm-test',
        status: 'live',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        ...over,
    }
}

describe('summarizeUsage', () => {
    it('reports zero for a user with no sites', () => {
        expect(summarizeUsage([])).toEqual({ siteCount: 0, totalBytes: 0 })
    })

    it('counts sites and sums their measured bytes', () => {
        const usage = summarizeUsage([
            site({ id: 's1', bytes: 1000 }),
            site({ id: 's2', bytes: 2500 }),
        ])
        expect(usage).toEqual({ siteCount: 2, totalBytes: 3500 })
    })

    it('treats unmeasured sites (no bytes) as 0', () => {
        const usage = summarizeUsage([
            site({ id: 's1', bytes: 4000 }),
            site({ id: 's2', bytes: undefined }),
        ])
        expect(usage).toEqual({ siteCount: 2, totalBytes: 4000 })
    })
})
