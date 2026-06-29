// Pure view-model for the per-site dashboard UI (§9, §14, task 734). Maps the
// `GET /api/sites/{id}/status` payload — the stored `Site` row plus the live
// nginxpilot status entry — and the caller's plan limits/usage into the shapes the
// dashboard's `tc-*` elements consume: a headline status dot, a status card, a
// build card, usage bars, and a deploy log.
//
// Like `domain/usage.ts` this is pure (no I/O, no `server-only` deps, imports only
// from `./types`), so it is unit-testable in isolation AND safe to import from the
// client `components/SiteDashboard.tsx` — the same "pure decision logic in
// domain/, server-only wiring in services/" split the deploy machine uses.
//
// The last-known-good guarantee (§9 step 5) is the load-bearing thing this surfaces
// plainly: a bad push never tears down the previous release, so when nginxpilot
// reports an error while still serving a prior `current` ref the build reads `fail`
// but the status card and the `lastKnownGood` note say the site is still up.
//
// See notes/static-hosting-app-design.md §9, §11, §14.

import type { PlanLimits, Site, SiteStatus, SiteUsage } from './types'

// ── input payload (mirrors `GET /api/sites/{id}/status`, kept local so the client
//    needn't import the `server-only` nginxpilot client) ─────────────────────────

/**
 * The live nginxpilot `/status` fields the dashboard reads (a subset of the
 * infrastructure client's `NginxpilotSiteStatus`). Mirrored here so this pure
 * module — and the client component that consumes it — stay decoupled from the
 * server-only nginxpilot client.
 */
export interface SiteDeployStatus {
    domain: string
    /** Currently-deployed git ref; absent before the first successful sync. */
    deployed_ref?: string
    /** ISO timestamp of the last successful sync, if any. */
    last_success?: string
    last_error?: string
    last_error_time?: string
    failure_streak: number
    /** True until the site's first successful sync (then a `current` release exists). */
    never_synced: boolean
    syncing: boolean
    /** ISO timestamp of the next scheduled poll, if scheduled. */
    next_sync?: string
    /** Deployed size of the live release in bytes, when nginxpilot reports it. */
    bytes?: number
}

/**
 * The managed-mode resource state for this site's hostname (§0/Phase A), resolved
 * server-side by matching `status.nginx.resources[].key === site.hostname`. Present
 * only when the daemon runs in managed mode and has an entry for the domain; a
 * `disabled` state means `nginx -t` quarantined the site's config (it isn't serving),
 * with `reason` carrying the daemon's verdict.
 */
export interface SiteNginxResource {
    state: 'active' | 'disabled'
    reason?: string
}

/** The `GET /api/sites/{id}/status` response: the stored row + the live entry (or null). */
export interface SiteStatusPayload {
    site: Site
    nginxpilot: SiteDeployStatus | null
    /** Managed-mode resource state for this domain, when nginxpilot runs managed (§0). */
    nginxResource?: SiteNginxResource | null
}

// ── view-model output (string-literal unions match the tc-* prop contracts) ──────

/** The five dashboard states the task calls out (§14). */
export type SiteDashboardStatus = 'live' | 'provisioning' | 'failed' | 'over-quota' | 'suspended'

/** `tc-status-dot` semantic colour. */
export type DotTone = 'online' | 'offline' | 'busy' | 'away'
/** `tc-status-card` `StatusItem.status`. */
export type CardTone = 'ok' | 'warning' | 'error' | 'inactive'
/** `tc-build` status. */
export type BuildState = 'pass' | 'fail' | 'running' | 'queued'
/** `tc-terminal-window` `TerminalLine.type`. */
export type LogLineType = 'command' | 'output' | 'comment'

/** Headline state for the dashboard header (status dot + label). */
export interface DashboardHeadline {
    status: SiteDashboardStatus
    label: string
    dot: DotTone
    pulse: boolean
}

/** One `tc-status-card` row. Structurally a web-components `StatusItem`. */
export interface DashboardStatusItem {
    id: string
    label: string
    status: CardTone
    detail?: string
}

/** `tc-build` props for the last-deploy card. */
export interface DashboardBuild {
    name: string
    status: BuildState
    /** Friendly UTC time of the last successful deploy, if any. */
    date?: string
    /** Deployed size in bytes (`tc-build` formats it into B/KB/MB/GB). */
    size?: number
    /** Short deployed ref, shown as the card badge. */
    badge?: string
    badgeVariant: string
    ariaLabel: string
}

/** One `tc-usage-summary-panel` bar. Structurally a web-components `UsageConfig`. */
export interface DashboardUsage {
    label: string
    used: number
    total: number
    measurementUnit: string
    warn?: boolean
}

/** One `tc-terminal-window` line. Structurally a web-components `TerminalLine`. */
export interface DashboardLogLine {
    type: LogLineType
    text: string
}

/** The complete dashboard view-model for one site. */
export interface SiteDashboardView {
    headline: DashboardHeadline
    statusItems: DashboardStatusItem[]
    build: DashboardBuild
    usage: DashboardUsage[]
    log: DashboardLogLine[]
    /** Plain-language last-known-good explanation, shown verbatim in the UI (§9 step 5). */
    lastKnownGood: string
    /** Whether a release is currently being served (drives the note + the serving row). */
    serving: boolean
}

// ── pure helpers (exported for unit coverage) ────────────────────────────────────

const MB = 1024 * 1024
const GB = 1024 * MB

/** Round to one decimal place (matches the usage panel's own number formatting). */
function round1(n: number): number {
    return Math.round(n * 10) / 10
}

/** Human-readable byte size — e.g. `0 B`, `12.3 MB`, `1.5 GB`, `∞` (unlimited). */
export function formatBytes(n: number | undefined): string {
    if (n === Infinity) return '∞'
    if (!n || !isFinite(n) || n <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let value = n
    let i = 0
    while (value >= 1024 && i < units.length - 1) {
        value /= 1024
        i++
    }
    const text = i === 0 ? String(Math.round(value)) : value.toFixed(value < 10 ? 1 : 0)
    return `${text} ${units[i]}`
}

/**
 * Shorten a git ref for display: a 7–40 char hex SHA is truncated to 7 chars; any
 * other ref (a branch/tag name) is returned unchanged. Deterministic, no Date.
 */
export function shortRef(ref: string | undefined): string {
    if (!ref) return ''
    return /^[0-9a-f]{7,40}$/i.test(ref) ? ref.slice(0, 7) : ref
}

/**
 * Format an ISO timestamp as a deterministic, timezone-independent `YYYY-MM-DD HH:MM
 * UTC` (sliced from the ISO string itself, so tests don't depend on the host locale
 * or zone). Returns `''` for a missing/malformed value.
 */
export function formatUtc(iso: string | undefined): string {
    if (!iso || iso.length < 16 || iso[10] !== 'T') return ''
    return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
}

/** Collapse the stored `SiteStatus` onto the five dashboard states (`draft` → provisioning). */
export function toDashboardStatus(status: SiteStatus): SiteDashboardStatus {
    switch (status) {
        case 'live':
            return 'live'
        case 'failed':
            return 'failed'
        case 'suspended':
            return 'suspended'
        case 'over_quota':
            return 'over-quota'
        default:
            return 'provisioning' // draft | provisioning
    }
}

/** Headline state → status-dot colour, label, and whether it pulses (in-progress). */
function headline(status: SiteDashboardStatus): DashboardHeadline {
    switch (status) {
        case 'live':
            return { status, label: 'Live', dot: 'online', pulse: false }
        case 'provisioning':
            return { status, label: 'Provisioning', dot: 'away', pulse: true }
        case 'failed':
            return { status, label: 'Failed', dot: 'busy', pulse: false }
        case 'over-quota':
            return { status, label: 'Over quota', dot: 'away', pulse: false }
        case 'suspended':
            return { status, label: 'Suspended', dot: 'offline', pulse: false }
    }
}

/** Headline state → the status-card "Status" row tone. */
function statusTone(status: SiteDashboardStatus): CardTone {
    switch (status) {
        case 'live':
            return 'ok'
        case 'provisioning':
        case 'over-quota':
            return 'warning'
        case 'failed':
            return 'error'
        case 'suspended':
            return 'inactive'
    }
}

/** A usage bar in MB or GB, picking the unit from the total. */
function usageRow(label: string, usedBytes: number, totalBytes: number, warn?: boolean): DashboardUsage {
    const useGb = isFinite(totalBytes) && totalBytes >= GB
    const div = useGb ? GB : MB
    return {
        label,
        used: round1(usedBytes / div),
        total: isFinite(totalBytes) ? round1(totalBytes / div) : 0,
        measurementUnit: useGb ? 'GB' : 'MB',
        warn,
    }
}

// ── the builder ──────────────────────────────────────────────────────────────────

/**
 * Build the full dashboard view-model for one site from its `/status` payload and the
 * owner's plan limits. When `account` usage is supplied, a second "All your sites"
 * storage bar (against `limits.maxBytesTotal`) is added beside the per-site one.
 */
export function buildSiteDashboard(
    payload: SiteStatusPayload,
    limits: PlanLimits,
    account?: SiteUsage,
): SiteDashboardView {
    const { site, nginxpilot: np, nginxResource } = payload
    const status = toDashboardStatus(site.status)
    const head = headline(status)

    // A `current` release only exists once nginxpilot has synced at least once; the
    // stored `lastRef` is the fallback before the first live `/status` reading lands.
    const deployedRef = np && !np.never_synced ? np.deployed_ref : undefined
    const ref = deployedRef ?? site.lastRef
    const failing = !!(np && (np.last_error || np.failure_streak > 0))
    const serving = status !== 'suspended' && !!ref
    const siteBytes = np?.bytes ?? site.bytes ?? 0

    // ── build card (last deploy) ──
    let buildState: BuildState
    if (status === 'suspended') buildState = 'queued'
    else if (np?.syncing) buildState = 'running'
    else if (failing) buildState = 'fail'
    else if (np?.last_success || ref) buildState = 'pass'
    else buildState = 'queued'

    const badgeVariant: Record<BuildState, string> = {
        pass: 'success',
        fail: 'danger',
        running: 'info',
        queued: 'secondary',
    }
    const build: DashboardBuild = {
        name: `${site.repoOwner}/${site.repoName}@${site.branch}`,
        status: buildState,
        date: formatUtc(np?.last_success) || undefined,
        size: siteBytes > 0 ? siteBytes : undefined,
        badge: ref ? shortRef(ref) : undefined,
        badgeVariant: badgeVariant[buildState],
        ariaLabel: `${head.label} — last deploy ${buildState}`,
    }

    // ── status card ──
    const lastDeployTone: CardTone = failing ? 'error' : np?.last_success ? 'ok' : 'inactive'
    const lastDeployDetail = failing
        ? formatUtc(np?.last_error_time) || 'failed'
        : formatUtc(np?.last_success) || 'pending'

    const overQuota = status === 'over-quota' || (limits.maxBytesPerSite > 0 && siteBytes >= limits.maxBytesPerSite)
    const nearQuota = limits.maxBytesPerSite > 0 && siteBytes >= limits.maxBytesPerSite * 0.8
    const storageTone: CardTone = overQuota ? 'error' : nearQuota ? 'warning' : 'ok'

    const statusItems: DashboardStatusItem[] = [
        { id: 'status', label: 'Status', status: statusTone(status), detail: head.label },
        {
            id: 'serving',
            label: 'Serving',
            status: serving ? 'ok' : 'inactive',
            detail: serving ? shortRef(ref) : status === 'suspended' ? 'suspended' : 'no release',
        },
        { id: 'deploy', label: 'Last deploy', status: lastDeployTone, detail: lastDeployDetail },
        {
            id: 'storage',
            label: 'Storage',
            status: storageTone,
            detail: `${formatBytes(siteBytes)} / ${formatBytes(limits.maxBytesPerSite)}`,
        },
    ]

    // Managed-mode quarantine (§0/Phase A): when nginxpilot's `nginx -t` gate disabled
    // this site's config, surface it as an error row carrying the daemon's reason — the
    // site's TLS/server block isn't live until the operator fixes the offending config.
    if (nginxResource?.state === 'disabled') {
        statusItems.push({
            id: 'nginx',
            label: 'TLS / nginx',
            status: 'error',
            detail: nginxResource.reason ?? 'disabled by nginx -t',
        })
    }

    // ── usage bars ──
    const usage: DashboardUsage[] = [usageRow('This site', siteBytes, limits.maxBytesPerSite, overQuota)]
    if (account) {
        usage.push(
            usageRow(
                'All your sites',
                account.totalBytes,
                limits.maxBytesTotal,
                limits.maxBytesTotal > 0 && account.totalBytes >= limits.maxBytesTotal,
            ),
        )
    }

    // ── deploy log ──
    const log: DashboardLogLine[] = [
        { type: 'comment', text: `# ${site.hostname}` },
        { type: 'command', text: `nginxpilot sync ${site.hostname}` },
    ]
    if (!np) {
        log.push({ type: 'comment', text: '# awaiting nginxpilot — fragment not yet picked up' })
    } else {
        log.push({ type: 'output', text: `repo: ${site.repoOwner}/${site.repoName} @ ${site.branch}` })
        if (np.never_synced && np.syncing) log.push({ type: 'output', text: 'cloning repository, first deploy in progress…' })
        else if (np.syncing) log.push({ type: 'output', text: `syncing ${site.branch}…` })
        if (np.last_success) log.push({ type: 'output', text: `last success: ${formatUtc(np.last_success)}` })
        if (ref) log.push({ type: 'output', text: `serving ref ${shortRef(ref)}` })
        if (siteBytes > 0) log.push({ type: 'output', text: `deployed size: ${formatBytes(siteBytes)}` })
        if (np.last_error) log.push({ type: 'output', text: `error: ${np.last_error}` })
        if (serving && failing) {
            log.push({ type: 'comment', text: '# last good release still serving (last-known-good)' })
        }
        if (np.next_sync && !np.syncing) log.push({ type: 'comment', text: `# next poll: ${formatUtc(np.next_sync)}` })
    }

    // ── last-known-good note (shown verbatim) ──
    let lastKnownGood: string
    if (status === 'suspended') {
        lastKnownGood =
            'This site is suspended and not serving. Re-deploy or upgrade your plan to bring it back online.'
    } else if (serving && failing) {
        lastKnownGood =
            'The latest push failed, but your previous release is still live — visitors keep seeing the last good build until a deploy succeeds.'
    } else if (serving) {
        lastKnownGood =
            'Your latest build is live. A failed push never takes it down: the previous release keeps serving until a new build succeeds.'
    } else {
        lastKnownGood =
            'No release is live yet. The first successful build goes live automatically; after that, a failed push keeps the previous release serving.'
    }

    return { headline: head, statusItems, build, usage, log, lastKnownGood, serving }
}
