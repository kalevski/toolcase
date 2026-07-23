// Pure rendering of an nginxpilot site fragment (Channel A of the integration
// seam — §4). No `server-only`, no filesystem, no I/O: given a `Site` plus the
// policy-derived knobs (poll interval, gates, private-repo auth), produce the
// exact `sites.d/quaykeeper-<siteId>.yml` text and the deterministic, server-generated
// filename. Keeping this layer pure (mirrors `domain/sponsorship-events.ts`) lets
// the fragment schema be unit-tested in isolation, and lets the I/O wrapper in
// `infrastructure/nginxpilot.ts` stay thin.
//
// See notes/static-hosting-app-design.md §4, §9, §16.

import { STANDARD_LIMITS, type BaseDomain, type PlanLimits, type Site, type SiteAuthMethod } from './types'
import { MIN_INTERVAL_SEC } from './site-input'
import type { TlsMode } from './routing'

// ── deterministic, server-generated identifiers (§16: no user input in paths) ──

// Site ids are server-generated (§12), but this module is the last gate before an
// id reaches a filesystem path *and* an OS env-var name, so it validates defensively
// rather than trusting the caller. Filenames tolerate `-`; env-var name components
// do not, so the two derivations differ (see `tokenEnvVarName`).
const SAFE_SITE_ID = /^[A-Za-z0-9_-]{1,64}$/

/** Throw unless `siteId` is a safe, server-generated id (path/env-var-name safe). */
export function assertSafeSiteId(siteId: string): void {
    if (!SAFE_SITE_ID.test(siteId)) {
        throw new Error(
            `[quaykeeper] unsafe site id ${JSON.stringify(siteId)}: expected ${SAFE_SITE_ID} ` +
                `(ids are server-generated — never derive a fragment path from user input, §16).`,
        )
    }
}

/** Deterministic fragment filename for a site — `quaykeeper-<siteId>.yml` (§4, §12). */
export function fragmentFilename(siteId: string): string {
    assertSafeSiteId(siteId)
    return `quaykeeper-${siteId}.yml`
}

/**
 * Env-var NAME that holds the repo credential for a private site (§4, §9, §16) —
 * the value is referenced by name in the fragment and never inlined. Uppercased
 * with id hyphens folded to `_`, since `-` is illegal in a POSIX env-var name.
 */
export function tokenEnvVarName(siteId: string): string {
    assertSafeSiteId(siteId)
    return `QUAYKEEPER_GH_TOKEN_${siteId.toUpperCase().replace(/-/g, '_')}`
}

/**
 * The name a private site's clone token is stored under in its realm's
 * git-credentials store (`PUT /git-credentials/{name}`). Per-site — deletion is
 * tied to the site's own lifecycle, no cross-site refcounting. Site ids are
 * already `[A-Za-z0-9_-]`, which nginxpilot's credential-name charset accepts.
 */
export function gitCredentialName(siteId: string): string {
    assertSafeSiteId(siteId)
    return `quaykeeper-${siteId}`
}

// ── fragment rendering (§4) ───────────────────────────────────────────────────

/**
 * Source credential reference for the fragment `auth` block (§9, §16). Secret material
 * NEVER appears here — only the *name* of an env var, or the daemon-local path of a 0600
 * file the credential store wrote. Which nginxpilot key that reference lands under
 * depends on the method (`token_file`, `key_file`, `password_file`, `value_file`), which
 * is why the caller supplies the method rather than a pre-chosen key.
 */
export interface FragmentAuth {
    /**
     * How to authenticate. Omitted → `github-token`, the original behaviour, since that
     * was the only method Quaykeeper could express before non-GitHub sources existed.
     */
    method?: SiteAuthMethod
    /**
     * Name of the env var nginxpilot reads the GitHub token from. NOTE: nginxpilot's
     * `github-token` method keys the credential as `token_env` (validated in
     * `internal/config/validate.go` — `key_env` belongs to the `ssh-key` method and
     * is rejected there). The §4 example writes `key_env`, which is a doc slip; the
     * engine-correct key is `token_env`, emitted below. Build it with
     * `tokenEnvVarName(site.id)`. `github-token` only.
     */
    tokenEnv?: string
    /**
     * Daemon-local path nginxpilot reads the secret from — the path returned by
     * `PUT /git-credentials/{name}` on the site's own realm. The deploy service pushes
     * the credential there before writing the fragment; nginxpilot resolves the file at
     * each fetch, so a rotated secret takes effect on the next sync without a reload.
     * Emitted as `token_file` / `key_file` / `password_file` / `value_file` to match
     * {@link method}.
     */
    tokenFile?: string
    /** Username for `https-token` / `basic`. Not secret; emitted inline. */
    username?: string
    /** Header name for `header` auth. Not secret; emitted inline. */
    headerName?: string
}

/** The nginxpilot `auth` key a method's secret-file reference belongs under. */
const AUTH_FILE_KEY: Record<SiteAuthMethod, string> = {
    'none': '',
    'ssh-key': 'key_file',
    'https-token': 'token_file',
    'github-token': 'token_file',
    'bearer': 'token_file',
    'basic': 'password_file',
    'header': 'value_file',
}

/**
 * Managed-mode TLS + security options for a site's server block (§0/Phase D) — the
 * `WebOptions` subset sites accept (no `websocket`/`cache`; those are proxy-only). The
 * caller (`services/deploy.ts` `resolveWebOptions`) resolves the *effective* values,
 * from two different scopes:
 *
 *   • **cert-scoped** (`tls`, `force_ssl`, `http2`, `hsts`) — a subdomain inherits its
 *     base domain's wildcard policy, because one cert covers every label and browsers
 *     coalesce siblings onto one connection; a custom domain has a dedicated cert and
 *     so carries its own {@link Site.tls}.
 *   • **site-scoped** (`block_exploits`, `gzip`, `advanced`) — plain per-site toggles
 *     with no cross-host coupling and no TLS requirement.
 *
 * Inert unless nginxpilot runs in managed mode. `tls: required` quarantines a site that
 * has no cert instead of serving it in plaintext, so it is only ever set explicitly by
 * a custom-domain owner — the default stays `auto`, which degrades to HTTP.
 */
export interface SiteWebOptions {
    tls?: TlsMode
    force_ssl?: boolean
    http2?: boolean
    hsts?: boolean
    block_exploits?: boolean
    gzip?: boolean
    /** Raw nginx passthrough; rides the daemon's `nginx -t` gate. */
    advanced?: string
}

/** Policy-derived knobs the `Site` row itself doesn't carry (§9, §11, §15). */
export interface FragmentOptions {
    /**
     * Poll cadence floor in seconds, from the owner's effective `PlanLimits.minIntervalSec`
     * (free = 900 → `15m`; gold = 60 → `1m`). Formatted to an nginxpilot Go duration.
     */
    intervalSec: number
    /**
     * How many prior release directories nginxpilot keeps for rollback
     * (`source.keep_releases`). Omitted → nginxpilot's own default (5). The caller
     * resolves it from the site's own setting, capped by the owner's plan.
     */
    keepReleases?: number
    /**
     * Post-fetch gate: nginxpilot won't go live unless these files exist, so a broken
     * or empty build keeps the last-known-good release serving. Defaults to
     * `['index.html']`; pass `[]` to omit the gate.
     */
    requireFile?: string[]
    /**
     * Glob excludes layered on nginxpilot's defaults. Defaults to `['*.map']`; pass
     * `[]` to omit.
     */
    exclude?: string[]
    /**
     * Present only for a private repo (paid tier, §9). Omit for public repos — the v1
     * free tier deploys public repos only and writes no `auth` block (zero secrets).
     */
    auth?: FragmentAuth
    /**
     * Managed-mode TLS + security options for the site's server block (§0/Phase D).
     * Omit (or all-off) to emit a plain HTTP site. Inert when nginxpilot isn't managed.
     */
    web?: SiteWebOptions
}

const DEFAULT_REQUIRE_FILE = ['index.html']
const DEFAULT_EXCLUDE = ['*.map']

// ── option resolution (pure policy; the service supplies the inputs) ──────────
//
// Turning a stored `Site` row + the owner's effective plan + (for a subdomain) its base
// domain into the exact `FragmentOptions` a render needs. Kept here, beside the renderer
// and free of `server-only`, so the rules are unit-testable — `services/deploy.ts` only
// does the two lookups (the owner's limits, the site's base domain) and hands them in.

/**
 * The **cert-scoped** web options — the toggles nginxpilot rejects without effective
 * TLS, and which therefore have to agree across every host sharing a certificate.
 *
 *   • Subdomain — TLS, HTTP/2 and HSTS all follow `base`'s wildcard policy (one cert per
 *     base). `auto` serves HTTPS once the wildcard cert is discoverable and degrades to
 *     HTTP otherwise, so a pending cert never takes subdomains down; an `off` base (or an
 *     unregistered one, `base === undefined`) emits no TLS at all. A per-label override is
 *     deliberately impossible: browsers coalesce siblings sharing a wildcard cert onto one
 *     connection, and vhosts that then disagree answer `421 Misdirected Request`.
 *   • Custom domain — has its own dedicated cert, so nothing can coalesce onto its
 *     connection and it carries its own {@link Site.tls} / {@link Site.hsts}. `auto`
 *     remains the default; `required` is the explicit "HTTPS or nothing" opt-in, where
 *     nginxpilot quarantines the site rather than serving it in plaintext.
 *
 * Returns `{}` when no TLS applies.
 */
export function resolveCertOptions(site: Site, base?: BaseDomain): SiteWebOptions {
    if (site.hostKind === 'custom') {
        const mode = site.tls ?? 'auto'
        if (mode === 'off') return {}
        return { tls: mode, force_ssl: true, http2: true, hsts: !!site.hsts }
    }
    if (site.hostKind !== 'subdomain') return {}
    if (!base || base.tls !== 'auto') return {}
    return { tls: 'auto', force_ssl: true, http2: base.http2, hsts: base.hsts }
}

/**
 * The full managed-mode web options: the cert-scoped block above plus the
 * **site-scoped** toggles — `gzip`, `block_exploits` and the raw `advanced` passthrough
 * — which have no cross-host coupling and no TLS requirement.
 *
 * `advanced` is re-gated on every render rather than only at write time, so revoking
 * {@link PlanLimits.advancedConfig} from an account actually drops the raw directives
 * from its sites at their next deploy instead of leaving them latched in.
 *
 * Returns `undefined` when nothing applies, so a plain HTTP static site emits no web keys.
 */
export function resolveWebOptions(
    site: Site,
    limits: PlanLimits,
    base?: BaseDomain,
): SiteWebOptions | undefined {
    const web = resolveCertOptions(site, base)
    if (site.gzip) web.gzip = true
    if (site.blockExploits) web.block_exploits = true
    if (site.advanced && limits.advancedConfig) web.advanced = site.advanced
    return Object.keys(web).length > 0 ? web : undefined
}

/**
 * The effective poll cadence. `PlanLimits.minIntervalSec` is a *floor*, not a fixed
 * value: a site may ask to be polled less often (a quiet marketing page), never more
 * often, since the floor is what the plan actually guarantees the fleet. nginxpilot's
 * own 30s hard minimum backstops both.
 */
export function resolveIntervalSec(site: Site, limits: PlanLimits): number {
    return Math.max(MIN_INTERVAL_SEC, limits.minIntervalSec, site.intervalSec ?? 0)
}

/**
 * The effective rollback depth: the site's own `keepReleases`, capped by the owner's
 * plan (deeper history is more disk, which is what the plan sells). Always resolved to a
 * number, so the plan value applies instead of nginxpilot's built-in default of 5.
 */
export function resolveKeepReleases(site: Site, limits: PlanLimits): number {
    const cap = Number.isFinite(limits.keepReleases) ? limits.keepReleases : STANDARD_LIMITS.keepReleases
    return Math.max(1, Math.min(site.keepReleases ?? cap, cap))
}

/**
 * Everything a render needs that the `Site` row doesn't carry verbatim: the plan-resolved
 * cadence and rollback depth, the site's own source-tree controls (`undefined` there
 * leaves the renderer's `['*.map']` / `['index.html']` defaults in place), and the
 * managed-mode web options. The `auth` block is added separately by the deploy service,
 * after a private repo's clone token reaches the realm's git-credentials store.
 */
export function resolveFragmentOptions(
    site: Site,
    limits: PlanLimits,
    base?: BaseDomain,
): FragmentOptions {
    return {
        intervalSec: resolveIntervalSec(site, limits),
        keepReleases: resolveKeepReleases(site, limits),
        requireFile: site.requireFile,
        exclude: site.exclude,
        web: resolveWebOptions(site, limits, base),
    }
}

/**
 * The URL nginxpilot fetches a site's content from. An explicit {@link Site.sourceUrl}
 * wins — that is how a non-GitHub git host (GitLab, Bitbucket, Gitea, an `ssh://` deploy
 * remote) or an `http-zip` archive is expressed. Without one, the site is a GitHub repo
 * and the URL is derived from its coordinates, exactly as before.
 */
export function sourceUrlFor(site: Site): string {
    if (site.sourceUrl) return site.sourceUrl
    return `https://github.com/${site.repoOwner}/${site.repoName}.git`
}

/**
 * Render the `sites.d/quaykeeper-<siteId>.yml` fragment for one site, per the §4 schema:
 * `domain`, the `source` block, `exclude`, the static-serving settings, and the
 * managed-mode web options.
 *
 * The `source` block differs by kind, matching nginxpilot's own validation — a `git`
 * source carries `branch`/`subdir` and rejects the archive fields, an `http-zip` source
 * carries `checksum_url`/`strip_components`/`allow_insecure` and rejects `branch`/`subdir`.
 * Secret material is NEVER inlined (§16): the `auth` block only ever references an env-var
 * name or a daemon-local 0600 file path.
 */
export function renderFragment(site: Site, options: FragmentOptions): string {
    assertSafeSiteId(site.id)
    const requireFile = options.requireFile ?? DEFAULT_REQUIRE_FILE
    const exclude = options.exclude ?? DEFAULT_EXCLUDE
    const type = site.sourceType ?? 'git'

    const lines: string[] = [
        `# ${fragmentFilename(site.id)} — generated by Quaykeeper; managed automatically, do not edit by hand.`,
        'sites:',
        `  - domain: ${scalar(site.hostname)}`,
        '    source:',
        `      type: ${type}`,
        `      url: ${scalar(sourceUrlFor(site))}`,
    ]
    if (type === 'git') lines.push(`      branch: ${scalar(site.branch)}`)
    lines.push(`      interval: ${scalar(formatInterval(options.intervalSec))}`)
    if (options.keepReleases !== undefined) lines.push(`      keep_releases: ${options.keepReleases}`)
    if (type === 'git') {
        if (site.subdir) lines.push(`      subdir: ${scalar(site.subdir)}`)
    } else {
        if (site.checksumUrl) lines.push(`      checksum_url: ${scalar(site.checksumUrl)}`)
        if (site.stripComponents !== undefined) lines.push(`      strip_components: ${site.stripComponents}`)
        if (site.allowInsecure) lines.push('      allow_insecure: true')
    }
    if (requireFile.length > 0) lines.push(`      require_file: ${flowSeq(requireFile)}`)
    lines.push(...renderAuth(options.auth))
    if (exclude.length > 0) lines.push(`    exclude: ${flowSeq(exclude)}`)

    // Static-serving settings from the site row (routing / custom 404 / asset caching) —
    // omitted when default, so plain static sites keep their pre-existing fragment bytes.
    if (site.routing && site.routing !== 'static') lines.push(`    routing: ${scalar(site.routing)}`)
    if (site.notFound) lines.push(`    not_found: ${scalar(site.notFound)}`)
    if (site.cacheAssets) lines.push('    cache_assets: true')

    // Managed-mode TLS + security options (§0/Phase D), emitted at the site (server-block)
    // level in a deterministic order so the golden tests stay stable. Inert unless the
    // daemon runs in managed mode.
    const web = options.web
    if (web) {
        if (web.tls && web.tls !== 'off') lines.push(`    tls: ${scalar(web.tls)}`)
        if (web.force_ssl) lines.push('    force_ssl: true')
        if (web.http2) lines.push('    http2: true')
        if (web.hsts) lines.push('    hsts: true')
        if (web.block_exploits) lines.push('    block_exploits: true')
        if (web.gzip) lines.push('    gzip: true')
        if (web.advanced && web.advanced.trim()) {
            // A literal block scalar: every line is content, so nothing inside can
            // close the block or introduce a sibling key. `trim()` guarantees the
            // first line carries no leading whitespace, which is what lets YAML
            // auto-detect the six-space indent (no explicit indicator needed). CR is
            // normalized away so a Windows-pasted snippet can't leave stray \r in the
            // emitted nginx directives.
            lines.push('    advanced: |')
            for (const line of web.advanced.replace(/\r\n?/g, '\n').trim().split('\n')) {
                lines.push(line.trim() ? `      ${line}` : '')
            }
        }
    }

    return lines.join('\n') + '\n'
}

/**
 * The `source.auth` block, or nothing when the source is public. Emits the credential
 * *reference* only — an env-var name or the daemon-local path of a 0600 file — under the
 * key nginxpilot expects for the method ({@link AUTH_FILE_KEY}). An `auth` block with no
 * reference at all is omitted rather than written empty: nginxpilot rejects a method that
 * names no credential, and a rejected fragment would take the whole site down, whereas
 * omitting it degrades to an unauthenticated fetch that fails loudly in `/status`.
 */
function renderAuth(auth: FragmentAuth | undefined): string[] {
    if (!auth) return []
    const method = auth.method ?? 'github-token'
    if (method === 'none') return []
    const hasRef = !!(auth.tokenEnv || auth.tokenFile)
    if (!hasRef) return []

    const lines = ['      auth:', `        method: ${method}`]
    if (auth.username) lines.push(`        username: ${scalar(auth.username)}`)
    if (method === 'header' && auth.headerName) lines.push(`        name: ${scalar(auth.headerName)}`)
    if (auth.tokenEnv) {
        // Env-var references only exist for `github-token` (see FragmentAuth.tokenEnv);
        // every other method resolves its secret through the credential store's file.
        lines.push(`        token_env: ${scalar(auth.tokenEnv)}`)
    } else if (auth.tokenFile) {
        lines.push(`        ${AUTH_FILE_KEY[method]}: ${scalar(auth.tokenFile)}`)
    }
    return lines
}

// ── drift detection (`GET /sites` vs the stored row) ─────────────────────────

/**
 * One site's live merged config as the daemon's `GET /sites` reports it (the JSON shape
 * of nginxpilot's `config.Site`, reduced to the fields the drift check and the adoption
 * mapping read — `domain/site-adopt.ts`). Auth carries references only — secret material
 * never crosses that wire — and internal provenance is dropped daemon-side, so this is a
 * faithful, comparable echo of the fragment Quaykeeper last wrote (or whatever else
 * lives in `sites.d/`).
 */
export interface LiveSiteConfig {
    domain: string
    source?: {
        type?: string
        url?: string
        branch?: string
        subdir?: string
        checksum_url?: string
        strip_components?: number
        allow_insecure?: boolean
        require_file?: string[]
        /** Go-duration string (`"15m0s"`); adoption parses it, the drift check ignores it. */
        interval?: string
        keep_releases?: number
        /** Credential *references* only (method, username, header name) — never a secret. */
        auth?: { method?: string; username?: string; name?: string }
    }
    routing?: string
    not_found?: string
    cache_assets?: boolean
    tls?: string
    block_exploits?: boolean
    gzip?: boolean
    /** JSON always carries the struct form (the daemon's `HSTS.MarshalJSON` round-trip). */
    hsts?: { enabled?: boolean }
    advanced?: string
    exclude?: string[]
}

/**
 * Whether the daemon's live config for a domain has drifted from what the stored `Site`
 * row says the fragment should hold — the trigger for a reconcile re-push (a daemon
 * restored from an old backup, a hand-edited fragment).
 *
 * Deliberately compares only fields the fragment renderer emits VERBATIM from the row
 * (source coordinates, routing, the serving toggles), so equality is stable across
 * round-trips and a re-push can never loop. Derived values with daemon-side defaults or
 * lossy encodings (interval durations, keep_releases, require_file/exclude defaults,
 * HSTS's union type, the auth block's daemon-local paths) are left out: a mismatch
 * there is either impossible to detect reliably or harmless until the next real deploy
 * rewrites the fragment anyway.
 */
export function fragmentDrifted(
    site: Site,
    live: LiveSiteConfig,
    web: SiteWebOptions | undefined,
): boolean {
    const type = site.sourceType ?? 'git'
    const src = live.source ?? {}
    if ((src.type ?? 'git') !== type) return true
    if (src.url !== sourceUrlFor(site)) return true
    if (type === 'git') {
        if ((src.branch ?? '') !== site.branch) return true
        if ((src.subdir ?? '') !== (site.subdir ?? '')) return true
    } else {
        if ((src.checksum_url ?? '') !== (site.checksumUrl ?? '')) return true
        if ((src.strip_components ?? undefined) !== (site.stripComponents ?? undefined)) return true
        if ((src.allow_insecure ?? false) !== !!site.allowInsecure) return true
    }
    if ((live.routing ?? 'static') !== (site.routing ?? 'static')) return true
    if ((live.not_found ?? '') !== (site.notFound ?? '')) return true
    if ((live.cache_assets ?? false) !== !!site.cacheAssets) return true
    // Serving toggles the renderer emits verbatim from the resolved web options. The
    // renderer omits `tls: off`, so normalize both sides to 'off'.
    if ((live.tls ?? 'off') !== (web?.tls ?? 'off')) return true
    if ((live.gzip ?? false) !== !!web?.gzip) return true
    if ((live.block_exploits ?? false) !== !!web?.block_exploits) return true
    return false
}

/**
 * Format a whole number of seconds as an nginxpilot Go duration: exact hours →
 * `Nh`, exact minutes → `Nm`, else `Ns`. 900 → `15m`, 300 → `5m`, 60 → `1m`,
 * 30 → `30s`. (nginxpilot enforces a 30s floor on its side.)
 */
export function formatInterval(seconds: number): string {
    const s = Math.max(1, Math.floor(seconds))
    if (s % 3600 === 0) return `${s / 3600}h`
    if (s % 60 === 0) return `${s / 60}m`
    return `${s}s`
}

// ── minimal YAML scalar/flow emission ─────────────────────────────────────────
//
// We hand-emit the handful of scalar/array shapes this fixed schema needs rather
// than pull in a YAML dependency. Plain-safe values are written bare (matching the
// §4 example); anything else is double-quoted, which both keeps the YAML valid and
// defuses injection through a value that slipped past upstream validation (§16).

// Bare scalars: start alphanumeric, then only chars that can't break out of a
// plain scalar or smuggle YAML structure. Domains, https URLs, branches, Go
// durations, `dist/`, and `QUAYKEEPER_GH_TOKEN_*` all qualify; a `*.map` glob (leading
// `*`) or anything with whitespace/quotes/newlines does not.
const PLAIN_SCALAR = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/

/** Emit a YAML scalar, quoting only when the value isn't plain-safe. */
function scalar(value: string): string {
    if (PLAIN_SCALAR.test(value)) return value
    return quote(value)
}

/** Emit a YAML flow sequence, quoting each item only when needed: `[a, "b*"]`. */
function flowSeq(items: string[]): string {
    return `[${items.map(scalar).join(', ')}]`
}

/** Double-quote a scalar, escaping backslashes, quotes, and control characters. */
function quote(value: string): string {
    const escaped = value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
    return `"${escaped}"`
}
