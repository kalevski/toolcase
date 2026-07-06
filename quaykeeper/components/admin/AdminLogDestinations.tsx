'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AdvancedTableColumn } from '@toolcase/web-components'
import { iconBtnHtml } from '@/lib/action-icons'
import { escapeHtml, useTc } from '@/lib/tc'
import { AdminPage, json, useOwnerData } from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormModal, FormGroup } from '@/components/FormModal'
import { SelectField, SwitchField, TextAreaField, TextField } from '@/components/fields'
import { useToast } from '@/components/Toast'

// Owner-only log-shipping destinations (log_ides.md §4). Each row is one push/sink
// target for nginxpilot's structured access logs: Loki, a generic HTTP collector, a
// local NDJSON file, or the container's stdout. Owner-only because every destination
// carries a URL and the pipeline egresses log data (SSRF surface on test, G21).
// Secrets are BY REFERENCE ONLY — auth carries an env-var / file NAME the operator
// provisions on the nginxpilot host; Quaykeeper never holds the credential.

// ── local DTO shapes (mirror the /api/admin/log-destinations responses) ─────────

interface LogAuthSpec {
    method?: 'none' | 'basic' | 'bearer'
    username?: string
    password_env?: string
    password_file?: string
    token_env?: string
    token_file?: string
}

interface LogDestSpec {
    name: string
    type: 'loki' | 'http' | 'file' | 'stdout'
    enabled?: boolean
    url?: string
    tenant?: string
    allow_insecure?: boolean
    ca_file?: string
    insecure_skip_verify?: boolean
    auth?: LogAuthSpec
    labels?: Record<string, string>
    filter?: Record<string, string[]>
    parse?: string[]
    sample?: number
    batch_size?: number
    flush_interval?: string
    max_retries?: number
    buffer_size?: number
    path?: string
    max_size?: string
    max_files?: number
}

interface LogDestDto {
    id: string
    name: string
    type: string
    scope: 'global' | 'instance'
    target?: string
    enabled: boolean
    spec: LogDestSpec
    logql: string
    createdAt: string
    updatedAt: string
}

interface LogDestLiveStat {
    name: string
    shipped: number
    dropped: number
    failed_batches: number
    buffer_len: number
    last_error?: string
    last_flush?: string
    oldest_buffered?: string
}

interface LogsStatus {
    enabled: boolean
    syslog_listen: string
    intake_error?: string
    received: number
    parse_errors: number
    destinations: LogDestLiveStat[]
}

// ── table rendering ─────────────────────────────────────────────────────────────

const DEST_COLUMNS: AdvancedTableColumn[] = [
    { key: 'identity', label: 'Destination' },
    { key: 'shipping', label: 'Shipping' },
    { key: 'actions', label: '', align: 'right' },
]

function healthDot(dto: LogDestDto, stat: LogDestLiveStat | undefined): { cls: string; title: string } {
    if (!dto.enabled) return { cls: 'quaykeeper-realm-dot--unknown', title: 'Disabled' }
    if (dto.scope === 'instance') return { cls: 'quaykeeper-realm-dot--unknown', title: 'Delivered to instances (client-side shipping)' }
    if (!stat) return { cls: 'quaykeeper-realm-dot--unknown', title: 'No shipping stats yet' }
    if (stat.last_error) return { cls: 'quaykeeper-realm-dot--down', title: stat.last_error }
    return { cls: 'quaykeeper-realm-dot--ok', title: stat.last_flush ? `Last flush ${stat.last_flush}` : 'Healthy' }
}

interface DestRow {
    dto: LogDestDto
    stat: LogDestLiveStat | undefined
}

/** The injected `<tbody>` HTML — every interpolated value is escaped. */
function destRowsHtml(rows: DestRow[], busy: boolean): string {
    return rows
        .map(({ dto, stat }) => {
            const { cls, title } = healthDot(dto, stat)

            const badges: string[] = [`<span class="badge text-bg-info">${escapeHtml(dto.type)}</span>`]
            badges.push(`<span class="badge text-bg-secondary">${escapeHtml(dto.scope)}</span>`)
            if (!dto.enabled) badges.push('<span class="badge text-bg-light">disabled</span>')
            if (dto.target) badges.push(`<span class="badge text-bg-light">${escapeHtml(dto.target)}</span>`)

            const sub = dto.type === 'loki' && dto.logql
                ? escapeHtml(dto.logql)
                : escapeHtml(dto.spec.url || dto.spec.path || (dto.type === 'stdout' ? 'container stdout' : ''))

            const shipping = stat
                ? `<span class="quaykeeper-admin-hint">↑ ${stat.shipped.toLocaleString()} · ✕ ${stat.dropped.toLocaleString()} · ⚠ ${stat.failed_batches.toLocaleString()}${stat.buffer_len ? ` · buf ${stat.buffer_len}` : ''}</span>`
                : dto.scope === 'instance'
                  ? '<span class="quaykeeper-admin-hint">client-side</span>'
                  : '<span class="quaykeeper-admin-hint">—</span>'

            const controls = [
                iconBtnHtml({ icon: 'test', label: `Test ${dto.name}`, data: { action: 'test', id: dto.id } }),
                iconBtnHtml({ icon: 'edit', label: `Edit ${dto.name}`, data: { action: 'edit', id: dto.id } }),
                iconBtnHtml({
                    icon: 'remove',
                    label: `Remove ${dto.name}`,
                    danger: true,
                    disabled: busy,
                    data: { action: 'remove', id: dto.id },
                }),
            ].join('')

            return (
                `<tr>` +
                `<td><span class="quaykeeper-admin-realm-id">` +
                `<span class="quaykeeper-realm-dot ${cls}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"></span>` +
                `<span class="quaykeeper-admin-realm-name">${escapeHtml(dto.name)}</span>` +
                `<span class="quaykeeper-admin-mono quaykeeper-admin-hint">${sub}</span>` +
                `<span class="quaykeeper-admin-badges">${badges.join('')}</span>` +
                `</span></td>` +
                `<td>${shipping}</td>` +
                `<td class="text-end"><span class="quaykeeper-admin-domain-controls">${controls}</span></td>` +
                `</tr>`
            )
        })
        .join('')
}

export function AdminLogDestinations() {
    const fetcher = useCallback(async (): Promise<LogDestDto[] | null> => {
        try {
            return await fetch('/api/admin/log-destinations', { cache: 'no-store' }).then((r) => json<LogDestDto[]>(r))
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useOwnerData(fetcher)

    return (
        <AdminPage
            title="Log destinations"
            subtitle="Where nginxpilot ships its structured access logs — Loki, a generic HTTP collector, a local file, or stdout. Multi-field filters and Loki label config included. Owner-only; secrets are provisioned on the nginxpilot host and referenced by name."
            icon="scroll-text"
            iconColor="violet"
            state={state}
            onRetry={() => void reload()}
        >
            {(dests) => <LogDestForm dests={dests} onChanged={() => void reload()} />}
        </AdminPage>
    )
}

// ── the create/edit form ─────────────────────────────────────────────────────────

interface Draft {
    name: string
    type: string
    scope: string
    target: string
    enabled: boolean
    url: string
    tenant: string
    allowInsecure: boolean
    caFile: string
    insecureSkipVerify: boolean
    authMethod: string
    username: string
    passwordEnv: string
    passwordFile: string
    tokenEnv: string
    tokenFile: string
    job: string
    hostLabel: string
    statusLabel: string
    extraLabels: string
    filterText: string
    parseText: string
    sample: string
    batchSize: string
    flushInterval: string
    maxRetries: string
    bufferSize: string
    path: string
    maxSize: string
    maxFiles: string
}

const emptyDraft = (): Draft => ({
    name: '',
    type: 'loki',
    scope: 'global',
    target: '',
    enabled: true,
    url: '',
    tenant: '',
    allowInsecure: false,
    caFile: '',
    insecureSkipVerify: false,
    authMethod: 'none',
    username: '',
    passwordEnv: '',
    passwordFile: '',
    tokenEnv: '',
    tokenFile: '',
    job: 'nginx',
    hostLabel: '$resource',
    statusLabel: '$status',
    extraLabels: '',
    filterText: '',
    parseText: '',
    sample: '',
    batchSize: '',
    flushInterval: '',
    maxRetries: '',
    bufferSize: '',
    path: '',
    maxSize: '',
    maxFiles: '',
})

/** Reconstruct an editing draft from a stored destination's spec. */
function draftOf(dto: LogDestDto): Draft {
    const s = dto.spec
    const labels = s.labels ?? {}
    const extraLabels = Object.entries(labels)
        .filter(([k]) => k !== 'job' && k !== 'host' && k !== 'status_code')
        .map(([k, v]) => `${k}=${v}`)
        .join('\n')
    const filterText = Object.entries(s.filter ?? {})
        .map(([field, list]) => `${field}: ${list.join(', ')}`)
        .join('\n')
    const parseText = (s.parse ?? []).join('\n')
    return {
        name: s.name,
        type: s.type,
        scope: dto.scope,
        target: dto.target ?? '',
        enabled: dto.enabled,
        url: s.url ?? '',
        tenant: s.tenant ?? '',
        allowInsecure: s.allow_insecure ?? false,
        caFile: s.ca_file ?? '',
        insecureSkipVerify: s.insecure_skip_verify ?? false,
        authMethod: s.auth?.method ?? 'none',
        username: s.auth?.username ?? '',
        passwordEnv: s.auth?.password_env ?? '',
        passwordFile: s.auth?.password_file ?? '',
        tokenEnv: s.auth?.token_env ?? '',
        tokenFile: s.auth?.token_file ?? '',
        job: labels.job ?? 'nginx',
        hostLabel: labels.host ?? 'none',
        statusLabel: labels.status_code ?? 'none',
        extraLabels,
        filterText,
        parseText,
        sample: s.sample !== undefined ? String(s.sample) : '',
        batchSize: s.batch_size !== undefined ? String(s.batch_size) : '',
        flushInterval: s.flush_interval ?? '',
        maxRetries: s.max_retries !== undefined ? String(s.max_retries) : '',
        bufferSize: s.buffer_size !== undefined ? String(s.buffer_size) : '',
        path: s.path ?? '',
        maxSize: s.max_size ?? '',
        maxFiles: s.max_files !== undefined ? String(s.max_files) : '',
    }
}

const numOr = (raw: string): number | undefined => {
    const t = raw.trim()
    if (t === '') return undefined
    const n = Number(t)
    return Number.isFinite(n) ? n : undefined
}

/** Assemble the API payload from the draft, including only fields relevant to the type. */
function buildPayload(d: Draft): Record<string, unknown> {
    const isPush = d.type === 'loki' || d.type === 'http'
    const payload: Record<string, unknown> = {
        name: d.name.trim(),
        type: d.type,
        scope: d.scope,
        enabled: d.enabled,
    }
    if (d.scope === 'instance' && d.target.trim()) payload.target = d.target.trim()

    // parse templates — instance scope only (nginxpilot access logs are already JSON).
    if (d.scope === 'instance') {
        const templates = d.parseText
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
        if (templates.length) payload.parse = templates
    }

    // filter (all types)
    const filter: Record<string, string[]> = {}
    for (const line of d.filterText.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const idx = trimmed.indexOf(':')
        if (idx < 0) continue
        const field = trimmed.slice(0, idx).trim()
        const matchers = trimmed
            .slice(idx + 1)
            .split(',')
            .map((m) => m.trim())
            .filter(Boolean)
        if (field && matchers.length) filter[field] = matchers
    }
    if (Object.keys(filter).length) payload.filter = filter

    // shipping tunables (all types)
    if (numOr(d.sample) !== undefined) payload.sample = numOr(d.sample)
    if (numOr(d.batchSize) !== undefined) payload.batch_size = numOr(d.batchSize)
    if (numOr(d.maxRetries) !== undefined) payload.max_retries = numOr(d.maxRetries)
    if (numOr(d.bufferSize) !== undefined) payload.buffer_size = numOr(d.bufferSize)
    if (d.flushInterval.trim()) payload.flush_interval = d.flushInterval.trim()

    if (isPush) {
        payload.url = d.url.trim()
        if (d.allowInsecure) payload.allow_insecure = true
        if (d.caFile.trim()) payload.ca_file = d.caFile.trim()
        if (d.insecureSkipVerify) payload.insecure_skip_verify = true
        if (d.authMethod !== 'none') {
            const auth: Record<string, string> = { method: d.authMethod }
            if (d.authMethod === 'basic') {
                auth.username = d.username.trim()
                if (d.passwordEnv.trim()) auth.password_env = d.passwordEnv.trim()
                if (d.passwordFile.trim()) auth.password_file = d.passwordFile.trim()
            } else {
                if (d.tokenEnv.trim()) auth.token_env = d.tokenEnv.trim()
                if (d.tokenFile.trim()) auth.token_file = d.tokenFile.trim()
            }
            payload.auth = auth
        }
        if (d.type === 'loki') {
            if (d.tenant.trim()) payload.tenant = d.tenant.trim()
            const labels: Record<string, string> = {}
            if (d.job.trim()) labels.job = d.job.trim()
            if (d.hostLabel !== 'none') labels.host = d.hostLabel
            if (d.statusLabel !== 'none') labels.status_code = d.statusLabel
            for (const line of d.extraLabels.split('\n')) {
                const trimmed = line.trim()
                if (!trimmed) continue
                const m = trimmed.match(/^([^=:]+)[=:]\s*(.+)$/)
                if (m) labels[m[1].trim()] = m[2].trim()
            }
            if (Object.keys(labels).length) payload.labels = labels
        }
    } else if (d.type === 'file') {
        payload.path = d.path.trim()
        if (d.maxSize.trim()) payload.max_size = d.maxSize.trim()
        if (numOr(d.maxFiles) !== undefined) payload.max_files = numOr(d.maxFiles)
    }
    return payload
}

/** Live LogQL preview from the current draft's label config (loki only). */
function draftLogql(d: Draft): string {
    if (d.type !== 'loki') return ''
    const parts = [`job="${d.job.trim() || 'nginx'}"`]
    if (d.hostLabel !== 'none') parts.push('host=~".+"')
    if (d.statusLabel !== 'none') parts.push('status_code=~".+"')
    for (const line of d.extraLabels.split('\n')) {
        const m = line.trim().match(/^([^=:]+)[=:]\s*(.+)$/)
        if (m) parts.push(`${m[1].trim()}="${m[2].trim()}"`)
    }
    return `{${parts.join(', ')}}`
}

function LogDestForm({ dests, onChanged }: { dests: LogDestDto[]; onChanged: () => void }) {
    const toast = useToast()
    const [form, setForm] = useState<{ id: string | null; draft: Draft } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [pending, setPending] = useState<LogDestDto | null>(null)
    const [stats, setStats] = useState<Record<string, LogDestLiveStat>>({})
    const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

    const patchDraft = (p: Partial<Draft>) =>
        setForm((prev) => (prev ? { ...prev, draft: { ...prev.draft, ...p } } : prev))

    const close = useCallback(() => {
        setForm(null)
        setError(null)
        setTestResult(null)
    }, [])

    // Poll the daemon's per-destination shipping stats and index them by name.
    const loadStats = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/log-destinations/status', { cache: 'no-store' })
            if (!res.ok) return
            const body = (await res.json()) as LogsStatus
            const byName: Record<string, LogDestLiveStat> = {}
            for (const s of body.destinations ?? []) byName[s.name] = s
            setStats(byName)
        } catch {
            // best-effort — the table still renders without live stats
        }
    }, [])

    useEffect(() => {
        void loadStats()
        const t = setInterval(() => void loadStats(), 5000)
        return () => clearInterval(t)
    }, [loadStats])

    const runTest = useCallback(async (draft: Draft): Promise<void> => {
        setTestResult(null)
        try {
            const res = await fetch('/api/admin/log-destinations/test', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(buildPayload(draft)),
            })
            const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; detail?: string } | null
            if (res.ok && body?.ok) setTestResult({ ok: true, msg: 'Test entry delivered.' })
            else if (res.ok) setTestResult({ ok: false, msg: body?.error ?? 'Destination rejected the test entry.' })
            else setTestResult({ ok: false, msg: body?.detail ?? body?.error ?? `Test failed (error ${res.status}).` })
        } catch {
            setTestResult({ ok: false, msg: 'Test failed — network error.' })
        }
    }, [])

    const submit = useCallback(async () => {
        if (!form || busy) return
        const d = form.draft
        if (!d.name.trim()) {
            setError('A destination needs a name.')
            return
        }
        setBusy(true)
        setError(null)
        try {
            const res = await fetch(
                form.id === null
                    ? '/api/admin/log-destinations'
                    : `/api/admin/log-destinations/${encodeURIComponent(form.id)}`,
                {
                    method: form.id === null ? 'POST' : 'PATCH',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(buildPayload(d)),
                },
            )
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: string; detail?: string } | null
                setError(
                    body?.error === 'name_taken'
                        ? `A destination named “${d.name.trim()}” already exists.`
                        : body?.detail
                          ? `Couldn’t save: ${body.detail}`
                          : body?.error
                            ? `Couldn’t save destination: ${body.error}.`
                            : `Couldn’t save destination (error ${res.status}).`,
                )
                return
            }
            toast.show(form.id === null ? `Destination “${d.name.trim()}” created.` : `Destination “${d.name.trim()}” updated.`, {
                variant: 'success',
            })
            setForm(null)
            onChanged()
        } catch {
            setError('Couldn’t save destination — network error.')
        } finally {
            setBusy(false)
        }
    }, [form, busy, onChanged, toast])

    const doRemove = useCallback(async () => {
        const dto = pending
        if (!dto || busy) return
        setPending(null)
        setBusy(true)
        setError(null)
        try {
            const res = await fetch(`/api/admin/log-destinations/${encodeURIComponent(dto.id)}`, { method: 'DELETE' })
            if (!res.ok && res.status !== 204) {
                setError(`Couldn’t remove ${dto.name} (error ${res.status}).`)
                return
            }
            toast.show(`Destination “${dto.name}” removed.`, { variant: 'success' })
            onChanged()
        } catch {
            setError(`Couldn’t remove ${dto.name} — network error.`)
        } finally {
            setBusy(false)
        }
    }, [pending, busy, onChanged, toast])

    const rows = useMemo<DestRow[]>(() => dests.map((dto) => ({ dto, stat: stats[dto.name] })), [dests, stats])
    const editing = form?.id ? dests.find((s) => s.id === form.id) : undefined

    const onDelegated = useCallback(
        (event: Event) => {
            const el = (event.target as HTMLElement)?.closest?.('[data-action]') as HTMLElement | null
            if (!el) return
            const action = el.getAttribute('data-action')
            const id = el.getAttribute('data-id')
            if (!action || !id) return
            const dto = dests.find((s) => s.id === id)
            if (!dto) return
            if (action === 'test') {
                setError(null)
                setForm({ id: dto.id, draft: draftOf(dto) })
                void runTest(draftOf(dto))
            } else if (action === 'edit') {
                setError(null)
                setTestResult(null)
                setForm({ id: dto.id, draft: draftOf(dto) })
            } else if (action === 'remove') setPending(dto)
        },
        [dests, runTest],
    )

    const tableProps = useMemo(
        () => ({
            columns: DEST_COLUMNS,
            total: rows.length,
            limit: rows.length || 10,
            offset: 0,
            rows: destRowsHtml(rows, busy),
        }),
        [rows, busy],
    )
    const tableRef = useTc<HTMLElement>(tableProps, { click: onDelegated })

    const d = form?.draft
    const isPush = d?.type === 'loki' || d?.type === 'http'

    return (
        <>
            <tc-section-card title="Log destinations" icon="scroll-text">
                <div className="quaykeeper-admin-section">
                    <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                        Global destinations are pushed to the active NGINX server and ship its access logs directly to the
                        target (Quaykeeper only distributes the config, never the log bytes). Instance destinations are
                        delivered to quaykeeper-client for app-log shipping. Credentials are referenced by env-var / file name
                        and provisioned on the host — never stored here.
                    </p>
                    {error && !form && <tc-banner variant="danger">{error}</tc-banner>}

                    <div className="quaykeeper-list-actions">
                        <tc-button variant="primary" size="sm" onClick={() => setForm({ id: null, draft: emptyDraft() })}>
                            Add destination
                        </tc-button>
                    </div>

                    {dests.length === 0 ? (
                        <tc-empty-state icon="scroll-text">No log destinations configured.</tc-empty-state>
                    ) : (
                        <tc-advanced-table ref={tableRef} />
                    )}
                </div>
            </tc-section-card>

            {form && d && (
                <FormModal
                    key={form.id ?? 'new'}
                    title={form.id === null ? 'Add log destination' : `Edit — ${editing?.name ?? ''}`}
                    busy={busy}
                    submitLabel={form.id === null ? 'Create' : 'Save'}
                    onSubmit={() => void submit()}
                    onClose={close}
                >
                    {error && <tc-banner variant="danger">{error}</tc-banner>}

                    <FormGroup title="Identity">
                        <TextField
                            label="Name"
                            placeholder="main-loki"
                            help="Slug [a-z0-9-] — becomes the fragment filename. Immutable after create."
                            value={d.name}
                            disabled={form.id !== null}
                            onValue={(v) => patchDraft({ name: v })}
                        />
                        <SelectField
                            label="Type"
                            value={d.type}
                            options={[
                                { value: 'loki', label: 'Loki (push API)' },
                                { value: 'http', label: 'HTTP collector (NDJSON)' },
                                { value: 'file', label: 'Local file (NDJSON, self-rotating)' },
                                { value: 'stdout', label: 'stdout (container log stream)' },
                            ]}
                            onValue={(v) => patchDraft({ type: v })}
                        />
                        <SelectField
                            label="Scope"
                            help="global → pushed to the NGINX edge. instance → delivered to quaykeeper-client for app logs."
                            value={d.scope}
                            options={[
                                { value: 'global', label: 'Global (NGINX edge)' },
                                { value: 'instance', label: 'Instance (app logs)' },
                            ]}
                            onValue={(v) => patchDraft({ scope: v })}
                        />
                        {d.scope === 'instance' && (
                            <TextField
                                label="Target instance"
                                placeholder="inst_…"
                                help="The Config instance id this destination is delivered to."
                                value={d.target}
                                onValue={(v) => patchDraft({ target: v })}
                            />
                        )}
                        <SwitchField label="Enabled" checked={d.enabled} onChecked={(v) => patchDraft({ enabled: v })} />
                    </FormGroup>

                    {isPush && (
                        <FormGroup title="Endpoint">
                            <TextField
                                label="URL"
                                placeholder={d.type === 'loki' ? 'https://loki.example.com/loki/api/v1/push' : 'https://collector.example.com/ingest'}
                                help="https:// required unless you enable allow-insecure."
                                value={d.url}
                                onValue={(v) => patchDraft({ url: v })}
                            />
                            {d.type === 'loki' && (
                                <TextField
                                    label="Tenant"
                                    placeholder="infra"
                                    help="Optional Loki X-Scope-OrgID."
                                    value={d.tenant}
                                    onValue={(v) => patchDraft({ tenant: v })}
                                />
                            )}
                            <TextField
                                label="CA file"
                                placeholder="/etc/nginxpilot/loki-ca.pem"
                                help="Optional — trust a private CA (daemon-local path)."
                                value={d.caFile}
                                onValue={(v) => patchDraft({ caFile: v })}
                            />
                            <SwitchField
                                label="Allow insecure (http:// / skip verify)"
                                checked={d.allowInsecure}
                                onChecked={(v) => patchDraft({ allowInsecure: v })}
                            />
                            {d.allowInsecure && (
                                <SwitchField
                                    label="Skip TLS verification"
                                    checked={d.insecureSkipVerify}
                                    onChecked={(v) => patchDraft({ insecureSkipVerify: v })}
                                />
                            )}
                        </FormGroup>
                    )}

                    {isPush && (
                        <FormGroup title="Auth (by reference)">
                            <SelectField
                                label="Method"
                                value={d.authMethod}
                                options={[
                                    { value: 'none', label: 'None' },
                                    { value: 'basic', label: 'Basic' },
                                    { value: 'bearer', label: 'Bearer' },
                                ]}
                                onValue={(v) => patchDraft({ authMethod: v })}
                            />
                            {d.authMethod === 'basic' && (
                                <>
                                    <TextField label="Username" value={d.username} onValue={(v) => patchDraft({ username: v })} />
                                    <TextField
                                        label="Password env var"
                                        placeholder="LOKI_PASSWORD"
                                        help="Name of the env var on the nginxpilot host — never the value."
                                        value={d.passwordEnv}
                                        onValue={(v) => patchDraft({ passwordEnv: v })}
                                    />
                                    <TextField
                                        label="…or password file"
                                        placeholder="/run/secrets/loki_password"
                                        help="Daemon-local file path (re-read per flush; rotate-safe)."
                                        value={d.passwordFile}
                                        onValue={(v) => patchDraft({ passwordFile: v })}
                                    />
                                </>
                            )}
                            {d.authMethod === 'bearer' && (
                                <>
                                    <TextField
                                        label="Token env var"
                                        placeholder="COLLECTOR_TOKEN"
                                        help="Name of the env var on the host — never the value."
                                        value={d.tokenEnv}
                                        onValue={(v) => patchDraft({ tokenEnv: v })}
                                    />
                                    <TextField
                                        label="…or token file"
                                        placeholder="/run/secrets/collector_token"
                                        value={d.tokenFile}
                                        onValue={(v) => patchDraft({ tokenFile: v })}
                                    />
                                </>
                            )}
                        </FormGroup>
                    )}

                    {d.type === 'loki' && (
                        <FormGroup title="Loki labels">
                            <TextField
                                label="job"
                                placeholder="nginx"
                                help="Static label (default nginx)."
                                value={d.job}
                                onValue={(v) => patchDraft({ job: v })}
                            />
                            <SelectField
                                label="host label"
                                help="$resource is bounded + recommended; $host is unsafe under wildcard vhosts."
                                value={d.hostLabel}
                                options={[
                                    { value: 'none', label: 'No host label' },
                                    { value: '$resource', label: '$resource (entity name — recommended)' },
                                    { value: '$host', label: '$host (client Host header)' },
                                    { value: '$server_name', label: '$server_name' },
                                ]}
                                onValue={(v) => patchDraft({ hostLabel: v })}
                            />
                            <SelectField
                                label="status_code label"
                                value={d.statusLabel}
                                options={[
                                    { value: 'none', label: 'No status label' },
                                    { value: '$status', label: '$status (exact code)' },
                                    { value: '$status_class', label: '$status_class (4xx / 5xx)' },
                                ]}
                                onValue={(v) => patchDraft({ statusLabel: v })}
                            />
                            <TextAreaField
                                label="Extra static labels"
                                rows={2}
                                placeholder={'region=eu\nenv=prod'}
                                help="One key=value per line (static only, max 5)."
                                value={d.extraLabels}
                                onValue={(v) => patchDraft({ extraLabels: v })}
                            />
                            <p className="quaykeeper-admin-hint">
                                Selector: <span className="quaykeeper-admin-mono">{draftLogql(d)}</span>
                            </p>
                        </FormGroup>
                    )}

                    {d.type === 'file' && (
                        <FormGroup title="File">
                            <TextField
                                label="Path"
                                placeholder="/var/log/nginxpilot/access.ndjson"
                                help="Absolute path. Self-rotates by size."
                                value={d.path}
                                onValue={(v) => patchDraft({ path: v })}
                            />
                            <TextField
                                label="Max size"
                                placeholder="64MiB"
                                value={d.maxSize}
                                onValue={(v) => patchDraft({ maxSize: v })}
                            />
                            <TextField
                                label="Max files"
                                type="number"
                                placeholder="3"
                                value={d.maxFiles}
                                onValue={(v) => patchDraft({ maxFiles: v })}
                            />
                        </FormGroup>
                    )}

                    <FormGroup title="Filter">
                        <TextAreaField
                            label="Field matchers"
                            rows={4}
                            placeholder={'status: 4xx, 5xx\npath: !/healthz, !/metrics\nmethod: GET, POST'}
                            help="One field per line: field: matcher, matcher. AND across lines, OR within a line. Fields: host, resource, path, user_agent, status, method, scheme, resource_type. Leading ! negates."
                            value={d.filterText}
                            onValue={(v) => patchDraft({ filterText: v })}
                        />
                    </FormGroup>

                    {d.scope === 'instance' && (
                        <FormGroup title="Parse templates">
                            <TextAreaField
                                label="Plain-text → structured"
                                rows={3}
                                placeholder={'{level} | {time} - {message}'}
                                help="One template per line. A non-JSON log line matching a template becomes structured JSON (e.g. info | 12:20 - hi → {level,time,message}), so level/status filters and Loki labels work. First match wins; non-matching lines ship raw."
                                value={d.parseText}
                                onValue={(v) => patchDraft({ parseText: v })}
                            />
                        </FormGroup>
                    )}

                    <FormGroup title="Shipping (optional)">
                        <TextField label="Sample (0–1]" placeholder="1.0" value={d.sample} onValue={(v) => patchDraft({ sample: v })} />
                        <TextField label="Batch size" type="number" placeholder="500" value={d.batchSize} onValue={(v) => patchDraft({ batchSize: v })} />
                        <TextField label="Flush interval" placeholder="2s" value={d.flushInterval} onValue={(v) => patchDraft({ flushInterval: v })} />
                        <TextField label="Max retries" type="number" placeholder="3" value={d.maxRetries} onValue={(v) => patchDraft({ maxRetries: v })} />
                        <TextField label="Buffer size (entries)" type="number" placeholder="8192" value={d.bufferSize} onValue={(v) => patchDraft({ bufferSize: v })} />
                    </FormGroup>

                    <FormGroup title="Test connection">
                        {testResult && (
                            <tc-banner variant={testResult.ok ? 'success' : 'danger'}>{testResult.msg}</tc-banner>
                        )}
                        <tc-button variant="secondary" size="sm" onClick={() => void runTest(d)}>
                            Send test entry
                        </tc-button>
                    </FormGroup>
                </FormModal>
            )}

            <ConfirmDialog
                open={!!pending}
                title="Remove log destination?"
                message={
                    pending
                        ? `Remove ${pending.name}. Shipping stops immediately${pending.scope === 'global' ? ' and its fragment is retracted from the NGINX server' : ''}. Buffered entries are flushed best-effort.`
                        : undefined
                }
                confirmLabel="Remove"
                danger
                onConfirm={() => void doRemove()}
                onCancel={() => setPending(null)}
            />
        </>
    )
}
