// Unit coverage for the pure per-site dashboard view-model (task 734, §9, §14).
// No SQLite, no `server-only`, no DOM — just the mapping from a `/status` payload +
// plan limits to the shapes the dashboard's tc-* elements consume. The
// last-known-good guarantee (§9 step 5) is the behaviour worth pinning down.

import { describe, it, expect } from 'vitest'
import {
    buildSiteDashboard,
    formatBytes,
    formatUtc,
    shortRef,
    toDashboardStatus,
    type SiteDeployStatus,
    type SiteStatusPayload,
} from './site-dashboard'
import { STANDARD_LIMITS, type Site, type SiteStatus } from './types'

const LIMITS = STANDARD_LIMITS // maxBytesPerSite = 50 MB
const MB = 1024 * 1024

function site(over: Partial<Site> = {}): Site {
    return {
        id: 's1',
        ownerId: 1,
        repoOwner: 'alice',
        repoName: 'portfolio',
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

function np(over: Partial<SiteDeployStatus> = {}): SiteDeployStatus {
    return {
        domain: 'alice.perch.dev',
        failure_streak: 0,
        never_synced: false,
        syncing: false,
        ...over,
    }
}

function payload(siteOver: Partial<Site>, npValue: SiteDeployStatus | null): SiteStatusPayload {
    return { site: site(siteOver), nginxpilot: npValue }
}

describe('helpers', () => {
    it('formatBytes scales into B/KB/MB/GB', () => {
        expect(formatBytes(0)).toBe('0 B')
        expect(formatBytes(undefined)).toBe('0 B')
        expect(formatBytes(512)).toBe('512 B')
        expect(formatBytes(12.3 * MB)).toBe('12 MB')
        expect(formatBytes(1.5 * 1024 * MB)).toBe('1.5 GB')
        expect(formatBytes(Infinity)).toBe('∞')
    })

    it('shortRef truncates SHAs but leaves branch names alone', () => {
        expect(shortRef('0123456789abcdef0123456789abcdef01234567')).toBe('0123456')
        expect(shortRef('gh-pages')).toBe('gh-pages')
        expect(shortRef(undefined)).toBe('')
    })

    it('formatUtc slices an ISO without locale/timezone drift', () => {
        expect(formatUtc('2026-01-02T03:04:05.000Z')).toBe('2026-01-02 03:04 UTC')
        expect(formatUtc(undefined)).toBe('')
        expect(formatUtc('not-a-date')).toBe('')
    })

    it('toDashboardStatus collapses draft → provisioning and maps over_quota', () => {
        const cases: Array<[SiteStatus, string]> = [
            ['draft', 'provisioning'],
            ['provisioning', 'provisioning'],
            ['live', 'live'],
            ['failed', 'failed'],
            ['suspended', 'suspended'],
            ['over_quota', 'over-quota'],
        ]
        for (const [input, expected] of cases) expect(toDashboardStatus(input)).toBe(expected)
    })
})

describe('buildSiteDashboard', () => {
    it('reports a healthy live site (online dot, pass build, serving)', () => {
        const view = buildSiteDashboard(
            payload(
                { status: 'live', lastRef: 'deadbeef0' },
                np({ deployed_ref: 'deadbeef0', last_success: '2026-02-01T10:00:00.000Z', bytes: 10 * MB }),
            ),
            LIMITS,
        )
        expect(view.headline).toMatchObject({ status: 'live', dot: 'online', pulse: false, label: 'Live' })
        expect(view.serving).toBe(true)
        expect(view.build.status).toBe('pass')
        expect(view.build.badge).toBe('deadbee') // 7-char SHA
        expect(view.build.size).toBe(10 * MB)
        expect(view.statusItems.find((i) => i.id === 'serving')).toMatchObject({ status: 'ok' })
        expect(view.lastKnownGood).toMatch(/latest build is live/i)
    })

    it('encodes last-known-good: a failed push keeps the previous release serving', () => {
        const view = buildSiteDashboard(
            payload(
                { status: 'failed', lastRef: 'goodref1' },
                np({
                    deployed_ref: 'goodref1',
                    last_error: 'build produced no index.html',
                    last_error_time: '2026-02-02T12:00:00.000Z',
                    failure_streak: 2,
                }),
            ),
            LIMITS,
        )
        // Build reads fail…
        expect(view.build.status).toBe('fail')
        // …but the site is still serving the prior good release.
        expect(view.serving).toBe(true)
        expect(view.statusItems.find((i) => i.id === 'serving')).toMatchObject({ status: 'ok', detail: 'goodref1' })
        expect(view.statusItems.find((i) => i.id === 'deploy')).toMatchObject({ status: 'error' })
        expect(view.lastKnownGood).toMatch(/previous release is still live/i)
        expect(view.log.some((l) => l.text.includes('last-known-good'))).toBe(true)
        expect(view.log.some((l) => l.text.includes('build produced no index.html'))).toBe(true)
    })

    it('shows a provisioning site as a pulsing away dot with a running build', () => {
        const view = buildSiteDashboard(
            payload({ status: 'provisioning' }, np({ never_synced: true, syncing: true })),
            LIMITS,
        )
        expect(view.headline).toMatchObject({ status: 'provisioning', dot: 'away', pulse: true })
        expect(view.serving).toBe(false)
        expect(view.build.status).toBe('running')
        expect(view.statusItems.find((i) => i.id === 'serving')).toMatchObject({ status: 'inactive', detail: 'no release' })
        expect(view.lastKnownGood).toMatch(/no release is live yet/i)
    })

    it('waits when nginxpilot has not yet seen the fragment', () => {
        const view = buildSiteDashboard(payload({ status: 'provisioning' }, null), LIMITS)
        expect(view.build.status).toBe('queued')
        expect(view.log.some((l) => l.text.includes('awaiting nginxpilot'))).toBe(true)
    })

    it('marks an over-quota site error in storage and warns on the bar', () => {
        const view = buildSiteDashboard(
            payload(
                { status: 'over_quota', lastRef: 'r1' },
                np({ deployed_ref: 'r1', bytes: 60 * MB, last_success: '2026-02-03T00:00:00.000Z' }),
            ),
            LIMITS,
        )
        expect(view.headline.status).toBe('over-quota')
        expect(view.statusItems.find((i) => i.id === 'storage')).toMatchObject({ status: 'error' })
        const siteBar = view.usage.find((u) => u.label === 'This site')!
        expect(siteBar).toMatchObject({ measurementUnit: 'MB', total: 50, warn: true })
        expect(siteBar.used).toBe(60)
    })

    it('renders a suspended site as offline and not serving even with a stored ref', () => {
        const view = buildSiteDashboard(payload({ status: 'suspended', lastRef: 'r1' }, null), LIMITS)
        expect(view.headline).toMatchObject({ status: 'suspended', dot: 'offline' })
        expect(view.serving).toBe(false)
        expect(view.build.status).toBe('queued')
        expect(view.lastKnownGood).toMatch(/suspended/i)
    })

    it('adds an account-wide storage bar when usage is supplied', () => {
        const view = buildSiteDashboard(
            payload({ status: 'live', lastRef: 'r1' }, np({ deployed_ref: 'r1', bytes: 5 * MB })),
            LIMITS,
            { siteCount: 1, totalBytes: 5 * MB },
        )
        expect(view.usage).toHaveLength(2)
        expect(view.usage[1]).toMatchObject({ label: 'All your sites', measurementUnit: 'MB', total: 50 })
    })

    it('injects a "TLS / nginx" error item when managed mode disabled the resource', () => {
        const view = buildSiteDashboard(
            {
                ...payload({ status: 'live', lastRef: 'r1' }, np({ deployed_ref: 'r1' })),
                nginxResource: { state: 'disabled', reason: 'nginx: [emerg] duplicate listen 443' },
            },
            LIMITS,
        )
        const item = view.statusItems.find((i) => i.id === 'nginx')
        expect(item).toMatchObject({ label: 'TLS / nginx', status: 'error', detail: 'nginx: [emerg] duplicate listen 443' })
    })

    it('falls back to a generic reason when the daemon gives none', () => {
        const view = buildSiteDashboard(
            { ...payload({ status: 'live', lastRef: 'r1' }, np({ deployed_ref: 'r1' })), nginxResource: { state: 'disabled' } },
            LIMITS,
        )
        expect(view.statusItems.find((i) => i.id === 'nginx')).toMatchObject({ detail: 'disabled by nginx -t' })
    })

    it('adds no nginx item when the resource is active or absent', () => {
        const active = buildSiteDashboard(
            { ...payload({ status: 'live', lastRef: 'r1' }, np({ deployed_ref: 'r1' })), nginxResource: { state: 'active' } },
            LIMITS,
        )
        expect(active.statusItems.find((i) => i.id === 'nginx')).toBeUndefined()
        const absent = buildSiteDashboard(payload({ status: 'live', lastRef: 'r1' }, np({ deployed_ref: 'r1' })), LIMITS)
        expect(absent.statusItems.find((i) => i.id === 'nginx')).toBeUndefined()
    })

    it('picks GB units for large plan limits', () => {
        const view = buildSiteDashboard(
            payload({ status: 'live', lastRef: 'r1' }, np({ deployed_ref: 'r1', bytes: 512 * MB })),
            { ...STANDARD_LIMITS, maxBytesPerSite: 1024 * 1024 * 1024 }, // maxBytesPerSite = 1 GB
        )
        const siteBar = view.usage[0]
        expect(siteBar).toMatchObject({ measurementUnit: 'GB', total: 1 })
        expect(siteBar.used).toBe(0.5)
    })
})
