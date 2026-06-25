// Unit coverage for the pure deploy state machine (§9). The `services/deploy.ts`
// wrapper can't be imported under vitest (its `server-only` guard throws), so the
// load-bearing sequence is exercised here against a mocked nginxpilot client and an
// in-memory store — the headline check is the happy-path provision sequence.

import { describe, it, expect } from 'vitest'
import type { Site } from './types'
import type { NginxpilotSiteStatus, NginxpilotStatus } from '../infrastructure/nginxpilot'
import {
    interpretStatus,
    provision,
    track,
    update,
    redeploy,
    remove,
    suspend,
    type DeployDeps,
} from './deploy-machine'

function site(overrides: Partial<Site> = {}): Site {
    return {
        id: 'abc123',
        ownerId: 1,
        repoOwner: 'alice',
        repoName: 'portfolio',
        branch: 'gh-pages',
        subdir: 'dist/',
        hostname: 'alice.perch.dev',
        hostKind: 'subdomain',
        status: 'draft',
        createdAt: '2026-06-25T00:00:00.000Z',
        updatedAt: '2026-06-25T00:00:00.000Z',
        ...overrides,
    }
}

/** A recording test harness: an ordered `calls` log plus per-site stored fields. */
function harness(statusQueue: NginxpilotStatus[] = []) {
    const calls: string[] = []
    const audits: { action: string; site: string; detail?: string }[] = []
    const store: Record<string, Partial<Site>> = {}
    let statusIdx = 0

    const deps: DeployDeps = {
        client: {
            async writeFragment(s) {
                calls.push('writeFragment')
                return `/sites.d/perch-${s.id}.yml`
            },
            async removeFragment() {
                calls.push('removeFragment')
            },
            async reload() {
                calls.push('reload')
                return { method: 'rest' }
            },
            async sync(domain) {
                calls.push(`sync:${domain}`)
            },
            async status() {
                calls.push('status')
                // Repeat the last reading once the queue is drained.
                const next = statusQueue[Math.min(statusIdx, statusQueue.length - 1)] ?? { sites: [] }
                statusIdx++
                return next
            },
        },
        store: {
            updateStatus(id, status) {
                ;(store[id] ??= {}).status = status
            },
            updateLastError(id, lastError) {
                ;(store[id] ??= {}).lastError = lastError ?? undefined
            },
            updateLastRef(id, lastRef) {
                ;(store[id] ??= {}).lastRef = lastRef
            },
            updateBytes(id, bytes) {
                ;(store[id] ??= {}).bytes = bytes
            },
            updateSource(id, branch, subdir) {
                Object.assign((store[id] ??= {}), { branch, subdir })
            },
            remove(id) {
                store[id] = { status: 'suspended' } // sentinel: removed
                calls.push('store.remove')
            },
        },
        fragmentOptions: () => ({ intervalSec: 900 }),
        audit(action, s, detail) {
            audits.push({ action, site: s.hostname, detail })
        },
        now: () => '2026-06-25T12:00:00.000Z',
        sleep: async () => {
            calls.push('sleep')
        },
    }

    return { deps, calls, audits, store }
}

function liveStatus(overrides: Partial<NginxpilotSiteStatus> = {}): NginxpilotStatus {
    return {
        sites: [
            {
                domain: 'alice.perch.dev',
                source_type: 'git',
                source_url: 'https://github.com/alice/portfolio.git',
                deployed_ref: 'deadbeef',
                last_success: '2026-06-25T12:00:00.000Z',
                failure_streak: 0,
                never_synced: false,
                syncing: false,
                ...overrides,
            },
        ],
    }
}

describe('provision', () => {
    it('runs the happy-path sequence against a mocked client', async () => {
        const h = harness()
        const result = await provision(h.deps, site({ status: 'draft', lastError: 'stale boom' }))

        // Write the fragment, reload, THEN force the first sync — order matters.
        expect(h.calls).toEqual(['writeFragment', 'reload', 'sync:alice.perch.dev'])

        // Row marked provisioning with the stale error cleared.
        expect(result.status).toBe('provisioning')
        expect(h.store['abc123'].status).toBe('provisioning')
        expect(h.store['abc123'].lastError).toBeUndefined()

        // One audit entry for the draft → provisioning transition.
        expect(h.audits).toEqual([
            { action: 'site.provisioning', site: 'alice.perch.dev', detail: undefined },
        ])
    })
})

describe('track', () => {
    it('polls until the domain reports a live current ref', async () => {
        // First poll: still syncing. Second poll: live.
        const provisioning = liveStatus({ deployed_ref: undefined, never_synced: true, syncing: true })
        const h = harness([provisioning, liveStatus({ bytes: 4096 })])

        const result = await track(h.deps, site({ status: 'provisioning' }), { attempts: 5, intervalMs: 10 })

        expect(result.status).toBe('live')
        expect(result.lastRef).toBe('deadbeef')
        expect(h.store['abc123'].status).toBe('live')
        expect(h.store['abc123'].lastRef).toBe('deadbeef')
        expect(h.store['abc123'].bytes).toBe(4096)
        // Two status polls with one sleep between them; stops as soon as it's live.
        expect(h.calls).toEqual(['status', 'sleep', 'status'])
        // Only the live transition is audited (provisioning→provisioning is a no-op).
        expect(h.audits).toEqual([{ action: 'site.live', site: 'alice.perch.dev', detail: undefined }])
    })

    it('records failed but keeps the last-known-good ref on a bad push', async () => {
        const h = harness([liveStatus({ failure_streak: 2, last_error: 'build missing index.html' })])
        const result = await track(h.deps, site({ status: 'provisioning' }), { attempts: 1 })

        expect(result.status).toBe('failed')
        // Prior release still serving — keep its ref.
        expect(result.lastRef).toBe('deadbeef')
        expect(result.lastError).toBe('build missing index.html')
        expect(h.audits).toEqual([
            { action: 'site.failed', site: 'alice.perch.dev', detail: 'build missing index.html' },
        ])
    })
})

describe('interpretStatus', () => {
    const base = site()

    it('reports provisioning when the fragment is not yet visible to nginxpilot', () => {
        expect(interpretStatus(undefined, base)).toMatchObject({ status: 'provisioning', live: false })
    })

    it('reports live when a release is served and the latest sync is clean', () => {
        const st = liveStatus().sites[0]
        expect(interpretStatus(st, base)).toEqual({
            status: 'live',
            lastRef: 'deadbeef',
            lastError: null,
            bytes: undefined,
            live: true,
        })
    })

    it('reports failed but keeps the serving ref on a last-known-good push', () => {
        const st = liveStatus({ failure_streak: 1, last_error: 'boom' }).sites[0]
        expect(interpretStatus(st, base)).toMatchObject({
            status: 'failed',
            lastRef: 'deadbeef',
            lastError: 'boom',
            live: false,
        })
    })

    it('reports a hard failure with no ref when the first deploy never succeeded', () => {
        const st = liveStatus({
            deployed_ref: undefined,
            never_synced: true,
            failure_streak: 3,
            last_error: 'clone failed',
        }).sites[0]
        expect(interpretStatus(st, base)).toEqual({
            status: 'failed',
            lastError: 'clone failed',
            live: false,
        })
    })

    it('stays provisioning while syncing with no error yet', () => {
        const st = liveStatus({ deployed_ref: undefined, never_synced: true, syncing: true }).sites[0]
        expect(interpretStatus(st, base)).toMatchObject({ status: 'provisioning', live: false })
    })
})

describe('redeploy', () => {
    it('just forces a sync and audits', async () => {
        const h = harness()
        await redeploy(h.deps, site({ status: 'live' }))
        expect(h.calls).toEqual(['sync:alice.perch.dev'])
        expect(h.audits).toEqual([{ action: 'site.redeploy', site: 'alice.perch.dev', detail: undefined }])
    })
})

describe('update', () => {
    it('rewrites the fragment, reloads and syncs on a branch change', async () => {
        const h = harness()
        const result = await update(h.deps, site({ status: 'live' }), { branch: 'main' })

        expect(result.branch).toBe('main')
        expect(result.status).toBe('provisioning')
        expect(h.store['abc123'].branch).toBe('main')
        expect(h.calls).toEqual(['writeFragment', 'reload', 'sync:alice.perch.dev'])
        expect(h.audits[0]).toMatchObject({ action: 'site.update', site: 'alice.perch.dev' })
    })

    it('is a no-op when neither branch nor subdir changes', async () => {
        const h = harness()
        const s = site({ status: 'live' })
        const result = await update(h.deps, s, { branch: s.branch, subdir: s.subdir })
        expect(result).toBe(s)
        expect(h.calls).toEqual([])
        expect(h.audits).toEqual([])
    })
})

describe('remove', () => {
    it('removes the fragment, reloads and deletes the row', async () => {
        const h = harness()
        await remove(h.deps, site({ status: 'live' }))
        expect(h.calls).toEqual(['removeFragment', 'reload', 'store.remove'])
        expect(h.audits).toEqual([{ action: 'site.remove', site: 'alice.perch.dev', detail: undefined }])
    })
})

describe('suspend', () => {
    it('removes the fragment, reloads and marks the row suspended — keeping the row', async () => {
        const h = harness()
        const result = await suspend(h.deps, site({ status: 'live' }))

        // Same stop-serving sequence as remove, but NO store.remove — the row survives.
        expect(h.calls).toEqual(['removeFragment', 'reload'])
        expect(result.status).toBe('suspended')
        expect(h.store['abc123'].status).toBe('suspended')

        // The machine does not audit: the moderation entry is the admin service's job,
        // attributed to the acting owner rather than the site's tenant.
        expect(h.audits).toEqual([])
    })
})
