'use client'

import { useCallback, useMemo, useState } from 'react'
import type { TableColumn, TabBarItem } from '@toolcase/web-components'
import { escapeHtml, useTc } from '@/lib/tc'
import type {
    NginxpilotCert,
    AcmeCredentialInfo,
    CertIssueAccepted,
    CertJob,
} from '@/server/infrastructure/nginxpilot'
import { KNOWN_PROVIDERS, providerSpec, mechanismLabel } from '@/server/domain/cert-input'
import type { AcmeCredentialRequest } from '@/server/domain/cert-input'
import { AdminPage, json, useOwnerData } from './shared'
import { DataTable } from '@/components/DataTable'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { TextField, TextAreaField, SelectField, CheckField } from '@/components/fields'
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

const MUTED = '<span class="perch-admin-hint">—</span>'

/** Localised short date, or a muted dash when absent/unparseable. */
function fmtDate(iso?: string): string {
    if (!iso) return MUTED
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return escapeHtml(iso)
    return escapeHtml(
        d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
    )
}

// Expiry as a coloured pill + date: danger once past, warning inside the 30-day renewal
// window, success otherwise. No not_after (an unparseable cert) collapses to a muted dash.
function expiryCell(notAfter?: string): string {
    if (!notAfter) return MUTED
    const d = new Date(notAfter)
    if (Number.isNaN(d.getTime())) return escapeHtml(notAfter)
    const days = Math.floor((d.getTime() - Date.now()) / 86_400_000)
    const pill =
        days < 0
            ? badge('danger', 'expired')
            : days <= 30
              ? badge('warning', `${days}d left`)
              : badge('success', `${days}d left`)
    return `${pill} <span class="perch-admin-hint">${fmtDate(notAfter)}</span>`
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
            const certs = await fetch('/api/admin/certificates', { cache: 'no-store' }).then((r) =>
                json<NginxpilotCert[]>(r),
            )
            let credentials: AcmeCredentialInfo[] = []
            try {
                credentials = await fetch('/api/admin/acme-credentials', { cache: 'no-store' }).then(
                    (r) => json<AcmeCredentialInfo[]>(r),
                )
            } catch {
                credentials = []
            }
            return { certs, credentials }
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
                    <tc-tab-bar ref={tabRef} active-id={tab} className="perch-sub-tabs" />
                    {tab === 'list' && (
                        <CertificatesList certs={data.certs} onChanged={() => void reload()} />
                    )}
                    {tab === 'issue' && (
                        <IssueCertCard
                            credentials={data.credentials}
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
    modTime: string
}

function certActionsHtml(domain: string): string {
    const d = escapeHtml(domain)
    return (
        `<span class="perch-admin-domain-controls">` +
        `<button type="button" class="btn btn-sm btn-outline-secondary" data-action="renew" data-domain="${d}">Renew</button>` +
        `<button type="button" class="btn btn-sm btn-outline-danger" data-action="delete" data-domain="${d}">Delete</button>` +
        `</span>`
    )
}

const CERT_COLUMNS: TableColumn[] = [
    {
        key: 'domain',
        header: 'Domain',
        render: (row: CertRow) => `<span class="perch-admin-mono">${escapeHtml(row.domain)}</span>`,
    },
    {
        key: 'names',
        header: 'SAN names',
        render: (row: CertRow) =>
            row.names.length
                ? `<span class="perch-admin-mono perch-admin-hint">${escapeHtml(row.names.join(', '))}</span>`
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
        render: (row: CertRow) => expiryCell(row.notAfter),
    },
    {
        key: 'modTime',
        header: 'Updated',
        render: (row: CertRow) => `<span class="perch-admin-hint">${fmtDate(row.modTime)}</span>`,
    },
    {
        key: 'actions',
        header: '',
        align: 'right',
        render: (row: CertRow) => certActionsHtml(row.domain),
    },
]

function CertificatesList({ certs, onChanged }: { certs: NginxpilotCert[]; onChanged: () => void }) {
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
                modTime: c.mod_time,
            })),
        [certs],
    )

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
            <div className="perch-admin-section">
                <p className="perch-home-lead perch-admin-hint">
                    nginxpilot scans its cert directory (certbot live or flat layout) and wires each
                    cert into the matching site or proxy. This reads disk fresh, so renewals show on
                    reload. Renew force-renews one cert by name; Delete removes it (certbot-managed or
                    a manual upload).
                </p>
                {error && <tc-banner variant="danger">{error}</tc-banner>}

                {rows.length === 0 ? (
                    <tc-empty-state icon="shield-check">
                        No certificates discovered. Issue one below, upload a cert/key pair, or point
                        nginxpilot’s <span className="perch-admin-mono">tls.cert_dir</span> at its
                        certbot live directory.
                    </tc-empty-state>
                ) : (
                    <DataTable<CertRow>
                        columns={CERT_COLUMNS}
                        rows={rows}
                        rowKey={(row) => row.domain}
                        onAction={onRowAction}
                    />
                )}

                <div className="perch-admin-add-row">
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

// ── issue a certificate (certbot) ────────────────────────────────────────────────────

// Issuance is async: POST returns 202 + a job id, then we poll the job until it is
// terminal. The ceiling covers the daemon's per-issue timeout (DNS-01 propagation
// ~180s) plus slack; the interval is a gentle poll.
const ISSUE_POLL_INTERVAL_MS = 2000
const ISSUE_POLL_MAX_MS = 360_000
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function IssueCertCard({
    credentials,
    onChanged,
}: {
    credentials: AcmeCredentialInfo[]
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
            <div className="perch-admin-section">
                <p className="perch-home-lead perch-admin-hint">
                    Drive certbot on the active realm. List one or more domains (comma- or
                    space-separated). A leading <span className="perch-admin-mono">*.</span> wildcard
                    is allowed only when the daemon’s challenge is DNS-01. Use staging while testing
                    to avoid the CA’s rate limits.
                </p>
                {error && <tc-banner variant="danger">{error}</tc-banner>}
                {progress && <tc-banner variant="info">{progress}</tc-banner>}
                <form
                    className="perch-admin-section"
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
                    <CheckField
                        checked={staging}
                        onChecked={setStaging}
                        label="Use the CA staging endpoint (testing)"
                    />
                    <div className="perch-admin-add-row">
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
            <div className="perch-admin-section">
                <p className="perch-home-lead perch-admin-hint">
                    Bring your own cert/key pair — no certbot, no ACME. The daemon validates the pair
                    (and rejects an expired cert) before writing it. The private key is stored 0600
                    and never echoed back. Works whenever{' '}
                    <span className="perch-admin-mono">tls.cert_dir</span> is set.
                </p>
                {error && <tc-banner variant="danger">{error}</tc-banner>}
                <form
                    className="perch-admin-section"
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
                    <div className="perch-admin-add-row">
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
    const p = escapeHtml(provider)
    return (
        `<span class="perch-admin-domain-controls">` +
        `<button type="button" class="btn btn-sm btn-outline-danger" data-action="delete" data-provider="${p}">Remove</button>` +
        `</span>`
    )
}

const CRED_COLUMNS: TableColumn[] = [
    {
        key: 'provider',
        header: 'Provider',
        render: (row: CredRow) => `<span class="perch-admin-mono">${escapeHtml(row.provider)}</span>`,
    },
    {
        key: 'mechanism',
        header: 'Mechanism',
        render: (row: CredRow) =>
            `<span class="perch-admin-hint">${escapeHtml(mechanismLabel(row.mechanism))}</span>`,
    },
    {
        key: 'modTime',
        header: 'Updated',
        align: 'right',
        render: (row: CredRow) => `<span class="perch-admin-hint">${fmtDate(row.modTime)}</span>`,
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
    const [busy, setBusy] = useState(false)

    const spec = provider === OTHER ? undefined : providerSpec(provider)
    // "Other" providers and any provider with the raw toggle on use the raw passthrough body.
    const rawMode = provider === OTHER || useRaw

    const providerOptions = useMemo(
        () => [
            ...KNOWN_PROVIDERS.map((p) => ({ value: p.id, label: p.label })),
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
        setCustomProvider('')
    }, [])

    const submit = useCallback(async () => {
        if (busy) return
        const targetProvider = provider === OTHER ? customProvider.trim() : provider
        if (!targetProvider) {
            setError('A provider name is required.')
            return
        }
        // Build the request body: raw passthrough, or the convenience fields for the shape.
        let req: AcmeCredentialRequest
        if (rawMode) {
            req = { credentials: raw }
        } else if (spec?.shape === 'token') {
            req = { token }
        } else if (spec?.shape === 'aws') {
            req = { access_key: accessKey, secret_key: secretKey }
        } else if (spec?.shape === 'google') {
            req = { service_account_json: serviceJson }
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
            <div className="perch-admin-section">
                <p className="perch-home-lead perch-admin-hint">
                    The runtime credentials store for DNS-01. Save a provider’s token / key here and
                    nginxpilot uses it on the next issue or renew — no host env wiring. Secrets are
                    write-only: this lists the providers and when they were last set, never the value.
                    Storing credentials requires <span className="perch-admin-mono">acme.enabled</span>{' '}
                    on the daemon.
                </p>
                {error && <tc-banner variant="danger">{error}</tc-banner>}

                {rows.length === 0 ? (
                    <tc-empty-state icon="key-round">
                        No provider credentials stored. Add one below, or pass credentials via the
                        daemon’s config (<span className="perch-admin-mono">credentials_env</span> /
                        <span className="perch-admin-mono"> credentials_file</span>) or ambient SDK env.
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
                    className="perch-admin-section"
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
                    {spec && (
                        <CheckField
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
                    ) : null}

                    <div className="perch-admin-add-row">
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
