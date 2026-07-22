'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTc, targetValue } from '@/lib/tc'
import { useToast } from './Toast'
import { useBranding } from '@/lib/branding-context'
import { SelectField, SwitchField, TextAreaField, TextField } from './fields'
import { buildSiteDashboard, type SiteStatusPayload } from '@/server/domain/site-dashboard'
import type { PlanLimits, Site, SiteRouting, SiteUsage } from '@/server/domain/types'

// The custom-domain verification result returned by POST /api/sites/{id}/verify-domain.
interface VerifyResult {
    domain: string
    verified: boolean
    expected: string
    resolved: string[]
    provisioned: boolean
}

// Per-site dashboard (§9 step 5, §11, §14, task 734). A live status view for one
// site composed entirely of `tc-*` Web Components driven through the `lib/tc.ts`
// bridge: object data (`items`/`usage`/`lines`) flows in as element *properties*
// and the deploy state is polled from `GET /api/sites/{id}/status`.
//
//   • tc-status-dot / tc-status-card — live | provisioning | failed | over-quota | suspended
//   • tc-build (+ a Redeploy button) — last deploy ref/size, POST …/redeploy
//   • tc-usage-summary-panel         — bytes-used bars vs the plan's maxBytesPerSite
//
// All presentation is derived by the pure `domain/site-dashboard.ts` view-model, so
// the component is just data-fetching + wiring. The last-known-good guarantee (a bad
// push keeps the previous release serving) is surfaced verbatim from that model.

// Poll cadence: faster while a deploy is in flight, relaxed once terminal.
const POLL_ACTIVE_MS = 5000
const POLL_IDLE_MS = 20000

const REDEPLOY_ERROR_COPY: Record<string, string> = {
    unauthorized: 'Your session expired. Sign in again to redeploy.',
    site_not_found: 'This site no longer exists.',
    forbidden: 'You do not have access to this site.',
    nginxpilot_error: 'The deploy engine is unavailable right now. Try again shortly.',
    internal_error: 'Something went wrong starting the redeploy. Try again.',
}

function redeployError(code: unknown, status: number): string {
    if (typeof code === 'string' && REDEPLOY_ERROR_COPY[code]) return REDEPLOY_ERROR_COPY[code]
    if (typeof code === 'string' && code) return code
    return `Redeploy failed (HTTP ${status}).`
}

const DELETE_ERROR_COPY: Record<string, string> = {
    unauthorized: 'Your session expired. Sign in again to delete this site.',
    site_not_found: 'This site no longer exists.',
    forbidden: 'You do not have access to this site.',
    nginxpilot_error: 'The deploy engine is unavailable right now. Try again shortly.',
    internal_error: 'Something went wrong deleting the site. Try again.',
}

function deleteError(code: unknown, status: number): string {
    if (typeof code === 'string' && DELETE_ERROR_COPY[code]) return DELETE_ERROR_COPY[code]
    if (typeof code === 'string' && code) return code
    return `Delete failed (HTTP ${status}).`
}

const SERVING_ERROR_COPY: Record<string, string> = {
    unauthorized: 'Your session expired. Sign in again to save these settings.',
    site_not_found: 'This site no longer exists.',
    forbidden: 'You do not have access to this site.',
    invalid_enum: 'Pick one of the offered routing modes.',
    invalid_traversal:
        'A path here must stay inside the site — no leading "/" and no "..". The 404 page is the exception: it must start with "/".',
    invalid_charset: 'One of the paths contains characters that are not allowed.',
    invalid_too_long: 'One of the values is too long.',
    invalid_type: 'One of the values is the wrong kind (a number where text was expected, or vice versa).',
    invalid_count: 'That list has too many entries.',
    invalid_range: 'That value is outside the range your plan allows.',
    invalid_empty: 'A list entry is blank — remove the empty line.',
    routing_conflict:
        'A custom 404 page can’t be combined with single-page-app routing — the SPA fallback serves index.html for every path.',
    tls_not_per_site: 'HTTPS for a Quaykeeper subdomain is set on its base domain, not per site.',
    hsts_not_per_site: 'HSTS for a Quaykeeper subdomain is set on its base domain, not per site.',
    advanced_config_not_allowed:
        'Raw nginx configuration isn’t enabled for your account — ask an owner to enable it.',
    nginxpilot_error: 'The deploy engine is unavailable right now. Try again shortly.',
    internal_error: 'Something went wrong saving the settings. Try again.',
}

function servingError(code: unknown, status: number): string {
    if (typeof code === 'string' && SERVING_ERROR_COPY[code]) return SERVING_ERROR_COPY[code]
    if (typeof code === 'string' && code) return code
    return `Saving failed (HTTP ${status}).`
}

/** Copy for the routing modes — mirrors the create wizard's select. */
const ROUTING_OPTIONS: { value: SiteRouting; label: string }[] = [
    { value: 'static', label: 'Static files (404 for unknown paths)' },
    { value: 'spa', label: 'Single-page app (fallback to index.html)' },
    { value: 'clean-urls', label: 'Clean URLs (/about serves about.html)' },
]

/** Where the content comes from. */
const SOURCE_TYPE_OPTIONS: { value: string; label: string }[] = [
    { value: 'git', label: 'Git repository' },
    { value: 'http-zip', label: 'Published archive (zip)' },
]

/**
 * Auth methods, labelled for what they actually are rather than by their engine name.
 * Which ones apply depends on the source kind and URL scheme — the server enforces the
 * same rules, so an impossible pick is refused rather than silently ignored.
 */
const GIT_HTTPS_AUTH: { value: string; label: string }[] = [
    { value: 'none', label: 'None — public repository' },
    { value: 'github-token', label: 'GitHub token' },
    { value: 'https-token', label: 'Username + access token' },
]
const GIT_SSH_AUTH: { value: string; label: string }[] = [
    { value: 'ssh-key', label: 'Deploy key (SSH private key)' },
]
const ARCHIVE_AUTH: { value: string; label: string }[] = [
    { value: 'none', label: 'None — public archive' },
    { value: 'bearer', label: 'Bearer token' },
    { value: 'basic', label: 'Username + password' },
    { value: 'header', label: 'Custom header' },
]

/** Whether a git URL speaks SSH — mirrors `isSshGitUrl` on the server. */
function looksLikeSsh(url: string): boolean {
    const u = url.trim()
    return u.startsWith('git@') || u.startsWith('ssh://')
}

/** What a given method's secret actually is, for the credential field's label. */
const SECRET_LABEL: Record<string, string> = {
    'ssh-key': 'Deploy key (private key)',
    'https-token': 'Access token',
    'github-token': 'GitHub token',
    'bearer': 'Bearer token',
    'basic': 'Password',
    'header': 'Header value',
}

/** Per-site TLS modes, offered only for a custom domain (a subdomain follows its base). */
const TLS_OPTIONS: { value: string; label: string }[] = [
    { value: 'auto', label: 'HTTPS when the certificate is ready' },
    { value: 'required', label: 'HTTPS only — don’t serve without a certificate' },
    { value: 'off', label: 'Plain HTTP' },
]

/**
 * Offered poll cadences. Only those at or slower than the account's floor are shown —
 * the floor is the fastest the plan guarantees, and a site is free to be checked less
 * often than that but never more.
 */
const INTERVAL_PRESETS: { sec: number; label: string }[] = [
    { sec: 60, label: 'Every minute' },
    { sec: 300, label: 'Every 5 minutes' },
    { sec: 900, label: 'Every 15 minutes' },
    { sec: 3600, label: 'Every hour' },
    { sec: 6 * 3600, label: 'Every 6 hours' },
    { sec: 24 * 3600, label: 'Once a day' },
]

/** Human cadence for the "plan default" option and the help text. */
function cadenceLabel(sec: number): string {
    if (sec % 3600 === 0) return sec === 3600 ? 'every hour' : `every ${sec / 3600} hours`
    if (sec % 60 === 0) return sec === 60 ? 'every minute' : `every ${sec / 60} minutes`
    return `every ${sec} seconds`
}

// The renderer's own fallbacks. The list boxes are pre-filled with the *effective*
// value rather than left blank for "inherit", so what the user sees is what the site
// actually uses — and clearing a box therefore means "none", unambiguously.
const DEFAULT_EXCLUDE = ['*.map']
const DEFAULT_REQUIRE_FILE = ['index.html']

/** Split a textarea's contents into a list — one entry per line, blanks dropped. */
function parseList(text: string): string[] {
    return text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
}

/**
 * The deploy source as form state. `sourceUrl` empty means "the GitHub repo this site
 * was created from" — the site keeps deploying `github.com/<owner>/<name>` and the URL
 * never has to be spelled out.
 */
interface SourceForm {
    sourceType: string
    sourceUrl: string
    branch: string
    subdir: string
    authMethod: string
    authUsername: string
    authHeaderName: string
    checksumUrl: string
    /** `''` = the engine default. */
    stripComponents: string
    allowInsecure: boolean
    /** New credential to store. Blank means "leave whatever is stored alone". */
    secret: string
}

function sourceFormFrom(site: Site): SourceForm {
    return {
        sourceType: site.sourceType ?? 'git',
        sourceUrl: site.sourceUrl ?? '',
        branch: site.branch,
        subdir: site.subdir ?? '',
        authMethod: site.authMethod ?? (site.repoPrivate ? 'github-token' : 'none'),
        authUsername: site.authUsername ?? '',
        authHeaderName: site.authHeaderName ?? '',
        checksumUrl: site.checksumUrl ?? '',
        stripComponents: site.stripComponents !== undefined ? String(site.stripComponents) : '',
        allowInsecure: !!site.allowInsecure,
        secret: '',
    }
}

/** The PATCH body for a source save. Fields belonging to the other kind are sent as `null`. */
function sourcePayload(form: SourceForm) {
    const isGit = form.sourceType === 'git'
    return {
        sourceType: form.sourceType,
        sourceUrl: form.sourceUrl.trim() || null,
        branch: form.branch.trim(),
        subdir: isGit ? form.subdir.trim() || null : null,
        authMethod: form.authMethod,
        authUsername: form.authUsername.trim() || null,
        authHeaderName: form.authMethod === 'header' ? form.authHeaderName.trim() || null : null,
        checksumUrl: isGit ? null : form.checksumUrl.trim() || null,
        stripComponents: isGit || form.stripComponents === '' ? null : Number(form.stripComponents),
        allowInsecure: !isGit && form.allowInsecure,
        // Omitted unless the user typed one: an absent key leaves the stored credential
        // untouched, which is what makes "save the branch" not wipe the deploy key.
        ...(form.secret.trim() ? { sourceSecret: form.secret } : {}),
    }
}

/** Whether two source forms differ — drives the Save button's enabled state. */
function sourceDirty(a: SourceForm, b: SourceForm): boolean {
    return (
        a.sourceType !== b.sourceType ||
        a.sourceUrl.trim() !== b.sourceUrl.trim() ||
        a.branch.trim() !== b.branch.trim() ||
        a.subdir.trim() !== b.subdir.trim() ||
        a.authMethod !== b.authMethod ||
        a.authUsername.trim() !== b.authUsername.trim() ||
        a.authHeaderName.trim() !== b.authHeaderName.trim() ||
        a.checksumUrl.trim() !== b.checksumUrl.trim() ||
        a.stripComponents !== b.stripComponents ||
        a.allowInsecure !== b.allowInsecure ||
        a.secret.trim() !== ''
    )
}

/**
 * Every per-site setting as form state. Values are kept in their edited (string)
 * form so a half-typed number or path never has to round-trip through the model;
 * {@link settingsPayload} converts once, on save.
 */
interface SettingsForm {
    routing: SiteRouting
    notFound: string
    cacheAssets: boolean
    gzip: boolean
    blockExploits: boolean
    tls: string
    hsts: boolean
    advanced: string
    exclude: string
    requireFile: string
    /** `''` = inherit the plan value. */
    keepReleases: string
    /** `''` = inherit the plan floor. */
    intervalSec: string
}

function settingsFormFrom(site: Site): SettingsForm {
    return {
        routing: site.routing ?? 'static',
        notFound: site.notFound ?? '',
        cacheAssets: !!site.cacheAssets,
        gzip: !!site.gzip,
        blockExploits: !!site.blockExploits,
        tls: site.tls ?? 'auto',
        hsts: !!site.hsts,
        advanced: site.advanced ?? '',
        exclude: (site.exclude ?? DEFAULT_EXCLUDE).join('\n'),
        requireFile: (site.requireFile ?? DEFAULT_REQUIRE_FILE).join('\n'),
        keepReleases: site.keepReleases !== undefined ? String(site.keepReleases) : '',
        intervalSec: site.intervalSec !== undefined ? String(site.intervalSec) : '',
    }
}

/** The PATCH body for a settings save. `null` resets a field to its plan/engine default. */
function settingsPayload(form: SettingsForm, isCustomDomain: boolean, canUseAdvanced: boolean) {
    return {
        routing: form.routing,
        // SPA routing serves index.html for every path, so a 404 page can never
        // trigger — clear it in the same PATCH (the field is hidden in that mode).
        notFound: (form.routing === 'spa' ? '' : form.notFound.trim()) || null,
        cacheAssets: form.cacheAssets,
        gzip: form.gzip,
        blockExploits: form.blockExploits,
        // A subdomain's HTTPS belongs to its base domain; sending anything but `null`
        // there is a 400, and rightly so — the form doesn't offer the controls either.
        tls: isCustomDomain ? form.tls : null,
        hsts: isCustomDomain ? form.hsts : false,
        // Omitted entirely without the capability, so a site that still stores an old
        // block isn't silently rewritten to empty by an unrelated save.
        ...(canUseAdvanced ? { advanced: form.advanced.trim() || null } : {}),
        exclude: parseList(form.exclude),
        requireFile: parseList(form.requireFile),
        keepReleases: form.keepReleases === '' ? null : Number(form.keepReleases),
        intervalSec: form.intervalSec === '' ? null : Number(form.intervalSec),
    }
}

/** Whether two settings forms differ — drives the Save button's enabled state. */
function settingsDirty(a: SettingsForm, b: SettingsForm): boolean {
    return (
        a.routing !== b.routing ||
        a.notFound.trim() !== b.notFound.trim() ||
        a.cacheAssets !== b.cacheAssets ||
        a.gzip !== b.gzip ||
        a.blockExploits !== b.blockExploits ||
        a.tls !== b.tls ||
        a.hsts !== b.hsts ||
        a.advanced.trim() !== b.advanced.trim() ||
        parseList(a.exclude).join('\n') !== parseList(b.exclude).join('\n') ||
        parseList(a.requireFile).join('\n') !== parseList(b.requireFile).join('\n') ||
        a.keepReleases !== b.keepReleases ||
        a.intervalSec !== b.intervalSec
    )
}

export function SiteDashboard({
    site,
    limits,
    accountUsage,
    onDeleted,
}: {
    site: Site
    limits: PlanLimits
    /** Account-wide usage, to add an "All your sites" storage bar beside the per-site one. */
    accountUsage?: SiteUsage
    /** Called after the site is deleted (204) — the parent navigates away from the gone page. */
    onDeleted?: () => void
}) {
    const toast = useToast()
    const branding = useBranding()
    const [payload, setPayload] = useState<SiteStatusPayload | null>(null)
    const [verifying, setVerifying] = useState(false)
    const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
    const [loadError, setLoadError] = useState(false)
    const [redeploying, setRedeploying] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [deleteMsg, setDeleteMsg] = useState<string | null>(null)
    // Type-to-confirm: the user must type the hostname before Delete enables, so a
    // destructive, irreversible action can't be a single misclick.
    const [confirmText, setConfirmText] = useState('')

    const statusUrl = `/api/sites/${encodeURIComponent(site.id)}/status`

    // One-shot status fetch, shared by the poll loop and the post-redeploy refresh.
    const fetchStatus = useCallback(async (): Promise<SiteStatusPayload | null> => {
        const res = await fetch(statusUrl, { cache: 'no-store' })
        if (!res.ok) throw new Error(`status ${res.status}`)
        return (await res.json()) as SiteStatusPayload
    }, [statusUrl])

    // Poll `/status` on mount and on an interval. The cadence adapts to the latest
    // reading: while a deploy is provisioning/syncing we poll quickly, then relax.
    useEffect(() => {
        let cancelled = false
        let timer: ReturnType<typeof setTimeout> | undefined

        const tick = async () => {
            let latest: SiteStatusPayload | null = null
            try {
                latest = await fetchStatus()
                if (cancelled) return
                setPayload(latest)
                setLoadError(false)
            } catch {
                if (!cancelled) setLoadError(true)
            }
            if (cancelled) return
            const active =
                !!latest?.nginxpilot?.syncing ||
                latest?.site.status === 'provisioning' ||
                latest?.site.status === 'draft'
            timer = setTimeout(tick, active ? POLL_ACTIVE_MS : POLL_IDLE_MS)
        }

        void tick()
        return () => {
            cancelled = true
            if (timer) clearTimeout(timer)
        }
    }, [fetchStatus])

    const redeploy = useCallback(async () => {
        setRedeploying(true)
        try {
            const res = await fetch(`/api/sites/${encodeURIComponent(site.id)}/redeploy`, { method: 'POST' })
            if (!res.ok) {
                const data = (await res.json().catch(() => ({}))) as { error?: unknown }
                toast.show(redeployError(data.error, res.status), { variant: 'error', title: 'Redeploy failed' })
                return
            }
            toast.show('Redeploy started — Quaykeeper is fetching the latest commit.', { variant: 'success' })
            // Pull a fresh reading so the build card flips to "running" promptly.
            try {
                const next = await fetchStatus()
                setPayload(next)
            } catch {
                /* the poll loop will catch up */
            }
        } catch {
            toast.show('Network error starting the redeploy. Check your connection and try again.', {
                variant: 'error',
                title: 'Redeploy failed',
            })
        } finally {
            setRedeploying(false)
        }
    }, [site.id, fetchStatus, toast])

    // ── per-site settings (serving / HTTPS / source controls / raw nginx) ─────────
    // Form state + the last-saved baseline: `site` is a one-shot prop from the page
    // loader, so after a successful PATCH the baseline advances to what the server
    // accepted and the Save button re-disables until the form drifts again. One form
    // and one Save for the whole group — every setting rides the same re-render + sync.
    const [serving, setServing] = useState<SettingsForm>(() => settingsFormFrom(site))
    const [servingBase, setServingBase] = useState<SettingsForm>(() => settingsFormFrom(site))
    const [savingServing, setSavingServing] = useState(false)

    const isCustomDomain = site.hostKind === 'custom'
    const canUseAdvanced = !!limits.advancedConfig
    const servingDirty = settingsDirty(serving, servingBase)

    const saveServing = useCallback(async () => {
        setSavingServing(true)
        try {
            const res = await fetch(`/api/sites/${encodeURIComponent(site.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settingsPayload(serving, isCustomDomain, canUseAdvanced)),
            })
            if (!res.ok) {
                const data = (await res.json().catch(() => ({}))) as { error?: unknown }
                toast.show(servingError(data.error, res.status), { variant: 'error', title: 'Settings not saved' })
                return
            }
            const updated = (await res.json()) as Site
            const next = settingsFormFrom(updated)
            setServing(next)
            setServingBase(next)
            toast.show('Settings saved — redeploying with the new configuration.', { variant: 'success' })
            // Pull a fresh reading so the status cards flip to "provisioning" promptly.
            try {
                setPayload(await fetchStatus())
            } catch {
                /* the poll loop will catch up */
            }
        } catch {
            toast.show('Network error saving the settings. Check your connection and try again.', {
                variant: 'error',
                title: 'Settings not saved',
            })
        } finally {
            setSavingServing(false)
        }
    }, [site.id, serving, isCustomDomain, canUseAdvanced, fetchStatus, toast])

    // ── deploy source (kind / URL / branch / auth) ───────────────────────────────
    // Its own form and Save, separate from the settings group: changing the source
    // alters nginxpilot's source fingerprint, which makes it discard stored refs and
    // resync from scratch. That is a heavier, more deliberate action than flipping gzip.
    const [source, setSource] = useState<SourceForm>(() => sourceFormFrom(site))
    const [sourceBase, setSourceBase] = useState<SourceForm>(() => sourceFormFrom(site))
    const [savingSource, setSavingSource] = useState(false)
    const isSourceDirty = sourceDirty(source, sourceBase)
    const secretStoredAt = payload?.sourceSecretSetAt ?? null

    const authOptions = useMemo(() => {
        if (source.sourceType !== 'git') return ARCHIVE_AUTH
        return looksLikeSsh(source.sourceUrl) ? GIT_SSH_AUTH : GIT_HTTPS_AUTH
    }, [source.sourceType, source.sourceUrl])

    // Switching kind or URL scheme can strand an auth method the server would reject, so
    // fall back to the first offered one rather than letting the form submit an
    // impossible combination.
    useEffect(() => {
        if (!authOptions.some((o) => o.value === source.authMethod)) {
            setSource((s) => ({ ...s, authMethod: authOptions[0].value }))
        }
    }, [authOptions, source.authMethod])

    const saveSource = useCallback(async () => {
        setSavingSource(true)
        try {
            const res = await fetch(`/api/sites/${encodeURIComponent(site.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sourcePayload(source)),
            })
            if (!res.ok) {
                const data = (await res.json().catch(() => ({}))) as { error?: unknown }
                toast.show(servingError(data.error, res.status), { variant: 'error', title: 'Source not saved' })
                return
            }
            const updated = (await res.json()) as Site
            const next = sourceFormFrom(updated)
            setSource(next)
            setSourceBase(next)
            toast.show('Source saved — fetching from the new location.', { variant: 'success' })
            try {
                setPayload(await fetchStatus())
            } catch {
                /* the poll loop will catch up */
            }
        } catch {
            toast.show('Network error saving the source. Check your connection and try again.', {
                variant: 'error',
                title: 'Source not saved',
            })
        } finally {
            setSavingSource(false)
        }
    }, [site.id, source, fetchStatus, toast])

    // Cadence + retention choices, bounded by the account's plan.
    const intervalOptions = useMemo(() => {
        const floor = limits.minIntervalSec
        return [
            { value: '', label: `Plan default (${cadenceLabel(floor)})` },
            ...INTERVAL_PRESETS.filter((p) => p.sec >= floor).map((p) => ({
                value: String(p.sec),
                label: p.label,
            })),
        ]
    }, [limits.minIntervalSec])

    const keepReleasesOptions = useMemo(() => {
        const cap = Number.isFinite(limits.keepReleases) ? limits.keepReleases : 5
        return [
            { value: '', label: `Plan default (${cap})` },
            ...Array.from({ length: cap }, (_, i) => ({
                value: String(i + 1),
                label: i === 0 ? '1 (no rollback history)' : String(i + 1),
            })),
        ]
    }, [limits.keepReleases])

    // The type-to-confirm field; reads its value live into `confirmText`.
    const confirmInputRef = useTc<HTMLElement & { value: string }>(undefined, {
        input: (e: Event) => setConfirmText(targetValue(e)),
    })

    // Delete-confirm modal. `tc-hidden` clears any stale error AND the typed
    // confirmation so reopening is clean; the ref drives show()/hide() imperatively.
    const deleteModalRef = useTc<HTMLElement & { show(): void; hide(): void }>(undefined, {
        'tc-hidden': () => {
            setDeleteMsg(null)
            setConfirmText('')
            if (confirmInputRef.current) confirmInputRef.current.value = ''
        },
    })

    const canDelete = confirmText.trim() === site.hostname

    const confirmDelete = useCallback(async () => {
        if (confirmText.trim() !== site.hostname) return
        setDeleting(true)
        setDeleteMsg(null)
        try {
            const res = await fetch(`/api/sites/${encodeURIComponent(site.id)}`, { method: 'DELETE' })
            if (res.status === 204) {
                deleteModalRef.current?.hide()
                onDeleted?.()
                return
            }
            const data = (await res.json().catch(() => ({}))) as { error?: unknown }
            setDeleteMsg(deleteError(data.error, res.status))
        } catch {
            setDeleteMsg('Network error deleting the site. Check your connection and try again.')
        } finally {
            setDeleting(false)
        }
    }, [site.id, site.hostname, confirmText, onDeleted, deleteModalRef])

    // Custom-domain DNS verification (§10, §729). POSTs to verify-domain; on a
    // confirmed A-record the server installs the vhost + cert and marks the site live.
    const verifyDomain = useCallback(async () => {
        setVerifying(true)
        try {
            const res = await fetch(`/api/sites/${encodeURIComponent(site.id)}/verify-domain`, { method: 'POST' })
            const data = (await res.json().catch(() => ({}))) as Partial<VerifyResult> & { error?: string }
            if (!res.ok) {
                const code = data.error
                const msg =
                    code === 'ingress_unconfigured'
                        ? 'No server IP is configured yet — ask the owner to set it in admin Settings.'
                        : code
                          ? `Verification failed: ${code}.`
                          : `Verification failed (HTTP ${res.status}).`
                toast.show(msg, { variant: 'error', title: 'Domain not verified' })
                return
            }
            const result = data as VerifyResult
            setVerifyResult(result)
            if (result.provisioned) {
                toast.show('Domain verified — certificate issued and the site is going live.', { variant: 'success' })
                // Pull fresh status so the build/status cards reflect the new live state.
                try {
                    setPayload(await fetchStatus())
                } catch {
                    /* the poll loop will catch up */
                }
            } else if (result.verified) {
                toast.show('Domain already verified and serving.', { variant: 'success' })
            } else {
                toast.show(`${result.domain} does not point at ${result.expected} yet.`, {
                    variant: 'warning',
                    title: 'DNS not pointing here yet',
                })
            }
        } catch {
            toast.show('Network error verifying the domain. Try again.', { variant: 'error' })
        } finally {
            setVerifying(false)
        }
    }, [site.id, fetchStatus, toast])

    const view = useMemo(
        () => (payload ? buildSiteDashboard(payload, limits, accountUsage) : null),
        [payload, limits, accountUsage],
    )

    // ── tc-* element refs (object props flow through lib/tc.ts) ──────────────────
    const statusCardRef = useTc<HTMLElement>(useMemo(() => ({ items: view?.statusItems ?? [] }), [view]))
    const usageRef = useTc<HTMLElement>(useMemo(() => ({ usage: view?.usage ?? [] }), [view]))

    // The custom-domain A/AAAA records, rendered through the same tc-code-snippet
    // the create-site wizard uses (copy button + mono framing) instead of a bespoke
    // <pre>. Driven via the `code` property so the multi-line value flows through the
    // lib/tc.ts bridge; only rendered when an ingress IP is configured.
    const dnsCode = useMemo(() => {
        const lines = [`A     ${site.hostname}    ${branding.ingressIpv4}`]
        if (branding.ingressIpv6) lines.push(`AAAA  ${site.hostname}    ${branding.ingressIpv6}`)
        return lines.join('\n')
    }, [site.hostname, branding.ingressIpv4, branding.ingressIpv6])
    const dnsSnippetRef = useTc<HTMLElement>(useMemo(() => ({ code: dnsCode }), [dnsCode]))

    const loading = !view
    const head = view?.headline

    return (
        <section className="quaykeeper-site" aria-label={`Site ${site.hostname}`}>
            {/* Page toolbar: live status + identity on the left, primary action on the
                right. Delete lives in an overflow menu so the destructive action can't
                sit shoulder-to-shoulder with Redeploy. */}
            <header className="quaykeeper-site-toolbar">
                <div className="quaykeeper-site-ident">
                    {head ? (
                        <tc-status-dot status={head.dot} label={head.label} pulse={head.pulse || undefined} />
                    ) : (
                        <tc-status-dot status="away" label="Loading…" />
                    )}
                    <div className="quaykeeper-site-id">
                        <h2 className="quaykeeper-site-host">{site.hostname}</h2>
                        <p className="quaykeeper-site-source">
                            {site.repoOwner}/{site.repoName} · {site.branch}
                            {site.subdir ? ` · ${site.subdir}` : ''}
                        </p>
                    </div>
                </div>
                <div className="quaykeeper-site-actions">
                    <tc-button variant="primary" onClick={redeploy} disabled={redeploying || undefined}>
                        {redeploying ? 'Redeploying…' : 'Redeploy'}
                    </tc-button>
                    <tc-dropdown className="quaykeeper-site-menu" label="More" variant="secondary" direction="down">
                        <tc-dropdown-item
                            className="quaykeeper-danger-item"
                            onClick={() => deleteModalRef.current?.show()}
                        >
                            Delete site
                        </tc-dropdown-item>
                    </tc-dropdown>
                </div>
            </header>

            {loadError && (
                <p className="quaykeeper-site-loaderror" role="alert">
                    Couldn’t reach the deploy engine for live status. Retrying…
                </p>
            )}

            {/* Last-known-good semantics, stated plainly (§9 step 5). */}
            <p className="quaykeeper-site-note">{view?.lastKnownGood ?? 'Loading deploy status…'}</p>

            {/* Build + status on the left, storage on the right. tc-grid is a pure
                layout primitive (it never relocates its children), so it's safely
                inside the relocation boundary; it collapses to one column on mobile
                via the mobile-first columns ladder (1 → md 3fr/2fr). */}
            <tc-grid
                className="quaykeeper-site-grid"
                columns="minmax(0, 1fr)"
                columns-md="minmax(0, 3fr) minmax(0, 2fr)"
                gap="1rem"
            >
                <div className="quaykeeper-site-col">
                    {/* Last deploy + Redeploy */}
                    {view ? (
                        <tc-build
                            name={view.build.name}
                            status={view.build.status}
                            date={view.build.date}
                            size={view.build.size}
                            badge={view.build.badge}
                            badge-variant={view.build.badgeVariant}
                        />
                    ) : (
                        <tc-build loading name={site.hostname} />
                    )}
                    <tc-status-card ref={statusCardRef} title="Status" loading={loading || undefined} />
                </div>

                <div className="quaykeeper-site-col">
                    <tc-usage-summary-panel ref={usageRef} title="Storage" loading={loading || undefined} />
                </div>
            </tc-grid>

            {/* Deploy source. Its own Save, because changing it makes nginxpilot treat the
                site as a brand-new source and resync from scratch — heavier than a settings
                change, which only re-renders the server block. */}
            <tc-section-card title="Source" icon="git-branch">
                <div className="quaykeeper-site-serving">
                    <SelectField
                        label="Source type"
                        value={source.sourceType}
                        options={SOURCE_TYPE_OPTIONS}
                        onValue={(value) => setSource((s) => ({ ...s, sourceType: value }))}
                        help="A git repository is cloned and served. An archive is downloaded and unpacked — for content built elsewhere, like a CI-published zip."
                    />
                    <TextField
                        label={source.sourceType === 'git' ? 'Repository URL' : 'Archive URL'}
                        value={source.sourceUrl}
                        onValue={(value) => setSource((s) => ({ ...s, sourceUrl: value }))}
                        placeholder={
                            source.sourceType === 'git'
                                ? `https://github.com/${site.repoOwner}/${site.repoName}.git`
                                : 'https://ci.example.com/site.zip'
                        }
                        help={
                            source.sourceType === 'git'
                                ? 'Leave blank to keep deploying the GitHub repository this site was created from. Any git host works — https://… or git@host:owner/repo.git for a deploy key.'
                                : 'The archive to download and unpack on each check.'
                        }
                    />
                    {source.sourceType === 'git' ? (
                        <>
                            <TextField
                                label="Branch"
                                value={source.branch}
                                onValue={(value) => setSource((s) => ({ ...s, branch: value }))}
                                placeholder="main"
                                help="The branch whose contents are published."
                            />
                            <TextField
                                label="Build subdirectory (optional)"
                                value={source.subdir}
                                onValue={(value) => setSource((s) => ({ ...s, subdir: value }))}
                                placeholder="dist/"
                                help="The folder inside the branch that holds index.html. Leave blank if the site is at the repository root."
                            />
                        </>
                    ) : (
                        <>
                            <TextField
                                label="Checksum URL (optional)"
                                value={source.checksumUrl}
                                onValue={(value) => setSource((s) => ({ ...s, checksumUrl: value }))}
                                placeholder="https://ci.example.com/site.zip.sha256"
                                help="A checksum file the archive is verified against before anything is published. Strongly recommended."
                            />
                            <TextField
                                label="Strip leading folders"
                                type="number"
                                min="0"
                                max="16"
                                value={source.stripComponents}
                                onValue={(value) => setSource((s) => ({ ...s, stripComponents: value }))}
                                placeholder="0"
                                help="Set to 1 when the archive wraps everything in a single top-level folder, so that folder isn't part of every URL."
                            />
                            <SwitchField
                                label="Allow an insecure (http://) URL"
                                checked={source.allowInsecure}
                                onChecked={(checked) => setSource((s) => ({ ...s, allowInsecure: checked }))}
                                help="Only for an archive on a trusted internal network. Over plain http the download can be read and altered in transit — pair it with a checksum URL at minimum."
                            />
                        </>
                    )}
                    <SelectField
                        label="Authentication"
                        value={source.authMethod}
                        options={authOptions}
                        onValue={(value) => setSource((s) => ({ ...s, authMethod: value }))}
                        help="How Quaykeeper proves it may fetch this source. An ssh URL always uses a deploy key."
                    />
                    {(source.authMethod === 'https-token' || source.authMethod === 'basic') && (
                        <TextField
                            label="Username"
                            value={source.authUsername}
                            onValue={(value) => setSource((s) => ({ ...s, authUsername: value }))}
                            help="The account the token or password belongs to."
                        />
                    )}
                    {source.authMethod === 'header' && (
                        <TextField
                            label="Header name"
                            value={source.authHeaderName}
                            onValue={(value) => setSource((s) => ({ ...s, authHeaderName: value }))}
                            placeholder="X-Api-Key"
                            help="The request header the credential is sent in."
                        />
                    )}
                    {source.authMethod !== 'none' &&
                        !(source.authMethod === 'github-token' && !source.sourceUrl.trim()) && (
                            <TextAreaField
                                label={SECRET_LABEL[source.authMethod] ?? 'Credential'}
                                value={source.secret}
                                onValue={(value) => setSource((s) => ({ ...s, secret: value }))}
                                rows={source.authMethod === 'ssh-key' ? 6 : 2}
                                placeholder={
                                    source.authMethod === 'ssh-key'
                                        ? '-----BEGIN OPENSSH PRIVATE KEY-----'
                                        : undefined
                                }
                                help={
                                    secretStoredAt
                                        ? 'A credential is already stored and can’t be shown. Leave this blank to keep it, or paste a new one to replace it.'
                                        : 'Stored encrypted and never shown again. Quaykeeper passes it to the deploy engine as a file it reads at fetch time.'
                                }
                            />
                        )}
                    {source.authMethod === 'github-token' && !source.sourceUrl.trim() && (
                        <p className="quaykeeper-site-note">
                            This site authenticates with your GitHub sign-in — nothing to enter, and it refreshes
                            itself each time you sign in.
                        </p>
                    )}
                    <div className="quaykeeper-site-actions">
                        <tc-button
                            variant="primary"
                            onClick={saveSource}
                            disabled={savingSource || !isSourceDirty || undefined}
                        >
                            {savingSource ? 'Saving…' : 'Save source'}
                        </tc-button>
                    </div>
                </div>
            </tc-section-card>

            {/* Serving settings (routing / 404 page / asset caching). Saving PATCHes the
                site; the server re-renders the nginxpilot fragment and re-syncs, so the
                status cards flip to "provisioning" until the new config is live. */}
            <tc-section-card title="Serving" icon="route">
                <div className="quaykeeper-site-serving">
                    <SelectField
                        label="Routing"
                        value={serving.routing}
                        onValue={(value) => setServing((s) => ({ ...s, routing: value as SiteRouting }))}
                        options={ROUTING_OPTIONS}
                        help="How request paths map to files. Pick the single-page-app mode for client-side routers; clean URLs suit pre-rendered about.html-style pages."
                    />
                    <div hidden={serving.routing === 'spa' || undefined}>
                        <TextField
                            label="Custom 404 page (optional)"
                            value={serving.notFound}
                            onValue={(value) => setServing((s) => ({ ...s, notFound: value }))}
                            placeholder="/404.html"
                            help="A page in the build served for unknown paths instead of the plain nginx 404."
                        />
                    </div>
                    <SwitchField
                        label="Long-lived asset caching"
                        checked={serving.cacheAssets}
                        onChecked={(checked) => setServing((s) => ({ ...s, cacheAssets: checked }))}
                        help="Serve fingerprinted assets (CSS, JS, fonts, images) with an immutable Cache-Control header. Use when the build hashes its asset filenames."
                    />
                    <SwitchField
                        label="Compress responses (gzip)"
                        checked={serving.gzip}
                        onChecked={(checked) => setServing((s) => ({ ...s, gzip: checked }))}
                        help="Gzip text responses (HTML, CSS, JS, JSON) on the way out. Worth having on for almost any static site; already-compressed images and video are skipped."
                    />
                    <SwitchField
                        label="Block common exploit probes"
                        checked={serving.blockExploits}
                        onChecked={(checked) => setServing((s) => ({ ...s, blockExploits: checked }))}
                        help="Reject the request patterns automated scanners use (SQL injection, file traversal, known-vulnerable paths) before they reach your files."
                    />
                </div>
            </tc-section-card>

            {/* Content selection: what gets published out of the fetched tree, when the
                gate lets a release go live, how often it's polled, and how much history
                is kept. All four map to the nginxpilot `source` block. */}
            <tc-section-card title="Content" icon="folder">
                <div className="quaykeeper-site-serving">
                    <TextAreaField
                        label="Exclude"
                        value={serving.exclude}
                        onValue={(value) => setServing((s) => ({ ...s, exclude: value }))}
                        rows={3}
                        placeholder="*.map"
                        help="One glob per line — files matching them are never published. Dotfiles like .env and .git are always excluded regardless. Leave empty to publish everything else."
                    />
                    <TextAreaField
                        label="Required files"
                        value={serving.requireFile}
                        onValue={(value) => setServing((s) => ({ ...s, requireFile: value }))}
                        rows={2}
                        placeholder="index.html"
                        help="One path per line. A new build only goes live once all of them exist, so a broken or empty build leaves the previous release serving. Leave empty to publish whatever the build produces."
                    />
                    <SelectField
                        label="Check for updates"
                        value={serving.intervalSec}
                        options={intervalOptions}
                        onValue={(value) => setServing((s) => ({ ...s, intervalSec: value }))}
                        help="How often Quaykeeper looks for a new commit. Choosing a slower cadence than your plan's is fine; Redeploy always fetches immediately."
                    />
                    <SelectField
                        label="Releases kept"
                        value={serving.keepReleases}
                        options={keepReleasesOptions}
                        onValue={(value) => setServing((s) => ({ ...s, keepReleases: value }))}
                        help="How many previous builds stay on disk for rollback. Fewer means less storage used by this site."
                    />
                </div>
            </tc-section-card>

            {/* HTTPS. Custom domains only: a Quaykeeper subdomain is covered by its base
                domain's wildcard certificate, and every label under that certificate has
                to agree, so those switches live in the admin base-domain page instead. */}
            {isCustomDomain && (
                <tc-section-card title="HTTPS" icon="lock">
                    <div className="quaykeeper-site-serving">
                        <SelectField
                            label="Certificate handling"
                            value={serving.tls}
                            options={TLS_OPTIONS}
                            onValue={(value) => setServing((s) => ({ ...s, tls: value }))}
                            help="“HTTPS when ready” serves plain HTTP until the certificate is issued, so the site is never dark. “HTTPS only” refuses to serve at all without one — pick it if a plaintext response would be worse than an outage."
                        />
                        <SwitchField
                            label="Strict-Transport-Security (HSTS)"
                            checked={serving.hsts}
                            onChecked={(checked) => setServing((s) => ({ ...s, hsts: checked }))}
                            help="Tells browsers to only ever reach this domain over HTTPS. Sticky: once sent, a browser keeps refusing plain HTTP for two years even after you turn this off. Turn it on only once HTTPS is working."
                        />
                    </div>
                </tc-section-card>
            )}

            {/* Raw nginx passthrough — only for accounts the owner has granted it. */}
            {canUseAdvanced && (
                <tc-section-card title="Advanced nginx" icon="terminal">
                    <div className="quaykeeper-site-serving">
                        <TextAreaField
                            label="Extra directives"
                            value={serving.advanced}
                            onValue={(value) => setServing((s) => ({ ...s, advanced: value }))}
                            rows={6}
                            placeholder="add_header X-Frame-Options DENY;"
                            help="Injected verbatim into this site's nginx server block. The config is tested before it's applied — if it doesn't parse, this one site stops being served and everything else keeps running."
                        />
                    </div>
                </tc-section-card>
            )}

            {/* One Save for the whole group: every setting above rides the same fragment
                re-render and re-sync, so splitting it per card would mean several redeploys
                for what is one intended change. */}
            <div className="quaykeeper-site-actions">
                <tc-button variant="primary" onClick={saveServing} disabled={savingServing || !servingDirty || undefined}>
                    {savingServing ? 'Saving…' : 'Save settings'}
                </tc-button>
            </div>

            {/* Custom-domain A-record + Verify (§10). Only for custom-domain sites —
                subdomains are covered by the wildcard server block and need no DNS work. */}
            {site.hostKind === 'custom' && (
                <tc-section-card title="Custom domain" icon="globe">
                    <div className="quaykeeper-site-domain">
                        <p className="quaykeeper-site-note">
                            Point <strong>{site.hostname}</strong> at this server, then verify. Quaykeeper confirms the DNS
                            and issues the TLS certificate before going live.
                        </p>
                        {branding.ingressIpv4 ? (
                            <tc-code-snippet ref={dnsSnippetRef} language="dns" title="DNS records" />
                        ) : (
                            <tc-banner variant="warning">
                                No server IP is configured yet — the owner must set it in admin Settings.
                            </tc-banner>
                        )}
                        {verifyResult && (
                            <div className="quaykeeper-site-verify-result" role="status">
                                <tc-status-dot
                                    status={verifyResult.verified ? 'online' : 'away'}
                                    label={
                                        verifyResult.verified
                                            ? verifyResult.provisioned
                                                ? 'Verified — going live'
                                                : 'Verified'
                                            : 'Not pointing here yet'
                                    }
                                />
                                <p className="quaykeeper-site-note">
                                    Expected <strong>{verifyResult.expected}</strong>; resolved{' '}
                                    {verifyResult.resolved.length ? verifyResult.resolved.join(', ') : '(no A record)'}.
                                </p>
                            </div>
                        )}
                        <div className="quaykeeper-site-actions">
                            <tc-button
                                variant="primary"
                                onClick={verifyDomain}
                                disabled={verifying || !branding.ingressIpv4 || undefined}
                            >
                                {verifying ? 'Verifying…' : 'Verify domain'}
                            </tc-button>
                        </div>
                    </div>
                </tc-section-card>
            )}

            {/* Delete confirmation. Body is one stable wrapper div (the modal relocates
                children into its body once at connect, so conditional content must live
                inside a node that's always present, not be a direct modal child). */}
            <tc-modal ref={deleteModalRef} title="Delete site" centered static-backdrop>
                <div className="quaykeeper-site-delete-body">
                    <p>
                        Permanently delete <strong>{site.hostname}</strong>? Quaykeeper removes its serving config and
                        deployed files. This cannot be undone.
                    </p>
                    <label className="quaykeeper-site-delete-confirm">
                        <span className="quaykeeper-wizard-field-label">
                            Type <strong>{site.hostname}</strong> to confirm
                        </span>
                        <tc-input ref={confirmInputRef} placeholder={site.hostname} autocomplete="off" />
                    </label>
                    {deleteMsg && <tc-banner variant="danger">{deleteMsg}</tc-banner>}
                </div>
                <tc-button
                    slot="footer"
                    variant="secondary"
                    outline
                    onClick={() => deleteModalRef.current?.hide()}
                    disabled={deleting || undefined}
                >
                    Cancel
                </tc-button>
                <tc-button
                    slot="footer"
                    variant="danger"
                    onClick={confirmDelete}
                    disabled={deleting || !canDelete || undefined}
                >
                    {deleting ? 'Deleting…' : 'Delete site'}
                </tc-button>
            </tc-modal>
        </section>
    )
}
