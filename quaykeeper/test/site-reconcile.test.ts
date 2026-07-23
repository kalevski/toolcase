import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Exercises the site-fragment drift reconcile (deploy.reconcileRealmSites): a daemon
// that lost a live site's fragment (redeployed container, wiped volume) gets it
// re-pushed; a fragment whose live config drifted from the stored row (restored
// backup) is rewritten; queued orphan removals (a forced delete / rehost the daemon
// missed) are retried until the daemon confirms. Real sqlite DB + repos (same pattern
// as log-bindings.test.ts); only the nginxpilot client is faked.

vi.mock('@/server/services/realms', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/server/services/realms')>()
    return { ...actual, clientFor: vi.fn(), clientForSite: vi.fn() }
})

let deploy: typeof import('@/server/services/deploy')
let realms: typeof import('@/server/services/realms')
let realmRepo: typeof import('@/server/data/repositories/realm-repo')
let userRepo: typeof import('@/server/data/repositories/user-repo')
let siteRepo: typeof import('@/server/data/repositories/site-repo')
let siteRemovalRepo: typeof import('@/server/data/repositories/site-removal-repo')
let fragment: typeof import('@/server/domain/nginxpilot-fragment')

const REALM_ID = 'realm_test'
const OWNER = 7

type Site = import('@/server/domain/types').Site

function site(overrides: Partial<Site> = {}): Site {
    const now = new Date().toISOString()
    return {
        id: overrides.id ?? `s${Math.random().toString(36).slice(2, 10)}`,
        ownerId: OWNER,
        repoOwner: 'acme',
        repoName: 'web',
        repoPrivate: false,
        branch: 'main',
        hostname: 'a.example.dev',
        hostKind: 'subdomain',
        status: 'live',
        realmId: REALM_ID,
        createdAt: now,
        updatedAt: now,
        ...overrides,
    }
}

/** The live `GET /sites` entry that exactly matches the default `site()` fragment. */
function liveConfigFor(s: Site) {
    return {
        domain: s.hostname,
        source: { type: 'git', url: `https://github.com/${s.repoOwner}/${s.repoName}.git`, branch: s.branch },
    }
}

function fakeClient(overrides: Record<string, (...args: unknown[]) => unknown> = {}) {
    return {
        listSites: vi.fn().mockResolvedValue([]),
        writeFragment: vi.fn().mockResolvedValue('ok'),
        removeFragment: vi.fn().mockResolvedValue(undefined),
        sync: vi.fn().mockResolvedValue(undefined),
        putGitCredential: vi.fn().mockResolvedValue({ status: 'created', name: 'x', path: '/creds/x' }),
        ...overrides,
    }
}

beforeAll(async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'qk-site-reconcile-test-'))
    process.env.QUAYKEEPER_DB_PATH = path.join(dir, 'test.db')
    process.env.QUAYKEEPER_GITHUB_CLIENT_ID = 'test'
    process.env.QUAYKEEPER_GITHUB_CLIENT_SECRET = 'test'
    process.env.QUAYKEEPER_OAUTH_REDIRECT_URI = 'http://localhost/cb'
    process.env.QUAYKEEPER_AUTH_SECRET = 'x'.repeat(48)
    const db = await import('@/server/data/db')
    db.initDb()

    realmRepo = await import('@/server/data/repositories/realm-repo')
    userRepo = await import('@/server/data/repositories/user-repo')
    siteRepo = await import('@/server/data/repositories/site-repo')
    siteRemovalRepo = await import('@/server/data/repositories/site-removal-repo')
    deploy = await import('@/server/services/deploy')
    realms = await import('@/server/services/realms')
    fragment = await import('@/server/domain/nginxpilot-fragment')

    realmRepo.create(
        { id: REALM_ID, name: 'test-realm', adminUrl: 'https://nginxpilot.example.com', isDefault: true, createdAt: new Date().toISOString() },
        null,
    )
    userRepo.insert({ githubId: OWNER, login: 'acme', name: 'Acme', role: 'standard', addedAt: new Date().toISOString() })
})

beforeEach(() => {
    for (const s of siteRepo.list()) siteRepo.remove(s.id)
    for (const p of siteRemovalRepo.listByRealm(REALM_ID)) siteRemovalRepo.remove(REALM_ID, p.domain)
    vi.mocked(realms.clientFor).mockReset()
})

describe('fragmentDrifted', () => {
    it('is false when the live config echoes the stored row', () => {
        const s = site()
        expect(fragment.fragmentDrifted(s, liveConfigFor(s), undefined)).toBe(false)
    })

    it('detects source drift (branch / url / subdir)', () => {
        const s = site()
        expect(fragment.fragmentDrifted(s, { ...liveConfigFor(s), source: { type: 'git', url: `https://github.com/acme/web.git`, branch: 'old' } }, undefined)).toBe(true)
        expect(fragment.fragmentDrifted(s, { ...liveConfigFor(s), source: { type: 'git', url: 'https://github.com/else/where.git', branch: 'main' } }, undefined)).toBe(true)
        expect(fragment.fragmentDrifted({ ...s, subdir: 'dist' }, liveConfigFor(s), undefined)).toBe(true)
    })

    it('detects serving-settings drift (routing / 404 / toggles)', () => {
        const s = site()
        expect(fragment.fragmentDrifted({ ...s, routing: 'spa' }, liveConfigFor(s), undefined)).toBe(true)
        expect(fragment.fragmentDrifted(s, { ...liveConfigFor(s), routing: 'spa' }, undefined)).toBe(true)
        expect(fragment.fragmentDrifted({ ...s, notFound: '/404.html' }, liveConfigFor(s), undefined)).toBe(true)
        expect(fragment.fragmentDrifted(s, { ...liveConfigFor(s), gzip: true }, undefined)).toBe(true)
        expect(fragment.fragmentDrifted(s, liveConfigFor(s), { gzip: true })).toBe(true)
        expect(fragment.fragmentDrifted(s, { ...liveConfigFor(s), gzip: true }, { gzip: true })).toBe(false)
    })

    it('treats absent routing as static and absent tls as off', () => {
        const s = site({ routing: 'static' })
        expect(fragment.fragmentDrifted(s, liveConfigFor(s), undefined)).toBe(false)
        expect(fragment.fragmentDrifted(s, { ...liveConfigFor(s), tls: 'auto' }, undefined)).toBe(true)
    })
})

describe('reconcileRealmSites', () => {
    it('re-pushes a live site whose fragment the daemon lost', async () => {
        const s = site()
        siteRepo.create(s)
        const client = fakeClient()
        vi.mocked(realms.clientFor).mockReturnValue(client as any)

        const result = await deploy.reconcileRealmSites(REALM_ID)
        expect(result).toEqual({ repushed: 1, removed: 0, failed: 0 })
        expect(client.writeFragment).toHaveBeenCalledTimes(1)
        expect(client.sync).toHaveBeenCalledWith(s.hostname)
    })

    it('leaves a matching fragment alone', async () => {
        const s = site()
        siteRepo.create(s)
        const client = fakeClient({ listSites: vi.fn().mockResolvedValue([liveConfigFor(s)]) })
        vi.mocked(realms.clientFor).mockReturnValue(client as any)

        const result = await deploy.reconcileRealmSites(REALM_ID)
        expect(result).toEqual({ repushed: 0, removed: 0, failed: 0 })
        expect(client.writeFragment).not.toHaveBeenCalled()
    })

    it('re-pushes a drifted fragment (stale branch on the daemon)', async () => {
        const s = site()
        siteRepo.create(s)
        const stale = { ...liveConfigFor(s), source: { type: 'git', url: `https://github.com/acme/web.git`, branch: 'old' } }
        const client = fakeClient({ listSites: vi.fn().mockResolvedValue([stale]) })
        vi.mocked(realms.clientFor).mockReturnValue(client as any)

        const result = await deploy.reconcileRealmSites(REALM_ID)
        expect(result.repushed).toBe(1)
        expect(client.writeFragment).toHaveBeenCalledTimes(1)
    })

    it('skips suspended / provisioning / failed sites', async () => {
        siteRepo.create(site({ hostname: 'x.example.dev', status: 'suspended' }))
        siteRepo.create(site({ hostname: 'y.example.dev', status: 'provisioning' }))
        siteRepo.create(site({ hostname: 'z.example.dev', status: 'failed' }))
        const client = fakeClient()
        vi.mocked(realms.clientFor).mockReturnValue(client as any)

        const result = await deploy.reconcileRealmSites(REALM_ID)
        expect(result.repushed).toBe(0)
        expect(client.writeFragment).not.toHaveBeenCalled()
    })

    it('retries a queued orphan removal and dequeues it once the daemon confirms', async () => {
        siteRemovalRepo.enqueue(REALM_ID, 'gone.example.dev', 'delete', new Date().toISOString())
        const client = fakeClient()
        vi.mocked(realms.clientFor).mockReturnValue(client as any)

        const result = await deploy.reconcileRealmSites(REALM_ID)
        expect(result.removed).toBe(1)
        expect(client.removeFragment).toHaveBeenCalledWith('gone.example.dev')
        expect(siteRemovalRepo.listByRealm(REALM_ID)).toHaveLength(0)
    })

    it('keeps a queued removal (attempts bumped) when the daemon still refuses', async () => {
        siteRemovalRepo.enqueue(REALM_ID, 'gone.example.dev', 'delete', new Date().toISOString())
        const client = fakeClient({ removeFragment: vi.fn().mockRejectedValue(new Error('down')) })
        vi.mocked(realms.clientFor).mockReturnValue(client as any)

        const result = await deploy.reconcileRealmSites(REALM_ID)
        expect(result.removed).toBe(0)
        expect(result.failed).toBe(1)
        const pending = siteRemovalRepo.listByRealm(REALM_ID)
        expect(pending).toHaveLength(1)
        expect(pending[0].attempts).toBe(1)
    })

    it('drops a stale removal without touching the daemon when a new site claimed the domain', async () => {
        const s = site({ hostname: 'reused.example.dev' })
        siteRepo.create(s)
        siteRemovalRepo.enqueue(REALM_ID, s.hostname, 'rehost', new Date().toISOString())
        const client = fakeClient({ listSites: vi.fn().mockResolvedValue([liveConfigFor(s)]) })
        vi.mocked(realms.clientFor).mockReturnValue(client as any)

        const result = await deploy.reconcileRealmSites(REALM_ID)
        expect(result.removed).toBe(0)
        expect(client.removeFragment).not.toHaveBeenCalled()
        expect(siteRemovalRepo.listByRealm(REALM_ID)).toHaveLength(0)
    })
})

describe('retractFragment', () => {
    it('removes the fragment directly when the daemon answers', async () => {
        const client = fakeClient()
        vi.mocked(realms.clientFor).mockReturnValue(client as any)

        await deploy.retractFragment(REALM_ID, 'old.example.dev', 'rehost')
        expect(client.removeFragment).toHaveBeenCalledWith('old.example.dev')
        expect(siteRemovalRepo.listByRealm(REALM_ID)).toHaveLength(0)
    })

    it('queues a durable retry when the daemon is unreachable', async () => {
        const client = fakeClient({ removeFragment: vi.fn().mockRejectedValue(new Error('refused')) })
        vi.mocked(realms.clientFor).mockReturnValue(client as any)

        await deploy.retractFragment(REALM_ID, 'old.example.dev', 'rehost')
        const pending = siteRemovalRepo.listByRealm(REALM_ID)
        expect(pending).toHaveLength(1)
        expect(pending[0]).toMatchObject({ domain: 'old.example.dev', reason: 'rehost' })
    })
})
