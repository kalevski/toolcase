'use client'

import { useCallback, useMemo, useState } from 'react'
import type { AdvancedTableColumn } from '@toolcase/web-components'
import { iconBtnHtml } from '@/lib/action-icons'
import { escapeHtml, useTc } from '@/lib/tc'
import { AdminPage, json, useOwnerData } from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormModal, FormGroup } from '@/components/FormModal'
import { SelectField, SwitchField, TextField } from '@/components/fields'
import { useToast } from '@/components/Toast'

// Owner-only reusable log endpoints (logs_feature.md §10). Each row is one push
// target — Loki or a generic HTTP collector — defined ONCE and assigned to log
// sources elsewhere: an NGINX server binds it from the Servers page, an instance
// from its Logs tab. The binding carries the shaping (labels/filter/parse/
// tunables); this page is purely the connection half. Owner-only because every
// destination carries a URL and the pipeline egresses log data (SSRF surface on
// test, G21). Secrets are BY REFERENCE ONLY — auth carries an env-var / file
// NAME the operator provisions on the shipping host; Quaykeeper never holds the
// credential.

// ── local DTO shapes (mirror the /api/admin/log-destinations responses) ─────────

interface LogAuthSpec {
    method?: 'none' | 'basic' | 'bearer'
    username?: string
    password_env?: string
    password_file?: string
    token_env?: string
    token_file?: string
}

interface EndpointSpec {
    name: string
    type: 'loki' | 'http'
    url: string
    tenant?: string
    ca_file?: string
    allow_insecure?: boolean
    insecure_skip_verify?: boolean
    auth?: LogAuthSpec
}

interface LogDestDto {
    id: string
    name: string
    type: string
    spec: EndpointSpec
    usedBy: { realms: number; instances: number }
    createdAt: string
    updatedAt: string
}

// ── table rendering ─────────────────────────────────────────────────────────────

const DEST_COLUMNS: AdvancedTableColumn[] = [
    { key: 'identity', label: 'Destination' },
    { key: 'usedBy', label: 'Used by' },
    { key: 'actions', label: '', align: 'right' },
]

/** "2 servers · 1 instance" — the at-a-glance reuse signal (D4). */
function usedByText(dto: LogDestDto): string {
    const parts: string[] = []
    if (dto.usedBy.realms > 0) parts.push(`${dto.usedBy.realms} server${dto.usedBy.realms === 1 ? '' : 's'}`)
    if (dto.usedBy.instances > 0) parts.push(`${dto.usedBy.instances} instance${dto.usedBy.instances === 1 ? '' : 's'}`)
    return parts.length ? parts.join(' · ') : 'unbound'
}

/** The injected `<tbody>` HTML — every interpolated value is escaped. */
function destRowsHtml(dests: LogDestDto[], busy: boolean): string {
    return dests
        .map((dto) => {
            const badges: string[] = [`<span class="badge text-bg-info">${escapeHtml(dto.type)}</span>`]
            if (dto.spec.allow_insecure) badges.push('<span class="badge text-bg-warning">insecure</span>')
            if (dto.spec.auth?.method && dto.spec.auth.method !== 'none') {
                badges.push(`<span class="badge text-bg-light">${escapeHtml(dto.spec.auth.method)} auth</span>`)
            }

            const bound = dto.usedBy.realms + dto.usedBy.instances > 0
            const usedBy = bound
                ? `<span class="quaykeeper-admin-hint">${escapeHtml(usedByText(dto))}</span>`
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
                `<span class="quaykeeper-admin-realm-name">${escapeHtml(dto.name)}</span>` +
                `<span class="quaykeeper-admin-mono quaykeeper-admin-hint">${escapeHtml(dto.spec.url)}</span>` +
                `<span class="quaykeeper-admin-badges">${badges.join('')}</span>` +
                `</span></td>` +
                `<td>${usedBy}</td>` +
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
            subtitle="Reusable log endpoints. Assign them to an NGINX server (Servers page) or an instance (its Logs tab). Owner-only; secrets are referenced by name, never stored."
            icon="scroll-text"
            iconColor="violet"
            state={state}
            onRetry={() => void reload()}
        >
            {(dests) => <LogDestForm dests={dests} onChanged={() => void reload()} />}
        </AdminPage>
    )
}

// ── the create/edit form (endpoint fields only) ──────────────────────────────────

interface Draft {
    name: string
    type: string
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
}

const emptyDraft = (): Draft => ({
    name: '',
    type: 'loki',
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
})

/** Reconstruct an editing draft from a stored endpoint spec. */
function draftOf(dto: LogDestDto): Draft {
    const s = dto.spec
    return {
        name: s.name,
        type: s.type,
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
    }
}

/** Assemble the endpoint API payload from the draft. */
function buildPayload(d: Draft): Record<string, unknown> {
    const payload: Record<string, unknown> = {
        name: d.name.trim(),
        type: d.type,
        url: d.url.trim(),
    }
    if (d.allowInsecure) payload.allow_insecure = true
    if (d.caFile.trim()) payload.ca_file = d.caFile.trim()
    if (d.insecureSkipVerify) payload.insecure_skip_verify = true
    if (d.type === 'loki' && d.tenant.trim()) payload.tenant = d.tenant.trim()
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
    return payload
}

function LogDestForm({ dests, onChanged }: { dests: LogDestDto[]; onChanged: () => void }) {
    const toast = useToast()
    const [form, setForm] = useState<{ id: string | null; draft: Draft } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [pending, setPending] = useState<LogDestDto | null>(null)
    const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

    const patchDraft = (p: Partial<Draft>) =>
        setForm((prev) => (prev ? { ...prev, draft: { ...prev.draft, ...p } } : prev))

    const close = useCallback(() => {
        setForm(null)
        setError(null)
        setTestResult(null)
    }, [])

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
        if (!d.url.trim()) {
            setError('A destination needs a URL.')
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
                const body = (await res.json().catch(() => null)) as { error?: string } | null
                const bindings = dto.usedBy.realms + dto.usedBy.instances
                setError(
                    body?.error === 'destination_in_use'
                        ? `“${dto.name}” is in use by ${bindings} binding${bindings === 1 ? '' : 's'} — unbind first.`
                        : `Couldn’t remove ${dto.name} (error ${res.status}).`,
                )
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
            total: dests.length,
            limit: dests.length || 10,
            offset: 0,
            rows: destRowsHtml(dests, busy),
        }),
        [dests, busy],
    )
    const tableRef = useTc<HTMLElement>(tableProps, { click: onDelegated })

    const d = form?.draft

    return (
        <>
            <tc-section-card title="Log destinations" icon="scroll-text">
                <div className="quaykeeper-admin-section">
                    <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                        A destination is a reusable endpoint — URL, TLS and auth only. What gets shipped to it, and how,
                        is set where it’s assigned: on an NGINX server (Servers page → log destination) for access logs,
                        or on an instance’s Logs tab for app logs. Credentials are referenced by env-var / file name and
                        provisioned on the shipping host — never stored here.
                    </p>
                    {error && !form && <tc-banner variant="error">{error}</tc-banner>}

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
                    {error && <tc-banner variant="error">{error}</tc-banner>}

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
                            ]}
                            onValue={(v) => patchDraft({ type: v })}
                        />
                    </FormGroup>

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
                                    help="Name of the env var on the shipping host — never the value."
                                    value={d.passwordEnv}
                                    onValue={(v) => patchDraft({ passwordEnv: v })}
                                />
                                <TextField
                                    label="…or password file"
                                    placeholder="/run/secrets/loki_password"
                                    help="Host-local file path (re-read per flush; rotate-safe)."
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

                    <FormGroup title="Test connection">
                        {testResult && (
                            <tc-banner variant={testResult.ok ? 'success' : 'error'}>{testResult.msg}</tc-banner>
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
                        ? `Remove ${pending.name}. Removal is blocked while any NGINX server or instance still binds it (currently: ${usedByText(pending)}).`
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
