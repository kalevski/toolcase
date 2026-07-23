import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Exercises adoption of a site discovered on a connected instance (sites.adoptSite +
// the pure domain/site-adopt.ts mapping): the created row must mirror the daemon's
// live config VERBATIM — adopting must never make the drift reconcile rewrite the
// running fragment — and the whole flow is owner-only. Real sqlite DB + repos (same
// pattern as site-reconcile.test.ts); only the nginxpilot client is faked.

vi.mock('@/server/services/realms', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/server/services/realms')>()
    return { ...actual, clientFor: vi.fn(), clientForSite: vi.fn() }
})

let sites: typeof import('@/server/services/sites')
let realms: typeof import('@/server/services/realms')
let realmRepo: typeof import('@/server/data/repositories/realm-repo')
let userRepo: typeof import('@/server/data/repositories/user-repo')
let siteRepo: typeof import('@/server/data/repositories/site-repo')
let siteRemovalRepo: typeof import('@/server/data/repositories/site-removal-repo')
let baseDomainRepo: typeof import('@/server/data/repositories/base-domain-repo')
let fragment: typeof import('@/server/domain/nginxpilot-fragment')
let adopt: typeof import('@/server/domain/site-adopt')
let types: typeof import('@/server/domain/types')

const REALM_ID = 'realm_adopt'
const OWNER = 11
const viewer = { sub: OWNER, role: 'owner' as const }

type LiveSiteConfig = import('@/server/domain/nginxpilot-fragment').LiveSiteConfig

function live(overrides: Partial<LiveSiteConfig> = {}): LiveSiteConfig {
    return {
        domain: 'legacy.example.com',
        source: { type: 'git', url: 'https://gitlab.com/acme/legacy.git', branch: 'main' },
        ...overrides,
    }
}

function fakeClient(sitesList: LiveSiteConfig[], statusSites: unknown[] = []) {
    return {
        listSites: vi.fn().mockResolvedValue(sitesList),
        status: vi.fn().mockResolvedValue({ sites: statusSites }),
        writeFragment: vi.fn(),
        sync: vi.fn(),
    }
}

beforeAll(async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'qk-site-adopt-test-'))
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
    baseDomainRepo = await import('@/server/data/repositories/base-domain-repo')
    sites = await import('@/server/services/sites')
    realms = await import('@/server/services/realms')
    fragment = await import('@/server/domain/nginxpilot-fragment')
    adopt = await import('@/server/domain/site-adopt')
    types = await import('@/server/domain/types')

    realmRepo.create(
        { id: REALM_ID, name: 'adopt-realm', adminUrl: 'https://nginxpilot.example.com', isDefault: true, createdAt: new Date().toISOString() },
        null,
    )
    userRepo.insert({ githubId: OWNER, login: 'op', name: 'Operator', role: 'owner', addedAt: new Date().toISOString() })
    userRepo.insert({ githubId: 99, login: 'std', name: 'Standard', role: 'standard', addedAt: new Date().toISOString() })
    baseDomainRepo.add('sites.example.dev', 'auto', true, false, REALM_ID)
})

beforeEach(() => {
    for (const s of siteRepo.list()) siteRepo.remove(s.id)
    for (const p of siteRemovalRepo.listByRealm(REALM_ID)) siteRemovalRepo.remove(REALM_ID, p.domain)
    vi.mocked(realms.clientFor).mockReset()
})

describe('classifyAdoptedHost', () => {
    it('classifies a single label under a base domain as a subdomain', () => {
        expect(adopt.classifyAdoptedHost('blog.sites.example.dev', ['sites.example.dev'])).toBe('subdomain')
    })

    it('treats deeper nesting, the apex, and foreign domains as custom', () => {
        expect(adopt.classifyAdoptedHost('a.b.sites.example.dev', ['sites.example.dev'])).toBe('custom')
        expect(adopt.classifyAdoptedHost('sites.example.dev', ['sites.example.dev'])).toBe('custom')
        expect(adopt.classifyAdoptedHost('www.example.com', ['sites.example.dev'])).toBe('custom')
    })
})

describe('parseGoDurationSeconds', () => {
    it('parses the daemon-emitted duration strings', () => {
        expect(adopt.parseGoDurationSeconds('15m0s')).toBe(900)
        expect(adopt.parseGoDurationSeconds('1h0m0s')).toBe(3600)
        expect(adopt.parseGoDurationSeconds('30s')).toBe(30)
    })

    it('returns undefined for absent, zero, or malformed values', () => {
        expect(adopt.parseGoDurationSeconds(undefined)).toBeUndefined()
        expect(adopt.parseGoDurationSeconds('0s')).toBeUndefined()
        expect(adopt.parseGoDurationSeconds('soon')).toBeUndefined()
    })
})

describe('adoptedSiteFields', () => {
    it('collapses an exact GitHub HTTPS URL into the classic coordinate form', () => {
        const fields = adopt.adoptedSiteFields(
            live({ source: { type: 'git', url: 'https://github.com/acme/web.git', branch: 'main' } }),
            'custom',
        )
        expect(fields.sourceUrl).toBeUndefined()
        expect(fields.repoOwner).toBe('acme')
        expect(fields.repoName).toBe('web')
        expect(fields.repoPrivate).toBe(false)
    })

    it('keeps the GitHub OAuth path available for a github-token source', () => {
        const fields = adopt.adoptedSiteFields(
            live({ source: { type: 'git', url: 'https://github.com/acme/web.git', branch: 'main', auth: { method: 'github-token' } } }),
            'custom',
        )
        expect(fields.repoPrivate).toBe(true)
        expect(fields.authMethod).toBe('github-token')
        // No sourceUrl → usesGithubOAuthCredential, so future fragments render auth
        // from the owner's OAuth token without any re-entered credential.
        expect(fields.sourceUrl).toBeUndefined()
    })

    it('keeps a non-GitHub authenticated source verbatim, flagged private', () => {
        const fields = adopt.adoptedSiteFields(
            live({ source: { type: 'git', url: 'git@gitlab.com:acme/legacy.git', branch: 'main', auth: { method: 'ssh-key' } } }),
            'custom',
        )
        expect(fields.sourceUrl).toBe('git@gitlab.com:acme/legacy.git')
        expect(fields.authMethod).toBe('ssh-key')
        expect(fields.repoPrivate).toBe(true)
    })

    it('maps http-zip fields and skips git-only ones', () => {
        const fields = adopt.adoptedSiteFields(
            {
                domain: 'zip.example.com',
                source: {
                    type: 'http-zip',
                    url: 'https://ci.example.com/site.zip',
                    checksum_url: 'https://ci.example.com/site.zip.sha256',
                    strip_components: 1,
                    allow_insecure: true,
                    auth: { method: 'header', name: 'X-Api-Key' },
                },
            },
            'custom',
        )
        expect(fields.sourceType).toBe('http-zip')
        expect(fields.checksumUrl).toBe('https://ci.example.com/site.zip.sha256')
        expect(fields.stripComponents).toBe(1)
        expect(fields.allowInsecure).toBe(true)
        expect(fields.authHeaderName).toBe('X-Api-Key')
        expect(fields.subdir).toBeUndefined()
    })

    it('records TLS/HSTS only for a custom domain', () => {
        const config = live({ tls: 'required', hsts: { enabled: true } })
        expect(adopt.adoptedSiteFields(config, 'custom').tls).toBe('required')
        expect(adopt.adoptedSiteFields(config, 'custom').hsts).toBe(true)
        expect(adopt.adoptedSiteFields(config, 'subdomain').tls).toBeUndefined()
        expect(adopt.adoptedSiteFields(config, 'subdomain').hsts).toBeUndefined()
    })

    it('mirrors list fields so a future render reproduces the fragment', () => {
        // Absent on the daemon = the fragment names none — "explicitly none", never the default.
        const bare = adopt.adoptedSiteFields(live(), 'custom')
        expect(bare.requireFile).toEqual([])
        expect(bare.exclude).toEqual([])
        // The renderer's own defaults collapse to undefined (inherit).
        const dflt = adopt.adoptedSiteFields(
            live({ source: { type: 'git', url: 'x', require_file: ['index.html'] }, exclude: ['*.map'] }),
            'custom',
        )
        expect(dflt.requireFile).toBeUndefined()
        expect(dflt.exclude).toBeUndefined()
    })
})

describe('adoptSite', () => {
    it('creates a row that mirrors the live config with zero drift', async () => {
        const config = live({
            source: { type: 'git', url: 'https://gitlab.com/acme/legacy.git', branch: 'release', subdir: 'dist', interval: '15m0s', keep_releases: 3 },
            routing: 'spa',
            cache_assets: true,
            tls: 'auto',
            gzip: true,
            block_exploits: true,
        })
        vi.mocked(realms.clientFor).mockReturnValue(
            fakeClient([config], [{ domain: config.domain, bytes: 1234, deployed_ref: 'abc123' }]) as any,
        )

        const site = await sites.adoptSite(viewer, { realmId: REALM_ID, domain: config.domain })
        expect(site.hostname).toBe('legacy.example.com')
        expect(site.hostKind).toBe('custom')
        expect(site.status).toBe('live')
        expect(site.realmId).toBe(REALM_ID)
        expect(site.branch).toBe('release')
        expect(site.subdir).toBe('dist')
        expect(site.intervalSec).toBe(900)
        expect(site.keepReleases).toBe(3)
        expect(site.bytes).toBe(1234)
        expect(site.lastRef).toBe('abc123')
        expect(siteRepo.get(site.id)).toBeDefined()

        // The whole point: the adopted row reproduces the running fragment verbatim,
        // so the reconcile loop sees no drift and never rewrites the daemon's config.
        const options = fragment.resolveFragmentOptions(site, types.UNLIMITED_LIMITS, undefined)
        expect(fragment.fragmentDrifted(site, config, options.web)).toBe(false)
    })

    it('classifies a discovered label under a registered base domain as a subdomain', async () => {
        const config = live({ domain: 'blog.sites.example.dev', tls: 'auto' })
        vi.mocked(realms.clientFor).mockReturnValue(fakeClient([config]) as any)

        const site = await sites.adoptSite(viewer, { realmId: REALM_ID, domain: config.domain })
        expect(site.hostKind).toBe('subdomain')
        expect(site.tls).toBeUndefined()
    })

    it('clears a queued fragment retraction for the readopted domain', async () => {
        const config = live()
        siteRemovalRepo.enqueue(REALM_ID, config.domain, 'delete', new Date().toISOString())
        vi.mocked(realms.clientFor).mockReturnValue(fakeClient([config]) as any)

        await sites.adoptSite(viewer, { realmId: REALM_ID, domain: config.domain })
        expect(siteRemovalRepo.listByRealm(REALM_ID)).toEqual([])
    })

    it('survives a /status hiccup — the runtime snapshot is best-effort', async () => {
        const client = fakeClient([live()])
        client.status.mockRejectedValue(new Error('down'))
        vi.mocked(realms.clientFor).mockReturnValue(client as any)

        const site = await sites.adoptSite(viewer, { realmId: REALM_ID, domain: 'legacy.example.com' })
        expect(site.status).toBe('live')
        expect(site.bytes).toBeUndefined()
    })

    it('rejects a domain the instance does not serve (404)', async () => {
        vi.mocked(realms.clientFor).mockReturnValue(fakeClient([]) as any)
        await expect(sites.adoptSite(viewer, { realmId: REALM_ID, domain: 'ghost.example.com' })).rejects.toMatchObject(
            { code: 'not_found_on_instance', status: 404 },
        )
    })

    it('rejects a domain a stored site already claims (409)', async () => {
        const config = live()
        vi.mocked(realms.clientFor).mockReturnValue(fakeClient([config]) as any)
        await sites.adoptSite(viewer, { realmId: REALM_ID, domain: config.domain })
        await expect(sites.adoptSite(viewer, { realmId: REALM_ID, domain: config.domain })).rejects.toMatchObject({
            code: 'already_managed',
            status: 409,
        })
    })

    it('is owner-only (403 for a standard caller)', async () => {
        await expect(
            sites.adoptSite({ sub: 99, role: 'standard' }, { realmId: REALM_ID, domain: 'legacy.example.com' }),
        ).rejects.toMatchObject({ code: 'forbidden', status: 403 })
    })
})
