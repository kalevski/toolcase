'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTc, targetValue } from '@/lib/tc'
import { useToast } from './Toast'
import { useBranding } from '@/lib/branding-context'
import { SelectField, SwitchField, TextField } from './fields'
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
    invalid_traversal: 'The 404 page must be an absolute site path like /404.html, without "..".',
    invalid_charset: 'The 404 page path contains characters that are not allowed.',
    invalid_too_long: 'The 404 page path is too long.',
    routing_conflict:
        'A custom 404 page can’t be combined with single-page-app routing — the SPA fallback serves index.html for every path.',
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

/** The serving settings as form state (routing normalized, 404 page as raw text). */
interface ServingForm {
    routing: SiteRouting
    notFound: string
    cacheAssets: boolean
}

function servingFormFrom(site: Site): ServingForm {
    return {
        routing: site.routing ?? 'static',
        notFound: site.notFound ?? '',
        cacheAssets: !!site.cacheAssets,
    }
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

    // ── serving settings (routing / 404 page / asset caching) ────────────────────
    // Form state + the last-saved baseline: `site` is a one-shot prop from the page
    // loader, so after a successful PATCH the baseline advances to what the server
    // accepted and the Save button re-disables until the form drifts again.
    const [serving, setServing] = useState<ServingForm>(() => servingFormFrom(site))
    const [servingBase, setServingBase] = useState<ServingForm>(() => servingFormFrom(site))
    const [savingServing, setSavingServing] = useState(false)

    const servingDirty =
        serving.routing !== servingBase.routing ||
        serving.notFound.trim() !== servingBase.notFound ||
        serving.cacheAssets !== servingBase.cacheAssets

    const saveServing = useCallback(async () => {
        setSavingServing(true)
        try {
            // SPA routing serves index.html for every path, so a 404 page can never
            // trigger — clear it in the same PATCH (the field is hidden in that mode).
            const notFound = serving.routing === 'spa' ? '' : serving.notFound.trim()
            const res = await fetch(`/api/sites/${encodeURIComponent(site.id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    routing: serving.routing,
                    notFound: notFound || null,
                    cacheAssets: serving.cacheAssets,
                }),
            })
            if (!res.ok) {
                const data = (await res.json().catch(() => ({}))) as { error?: unknown }
                toast.show(servingError(data.error, res.status), { variant: 'error', title: 'Settings not saved' })
                return
            }
            const updated = (await res.json()) as Site
            const next = servingFormFrom(updated)
            setServing(next)
            setServingBase(next)
            toast.show('Serving settings saved — redeploying with the new configuration.', { variant: 'success' })
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
    }, [site.id, serving, fetchStatus, toast])

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
                    <div className="quaykeeper-site-actions">
                        <tc-button
                            variant="primary"
                            onClick={saveServing}
                            disabled={savingServing || !servingDirty || undefined}
                        >
                            {savingServing ? 'Saving…' : 'Save serving settings'}
                        </tc-button>
                    </div>
                </div>
            </tc-section-card>

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
