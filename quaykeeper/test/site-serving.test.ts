import { describe, it, expect } from 'vitest'
import {
    renderFragment,
    resolveIntervalSec,
    resolveKeepReleases,
    resolveWebOptions,
} from '@/server/domain/nginxpilot-fragment'
import {
    checkAdvanced,
    checkExclude,
    checkSourceSpec,
    checkSourceUrl,
    describeSourceUrl,
    checkIntervalSec,
    checkKeepReleases,
    checkNotFound,
    checkRequireFile,
    checkRouting,
    checkSiteTls,
} from '@/server/domain/site-input'
import { update, type DeployDeps } from '@/server/domain/deploy-machine'
import {
    siteSettings,
    siteSource,
    STANDARD_LIMITS,
    UNLIMITED_LIMITS,
    usesGithubOAuthCredential,
    type BaseDomain,
    type Site,
    type SiteSettings,
    type SiteSource,
} from '@/server/domain/types'

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
                updateSource: (_id, src) =>
                    void calls.push(`updateSource ${src.branch} ${src.subdir ?? '-'}`),
                updateSettings: (_id, s) =>
                    void calls.push(
                        `updateSettings ${s.routing ?? 'static'} ${s.notFound ?? '-'} ${!!s.cacheAssets}`,
                    ),
                remove: () => void calls.push('remove'),
            },
            fragmentOptions: () => OPTIONS,
            audit: (action) => void calls.push(`audit ${action}`),
            now: () => '2026-07-12T01:00:00.000Z',
            sleep: async () => {},
        }
        return { deps, calls }
    }

    it('a settings-only change persists and re-renders (no source write)', async () => {
        const { deps, calls } = makeDeps()
        const before = site()
        const next = await update(deps, before, {
            settings: { ...siteSettings(before), routing: 'spa', cacheAssets: true },
        })
        expect(next.routing).toBe('spa')
        expect(next.cacheAssets).toBe(true)
        expect(next.status).toBe('provisioning')
        expect(calls).toContain('updateSettings spa - true')
        expect(calls).toContain('writeFragment routing=spa notFound=- cache=true')
        expect(calls).toContain('reload')
        expect(calls).toContain('sync')
        expect(calls.some((c) => c.startsWith('updateSource'))).toBe(false)
    })

    it('clearing the 404 page is a real change', async () => {
        const { deps, calls } = makeDeps()
        const before = site({ notFound: '/404.html' })
        const next = await update(deps, before, {
            settings: { ...siteSettings(before), notFound: undefined },
        })
        expect(next.notFound).toBeUndefined()
        expect(calls).toContain('updateSettings static - false')
    })

    it('a no-op settings change short-circuits without touching nginxpilot', async () => {
        const { deps, calls } = makeDeps()
        const before = site({ routing: 'spa', cacheAssets: true })
        const next = await update(deps, before, { settings: siteSettings(before) })
        expect(next).toBe(before)
        expect(calls).toHaveLength(0)
    })

    it('a branch change alone leaves settings untouched but re-renders with the stored ones', async () => {
        const { deps, calls } = makeDeps()
        const before = site({ routing: 'clean-urls', notFound: '/404.html' })
        await update(deps, before, { source: { ...siteSource(before), branch: 'release' } })
        expect(calls).toContain('updateSource release -')
        expect(calls.some((c) => c.startsWith('updateSettings'))).toBe(false)
        expect(calls).toContain('writeFragment routing=clean-urls notFound=/404.html cache=false')
    })

    // Changing anything in the source group alters nginxpilot's source fingerprint, so
    // each member has to be detected — a missed one would leave the row and the daemon
    // disagreeing about where the content comes from.
    it('detects a change in every source field', async () => {
        const before = site()
        const variants: Partial<SiteSource>[] = [
            { branch: 'release' },
            { subdir: 'dist' },
            { sourceType: 'http-zip' },
            { sourceUrl: 'https://gitlab.com/acme/site.git' },
            { authMethod: 'ssh-key' },
            { authUsername: 'deploy' },
            { authHeaderName: 'X-Api-Key' },
            { checksumUrl: 'https://example.com/site.zip.sha256' },
            { stripComponents: 1 },
            { allowInsecure: true },
        ]
        for (const variant of variants) {
            const { deps, calls } = makeDeps()
            const next = await update(deps, before, { source: { ...siteSource(before), ...variant } })
            expect(next.status, `${Object.keys(variant)[0]} should be a change`).toBe('provisioning')
            expect(calls.some((c) => c.startsWith('updateSource'))).toBe(true)
        }
    })

    it('treats an absent source type as git', async () => {
        const { deps, calls } = makeDeps()
        const before = site()
        const next = await update(deps, before, { source: { ...siteSource(before), sourceType: 'git' } })
        expect(next).toBe(before)
        expect(calls).toHaveLength(0)
    })

    // The settings group covers far more than routing now, so change detection has to
    // notice each member — a missed field would silently skip the DB write while still
    // re-rendering the fragment, leaving the row and nginxpilot disagreeing.
    it('detects a change in every settings field', async () => {
        const before = site()
        const variants: SiteSettings[] = [
            { gzip: true },
            { blockExploits: true },
            { advanced: 'add_header X-Test 1;' },
            { exclude: ['*.txt'] },
            { requireFile: ['200.html'] },
            { keepReleases: 3 },
            { intervalSec: 3600 },
        ]
        for (const variant of variants) {
            const { deps, calls } = makeDeps()
            const next = await update(deps, before, { settings: { ...siteSettings(before), ...variant } })
            expect(next.status, `${Object.keys(variant)[0]} should be a change`).toBe('provisioning')
            expect(calls.some((c) => c.startsWith('updateSettings'))).toBe(true)
        }
    })

    // `undefined` (inherit the default) and `[]` (explicitly none) render differently —
    // `require_file: []` drops the post-fetch gate entirely — so they must not compare equal.
    it('treats an empty list as different from an absent one', async () => {
        const { deps, calls } = makeDeps()
        const before = site()
        const next = await update(deps, before, { settings: { ...siteSettings(before), requireFile: [] } })
        expect(next.requireFile).toEqual([])
        expect(calls.some((c) => c.startsWith('updateSettings'))).toBe(true)
    })
})

// The wildcard-wide HTTP/2 policy (BaseDomain.http2). It reaches the fragment as a
// SiteWebOptions field, so these assertions pin the emitted bytes; the per-base
// inheritance itself lives in `services/deploy.ts` resolveWebOptions.
describe('renderFragment — http2 web option', () => {
    it('emits http2: true alongside tls when enabled', () => {
        const yaml = renderFragment(site(), {
            ...OPTIONS,
            web: { tls: 'auto', force_ssl: true, http2: true },
        })
        expect(yaml).toContain('\n    tls: auto\n')
        expect(yaml).toContain('\n    force_ssl: true\n')
        expect(yaml).toContain('\n    http2: true\n')
    })

    it('omits http2 entirely when disabled (no `http2: false` key)', () => {
        const yaml = renderFragment(site(), {
            ...OPTIONS,
            web: { tls: 'auto', force_ssl: true, http2: false },
        })
        expect(yaml).toContain('\n    tls: auto\n')
        expect(yaml).not.toContain('http2')
    })

    it('emits no web keys at all when the base domain is HTTP-only', () => {
        // resolveWebOptions returns undefined for `tls: off` bases, so http2 can never
        // reach nginxpilot without TLS — which it rejects outright ("http2 requires tls").
        const yaml = renderFragment(site(), OPTIONS)
        expect(yaml).not.toContain('tls:')
        expect(yaml).not.toContain('http2')
    })

    it('keeps http2 at the site level, outside the source block', () => {
        const yaml = renderFragment(site(), { ...OPTIONS, web: { tls: 'auto', http2: true } })
        const sourceStart = yaml.indexOf('    source:')
        const http2At = yaml.indexOf('    http2:')
        expect(http2At).toBeGreaterThan(sourceStart)
        // Four-space indent = site level (source children are six-space).
        expect(yaml).toContain('\n    http2: true\n')
    })
})

// The web toggles the renderer could always emit but no caller ever populated
// (missing_features.md §1). `resolveWebOptions` in services/deploy.ts is what now
// fills them; these pin the bytes each one produces.
describe('renderFragment — hsts / gzip / block_exploits / advanced', () => {
    it('emits hsts as a bare bool alongside tls', () => {
        const yaml = renderFragment(site(), { ...OPTIONS, web: { tls: 'auto', force_ssl: true, hsts: true } })
        expect(yaml).toContain('\n    hsts: true\n')
    })

    it('emits gzip and block_exploits with no TLS at all', () => {
        const yaml = renderFragment(site(), { ...OPTIONS, web: { gzip: true, block_exploits: true } })
        expect(yaml).toContain('\n    gzip: true\n')
        expect(yaml).toContain('\n    block_exploits: true\n')
        expect(yaml).not.toContain('tls:')
    })

    it('omits every toggle that is false (no `gzip: false` keys)', () => {
        const yaml = renderFragment(site(), {
            ...OPTIONS,
            web: { tls: 'auto', hsts: false, gzip: false, block_exploits: false },
        })
        expect(yaml).not.toContain('hsts')
        expect(yaml).not.toContain('gzip')
        expect(yaml).not.toContain('block_exploits')
    })

    it('emits tls: required verbatim (the "HTTPS or nothing" mode)', () => {
        const yaml = renderFragment(site(), { ...OPTIONS, web: { tls: 'required', force_ssl: true } })
        expect(yaml).toContain('\n    tls: required\n')
    })

    it('renders advanced as an indented literal block scalar', () => {
        const yaml = renderFragment(site(), {
            ...OPTIONS,
            web: { advanced: 'add_header X-Frame-Options DENY;\nclient_max_body_size 20m;' },
        })
        expect(yaml).toContain('\n    advanced: |\n')
        expect(yaml).toContain('\n      add_header X-Frame-Options DENY;\n')
        expect(yaml).toContain('\n      client_max_body_size 20m;\n')
    })

    it('normalizes CRLF inside advanced so no stray \\r reaches nginx', () => {
        const yaml = renderFragment(site(), { ...OPTIONS, web: { advanced: 'a;\r\nb;' } })
        expect(yaml).not.toContain('\r')
        expect(yaml).toContain('\n      a;\n      b;\n')
    })
})

// The source-tree controls that used to be hardcoded (missing_features.md §3).
describe('renderFragment — source controls', () => {
    it('keeps the built-in defaults when the caller passes nothing', () => {
        const yaml = renderFragment(site(), OPTIONS)
        expect(yaml).toContain('require_file: [index.html]')
        expect(yaml).toContain('exclude: ["*.map"]')
        expect(yaml).not.toContain('keep_releases')
    })

    it('emits caller-supplied require_file and exclude lists', () => {
        const yaml = renderFragment(site(), {
            ...OPTIONS,
            requireFile: ['200.html', 'docs/index.html'],
            exclude: ['*.map', 'README.md'],
        })
        expect(yaml).toContain('require_file: [200.html, docs/index.html]')
        expect(yaml).toContain('exclude: ["*.map", README.md]')
    })

    it('drops the gate entirely for an empty require_file', () => {
        const yaml = renderFragment(site(), { ...OPTIONS, requireFile: [], exclude: [] })
        expect(yaml).not.toContain('require_file')
        expect(yaml).not.toContain('exclude')
    })

    it('emits keep_releases inside the source block', () => {
        const yaml = renderFragment(site(), { ...OPTIONS, keepReleases: 3 })
        expect(yaml).toContain('\n      keep_releases: 3\n')
        const sourceStart = yaml.indexOf('    source:')
        expect(yaml.indexOf('      keep_releases:')).toBeGreaterThan(sourceStart)
    })

    it('formats a per-site interval as a Go duration', () => {
        expect(renderFragment(site(), { ...OPTIONS, intervalSec: 3600 })).toContain('interval: 1h')
        expect(renderFragment(site(), { ...OPTIONS, intervalSec: 90 })).toContain('interval: 90s')
    })
})

// Where each web option comes from — the rule the gap analysis called out as the
// missing piece: the renderer could always emit these, but nothing populated them.
describe('resolveWebOptions — cert-scoped vs site-scoped', () => {
    const base = (over: Partial<BaseDomain> = {}): BaseDomain => ({
        domain: 'quaykeeper.dev',
        tls: 'auto',
        http2: true,
        hsts: false,
        realmId: 'default',
        createdAt: '2026-07-12T00:00:00.000Z',
        ...over,
    })

    it('inherits tls / http2 / hsts from the base domain for a subdomain', () => {
        const web = resolveWebOptions(site(), STANDARD_LIMITS, base({ http2: true, hsts: true }))
        expect(web).toEqual({ tls: 'auto', force_ssl: true, http2: true, hsts: true })
    })

    it('emits no TLS for an HTTP-only or unregistered base domain', () => {
        expect(resolveWebOptions(site(), STANDARD_LIMITS, base({ tls: 'off' }))).toBeUndefined()
        expect(resolveWebOptions(site(), STANDARD_LIMITS, undefined)).toBeUndefined()
    })

    it('ignores a subdomain\'s own tls/hsts — the wildcard cert decides', () => {
        const rogue = site({ tls: 'required', hsts: true })
        expect(resolveWebOptions(rogue, STANDARD_LIMITS, base({ http2: false }))).toEqual({
            tls: 'auto',
            force_ssl: true,
            http2: false,
            hsts: false,
        })
    })

    it('uses a custom domain\'s own tri-state, defaulting to auto', () => {
        const custom = site({ hostKind: 'custom', hostname: 'www.example.com' })
        expect(resolveWebOptions(custom, STANDARD_LIMITS)).toEqual({
            tls: 'auto',
            force_ssl: true,
            http2: true,
            hsts: false,
        })
        expect(resolveWebOptions({ ...custom, tls: 'required', hsts: true }, STANDARD_LIMITS)).toEqual({
            tls: 'required',
            force_ssl: true,
            http2: true,
            hsts: true,
        })
        expect(resolveWebOptions({ ...custom, tls: 'off' }, STANDARD_LIMITS)).toBeUndefined()
    })

    it('applies gzip and block_exploits with no TLS involved at all', () => {
        const web = resolveWebOptions(site({ gzip: true, blockExploits: true }), STANDARD_LIMITS)
        expect(web).toEqual({ gzip: true, block_exploits: true })
    })

    it('drops a stored advanced block once the account loses the capability', () => {
        const withAdvanced = site({ advanced: 'add_header X 1;' })
        expect(resolveWebOptions(withAdvanced, UNLIMITED_LIMITS)?.advanced).toBe('add_header X 1;')
        expect(resolveWebOptions(withAdvanced, STANDARD_LIMITS)).toBeUndefined()
    })
})

describe('resolveIntervalSec / resolveKeepReleases', () => {
    it('falls back to the plan floor and lets a site poll slower, never faster', () => {
        expect(resolveIntervalSec(site(), STANDARD_LIMITS)).toBe(900)
        expect(resolveIntervalSec(site({ intervalSec: 3600 }), STANDARD_LIMITS)).toBe(3600)
        // A stored value below the floor (a plan downgrade after the fact) is clamped up
        // rather than honoured — the floor is the plan's guarantee, not a suggestion.
        expect(resolveIntervalSec(site({ intervalSec: 60 }), STANDARD_LIMITS)).toBe(900)
    })

    it('caps rollback depth at the plan value and never goes below 1', () => {
        expect(resolveKeepReleases(site(), STANDARD_LIMITS)).toBe(1)
        expect(resolveKeepReleases(site(), UNLIMITED_LIMITS)).toBe(5)
        expect(resolveKeepReleases(site({ keepReleases: 3 }), UNLIMITED_LIMITS)).toBe(3)
        expect(resolveKeepReleases(site({ keepReleases: 9 }), UNLIMITED_LIMITS)).toBe(5)
        expect(resolveKeepReleases(site({ keepReleases: 0 }), UNLIMITED_LIMITS)).toBe(1)
    })
})

// Source kinds, hosts, and auth methods beyond the original GitHub-only assumption.
describe('renderFragment — source kinds and auth', () => {
    it('derives the GitHub URL when no explicit source URL is stored', () => {
        const yaml = renderFragment(site(), OPTIONS)
        expect(yaml).toContain('      type: git\n')
        expect(yaml).toContain('      url: https://github.com/acme/landing.git\n')
        expect(yaml).toContain('      branch: main\n')
    })

    it('uses an explicit non-GitHub git URL verbatim', () => {
        const yaml = renderFragment(site({ sourceUrl: 'https://gitlab.com/acme/site.git' }), OPTIONS)
        expect(yaml).toContain('      url: https://gitlab.com/acme/site.git\n')
        expect(yaml).not.toContain('github.com')
    })

    it('quotes an scp-style ssh remote (a leading git@ is not plain-safe)', () => {
        const yaml = renderFragment(site({ sourceUrl: 'git@gitea.internal:acme/site.git' }), OPTIONS)
        expect(yaml).toContain('      url: "git@gitea.internal:acme/site.git"\n')
    })

    it('renders an http-zip source with its archive-only fields and no branch', () => {
        const yaml = renderFragment(
            site({
                sourceType: 'http-zip',
                sourceUrl: 'https://ci.example.com/site.zip',
                checksumUrl: 'https://ci.example.com/site.zip.sha256',
                stripComponents: 1,
            }),
            OPTIONS,
        )
        expect(yaml).toContain('      type: http-zip\n')
        expect(yaml).toContain('      url: https://ci.example.com/site.zip\n')
        expect(yaml).toContain('      checksum_url: https://ci.example.com/site.zip.sha256\n')
        expect(yaml).toContain('      strip_components: 1\n')
        expect(yaml).not.toContain('branch:')
        expect(yaml).not.toContain('allow_insecure')
    })

    it('never emits git-only keys on an archive source (nginxpilot rejects them)', () => {
        const yaml = renderFragment(
            site({ sourceType: 'http-zip', sourceUrl: 'https://ci.example.com/site.zip', subdir: 'dist' }),
            OPTIONS,
        )
        expect(yaml).not.toContain('subdir:')
        expect(yaml).not.toContain('branch:')
    })

    it('emits allow_insecure only when set', () => {
        const insecure = site({
            sourceType: 'http-zip',
            sourceUrl: 'http://ci.internal/site.zip',
            allowInsecure: true,
        })
        expect(renderFragment(insecure, OPTIONS)).toContain('      allow_insecure: true\n')
    })

    it('keys the credential reference by auth method', () => {
        const cases: [string, string][] = [
            ['github-token', 'token_file'],
            ['https-token', 'token_file'],
            ['ssh-key', 'key_file'],
            ['bearer', 'token_file'],
            ['basic', 'password_file'],
            ['header', 'value_file'],
        ]
        for (const [method, key] of cases) {
            const yaml = renderFragment(site(), {
                ...OPTIONS,
                auth: { method: method as never, tokenFile: '/var/lib/np/creds/x.token' },
            })
            expect(yaml, method).toContain(`        method: ${method}\n`)
            // An absolute path isn't a plain-safe YAML scalar, so it comes back quoted.
            expect(yaml, method).toContain(`        ${key}: "/var/lib/np/creds/x.token"\n`)
        }
    })

    it('emits the non-secret username and header name inline', () => {
        const withUser = renderFragment(site(), {
            ...OPTIONS,
            auth: { method: 'https-token', tokenFile: '/creds/x.token', username: 'deploy' },
        })
        expect(withUser).toContain('        username: deploy\n')

        const withHeader = renderFragment(site(), {
            ...OPTIONS,
            auth: { method: 'header', tokenFile: '/creds/x.token', headerName: 'X-Api-Key' },
        })
        expect(withHeader).toContain('        name: X-Api-Key\n')
    })

    it('keeps the github-token env-var reference working (the original path)', () => {
        const yaml = renderFragment(site(), { ...OPTIONS, auth: { tokenEnv: 'QUAYKEEPER_GH_TOKEN_X' } })
        expect(yaml).toContain('        method: github-token\n')
        expect(yaml).toContain('        token_env: QUAYKEEPER_GH_TOKEN_X\n')
    })

    it('omits the auth block for a public source or a credential-less method', () => {
        expect(renderFragment(site(), OPTIONS)).not.toContain('auth:')
        expect(renderFragment(site(), { ...OPTIONS, auth: { method: 'none' } })).not.toContain('auth:')
        // A method naming no credential would be rejected by nginxpilot, taking the whole
        // site down; omitting it degrades to an unauthenticated fetch that fails in /status.
        expect(renderFragment(site(), { ...OPTIONS, auth: { method: 'ssh-key' } })).not.toContain('auth:')
    })
})

// Which sites authenticate with the owner's GitHub OAuth token. The deploy path and
// the login-time refresh both branch on this and must agree — if the refresh were
// broader, every sign-in would overwrite an external site's stored deploy key with an
// unrelated GitHub token, breaking its very next fetch.
describe('usesGithubOAuthCredential', () => {
    it('is true only for a private GitHub repo with no explicit URL', () => {
        expect(usesGithubOAuthCredential(site({ repoPrivate: true }))).toBe(true)
        expect(usesGithubOAuthCredential(site({ repoPrivate: true, authMethod: 'github-token' }))).toBe(true)
    })

    it('is false for a public site', () => {
        expect(usesGithubOAuthCredential(site())).toBe(false)
    })

    it('is false once the site fetches from an explicit URL', () => {
        // Even when the method is still called github-token: a token minted for this
        // user's GitHub account has no standing at some other host.
        expect(
            usesGithubOAuthCredential(
                site({ repoPrivate: true, sourceUrl: 'https://gitlab.com/acme/site.git', authMethod: 'https-token' }),
            ),
        ).toBe(false)
        expect(
            usesGithubOAuthCredential(
                site({ repoPrivate: true, sourceUrl: 'git@gitea.internal:acme/site.git', authMethod: 'ssh-key' }),
            ),
        ).toBe(false)
    })
})

describe('checkSourceUrl / checkSourceSpec', () => {
    it('accepts https, ssh://, and scp-style git URLs', () => {
        for (const url of [
            'https://gitlab.com/acme/site.git',
            'ssh://git@gitea.internal/acme/site.git',
            'git@github.com:acme/site.git',
        ]) {
            expect(checkSourceUrl(url, 'git').ok, url).toBe(true)
        }
    })

    it('refuses a cleartext git URL outright', () => {
        const c = checkSourceUrl('http://git.internal/acme/site.git', 'git')
        expect(c.ok).toBe(false)
    })

    it('allows an http archive URL only with allowInsecure', () => {
        expect(checkSourceUrl('http://ci.internal/site.zip', 'http-zip').ok).toBe(false)
        expect(checkSourceUrl('http://ci.internal/site.zip', 'http-zip', true).ok).toBe(true)
    })

    it('rejects URLs carrying characters that could escape the emitted config', () => {
        for (const url of ['https://example.com/a b.zip', 'https://example.com/"x".zip']) {
            expect(checkSourceUrl(url, 'http-zip').ok, url).toBe(false)
        }
    })

    it('pairs ssh URLs with ssh-key and https URLs with token auth', () => {
        const ssh = 'git@gitea.internal:acme/site.git'
        expect(checkSourceSpec({ branch: 'main', sourceUrl: ssh, authMethod: 'ssh-key' }).ok).toBe(true)
        expect(checkSourceSpec({ branch: 'main', sourceUrl: ssh, authMethod: 'github-token' }).ok).toBe(false)
        expect(
            checkSourceSpec({ branch: 'main', sourceUrl: 'https://gitlab.com/a/b.git', authMethod: 'ssh-key' }).ok,
        ).toBe(false)
    })

    it('requires a username for https-token and forbids one for github-token', () => {
        const url = 'https://gitlab.com/acme/site.git'
        expect(checkSourceSpec({ branch: 'main', sourceUrl: url, authMethod: 'https-token' }).ok).toBe(false)
        expect(
            checkSourceSpec({ branch: 'main', sourceUrl: url, authMethod: 'https-token', authUsername: 'deploy' }).ok,
        ).toBe(true)
        expect(
            checkSourceSpec({ branch: 'main', authMethod: 'github-token', authUsername: 'deploy' }).ok,
        ).toBe(false)
    })

    it('keeps the archive auth methods off git sources and vice versa', () => {
        expect(checkSourceSpec({ branch: 'main', authMethod: 'bearer' }).ok).toBe(false)
        expect(
            checkSourceSpec({
                sourceType: 'http-zip',
                branch: '',
                sourceUrl: 'https://ci.example.com/site.zip',
                authMethod: 'ssh-key',
            }).ok,
        ).toBe(false)
    })

    it('rejects git-only and archive-only fields on the wrong kind', () => {
        expect(checkSourceSpec({ branch: 'main', stripComponents: 1 }).ok).toBe(false)
        expect(
            checkSourceSpec({
                sourceType: 'http-zip',
                branch: '',
                sourceUrl: 'https://ci.example.com/site.zip',
                subdir: 'dist',
            }).ok,
        ).toBe(false)
    })

    it('requires a branch for git and a URL for an archive', () => {
        expect(checkSourceSpec({ branch: '' }).ok).toBe(false)
        expect(checkSourceSpec({ sourceType: 'http-zip', branch: '' }).ok).toBe(false)
    })

    it('accepts the plain GitHub shape it started from', () => {
        expect(checkSourceSpec({ branch: 'main' }).ok).toBe(true)
        expect(checkSourceSpec({ branch: 'main', subdir: 'dist', authMethod: 'github-token' }).ok).toBe(true)
    })
})

describe('describeSourceUrl', () => {
    it('reads owner/name out of the usual git and archive URL shapes', () => {
        expect(describeSourceUrl('https://gitlab.com/acme/site.git')).toEqual({ owner: 'acme', name: 'site' })
        expect(describeSourceUrl('git@gitea.internal:acme/site.git')).toEqual({ owner: 'acme', name: 'site' })
        expect(describeSourceUrl('https://ci.example.com/builds/site.zip')).toEqual({
            owner: 'builds',
            name: 'site',
        })
    })

    it('falls back to the host rather than failing on an odd URL', () => {
        expect(describeSourceUrl('https://example.com/')).toEqual({ owner: 'example.com', name: 'example.com' })
        expect(describeSourceUrl('not a url')).toEqual({ owner: 'source', name: 'not-a-url' })
    })
})

describe('checkExclude / checkRequireFile', () => {
    it('normalizes null/undefined to "inherit the default"', () => {
        expect(checkExclude(null)).toEqual({ ok: true, value: undefined })
        expect(checkRequireFile(undefined)).toEqual({ ok: true, value: undefined })
    })

    it('preserves an explicitly empty list', () => {
        expect(checkExclude([])).toEqual({ ok: true, value: [] })
        expect(checkRequireFile([])).toEqual({ ok: true, value: [] })
    })

    it('trims and de-duplicates, preserving order', () => {
        const c = checkExclude([' *.map ', 'README.md', '*.map'])
        expect(c.ok).toBe(true)
        if (c.ok) expect(c.value).toEqual(['*.map', 'README.md'])
    })

    it('accepts glob metacharacters in exclude but not in require_file', () => {
        expect(checkExclude(['*.map', 'build/?.tmp']).ok).toBe(true)
        const gate = checkRequireFile(['*.html'])
        expect(gate.ok).toBe(false)
        if (!gate.ok) expect(gate.reason).toBe('charset')
    })

    it('rejects traversal, absolute paths, blanks, and non-arrays', () => {
        for (const [raw, reason] of [
            [['../secrets'], 'traversal'],
            [['/etc/passwd'], 'traversal'],
            [['  '], 'empty'],
            ['*.map', 'type'],
            [[42], 'type'],
        ] as const) {
            const c = checkExclude(raw)
            expect(c.ok, JSON.stringify(raw)).toBe(false)
            if (!c.ok) expect(c.reason).toBe(reason)
        }
    })

    it('caps the number of entries', () => {
        const c = checkExclude(Array.from({ length: 51 }, (_, i) => `f${i}.txt`))
        expect(c.ok).toBe(false)
        if (!c.ok) expect(c.reason).toBe('count')
    })
})

describe('checkKeepReleases', () => {
    it('inherits on null/undefined', () => {
        expect(checkKeepReleases(null, 5)).toEqual({ ok: true, value: undefined })
    })

    it('accepts a value at or under the plan cap', () => {
        expect(checkKeepReleases(5, 5)).toEqual({ ok: true, value: 5 })
    })

    it('rejects above the cap, below 1, and non-integers', () => {
        for (const [raw, reason] of [
            [6, 'range'],
            [0, 'range'],
            [2.5, 'type'],
            ['3', 'type'],
        ] as const) {
            const c = checkKeepReleases(raw, 5)
            expect(c.ok, String(raw)).toBe(false)
            if (!c.ok) expect(c.reason).toBe(reason)
        }
    })
})

describe('checkIntervalSec', () => {
    it('lets a site poll SLOWER than its plan floor but never faster', () => {
        expect(checkIntervalSec(3600, 900)).toEqual({ ok: true, value: 3600 })
        expect(checkIntervalSec(900, 900)).toEqual({ ok: true, value: 900 })
        const tooFast = checkIntervalSec(60, 900)
        expect(tooFast.ok).toBe(false)
        if (!tooFast.ok) expect(tooFast.reason).toBe('range')
    })

    it("honours nginxpilot's own 30s floor even for an unrealistically low plan floor", () => {
        const c = checkIntervalSec(10, 5)
        expect(c.ok).toBe(false)
        if (!c.ok) expect(c.message).toContain('30')
    })

    it('rejects a cadence slower than a week', () => {
        const c = checkIntervalSec(8 * 24 * 60 * 60, 900)
        expect(c.ok).toBe(false)
        if (!c.ok) expect(c.reason).toBe('range')
    })
})

describe('checkSiteTls', () => {
    it('normalizes null/empty to the default', () => {
        expect(checkSiteTls(null)).toEqual({ ok: true, value: undefined })
        expect(checkSiteTls('  ')).toEqual({ ok: true, value: undefined })
    })

    it('accepts the full tri-state', () => {
        for (const mode of ['off', 'auto', 'required'] as const) {
            expect(checkSiteTls(mode)).toEqual({ ok: true, value: mode })
        }
    })

    it('rejects anything else', () => {
        const c = checkSiteTls('on')
        expect(c.ok).toBe(false)
        if (!c.ok) expect(c.reason).toBe('enum')
    })
})

describe('checkAdvanced', () => {
    it('normalizes empty/whitespace to "unset"', () => {
        expect(checkAdvanced('   \n  ')).toEqual({ ok: true, value: undefined })
        expect(checkAdvanced(null)).toEqual({ ok: true, value: undefined })
    })

    it('normalizes CRLF and trims the block', () => {
        const c = checkAdvanced('\n  add_header X 1;\r\nadd_header Y 2;\n\n')
        expect(c.ok).toBe(true)
        if (c.ok) expect(c.value).toBe('add_header X 1;\nadd_header Y 2;')
    })

    it('rejects control characters that would corrupt the emitted config', () => {
        // Built from a char code rather than written as an escape so the NUL is
        // unambiguous in the source and survives any tool that rewrites this file.
        const c = checkAdvanced(`add_header X${String.fromCharCode(0)} 1;`)
        expect(c.ok).toBe(false)
        if (!c.ok) expect(c.reason).toBe('charset')
    })

    it('caps length and line count', () => {
        expect(checkAdvanced('x'.repeat(8001)).ok).toBe(false)
        expect(checkAdvanced(Array.from({ length: 201 }, () => 'a;').join('\n')).ok).toBe(false)
    })
})
