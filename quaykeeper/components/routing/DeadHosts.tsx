'use client'

import { useCallback, useMemo, useState } from 'react'
import type { AdvancedTableColumn } from '@toolcase/web-components'
import { hstsEnabled, type DeadHost, type DeadHostCode, type TlsMode } from '@/server/domain/routing'
import type { AccessList } from '@/server/domain/access-list'
import {
    HstsOptionsRow,
    RoutingPage,
    RoutingListTable,
    SaveWarningsBanner,
    VhostPreviewModal,
    cellAccessList,
    cellBadge,
    cellEnabled,
    cellJoin,
    cellMono,
    cellTls,
    defaultHstsDraft,
    hstsDraftFrom,
    hstsPayload,
    json,
    saveErrorMessage,
    saveRouting,
    useMaintainerData,
    useResourceStates,
    type HstsDraft,
    type RoutingListItem,
} from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormModal, FormGroup } from '@/components/FormModal'
import { SelectField, SwitchField, TextAreaField, TextField, type SelectOption } from '@/components/fields'

// Maintainer routing surface — dead (parked) hosts (better.md §3): nginx answers
// every request on the domain with a fixed error code, optionally over TLS so the
// cert stays warm while a service is retired. 444 closes the connection without a
// response — no status line reaches the client at all. List the configured dead
// hosts, create/edit in a FormModal (impl §10 — POST replaces by domain), toggle,
// and remove. Drives the `/api/routing/dead-hosts` endpoints
// (`authorize('maintainer')`-gated).

const CODE_OPTIONS: SelectOption[] = [
    { value: '404', label: '404 — not found' },
    { value: '410', label: '410 — gone' },
    { value: '444', label: '444 — close connection (no response)' },
    { value: '503', label: '503 — service unavailable' },
]

const TLS_OPTIONS: SelectOption[] = [
    { value: 'off', label: 'off' },
    { value: 'auto', label: 'auto' },
    { value: 'required', label: 'required' },
]

/** Human chip text for the parked code — 444 reads as its behavior, not a number. */
function codeLabel(code: number): string {
    return code === 444 ? '444 close connection' : String(code)
}

interface DeadHostsData {
    deadHosts: DeadHost[]
    accessLists: AccessList[]
}

export function DeadHosts() {
    const fetcher = useCallback(async (): Promise<DeadHostsData | null> => {
        try {
            const deadHosts = await fetch('/api/routing/dead-hosts', { cache: 'no-store' }).then((r) =>
                json<DeadHost[]>(r),
            )
            const accessLists = await fetch('/api/routing/access-lists', { cache: 'no-store' })
                .then((r) => json<AccessList[]>(r))
                .catch(() => [] as AccessList[])
            return { deadHosts, accessLists }
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useMaintainerData(fetcher)

    return (
        <RoutingPage
            title="Dead hosts"
            subtitle="Parked domains answering a fixed error code — optionally over TLS to keep the cert warm."
            icon="ban"
            iconColor="rose"
            requiresPath="/dead-hosts"
            state={state}
            onRetry={() => void reload()}
        >
            {(data) => (
                <DeadHostsManager
                    deadHosts={data.deadHosts}
                    accessLists={data.accessLists}
                    onChanged={() => void reload()}
                />
            )}
        </RoutingPage>
    )
}

// List columns (between the built-in Domain column and the actions).
const DEAD_HOST_COLUMNS: AdvancedTableColumn[] = [
    { key: 'code', label: 'Answers' },
    { key: 'listen', label: 'Listen' },
    { key: 'tls', label: 'TLS' },
    { key: 'access', label: 'Access' },
    { key: 'options', label: 'Options' },
    { key: 'status', label: 'Status' },
]

const CODE_HINTS: Record<number, string> = {
    404: 'not found',
    410: 'gone',
    444: 'nginx closes the connection — no status line reaches the client',
    503: 'service unavailable',
}

/** Option chips beyond TLS: exploit blocking, gzip, raw nginx. */
function optionsCellHtml(d: DeadHost): string {
    const chips: string[] = []
    if (d.block_exploits) chips.push(cellBadge('block exploits'))
    if (d.gzip) chips.push(cellBadge('gzip'))
    if (d.advanced) chips.push(cellBadge('raw nginx', 'secondary', 'Carries a raw nginx passthrough snippet.'))
    return cellJoin(chips)
}

/** Everything the dead-host form holds — one draft object; the modal resets by remount. */
interface DeadHostDraft {
    domain: string
    enabled: boolean
    listen: string
    code: string
    tls: TlsMode
    forceSsl: boolean
    http2: boolean
    hsts: boolean
    hstsOpts: HstsDraft
    blockExploits: boolean
    gzip: boolean
    accessList: string
    advanced: string
}

const emptyDraft = (): DeadHostDraft => ({
    domain: '',
    enabled: true,
    listen: '',
    code: '404',
    tls: 'off',
    forceSsl: false,
    http2: false,
    hsts: false,
    hstsOpts: defaultHstsDraft(),
    blockExploits: false,
    gzip: false,
    accessList: '',
    advanced: '',
})

const draftFrom = (d: DeadHost): DeadHostDraft => ({
    domain: d.domain,
    enabled: d.enabled !== false,
    listen: d.listen ? String(d.listen) : '',
    code: String(d.code ?? 404),
    tls: d.tls ?? 'off',
    forceSsl: !!d.force_ssl,
    http2: !!d.http2,
    hsts: hstsEnabled(d.hsts),
    hstsOpts: hstsDraftFrom(d.hsts),
    blockExploits: !!d.block_exploits,
    gzip: !!d.gzip,
    accessList: d.access_list ?? '',
    advanced: d.advanced ?? '',
})

function DeadHostsManager({
    deadHosts,
    accessLists,
    onChanged,
}: {
    deadHosts: DeadHost[]
    accessLists: AccessList[]
    onChanged: () => void
}) {
    // The open form: null = closed; { editing: null } = create; { editing: domain } = edit.
    const [form, setForm] = useState<{ editing: string | null; draft: DeadHostDraft } | null>(null)
    const [error, setError] = useState<string | null>(null)
    // Advisory target-check warnings from the last successful save (A5) — dismissible.
    const [warnings, setWarnings] = useState<string[]>([])
    const [busy, setBusy] = useState(false)
    // The dead host awaiting remove confirmation (drives the ConfirmDialog).
    const [pending, setPending] = useState<string | null>(null)
    // The dead host awaiting disable confirmation (disabling stops the parked answer).
    const [pendingDisable, setPendingDisable] = useState<string | null>(null)
    // The domain whose rendered vhost is being previewed (impl §5).
    const [viewing, setViewing] = useState<string | null>(null)

    const patch = (p: Partial<DeadHostDraft>) =>
        setForm((prev) => (prev ? { ...prev, draft: { ...prev.draft, ...p } } : prev))

    const openCreate = () => {
        setError(null)
        setForm({ editing: null, draft: emptyDraft() })
    }

    const startEdit = useCallback(
        (deadDomain: string) => {
            const d = deadHosts.find((x) => x.domain === deadDomain)
            if (!d) return
            setError(null)
            setForm({ editing: d.domain, draft: draftFrom(d) })
        },
        [deadHosts],
    )

    const close = useCallback(() => {
        setForm(null)
        setError(null)
    }, [])

    const save = useCallback(async () => {
        if (!form || busy) return
        const d = form.draft
        const domain = d.domain.trim()
        if (!domain) {
            setError('A dead host needs a domain.')
            return
        }
        const tlsOn = d.tls !== 'off'
        if ((d.forceSsl || d.http2 || d.hsts) && !tlsOn) {
            setError('Enable TLS first to use Force HTTPS, HTTP/2 or HSTS.')
            return
        }
        const payload: DeadHost = { domain }
        if (!d.enabled) payload.enabled = false
        if (d.listen.trim()) payload.listen = Number(d.listen)
        if (d.code !== '404') payload.code = Number(d.code) as DeadHostCode
        if (tlsOn) payload.tls = d.tls
        if (d.forceSsl) payload.force_ssl = true
        if (d.http2) payload.http2 = true
        if (d.hsts) {
            const h = hstsPayload(d.hstsOpts)
            if ('error' in h) {
                setError(h.error)
                return
            }
            payload.hsts = h.value
        }
        if (d.blockExploits) payload.block_exploits = true
        if (d.gzip) payload.gzip = true
        if (d.accessList) payload.access_list = d.accessList
        if (d.advanced.trim()) payload.advanced = d.advanced

        setBusy(true)
        setError(null)
        setWarnings([])
        const outcome = await saveRouting('/api/routing/dead-hosts', payload)
        setBusy(false)
        if (!outcome.ok) {
            setError(saveErrorMessage('dead host', outcome))
            return
        }
        setWarnings(outcome.warnings)
        close()
        onChanged()
    }, [form, busy, close, onChanged])

    const doRemove = useCallback(async () => {
        const deadDomain = pending
        if (!deadDomain || busy) return
        setPending(null)
        setBusy(true)
        setError(null)
        try {
            const res = await fetch(`/api/routing/dead-hosts?domain=${encodeURIComponent(deadDomain)}`, {
                method: 'DELETE',
            })
            if (!res.ok && res.status !== 204) {
                setError(`Couldn’t remove ${deadDomain} (error ${res.status}).`)
                return
            }
            onChanged()
        } catch {
            setError(`Couldn’t remove ${deadDomain} — network error.`)
        } finally {
            setBusy(false)
        }
    }, [pending, busy, onChanged])

    // Flip a dead host's enabled state by POSTing the full object back (replace-by-domain).
    const applyEnabled = useCallback(
        async (deadDomain: string, next: boolean) => {
            const d = deadHosts.find((x) => x.domain === deadDomain)
            if (!d || busy) return
            setBusy(true)
            setError(null)
            const verb = next ? 'enable' : 'disable'
            const outcome = await saveRouting('/api/routing/dead-hosts', {
                ...d,
                enabled: next ? undefined : false,
            })
            setBusy(false)
            if (!outcome.ok) {
                setError(saveErrorMessage(`${verb} of ${deadDomain}`, outcome))
                return
            }
            onChanged()
        },
        [deadHosts, busy, onChanged],
    )

    // Enable is instant; disable stops the domain answering its parked code.
    const toggle = useCallback(
        (deadDomain: string) => {
            const d = deadHosts.find((x) => x.domain === deadDomain)
            if (!d) return
            if (d.enabled === false) void applyEnabled(deadDomain, true)
            else setPendingDisable(deadDomain)
        },
        [deadHosts, applyEnabled],
    )

    const resourceStates = useResourceStates('dead-host')
    const items = useMemo<RoutingListItem[]>(
        () =>
            deadHosts.map((d) => {
                const code = d.code ?? 404
                return {
                    name: d.domain,
                    nameExtraHtml: d.domain.startsWith('*.')
                        ? ` ${cellBadge('wildcard', 'info', 'Needs a DNS-01 wildcard cert (Certificates, challenge: dns).')}`
                        : undefined,
                    cells: {
                        code: cellBadge(codeLabel(code), code === 444 ? 'warning' : 'secondary', CODE_HINTS[code]),
                        listen: cellMono(`:${d.listen ?? 80}`),
                        tls: cellTls(d),
                        access: cellAccessList(d.access_list),
                        options: optionsCellHtml(d),
                        status: cellEnabled(d.enabled !== false),
                    },
                    toggleLabel: d.enabled === false ? 'Enable' : 'Disable',
                    stateChip: resourceStates.get(d.domain)?.state,
                    stateReason: resourceStates.get(d.domain)?.reason,
                }
            }),
        [deadHosts, resourceStates],
    )

    const d = form?.draft
    const tlsOff = d ? d.tls === 'off' : true

    return (
        <>
            <tc-section-card title="Dead (parked) hosts" icon="ban">
                <div className="quaykeeper-admin-section">
                    <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                        {deadHosts.length} dead host{deadHosts.length === 1 ? '' : 's'}. Each parks a domain on a fixed
                        error code. 444 closes the connection without any response. Keeping TLS on keeps the cert warm
                        for a retired domain, so bringing it back later needs no reissue.
                    </p>
                    {error && !form && <tc-banner variant="danger">{error}</tc-banner>}
                    <SaveWarningsBanner warnings={warnings} onDismiss={() => setWarnings([])} />

                    <div className="quaykeeper-list-actions">
                        <tc-button variant="primary" size="sm" onClick={openCreate}>
                            New dead host
                        </tc-button>
                    </div>

                    {deadHosts.length === 0 ? (
                        <tc-empty-state icon="ban">No dead hosts yet.</tc-empty-state>
                    ) : (
                        <RoutingListTable
                            columns={DEAD_HOST_COLUMNS}
                            nameLabel="Domain"
                            items={items}
                            busy={busy}
                            onEdit={startEdit}
                            onToggle={toggle}
                            onView={setViewing}
                            onRemove={setPending}
                        />
                    )}
                </div>
            </tc-section-card>

            {form && d && (
                <FormModal
                    key={form.editing ?? 'new'}
                    title={form.editing ? `Edit dead host — ${form.editing}` : 'New dead host'}
                    busy={busy}
                    submitLabel={form.editing ? 'Save changes' : 'Create dead host'}
                    onSubmit={() => void save()}
                    onClose={close}
                >
                    {error && <tc-banner variant="danger">{error}</tc-banner>}
                    <FormGroup title="Identity">
                        <div className="quaykeeper-form-grid">
                            <div className="quaykeeper-form-span">
                                <TextField
                                    label="Domain"
                                    placeholder="retired.example.com or *.example.com"
                                    help="A wildcard (*.example.com) needs a DNS-01 wildcard cert — issue via Certificates with challenge: dns."
                                    value={d.domain}
                                    disabled={!!form.editing}
                                    onValue={(v) => patch({ domain: v })}
                                />
                            </div>
                            <SelectField
                                label="Code"
                                value={d.code}
                                options={CODE_OPTIONS}
                                onValue={(v) => patch({ code: v })}
                            />
                            <TextField
                                type="number"
                                min={1}
                                max={65535}
                                label="Listen"
                                placeholder="80"
                                help="Plain-HTTP port. Blank = 80."
                                value={d.listen}
                                onValue={(v) => patch({ listen: v })}
                            />
                            <SwitchField
                                label="Enabled"
                                help="Off keeps the config but renders no server block."
                                checked={d.enabled}
                                onChecked={(c) => patch({ enabled: c })}
                            />
                        </div>
                    </FormGroup>

                    <FormGroup title="TLS & security">
                        <div className="quaykeeper-form-grid">
                            <SelectField
                                label="TLS"
                                help="Keeps the cert warm for a retired domain — bringing it back later needs no reissue."
                                value={d.tls}
                                options={TLS_OPTIONS}
                                onValue={(v) => {
                                    const mode = v as TlsMode
                                    patch(
                                        mode === 'off'
                                            ? { tls: mode, forceSsl: false, http2: false, hsts: false }
                                            : { tls: mode },
                                    )
                                }}
                            />
                            <SelectField
                                label="Access list"
                                help="IP allow/deny + basic auth policy (manage under Routing → Access lists)."
                                value={d.accessList}
                                options={[
                                    { value: '', label: 'open (no access list)' },
                                    ...accessLists.map((l) => ({ value: l.name, label: l.name })),
                                ]}
                                onValue={(v) => patch({ accessList: v })}
                            />
                        </div>
                        <div className="quaykeeper-form-switches">
                            <SwitchField
                                label="Force HTTPS"
                                disabled={tlsOff}
                                checked={d.forceSsl}
                                onChecked={(c) => patch({ forceSsl: c })}
                            />
                            <SwitchField
                                label="HTTP/2"
                                disabled={tlsOff}
                                checked={d.http2}
                                onChecked={(c) => patch({ http2: c })}
                            />
                            <SwitchField
                                label="HSTS"
                                disabled={tlsOff}
                                checked={d.hsts}
                                onChecked={(c) => patch({ hsts: c })}
                            />
                            <SwitchField
                                label="Block exploits"
                                checked={d.blockExploits}
                                onChecked={(c) => patch({ blockExploits: c })}
                            />
                            <SwitchField label="Gzip" checked={d.gzip} onChecked={(c) => patch({ gzip: c })} />
                        </div>
                        {d.hsts && !tlsOff && (
                            <HstsOptionsRow draft={d.hstsOpts} onDraft={(next) => patch({ hstsOpts: next })} />
                        )}
                    </FormGroup>

                    <FormGroup title="Advanced">
                        <TextAreaField
                            label="Raw nginx (server block)"
                            rows={3}
                            placeholder="add_header X-Robots-Tag noindex;"
                            help="Rides the daemon's nginx -t gate — a bad snippet quarantines only this dead host."
                            value={d.advanced}
                            onValue={(v) => patch({ advanced: v })}
                        />
                    </FormGroup>
                </FormModal>
            )}

            <VhostPreviewModal domain={viewing} onClose={() => setViewing(null)} />

            <ConfirmDialog
                open={!!pendingDisable}
                title="Disable dead host?"
                message={
                    pendingDisable
                        ? `Disable the dead host for ${pendingDisable}. The domain stops answering its parked code once nginx reloads; the configuration is kept.`
                        : undefined
                }
                confirmLabel="Disable"
                danger
                onConfirm={() => {
                    const dd = pendingDisable
                    setPendingDisable(null)
                    if (dd) void applyEnabled(dd, false)
                }}
                onCancel={() => setPendingDisable(null)}
            />

            <ConfirmDialog
                open={!!pending}
                title="Remove dead host?"
                message={
                    pending
                        ? `Remove the dead host for ${pending}. The domain stops answering once nginx reloads.`
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
