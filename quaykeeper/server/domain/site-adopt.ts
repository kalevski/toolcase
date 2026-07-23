// Pure adoption mapping for the sites page's "Found on your instances" section: turn
// one live nginxpilot site config — a fragment Quaykeeper never wrote (deployed before
// the instance was registered, or by another control plane) — into the `Site` row
// fields that reproduce it. The mapping is deliberately VERBATIM on every field the
// drift check (`fragmentDrifted`) compares, so adopting a site never causes the
// reconcile loop to rewrite the running fragment: management transfers with zero
// churn on the daemon. Free of `server-only` so the rules are unit-testable;
// `services/sites.ts` supplies the lookups (realm, base domains, live config).

import type { LiveSiteConfig } from './nginxpilot-fragment'
import { describeSourceUrl } from './site-input'
import { SITE_AUTH_METHODS, isSiteTls } from './types'
import type { SiteAuthMethod, SiteHostKind, SiteRouting, SiteSourceType, SiteTls } from './types'

/**
 * Classify an adopted domain against the realm's registered base domains: a single
 * label directly under a base domain is a `subdomain` (it rides the base's wildcard
 * cert and TLS policy), anything else — including deeper nesting, which no wildcard
 * covers — is a `custom` domain with its own cert. Purely structural: the domain
 * already serves live on the instance, so the strict create-time charset/reservation
 * checks don't apply — refusing to adopt a working site over them would help no one.
 */
export function classifyAdoptedHost(domain: string, baseDomains: string[]): SiteHostKind {
    const host = domain.toLowerCase()
    for (const raw of baseDomains) {
        const base = raw.trim().toLowerCase()
        if (!base || !host.endsWith(`.${base}`)) continue
        const label = host.slice(0, -(base.length + 1))
        if (label && !label.includes('.')) return 'subdomain'
    }
    return 'custom'
}

// Go's `time.Duration.String()` output ("15m0s", "1h0m0s", "90s") — the shape the
// daemon's JSON emits for `source.interval`.
const DURATION_SEGMENT = /(\d+(?:\.\d+)?)(ns|us|µs|μs|ms|s|m|h)/g
const UNIT_SECONDS: Record<string, number> = {
    ns: 1e-9,
    us: 1e-6,
    'µs': 1e-6,
    'μs': 1e-6,
    ms: 1e-3,
    s: 1,
    m: 60,
    h: 3600,
}

/**
 * Parse a Go duration string to whole seconds. Returns `undefined` for an absent,
 * malformed, or zero value — all of which mean "inherit the plan default" on the row.
 */
export function parseGoDurationSeconds(raw: string | undefined): number | undefined {
    if (!raw) return undefined
    let total = 0
    let consumed = ''
    for (const m of raw.matchAll(DURATION_SEGMENT)) {
        total += parseFloat(m[1]) * UNIT_SECONDS[m[2]]
        consumed += m[0]
    }
    if (consumed !== raw || !(total > 0)) return undefined
    return Math.round(total)
}

/**
 * A GitHub HTTPS clone URL in exactly the shape `sourceUrlFor` derives from repo
 * coordinates. Only this exact form (with the `.git` suffix) adopts into the classic
 * GitHub row shape — anything looser would store coordinates whose derived URL differs
 * from the live fragment's, and that mismatch is precisely what the drift check flags.
 */
const GITHUB_HTTPS_REPO = /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,37})?)\/([A-Za-z0-9._-]{1,100})\.git$/

/** A stored list mirroring the live one: the renderer's default collapses to `undefined`. */
function listVerbatim(live: string[] | undefined, rendererDefault: string[]): string[] | undefined {
    // Absent on the daemon = the fragment names none — store `[]` ("explicitly none") so a
    // future render doesn't introduce the default where the fragment had nothing.
    if (!live) return []
    if (live.length === rendererDefault.length && live.every((v, i) => v === rendererDefault[i])) return undefined
    return live
}

/** The `Site` fields {@link adoptedSiteFields} derives — everything but identity/realm/status. */
export interface AdoptedSiteFields {
    repoOwner: string
    repoName: string
    repoPrivate: boolean
    sourceType?: SiteSourceType
    sourceUrl?: string
    branch: string
    subdir?: string
    authMethod?: SiteAuthMethod
    authUsername?: string
    authHeaderName?: string
    checksumUrl?: string
    stripComponents?: number
    allowInsecure?: boolean
    routing?: SiteRouting
    notFound?: string
    cacheAssets?: boolean
    gzip?: boolean
    blockExploits?: boolean
    tls?: SiteTls
    hsts?: boolean
    advanced?: string
    exclude?: string[]
    requireFile?: string[]
    keepReleases?: number
    intervalSec?: number
}

/**
 * Map one live config to the row fields that reproduce it verbatim.
 *
 * Two shapes come out:
 *
 *   • **Classic GitHub** — a `git` source at exactly `https://github.com/<o>/<n>.git`
 *     whose auth is `none`/`github-token` stores coordinates and no `sourceUrl`, so a
 *     private repo's future fragment renders auth from the owner's OAuth token — the
 *     one credential Quaykeeper can supply itself, making the adoption fully
 *     self-sufficient.
 *   • **Explicit source** — everything else keeps its URL verbatim. An authenticated
 *     one (`repoPrivate`) has NO stored credential — the daemon-side fragment keeps
 *     using its own references untouched, but the user must re-enter the secret in the
 *     site's settings before a config change re-renders the fragment (the same "written
 *     without auth, fails loudly in /status" degrade as a missing credential anywhere).
 *
 * TLS/HSTS land on the row only for a custom domain — a subdomain's TLS follows its
 * base domain's wildcard policy, and a live value that disagrees is real drift the
 * reconcile loop is *supposed* to converge.
 */
export function adoptedSiteFields(live: LiveSiteConfig, hostKind: SiteHostKind): AdoptedSiteFields {
    const src = live.source ?? {}
    const sourceType: SiteSourceType = src.type === 'http-zip' ? 'http-zip' : 'git'
    const url = src.url ?? ''

    const rawMethod = src.auth?.method ?? 'none'
    const authMethod = (SITE_AUTH_METHODS as readonly string[]).includes(rawMethod)
        ? (rawMethod as SiteAuthMethod)
        : 'none'
    const repoPrivate = authMethod !== 'none'

    const github =
        sourceType === 'git' && (authMethod === 'none' || authMethod === 'github-token')
            ? GITHUB_HTTPS_REPO.exec(url)
            : null
    const labels = github ? { owner: github[1], name: github[2] } : describeSourceUrl(url)

    const routing =
        live.routing === 'spa' || live.routing === 'clean-urls' ? (live.routing as SiteRouting) : undefined

    const fields: AdoptedSiteFields = {
        repoOwner: labels.owner,
        repoName: labels.name,
        repoPrivate,
        sourceType: sourceType === 'git' ? undefined : sourceType,
        sourceUrl: github ? undefined : url || undefined,
        branch: sourceType === 'git' ? (src.branch ?? '') : 'main',
        subdir: sourceType === 'git' ? src.subdir || undefined : undefined,
        authMethod: repoPrivate ? authMethod : undefined,
        authUsername: src.auth?.username || undefined,
        authHeaderName: src.auth?.name || undefined,
        checksumUrl: sourceType === 'http-zip' ? src.checksum_url || undefined : undefined,
        stripComponents: sourceType === 'http-zip' ? (src.strip_components ?? undefined) : undefined,
        allowInsecure: sourceType === 'http-zip' && src.allow_insecure ? true : undefined,
        routing,
        notFound: live.not_found || undefined,
        cacheAssets: live.cache_assets ? true : undefined,
        gzip: live.gzip ? true : undefined,
        blockExploits: live.block_exploits ? true : undefined,
        advanced: live.advanced?.trim() ? live.advanced : undefined,
        exclude: listVerbatim(live.exclude, ['*.map']),
        requireFile: listVerbatim(src.require_file, ['index.html']),
        keepReleases: src.keep_releases ?? undefined,
        intervalSec: parseGoDurationSeconds(src.interval),
    }

    if (hostKind === 'custom') {
        fields.tls = isSiteTls(live.tls) ? live.tls : 'off'
        fields.hsts = live.hsts?.enabled ? true : undefined
    }

    return fields
}
