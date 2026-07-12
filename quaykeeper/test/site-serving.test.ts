import { describe, it, expect } from 'vitest'
import { renderFragment } from '@/server/domain/nginxpilot-fragment'
import { checkNotFound, checkRouting } from '@/server/domain/site-input'
import { update, type DeployDeps } from '@/server/domain/deploy-machine'
import type { Site } from '@/server/domain/types'

// The static-serving settings (routing / custom 404 / asset caching) end-to-end:
// pure validation (site-input), fragment emission (nginxpilot-fragment), and the
// deploy machine's change detection — the three seams a setting crosses on its way
// from a PATCH body to nginxpilot's `POST /sites`.

function site(overrides: Partial<Site> = {}): Site {
    return {
        id: 'abc123DEF456',
        ownerId: 1,
        repoOwner: 'acme',
        repoName: 'landing',
        repoPrivate: false,
        branch: 'main',
        hostname: 'acme.quaykeeper.dev',
        hostKind: 'subdomain',
        status: 'live',
        realmId: 'default',
        createdAt: '2026-07-12T00:00:00.000Z',
        updatedAt: '2026-07-12T00:00:00.000Z',
        ...overrides,
    }
}

const OPTIONS = { intervalSec: 900 }

describe('renderFragment — serving settings', () => {
    it('emits no serving keys for a default static site (fragment bytes unchanged)', () => {
        const yaml = renderFragment(site(), OPTIONS)
        expect(yaml).not.toContain('routing:')
        expect(yaml).not.toContain('not_found:')
        expect(yaml).not.toContain('cache_assets:')
    })

    it('emits routing: spa at the site level', () => {
        const yaml = renderFragment(site({ routing: 'spa' }), OPTIONS)
        expect(yaml).toContain('\n    routing: spa\n')
    })

    it('emits clean-urls as a bare scalar', () => {
        const yaml = renderFragment(site({ routing: 'clean-urls' }), OPTIONS)
        expect(yaml).toContain('\n    routing: clean-urls\n')
    })

    it('omits routing when explicitly static', () => {
        const yaml = renderFragment(site({ routing: 'static' }), OPTIONS)
        expect(yaml).not.toContain('routing:')
    })

    it('emits a quoted not_found path (leading slash is not plain-safe)', () => {
        const yaml = renderFragment(site({ notFound: '/404.html' }), OPTIONS)
        expect(yaml).toContain('\n    not_found: "/404.html"\n')
    })

    it('emits cache_assets: true only when enabled', () => {
        expect(renderFragment(site({ cacheAssets: true }), OPTIONS)).toContain('\n    cache_assets: true\n')
        expect(renderFragment(site({ cacheAssets: false }), OPTIONS)).not.toContain('cache_assets')
    })

    it('keeps serving keys at the site level, outside the source block', () => {
        const yaml = renderFragment(site({ routing: 'spa', cacheAssets: true }), OPTIONS)
        const sourceStart = yaml.indexOf('    source:')
        const routingAt = yaml.indexOf('    routing:')
        // Four-space indent = site level (source children are six-space).
        expect(routingAt).toBeGreaterThan(sourceStart)
        expect(yaml).not.toContain('      routing:')
    })
})

describe('checkRouting', () => {
    it('normalizes empty / null / static to undefined', () => {
        for (const raw of [undefined, null, '', '  ', 'static']) {
            const c = checkRouting(raw)
            expect(c.ok).toBe(true)
            if (c.ok) expect(c.value).toBeUndefined()
        }
    })

    it('accepts spa and clean-urls', () => {
        for (const raw of ['spa', 'clean-urls']) {
            const c = checkRouting(raw)
            expect(c.ok).toBe(true)
            if (c.ok) expect(c.value).toBe(raw)
        }
    })

    it('rejects unknown modes', () => {
        const c = checkRouting('hybrid')
        expect(c.ok).toBe(false)
        if (!c.ok) expect(c.reason).toBe('enum')
    })
})

describe('checkNotFound', () => {
    it('normalizes empty / null to undefined', () => {
        for (const raw of [undefined, null, '', '  ']) {
            const c = checkNotFound(raw)
            expect(c.ok).toBe(true)
            if (c.ok) expect(c.value).toBeUndefined()
        }
    })

    it('accepts absolute clean paths', () => {
        for (const raw of ['/404.html', '/errors/not-found.html']) {
            const c = checkNotFound(raw)
            expect(c.ok).toBe(true)
            if (c.ok) expect(c.value).toBe(raw)
        }
    })

    it('rejects relative paths, traversal, and bad charsets', () => {
        for (const [raw, reason] of [
            ['404.html', 'traversal'],
            ['/../404.html', 'traversal'],
            ['/a//b.html', 'charset'],
            ['/404 page.html', 'charset'],
        ] as const) {
            const c = checkNotFound(raw)
            expect(c.ok).toBe(false)
            if (!c.ok) expect(c.reason).toBe(reason)
        }
    })
})

describe('deploy machine update — serving changes', () => {
    /** In-memory deps: record every port call so the sequencing can be asserted. */
    function makeDeps() {
        const calls: string[] = []
        const deps: DeployDeps = {
            client: {
                writeFragment: async (s) => {
                    calls.push(`writeFragment routing=${s.routing ?? 'static'} notFound=${s.notFound ?? '-'} cache=${!!s.cacheAssets}`)
                    return s.hostname
                },
                removeFragment: async () => void calls.push('removeFragment'),
                reload: async () => void calls.push('reload'),
                sync: async () => void calls.push('sync'),
                status: async () => ({ sites: [] }) as never,
            },
            store: {
                updateStatus: (_id, status) => void calls.push(`updateStatus ${status}`),
                updateLastError: () => void calls.push('updateLastError'),
                updateLastRef: () => void calls.push('updateLastRef'),
                updateBytes: () => void calls.push('updateBytes'),
                updateSource: (_id, branch, subdir) => void calls.push(`updateSource ${branch} ${subdir ?? '-'}`),
                updateServing: (_id, routing, notFound, cacheAssets) =>
                    void calls.push(`updateServing ${routing ?? 'static'} ${notFound ?? '-'} ${cacheAssets}`),
                remove: () => void calls.push('remove'),
            },
            fragmentOptions: () => OPTIONS,
            audit: (action) => void calls.push(`audit ${action}`),
            now: () => '2026-07-12T01:00:00.000Z',
            sleep: async () => {},
        }
        return { deps, calls }
    }

    it('a serving-only change persists and re-renders (no source write)', async () => {
        const { deps, calls } = makeDeps()
        const next = await update(deps, site(), { routing: 'spa', cacheAssets: true })
        expect(next.routing).toBe('spa')
        expect(next.cacheAssets).toBe(true)
        expect(next.status).toBe('provisioning')
        expect(calls).toContain('updateServing spa - true')
        expect(calls).toContain('writeFragment routing=spa notFound=- cache=true')
        expect(calls).toContain('reload')
        expect(calls).toContain('sync')
        expect(calls.some((c) => c.startsWith('updateSource'))).toBe(false)
    })

    it('clearing the 404 page (notFound: null) is a real change', async () => {
        const { deps, calls } = makeDeps()
        const next = await update(deps, site({ notFound: '/404.html' }), { notFound: null })
        expect(next.notFound).toBeUndefined()
        expect(calls).toContain('updateServing static - false')
    })

    it('a no-op serving change short-circuits without touching nginxpilot', async () => {
        const { deps, calls } = makeDeps()
        const before = site({ routing: 'spa', cacheAssets: true })
        const next = await update(deps, before, { routing: 'spa', cacheAssets: true })
        expect(next).toBe(before)
        expect(calls).toHaveLength(0)
    })

    it('a branch change alone leaves serving untouched but re-renders with stored settings', async () => {
        const { deps, calls } = makeDeps()
        await update(deps, site({ routing: 'clean-urls', notFound: '/404.html' }), { branch: 'release' })
        expect(calls).toContain('updateSource release -')
        expect(calls.some((c) => c.startsWith('updateServing'))).toBe(false)
        expect(calls).toContain('writeFragment routing=clean-urls notFound=/404.html cache=false')
    })
})
