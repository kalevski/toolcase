'use client'

import { useCallback, useMemo, useState } from 'react'
import type { TableColumn, TabBarItem } from '@toolcase/web-components'
import { escapeHtml, useTc } from '@/lib/tc'
import type {
    NginxpilotCert,
    AcmeCredentialInfo,
    CertIssueAccepted,
    CertJob,
    CertsRenewalStatus,
} from '@/server/infrastructure/nginxpilot'
import {
    CertInputError,
    INI_TEMPLATE_PROVIDERS,
    KNOWN_PROVIDERS,
    iniTemplate,
    mechanismLabel,
    providerSpec,
    renderIniCredentials,
} from '@/server/domain/cert-input'
import type { AcmeCredentialRequest } from '@/server/domain/cert-input'
import { iconBtnHtml } from '@/lib/action-icons'
import { AdminPage, json, useOwnerData } from './shared'
import { DataTable } from '@/components/DataTable'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { TextField, TextAreaField, SelectField, SwitchField } from '@/components/fields'
import { useToast } from '@/components/Toast'

// Owner-only certificate management for the active realm (cert_feature.md). nginxpilot now
// *issues* (certbot), accepts *manual uploads*, *renews*, and *deletes* certs, and stores
// per-provider ACME DNS credentials — all over its admin API. This page drives that whole
// surface through `/api/admin/certificates*` + `/api/admin/acme-credentials*`:
//
//   • Discovered certificates — the live cert index, with per-row Renew / Delete and a
//     "Renew due" action (POST /certs/renew).
//   • Issue a certificate — certbot issuance (POST /certs); supports a leading wildcard
//     (DNS-01 only — the daemon enforces it) and a staging toggle.
//   • Upload a certificate — bring-your-own cert/key pair (PUT /certs/{domain}); no certbot.
//   • DNS provider credentials — the runtime store (PUT/GET/DELETE /acme/credentials).
//
// Secret material (private keys, provider tokens) is POSTed but NEVER read back: the list
// endpoints return metadata only. Issuance / credential ops require `acme.enabled` on the
// daemon; a `not_enabled` reply is surfaced inline rather than hidden.

// ── shared types + helpers ──────────────────────────────────────────────────────────

interface CertsData {
    certs: NginxpilotCert[]
    credentials: AcmeCredentialInfo[]
    /** Renewal-scheduler summary (A6); null when /status failed or omitted the block. */
    renewal: CertsRenewalStatus | null
    /** Recent async issuance jobs (impl §2) — best-effort; ephemeral on the daemon. */
    jobs: CertJob[]
}

interface ApiResult<T = unknown> {
    ok: boolean
    status: number
    message?: string
    data?: T
}

/** One JSON/text mutation against an admin API route, classified into a uniform result. */
async function callApi<T = unknown>(
    url: string,
    method: string,
    body?: unknown,
): Promise<ApiResult<T>> {
    try {
        const res = await fetch(url, {
            method,
            cache: 'no-store',
            headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        })
        const text = await res.text()
        let parsed: unknown = null
        if (text) {
            try {
                parsed = JSON.parse(text)
            } catch {
                parsed = { _text: text }
            }
        }
        const obj = (parsed ?? {}) as { message?: string; error?: string }
        if (!res.ok) {
            return { ok: false, status: res.status, message: obj.message || obj.error || `error ${res.status}` }
        }
        return { ok: true, status: res.status, data: parsed as T }
    } catch {
        return { ok: false, status: 0, message: 'network error' }
    }
}

/** A Bootstrap-compatible pill (painted by tc-* style.css). */
function badge(variant: string, text: string): string {
    return `<span class="badge text-bg-${variant}">${escapeHtml(text)}</span>`
}

const MUTED = '<span class="quaykeeper-admin-hint">—</span>'

/** Localised short date, or a muted dash when absent/unparseable. */
function fmtDate(iso?: string): string {
    if (!iso) return MUTED
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return escapeHtml(iso)
    return escapeHtml(
        d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
    )
}

/**
 * Days in a Go duration string ("720h0m0s", "12h", "36h30m") — the shape the daemon's
 * renewal scheduler reports `renew_before` / `check_interval` in. NaN when unparseable.
 */
function goDurationDays(dur?: string): number {
    if (!dur) return NaN
    let hours = 0
    let matched = false
    for (const m of dur.matchAll(/([0-9]+(?:\.[0-9]+)?)(h|m|s)/g)) {
        matched = true
        const n = Number(m[1])
        if (m[2] === 'h') hours += n
        else if (m[2] === 'm') hours += n / 60
        else hours += n / 3600
    }
    return matched ? hours / 24 : NaN
}

// Expiry as a coloured pill + date (A6): danger once past OR already inside the
// scheduler's renew_before window (renewal should have happened — something is wrong),
// warning under 30 days, success otherwise. No not_after collapses to a muted dash.
// The daemon's own expires_in_seconds is preferred over recomputing from not_after —
// it removes client-clock skew from the pill (impl "minor").
function expiryCell(
    notAfter: string | undefined,
    expiresInSeconds: number | undefined,
    renewBeforeDays: number,
): string {
    if (!notAfter) return MUTED
    const d = new Date(notAfter)
    if (Number.isNaN(d.getTime())) return escapeHtml(notAfter)
    const days =
        expiresInSeconds !== undefined
            ? Math.floor(expiresInSeconds / 86_400)
            : Math.floor((d.getTime() - Date.now()) / 86_400_000)
    const inRenewWindow = Number.isFinite(renewBeforeDays) && days < renewBeforeDays
    const pill =
        days < 0
            ? badge('danger', 'expired')
            : inRenewWindow
              ? badge('danger', `${days}d left`)
              : days <= 30
                ? badge('warning', `${days}d left`)
                : badge('success', `${days}d left`)
    return `${pill} <span class="quaykeeper-admin-hint">${fmtDate(notAfter)}</span>`
}

// Renewal posture (A6): certbot-managed certs renew themselves ("auto-renew"); a
// manual upload must be re-uploaded before expiry. A sticky scheduler failure shows
// as a danger pill carrying the daemon's reason in the title.
function renewalCell(row: CertRow): string {
    const parts: string[] = [
        row.renewManaged
            ? badge('success', 'auto-renew')
            : badge('secondary', 'manual — re-upload before expiry'),
    ]
    if (row.lastRenewError) {
        parts.push(
            `<span class="badge text-bg-danger" title="${escapeHtml(row.lastRenewError)}">renew failed</span>`,
        )
    } else if (row.lastRenewTime) {
        parts.push(`<span class="quaykeeper-admin-hint">renewed ${fmtDate(row.lastRenewTime)}</span>`)
    }
    return parts.join(' ')
}

// ── page shell ──────────────────────────────────────────────────────────────────────

// The four cert operations are sibling tabs within this one page (a local tc-tab-bar,
// NOT route navigation — they all read the same loaded slice and share one reload). The
// tab bar is property-driven (`tabs` + `onChange` via the ref); `active-id` is the attribute.
type CertTab = 'list' | 'issue' | 'upload' | 'credentials'

const CERT_TABS: TabBarItem[] = [
    { id: 'list', label: 'Certificates', icon: 'shield-check' },
    { id: 'issue', label: 'Issue', icon: 'badge-check' },
    { id: 'upload', label: 'Upload', icon: 'upload' },
    { id: 'credentials', label: 'DNS credentials', icon: 'key-round' },
]

export function AdminCertificates() {
    const [tab, setTab] = useState<CertTab>('list')

    const fetcher = useCallback(async (): Promise<CertsData | null> => {
        try {
            // Certs are the critical slice — a failure errors the page. The credentials store is
            // best-effort: a daemon with acme off (or an older build) still shows the cert table.
            const listing = await fetch('/api/admin/certificates', { cache: 'no-store' }).then((r) =>
                json<{ certs: NginxpilotCert[]; renewal: CertsRenewalStatus | null }>(r),
            )
            let credentials: AcmeCredentialInfo[] = []
            try {
                credentials = await fetch('/api/admin/acme-credentials', { cache: 'no-store' }).then(
                    (r) => json<AcmeCredentialInfo[]>(r),
                )
            } catch {
                credentials = []
            }
            // Recent issuance jobs are an enrichment — a daemon without the list
            // endpoint must not error the page.
            let jobs: CertJob[] = []
            try {
                const body = await fetch('/api/admin/certificates/jobs', { cache: 'no-store' }).then(
                    (r) => json<{ jobs: CertJob[] }>(r),
                )
                jobs = body.jobs ?? []
            } catch {
                jobs = []
            }
            return { certs: listing.certs ?? [], credentials, renewal: listing.renewal ?? null, jobs }
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useOwnerData(fetcher)

    const tabRef = useTc<HTMLElement>(
        useMemo(() => ({ tabs: CERT_TABS, onChange: (id: string) => setTab(id as CertTab) }), []),
    )

    return (
        <AdminPage
            title="Certificates"
            subtitle="Issue, upload, renew, and delete the TLS certificates on the active realm's nginxpilot, and store the DNS-provider credentials certbot uses. Owner-only."
            icon="shield-check"
            iconColor="emerald"
            state={state}
            onRetry={() => void reload()}
        >
            {(data) => (
                <>
                    <tc-tab-bar ref={tabRef} active-id={tab} className="quaykeeper-sub-tabs" />
                    {tab === 'list' && (
                        <>
                            <CertificatesList
                                certs={data.certs}
                                renewal={data.renewal}
                                onChanged={() => void reload()}
                            />
                            <IssueJobsCard jobs={data.jobs} onChanged={() => void reload()} />
                        </>
                    )}
                    {tab === 'issue' && (
                        <IssueCertCard
                            credentials={data.credentials}
                            jobs={data.jobs}
                            onChanged={() => void reload()}
                        />
                    )}
                    {tab === 'upload' && <UploadCertCard onChanged={() => void reload()} />}
                    {tab === 'credentials' && (
                        <CredentialsCard
                            credentials={data.credentials}
                            onChanged={() => void reload()}
                        />
                    )}
                </>
            )}
        </AdminPage>
    )
}

// ── discovered certificates (table + row actions + renew-due) ────────────────────────

interface CertRow extends Record<string, unknown> {
    domain: string
    names: string[]
    issuer?: string
    notAfter?: string
    expiresInSeconds?: number
    modTime: string
    renewManaged: boolean
    lastRenewTime?: string
    lastRenewError?: string
}

function certActionsHtml(domain: string): string {
    return (
        `<span class="quaykeeper-admin-domain-controls">` +
        iconBtnHtml({ icon: 'renew', label: `Renew ${domain}`, data: { action: 'renew', domain } }) +
        iconBtnHtml({ icon: 'remove', label: `Delete ${domain}`, danger: true, data: { action: 'delete', domain } }) +
        `</span>`
    )
}

const certColumns = (renewBeforeDays: number): TableColumn[] => [
    {
        key: 'domain',
        header: 'Domain',
        render: (row: CertRow) => `<span class="quaykeeper-admin-mono">${escapeHtml(row.domain)}</span>`,
    },
    {
        key: 'names',
        header: 'SAN names',
        render: (row: CertRow) =>
            row.names.length
                ? `<span class="quaykeeper-admin-mono quaykeeper-admin-hint">${escapeHtml(row.names.join(', '))}</span>`
                : MUTED,
    },
    {
        key: 'issuer',
        header: 'Issuer',
        render: (row: CertRow) => (row.issuer ? escapeHtml(row.issuer) : MUTED),
    },
    {
        key: 'notAfter',
        header: 'Expires',
        render: (row: CertRow) => expiryCell(row.notAfter, row.expiresInSeconds, renewBeforeDays),
    },
    {
        key: 'renewal',
        header: 'Renewal',
        render: (row: CertRow) => renewalCell(row),
    },
    {
        key: 'modTime',
        header: 'Updated',
        render: (row: CertRow) => `<span class="quaykeeper-admin-hint">${fmtDate(row.modTime)}</span>`,
    },
    {
        key: 'actions',
        header: '',
        align: 'right',
        render: (row: CertRow) => certActionsHtml(row.domain),
    },
]

function CertificatesList({
    certs,
    renewal,
    onChanged,
}: {
    certs: NginxpilotCert[]
    renewal: CertsRenewalStatus | null
    onChanged: () => void
}) {
    const toast = useToast()
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [pendingDelete, setPendingDelete] = useState<string | null>(null)

    const rows = useMemo<CertRow[]>(
        () =>
            certs.map((c) => ({
                domain: c.domain,
                names: c.names,
                issuer: c.issuer,
                notAfter: c.not_after,
                expiresInSeconds: c.expires_in_seconds,
                modTime: c.mod_time,
                renewManaged: c.renew_managed,
                lastRenewTime: c.last_renew_time,
                lastRenewError: c.last_renew_error,
            })),
        [certs],
    )

    const renewBeforeDays = goDurationDays(renewal?.renew_before)
    const columns = useMemo(() => certColumns(renewBeforeDays), [renewBeforeDays])

    const renewOne = useCallback(
        async (domain: string) => {
            setError(null)
            const res = await callApi(
                `/api/admin/certificates/${encodeURIComponent(domain)}/renew`,
                'POST',
            )
            if (res.ok) {
                toast.show(`Renewed ${domain}.`, { variant: 'success' })
                onChanged()
            } else {
                setError(`Couldn’t renew ${domain}: ${res.message}`)
            }
        },
        [toast, onChanged],
    )

    const renewDue = useCallback(async () => {
        if (busy) return
        setBusy(true)
        setError(null)
        const res = await callApi<{ output?: string }>('/api/admin/certificates/renew', 'POST')
        setBusy(false)
        if (res.ok) {
            toast.show('Renewal pass complete.', { variant: 'success' })
            onChanged()
        } else {
            setError(`Couldn’t renew due certificates: ${res.message}`)
        }
    }, [busy, toast, onChanged])

    const doDelete = useCallback(async () => {
        const domain = pendingDelete
        if (!domain) return
        setPendingDelete(null)
        setError(null)
        const res = await callApi(`/api/admin/certificates/${encodeURIComponent(domain)}`, 'DELETE')
        if (res.ok) {
            toast.show(`Deleted ${domain}.`, { variant: 'success' })
            onChanged()
        } else {
            setError(`Couldn’t delete ${domain}: ${res.message}`)
        }
    }, [pendingDelete, toast, onChanged])

    const onRowAction = useCallback(
        (action: string, dataset: DOMStringMap) => {
            const domain = dataset.domain
            if (!domain) return
            if (action === 'renew') void renewOne(domain)
            else if (action === 'delete') setPendingDelete(domain)
        },
        [renewOne],
    )

    return (
        <tc-section-card title="Discovered certificates" icon="shield-check">
            <div className="quaykeeper-admin-section">
                <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                    nginxpilot scans its cert directory (certbot live or flat layout) and wires each
                    cert into the matching site or proxy. This reads disk fresh, so renewals show on
                    reload. Renew force-renews one cert by name; Delete removes it (certbot-managed or
                    a manual upload).
                </p>
                {renewal ? (
                    renewal.enabled ? (
                        <tc-banner variant="info">
                            Automatic renewal is on: the daemon checks every {renewal.check_interval} and renews
                            certs inside the {renewal.renew_before} window.
                            {renewal.next_check ? ` Next check: ${fmtDate(renewal.next_check)}.` : ''} Manual Renew
                            stays available as the force path.
                        </tc-banner>
                    ) : (
                        <tc-banner variant="warning">
                            The renewal scheduler is off on this realm (acme disabled or renewal not configured) —
                            certs only renew via the manual Renew buttons here.
                        </tc-banner>
                    )
                ) : null}
                {error && <tc-banner variant="danger">{error}</tc-banner>}

                {rows.length === 0 ? (
                    <tc-empty-state icon="shield-check">
                        No certificates discovered. Issue one below, upload a cert/key pair, or point
                        nginxpilot’s <span className="quaykeeper-admin-mono">tls.cert_dir</span> at its
                        certbot live directory.
                    </tc-empty-state>
                ) : (
                    <DataTable<CertRow>
                        columns={columns}
                        rows={rows}
                        rowKey={(row) => row.domain}
                        onAction={onRowAction}
                    />
                )}

                <div className="quaykeeper-admin-add-row">
                    <tc-button variant="secondary" size="sm" disabled={busy || undefined} onClick={renewDue}>
                        Renew due certificates
                    </tc-button>
                </div>
            </div>
            <ConfirmDialog
                open={!!pendingDelete}
                title="Delete certificate?"
                message={
                    pendingDelete
                        ? `Delete the certificate for ${pendingDelete}. A site or proxy that requires it will be quarantined by nginxpilot’s nginx -t gate until a cert is restored.`
                        : undefined
                }
                confirmLabel="Delete"
                danger
                onConfirm={() => void doDelete()}
                onCancel={() => setPendingDelete(null)}
            />
        </tc-section-card>
    )
}

// ── recent issuance jobs (impl §2) ────────────────────────────────────────────────────

/** State pill variants for the four job states. */
function jobStateBadge(state: CertJob['state']): string {
    const variant =
        state === 'succeeded' ? 'success' : state === 'failed' ? 'danger' : state === 'running' ? 'info' : 'secondary'
    return badge(variant, state)
}

interface JobRow extends Record<string, unknown> {
    id: string
    state: CertJob['state']
    certName: string
    domains: string[]
    staging: boolean
    error?: string
    createdAt: string
    updatedAt: string
}

const JOB_COLUMNS: TableColumn[] = [
    {
        key: 'state',
        header: 'State',
        render: (row: JobRow) => jobStateBadge(row.state),
    },
    {
        key: 'certName',
        header: 'Cert name',
        render: (row: JobRow) =>
            `<span class="quaykeeper-admin-mono">${escapeHtml(row.certName)}</span>${
                row.staging ? ' <span class="badge text-bg-secondary">staging</span>' : ''
            }`,
    },
    {
        key: 'domains',
        header: 'Domains',
        render: (row: JobRow) =>
            row.domains.length
                ? `<span class="quaykeeper-admin-mono quaykeeper-admin-hint">${escapeHtml(row.domains.join(', '))}</span>`
                : MUTED,
    },
    {
        key: 'error',
        header: 'Result',
        render: (row: JobRow) =>
            row.error
                ? `<span class="quaykeeper-admin-hint" title="${escapeHtml(row.error)}">${escapeHtml(
                      row.error.length > 120 ? `${row.error.slice(0, 120)}…` : row.error,
                  )}</span>`
                : MUTED,
    },
    {
        key: 'updatedAt',
        header: 'Updated',
        align: 'right',
        render: (row: JobRow) => `<span class="quaykeeper-admin-hint">${fmtDate(row.updatedAt)}</span>`,
    },
    {
        key: 'actions',
        header: '',
        align: 'right',
        render: (row: JobRow) =>
            row.state === 'pending' || row.state === 'running'
                ? iconBtnHtml({ icon: 'view', label: `Watch job ${row.id}`, data: { action: 'watch', job: row.id } })
                : '',
    },
]

/**
 * Recent async issuance jobs on the realm (`GET /certs/jobs`) — the daemon-side view
 * that survives a closed tab, so a second admin sees in-flight and recently failed
 * issuances. Watch re-enters the poll loop for an in-flight job started elsewhere.
 */
function IssueJobsCard({ jobs, onChanged }: { jobs: CertJob[]; onChanged: () => void }) {
    const toast = useToast()
    const [watching, setWatching] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const watch = useCallback(
        async (jobId: string) => {
            if (watching) return
            setWatching(jobId)
            setError(null)
            const deadline = Date.now() + ISSUE_POLL_MAX_MS
            while (Date.now() < deadline) {
                await delay(ISSUE_POLL_INTERVAL_MS)
                const jr = await callApi<CertJob>(
                    `/api/admin/certificates/jobs/${encodeURIComponent(jobId)}`,
                    'GET',
                )
                if (!jr.ok) {
                    setWatching(null)
                    setError(`Couldn’t check the issuance: ${jr.message}`)
                    return
                }
                const job = jr.data
                if (!job) continue
                if (job.state === 'succeeded') {
                    setWatching(null)
                    toast.show(`Certificate ${job.cert_name} issued.`, { variant: 'success' })
                    onChanged()
                    return
                }
                if (job.state === 'failed') {
                    setWatching(null)
                    setError(`Issuance of ${job.cert_name} failed: ${job.error ?? 'unknown error'}`)
                    onChanged()
                    return
                }
            }
            setWatching(null)
            setError('The issuance is taking longer than expected — refresh shortly.')
        },
        [watching, toast, onChanged],
    )

    const rows = useMemo<JobRow[]>(
        () =>
            jobs.map((j) => ({
                id: j.id,
                state: j.state,
                certName: j.cert_name,
                domains: j.domains ?? [],
                staging: j.staging,
                error: j.error,
                createdAt: j.created_at,
                updatedAt: j.updated_at,
            })),
        [jobs],
    )

    const onRowAction = useCallback(
        (action: string, dataset: DOMStringMap) => {
            if (action === 'watch' && dataset.job) void watch(dataset.job)
        },
        [watch],
    )

    if (rows.length === 0) return null

    return (
        <tc-section-card title="Recent issuance jobs" icon="history">
            <div className="quaykeeper-admin-section">
                <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                    Async certbot runs the daemon still remembers (finished jobs are pruned after about an
                    hour; a daemon restart clears them). An in-flight job started in another tab — or by
                    another admin — can be picked up with Watch.
                </p>
                {error && <tc-banner variant="danger">{error}</tc-banner>}
                {watching && <tc-banner variant="info">Watching the issuance…</tc-banner>}
                <DataTable<JobRow> columns={JOB_COLUMNS} rows={rows} rowKey={(row) => row.id} onAction={onRowAction} />
            </div>
        </tc-section-card>
    )
}

// ── issue a certificate (certbot) ────────────────────────────────────────────────────

// Issuance is async: POST returns 202 + a job id, then we poll the job until it is
// terminal. The ceiling covers the daemon's per-issue timeout (DNS-01 propagation
// ~180s) plus slack; the interval is a gentle poll.
const ISSUE_POLL_INTERVAL_MS = 2000
const ISSUE_POLL_MAX_MS = 360_000
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** One pre-flight verdict as `POST /api/admin/certificates/preflight` returns it (B2). */
interface PreflightRow {
    domain: string
    verdict: string
    detail: string
}

/** Banner tone for a pre-flight verdict — ok is green, wildcard hint is informational. */
function preflightVariant(verdict: string): string {
    if (verdict === 'ok') return 'success'
    if (verdict === 'wildcard_needs_dns') return 'info'
    return 'warning'
}

function IssueCertCard({
    credentials,
    jobs,
    onChanged,
}: {
    credentials: AcmeCredentialInfo[]
    /** Recent issuance jobs (impl §2) — used to warn about an already-running issuance. */
    jobs: CertJob[]
    onChanged: () => void
}) {
    const toast = useToast()
    const [domains, setDomains] = useState('')
    const [certName, setCertName] = useState('')
    const [email, setEmail] = useState('')
    const [provider, setProvider] = useState('')
    const [staging, setStaging] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [progress, setProgress] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    // Advisory pre-flight results (B2) — one row per domain; never gates the submit.
    const [preflight, setPreflight] = useState<PreflightRow[] | null>(null)
    const [testing, setTesting] = useState(false)

    const runPreflight = useCallback(async () => {
        const list = domains.split(/[\s,]+/).filter(Boolean)
        if (!list.length || testing) return
        setTesting(true)
        setPreflight(null)
        const results: PreflightRow[] = []
        for (const d of list) {
            const res = await callApi<PreflightRow>('/api/admin/certificates/preflight', 'POST', { domain: d })
            results.push(
                res.ok && res.data
                    ? res.data
                    : { domain: d, verdict: 'error', detail: res.message ?? 'check failed' },
            )
        }
        setPreflight(results)
        setTesting(false)
    }, [domains, testing])

    // An issuance already in flight on the daemon (any tab, any admin) — warn before a
    // duplicate run; certbot serializes on its lock anyway, so a second run only queues.
    const inFlight = useMemo(() => jobs.filter((j) => j.state === 'pending' || j.state === 'running'), [jobs])

    // The provider select lists the realm's already-stored DNS credentials; the blank
    // option leaves the daemon's configured acme.dns.provider in charge.
    const providerOptions = useMemo(
        () => [
            { value: '', label: 'Daemon default' },
            ...credentials.map((c) => ({ value: c.provider, label: c.provider })),
        ],
        [credentials],
    )

    const submit = useCallback(async () => {
        if (!domains.trim() || busy) return
        setBusy(true)
        setError(null)
        setProgress(null)

        // Start issuance — the daemon accepts the job (202) and runs certbot off-band.
        const start = await callApi<CertIssueAccepted>('/api/admin/certificates', 'POST', {
            domains: domains.trim(),
            cert_name: certName.trim() || undefined,
            email: email.trim() || undefined,
            provider: provider || undefined,
            staging,
        })
        if (!start.ok) {
            setBusy(false)
            setError(
                start.status === 501
                    ? `ACME issuance isn’t enabled on this realm’s nginxpilot (acme.enabled: false). ${start.message ?? ''}`
                    : `Couldn’t start issuance: ${start.message}`,
            )
            return
        }
        const jobId = start.data?.job_id
        if (!jobId) {
            setBusy(false)
            setError('Issuance was accepted but the daemon returned no job id.')
            return
        }

        // Poll the job until it succeeds / fails (or we hit the ceiling).
        setProgress('Issuance queued…')
        const deadline = Date.now() + ISSUE_POLL_MAX_MS
        while (Date.now() < deadline) {
            await delay(ISSUE_POLL_INTERVAL_MS)
            const jr = await callApi<CertJob>(
                `/api/admin/certificates/jobs/${encodeURIComponent(jobId)}`,
                'GET',
            )
            if (!jr.ok) {
                setBusy(false)
                setProgress(null)
                setError(`Couldn’t check issuance status: ${jr.message}`)
                return
            }
            const job = jr.data
            if (!job) continue
            if (job.state === 'succeeded') {
                setBusy(false)
                setProgress(null)
                toast.show('Certificate issued.', { variant: 'success' })
                setDomains('')
                setCertName('')
                setEmail('')
                setProvider('')
                onChanged()
                return
            }
            if (job.state === 'failed') {
                setBusy(false)
                setProgress(null)
                setError(`Couldn’t issue certificate: ${job.error ?? 'unknown error'}`)
                return
            }
            setProgress(job.state === 'running' ? 'Running certbot…' : 'Issuance queued…')
        }
        // Ceiling hit — the job may still finish on the daemon; the cert table will show it.
        setBusy(false)
        setProgress(null)
        setError('Issuance is taking longer than expected — check the Certificates tab shortly.')
    }, [domains, certName, email, provider, staging, busy, toast, onChanged])

    return (
        <tc-section-card title="Issue a certificate" icon="badge-check">
            <div className="quaykeeper-admin-section">
                <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                    Drive certbot on the active realm. List one or more domains (comma- or
                    space-separated). A leading <span className="quaykeeper-admin-mono">*.</span> wildcard
                    is allowed only when the daemon’s challenge is DNS-01. Use staging while testing
                    to avoid the CA’s rate limits.
                </p>
                {error && <tc-banner variant="danger">{error}</tc-banner>}
                {progress && <tc-banner variant="info">{progress}</tc-banner>}
                {inFlight.length > 0 && !busy && (
                    <tc-banner variant="warning">
                        An issuance is already running on this realm:{' '}
                        {inFlight.map((j) => j.cert_name).join(', ')}. Watch it from the Certificates
                        tab before starting another for the same domains.
                    </tc-banner>
                )}
                {preflight?.map((p) => (
                    <tc-banner key={p.domain} variant={preflightVariant(p.verdict)}>
                        <span className="quaykeeper-admin-mono">{p.domain}</span> — {p.detail}
                    </tc-banner>
                ))}
                <form
                    className="quaykeeper-admin-section"
                    onSubmit={(e) => {
                        e.preventDefault()
                        void submit()
                    }}
                >
                    <TextField
                        value={domains}
                        onValue={setDomains}
                        label="Domains"
                        placeholder="example.com, www.example.com, *.example.com"
                        ariaLabel="Domains to issue"
                    />
                    <TextField
                        value={certName}
                        onValue={setCertName}
                        label="Cert name (optional)"
                        help="Defaults to the first domain (wildcards stripped) — also the live/ directory name."
                        placeholder="example.com"
                        ariaLabel="Certificate name"
                    />
                    <TextField
                        value={email}
                        onValue={setEmail}
                        type="email"
                        label="ACME account email (optional)"
                        help="Registered with the CA for this cert. Blank uses the daemon’s configured acme.email."
                        placeholder="ops@example.com"
                        ariaLabel="ACME account email"
                    />
                    <SelectField
                        value={provider}
                        onValue={setProvider}
                        options={providerOptions}
                        label="DNS credentials (optional)"
                        help="Which stored DNS-provider credential certbot uses (DNS-01). Blank uses the daemon’s configured provider."
                        ariaLabel="DNS provider credentials"
                    />
                    <SwitchField
                        checked={staging}
                        onChecked={setStaging}
                        label="Use the CA staging endpoint (testing)"
                        help="Avoids the CA's rate limits while testing; staging certs aren't browser-trusted."
                    />
                    <div className="quaykeeper-admin-add-row">
                        <tc-button
                            variant="secondary"
                            outline
                            disabled={!domains.trim() || testing || busy || undefined}
                            onClick={() => void runPreflight()}
                        >
                            {testing ? 'Testing…' : 'Test before issuing'}
                        </tc-button>
                        <tc-button
                            type="submit"
                            variant="primary"
                            disabled={!domains.trim() || busy || undefined}
                        >
                            {busy ? 'Issuing…' : 'Issue certificate'}
                        </tc-button>
                    </div>
                </form>
            </div>
        </tc-section-card>
    )
}

// ── upload a manual certificate ───────────────────────────────────────────────────────

function UploadCertCard({ onChanged }: { onChanged: () => void }) {
    const toast = useToast()
    const [domain, setDomain] = useState('')
    const [cert, setCert] = useState('')
    const [key, setKey] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const submit = useCallback(async () => {
        if (!domain.trim() || !cert.trim() || !key.trim() || busy) return
        setBusy(true)
        setError(null)
        const res = await callApi(
            `/api/admin/certificates/${encodeURIComponent(domain.trim())}`,
            'PUT',
            { cert, key },
        )
        setBusy(false)
        if (res.ok) {
            toast.show(`Certificate for ${domain.trim()} stored.`, { variant: 'success' })
            setDomain('')
            setCert('')
            setKey('')
            onChanged()
        } else {
            setError(
                res.status === 501
                    ? `No cert directory is configured on this realm’s nginxpilot (tls.cert_dir). ${res.message ?? ''}`
                    : `Couldn’t upload certificate: ${res.message}`,
            )
        }
    }, [domain, cert, key, busy, toast, onChanged])

    return (
        <tc-section-card title="Upload a certificate" icon="upload">
            <div className="quaykeeper-admin-section">
                <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                    Bring your own cert/key pair — no certbot, no ACME. The daemon validates the pair
                    (and rejects an expired cert) before writing it. The private key is stored 0600
                    and never echoed back. Works whenever{' '}
                    <span className="quaykeeper-admin-mono">tls.cert_dir</span> is set.
                </p>
                {error && <tc-banner variant="danger">{error}</tc-banner>}
                <form
                    className="quaykeeper-admin-section"
                    onSubmit={(e) => {
                        e.preventDefault()
                        void submit()
                    }}
                >
                    <TextField
                        value={domain}
                        onValue={setDomain}
                        label="Domain"
                        help="The flat-layout file stem (e.g. example.com) — not a wildcard."
                        placeholder="example.com"
                        ariaLabel="Certificate domain"
                    />
                    <TextAreaField
                        value={cert}
                        onValue={setCert}
                        label="Certificate (PEM — leaf + chain)"
                        rows={5}
                        placeholder={'-----BEGIN CERTIFICATE-----\n...'}
                        ariaLabel="Certificate PEM"
                    />
                    <TextAreaField
                        value={key}
                        onValue={setKey}
                        label="Private key (PEM)"
                        rows={5}
                        placeholder={'-----BEGIN PRIVATE KEY-----\n...'}
                        ariaLabel="Private key PEM"
                    />
                    <div className="quaykeeper-admin-add-row">
                        <tc-button
                            type="submit"
                            variant="primary"
                            disabled={!domain.trim() || !cert.trim() || !key.trim() || busy || undefined}
                        >
                            Upload certificate
                        </tc-button>
                    </div>
                </form>
            </div>
        </tc-section-card>
    )
}

// ── DNS provider credentials store ────────────────────────────────────────────────────

interface CredRow extends Record<string, unknown> {
    provider: string
    mechanism: string
    modTime: string
}

function credActionsHtml(provider: string): string {
    return (
        `<span class="quaykeeper-admin-domain-controls">` +
        iconBtnHtml({ icon: 'remove', label: `Remove ${provider} credentials`, danger: true, data: { action: 'delete', provider } }) +
        `</span>`
    )
}

const CRED_COLUMNS: TableColumn[] = [
    {
        key: 'provider',
        header: 'Provider',
        render: (row: CredRow) => `<span class="quaykeeper-admin-mono">${escapeHtml(row.provider)}</span>`,
    },
    {
        key: 'mechanism',
        header: 'Mechanism',
        render: (row: CredRow) =>
            `<span class="quaykeeper-admin-hint">${escapeHtml(mechanismLabel(row.mechanism))}</span>`,
    },
    {
        key: 'modTime',
        header: 'Updated',
        align: 'right',
        render: (row: CredRow) => `<span class="quaykeeper-admin-hint">${fmtDate(row.modTime)}</span>`,
    },
    {
        key: 'actions',
        header: '',
        align: 'right',
        render: (row: CredRow) => credActionsHtml(row.provider),
    },
]

const OTHER = '__other__'

function CredentialsCard({
    credentials,
    onChanged,
}: {
    credentials: AcmeCredentialInfo[]
    onChanged: () => void
}) {
    const toast = useToast()
    const [error, setError] = useState<string | null>(null)
    const [pendingDelete, setPendingDelete] = useState<string | null>(null)

    // Add/replace form state.
    const [provider, setProvider] = useState(KNOWN_PROVIDERS[0]?.id ?? OTHER)
    const [customProvider, setCustomProvider] = useState('')
    const [useRaw, setUseRaw] = useState(false)
    const [token, setToken] = useState('')
    const [accessKey, setAccessKey] = useState('')
    const [secretKey, setSecretKey] = useState('')
    const [serviceJson, setServiceJson] = useState('')
    const [raw, setRaw] = useState('')
    // Values of the per-provider INI template fields (C4), keyed by INI key.
    const [iniValues, setIniValues] = useState<Record<string, string>>({})
    const [busy, setBusy] = useState(false)

    const spec = provider === OTHER ? undefined : providerSpec(provider)
    // Providers past the five convenience shapes get an INI field template (C4).
    const template = provider === OTHER ? undefined : iniTemplate(provider)
    // "Other" providers and any provider with the raw toggle on use the raw passthrough body.
    const rawMode = provider === OTHER || useRaw

    const providerOptions = useMemo(
        () => [
            ...KNOWN_PROVIDERS.map((p) => ({ value: p.id, label: p.label })),
            ...INI_TEMPLATE_PROVIDERS.map((p) => ({ value: p.id, label: p.label })),
            { value: OTHER, label: 'Other (raw credentials)' },
        ],
        [],
    )

    const rows = useMemo<CredRow[]>(
        () =>
            credentials.map((c) => ({
                provider: c.provider,
                mechanism: c.mechanism,
                modTime: c.mod_time,
            })),
        [credentials],
    )

    const resetForm = useCallback(() => {
        setToken('')
        setAccessKey('')
        setSecretKey('')
        setServiceJson('')
        setRaw('')
        setIniValues({})
        setCustomProvider('')
    }, [])

    const submit = useCallback(async () => {
        if (busy) return
        const targetProvider = provider === OTHER ? customProvider.trim() : provider
        if (!targetProvider) {
            setError('A provider name is required.')
            return
        }
        // Build the request body: raw passthrough, the convenience fields for the shape,
        // or the assembled INI template body (C4).
        let req: AcmeCredentialRequest
        if (rawMode) {
            req = { credentials: raw }
        } else if (spec?.shape === 'token') {
            req = { token }
        } else if (spec?.shape === 'aws') {
            req = { access_key: accessKey, secret_key: secretKey }
        } else if (spec?.shape === 'google') {
            req = { service_account_json: serviceJson }
        } else if (template) {
            try {
                req = { credentials: renderIniCredentials(template, iniValues) }
            } catch (err) {
                setError(err instanceof CertInputError ? err.message : 'The credential fields are incomplete.')
                return
            }
        } else {
            req = { credentials: raw }
        }

        setBusy(true)
        setError(null)
        const res = await callApi(
            `/api/admin/acme-credentials/${encodeURIComponent(targetProvider)}`,
            'PUT',
            req,
        )
        setBusy(false)
        if (res.ok) {
            toast.show(`Stored credentials for ${targetProvider}.`, { variant: 'success' })
            resetForm()
            onChanged()
        } else {
            setError(`Couldn’t store credentials: ${res.message}`)
        }
    }, [
        busy,
        provider,
        customProvider,
        rawMode,
        spec,
        template,
        iniValues,
        raw,
        token,
        accessKey,
        secretKey,
        serviceJson,
        toast,
        resetForm,
        onChanged,
    ])

    const doDelete = useCallback(async () => {
        const p = pendingDelete
        if (!p) return
        setPendingDelete(null)
        setError(null)
        const res = await callApi(`/api/admin/acme-credentials/${encodeURIComponent(p)}`, 'DELETE')
        if (res.ok) {
            toast.show(`Removed credentials for ${p}.`, { variant: 'success' })
            onChanged()
        } else {
            setError(`Couldn’t remove credentials for ${p}: ${res.message}`)
        }
    }, [pendingDelete, toast, onChanged])

    const onRowAction = useCallback((action: string, dataset: DOMStringMap) => {
        if (action === 'delete' && dataset.provider) setPendingDelete(dataset.provider)
    }, [])

    return (
        <tc-section-card title="DNS provider credentials" icon="key-round">
            <div className="quaykeeper-admin-section">
                <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                    The runtime credentials store for DNS-01. Save a provider’s token / key here and
                    nginxpilot uses it on the next issue or renew — no host env wiring. Secrets are
                    write-only: this lists the providers and when they were last set, never the value.
                    Storing credentials requires <span className="quaykeeper-admin-mono">acme.enabled</span>{' '}
                    on the daemon.
                </p>
                {error && <tc-banner variant="danger">{error}</tc-banner>}

                {rows.length === 0 ? (
                    <tc-empty-state icon="key-round">
                        No provider credentials stored. Add one below, or pass credentials via the
                        daemon’s config (<span className="quaykeeper-admin-mono">credentials_env</span> /
                        <span className="quaykeeper-admin-mono"> credentials_file</span>) or ambient SDK env.
                    </tc-empty-state>
                ) : (
                    <DataTable<CredRow>
                        columns={CRED_COLUMNS}
                        rows={rows}
                        rowKey={(row) => row.provider}
                        onAction={onRowAction}
                    />
                )}

                <form
                    className="quaykeeper-admin-section"
                    onSubmit={(e) => {
                        e.preventDefault()
                        void submit()
                    }}
                >
                    <SelectField
                        value={provider}
                        onValue={setProvider}
                        options={providerOptions}
                        label="Provider"
                        ariaLabel="DNS provider"
                    />
                    {provider === OTHER && (
                        <TextField
                            value={customProvider}
                            onValue={setCustomProvider}
                            label="Provider name"
                            help="The certbot DNS-plugin suffix (e.g. rfc2136, ovh, azure)."
                            placeholder="rfc2136"
                            ariaLabel="Custom provider name"
                        />
                    )}
                    {(spec || template) && (
                        <SwitchField
                            checked={useRaw}
                            onChecked={setUseRaw}
                            label="Enter the raw credentials body instead"
                        />
                    )}

                    {rawMode ? (
                        <TextAreaField
                            value={raw}
                            onValue={setRaw}
                            label="Credentials (INI / JSON)"
                            rows={5}
                            help="The provider's full credentials file body, passed through verbatim."
                            placeholder={'dns_rfc2136_server = 192.0.2.1\ndns_rfc2136_secret = ...'}
                            ariaLabel="Raw credentials body"
                        />
                    ) : spec?.shape === 'token' ? (
                        <TextField
                            value={token}
                            onValue={setToken}
                            type="password"
                            label="API token"
                            help={spec.hint}
                            ariaLabel={`${spec.label} token`}
                        />
                    ) : spec?.shape === 'aws' ? (
                        <>
                            <TextField
                                value={accessKey}
                                onValue={setAccessKey}
                                label="Access key ID"
                                help={spec.hint}
                                ariaLabel="AWS access key id"
                            />
                            <TextField
                                value={secretKey}
                                onValue={setSecretKey}
                                type="password"
                                label="Secret access key"
                                ariaLabel="AWS secret access key"
                            />
                        </>
                    ) : spec?.shape === 'google' ? (
                        <TextAreaField
                            value={serviceJson}
                            onValue={setServiceJson}
                            label="Service-account JSON"
                            rows={5}
                            help={spec.hint}
                            placeholder={'{ "type": "service_account", ... }'}
                            ariaLabel="Google service account JSON"
                        />
                    ) : template ? (
                        // C4: one input per INI field — assembled into the plugin's
                        // documented credentials body on submit; nothing hand-written.
                        <>
                            {template.fields.map((f) => (
                                <TextField
                                    key={f.key}
                                    value={iniValues[f.key] ?? ''}
                                    onValue={(v) => setIniValues((prev) => ({ ...prev, [f.key]: v }))}
                                    type={f.secret ? 'password' : undefined}
                                    label={`${f.label}${f.optional ? ' (optional)' : ''}`}
                                    help={f.key}
                                    ariaLabel={f.label}
                                />
                            ))}
                        </>
                    ) : null}

                    <div className="quaykeeper-admin-add-row">
                        <tc-button type="submit" variant="primary" disabled={busy || undefined}>
                            Save credentials
                        </tc-button>
                    </div>
                </form>
            </div>
            <ConfirmDialog
                open={!!pendingDelete}
                title="Remove credentials?"
                message={
                    pendingDelete
                        ? `Remove the stored credentials for ${pendingDelete}. Future issues/renews for this provider will fall back to config or ambient env.`
                        : undefined
                }
                confirmLabel="Remove"
                danger
                onConfirm={() => void doDelete()}
                onCancel={() => setPendingDelete(null)}
            />
        </tc-section-card>
    )
}
