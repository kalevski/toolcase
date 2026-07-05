'use client'

import { useCallback, useMemo, useState } from 'react'
import type { AdvancedTableColumn } from '@toolcase/web-components'
import { hstsEnabled, type Redirect, type RedirectCode, type RedirectScheme, type TlsMode } from '@/server/domain/routing'
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
    cellMuted,
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

// Maintainer routing surface — redirection hosts (better.md §3): an nginx `server{}`
// block answering every request with a configurable 30x to another host. List the
// configured redirects, create/edit in a FormModal (impl §10 — POST replaces by
// domain), toggle, and remove. Drives the `/api/routing/redirects` endpoints
// (`authorize('maintainer')`-gated). `force_ssl` is intentionally absent — the daemon
// rejects it on redirects (the redirect IS the redirect); TLS auto/required makes the
// redirect answer https.

const CODE_OPTIONS: SelectOption[] = [
    { value: '301', label: '301 — permanent' },
    { value: '302', label: '302 — found (temporary)' },
    { value: '303', label: '303 — see other' },
    { value: '307', label: '307 — temporary (method kept)' },
    { value: '308', label: '308 — permanent (method kept)' },
]

const SCHEME_OPTIONS: SelectOption[] = [
    { value: 'auto', label: 'auto (keep the client’s)' },
    { value: 'http', label: 'http' },
    { value: 'https', label: 'https' },
]

const TLS_OPTIONS: SelectOption[] = [
    { value: 'off', label: 'off' },
    { value: 'auto', label: 'auto' },
    { value: 'required', label: 'required' },
]

interface RedirectsData {
    redirects: Redirect[]
    accessLists: AccessList[]
}

export function Redirects() {
    const fetcher = useCallback(async (): Promise<RedirectsData | null> => {
        try {
            const redirects = await fetch('/api/routing/redirects', { cache: 'no-store' }).then((r) =>
                json<Redirect[]>(r),
            )
            const accessLists = await fetch('/api/routing/access-lists', { cache: 'no-store' })
                .then((r) => json<AccessList[]>(r))
                .catch(() => [] as AccessList[])
            return { redirects, accessLists }
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useMaintainerData(fetcher)

    return (
        <RoutingPage
            title="Redirects"
            subtitle="Redirection hosts — answer every request with a 30x to another host. Maintainer access."
            icon="corner-up-right"
            iconColor="violet"
            requiresPath="/redirects"
            state={state}
            onRetry={() => void reload()}
        >
            {(data) => (
                <RedirectsManager
                    redirects={data.redirects}
                    accessLists={data.accessLists}
                    onChanged={() => void reload()}
                />
            )}
        </RoutingPage>
    )
}

// List columns (between the built-in Domain column and the actions).
const REDIRECT_COLUMNS: AdvancedTableColumn[] = [
    { key: 'target', label: 'Target' },
    { key: 'code', label: 'Code' },
    { key: 'path', label: 'Path' },
    { key: 'listen', label: 'Listen' },
    { key: 'tls', label: 'TLS' },
    { key: 'access', label: 'Access' },
    { key: 'options', label: 'Options' },
    { key: 'status', label: 'Status' },
]

const CODE_HINTS: Record<number, string> = {
    301: 'permanent',
    302: 'found (temporary)',
    303: 'see other',
    307: 'temporary (method kept)',
    308: 'permanent (method kept)',
}

/** Target cell: the destination host plus a forced-scheme chip when set. */
function targetCellHtml(r: Redirect): string {
    const parts = [cellMono(`→ ${r.to}`)]
    if (r.scheme && r.scheme !== 'auto') {
        parts.push(cellBadge(r.scheme, 'secondary', 'Forces the target scheme (auto keeps the client’s).'))
    }
    return cellJoin(parts)
}

/** Option chips beyond TLS: exploit blocking, gzip, raw nginx. */
function optionsCellHtml(r: Redirect): string {
    const chips: string[] = []
    if (r.block_exploits) chips.push(cellBadge('block exploits'))
    if (r.gzip) chips.push(cellBadge('gzip'))
    if (r.advanced) chips.push(cellBadge('raw nginx', 'secondary', 'Carries a raw nginx passthrough snippet.'))
    return cellJoin(chips)
}

/** Everything the redirect form holds — one draft object; the modal resets by remount. */
interface RedirectDraft {
    domain: string
    enabled: boolean
    listen: string
    to: string
    code: string
    scheme: RedirectScheme
    preservePath: boolean
    tls: TlsMode
    http2: boolean
    hsts: boolean
    hstsOpts: HstsDraft
    blockExploits: boolean
    gzip: boolean
    accessList: string
    advanced: string
}

const emptyDraft = (): RedirectDraft => ({
    domain: '',
    enabled: true,
    listen: '',
    to: '',
    code: '301',
    scheme: 'auto',
    preservePath: true,
    tls: 'off',
    http2: false,
    hsts: false,
    hstsOpts: defaultHstsDraft(),
    blockExploits: false,
    gzip: false,
    accessList: '',
    advanced: '',
})

const draftFrom = (r: Redirect): RedirectDraft => ({
    domain: r.domain,
    enabled: r.enabled !== false,
    listen: r.listen ? String(r.listen) : '',
    to: r.to,
    code: String(r.code ?? 301),
    scheme: r.scheme ?? 'auto',
    preservePath: r.preserve_path !== false,
    tls: r.tls ?? 'off',
    http2: !!r.http2,
    hsts: hstsEnabled(r.hsts),
    hstsOpts: hstsDraftFrom(r.hsts),
    blockExploits: !!r.block_exploits,
    gzip: !!r.gzip,
    accessList: r.access_list ?? '',
    advanced: r.advanced ?? '',
})

function RedirectsManager({
    redirects,
    accessLists,
    onChanged,
}: {
    redirects: Redirect[]
    accessLists: AccessList[]
    onChanged: () => void
}) {
    // The open form: null = closed; { editing: null } = create; { editing: domain } = edit.
    const [form, setForm] = useState<{ editing: string | null; draft: RedirectDraft } | null>(null)
    const [error, setError] = useState<string | null>(null)
    // Advisory target-check warnings from the last successful save (A5) — dismissible.
    const [warnings, setWarnings] = useState<string[]>([])
    const [busy, setBusy] = useState(false)
    // The redirect awaiting remove confirmation (drives the ConfirmDialog).
    const [pending, setPending] = useState<string | null>(null)
    // The redirect awaiting disable confirmation (disabling stops the redirect answering).
    const [pendingDisable, setPendingDisable] = useState<string | null>(null)
    // The domain whose rendered vhost is being previewed (impl §5).
    const [viewing, setViewing] = useState<string | null>(null)

    const patch = (p: Partial<RedirectDraft>) =>
        setForm((prev) => (prev ? { ...prev, draft: { ...prev.draft, ...p } } : prev))

    const openCreate = () => {
        setError(null)
        setForm({ editing: null, draft: emptyDraft() })
    }

    const startEdit = useCallback(
        (redirectDomain: string) => {
            const r = redirects.find((x) => x.domain === redirectDomain)
            if (!r) return
            setError(null)
            setForm({ editing: r.domain, draft: draftFrom(r) })
        },
        [redirects],
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
            setError('A redirect needs a domain.')
            return
        }
        if (!d.to.trim()) {
            setError('A redirect needs a target host (to).')
            return
        }
        const tlsOn = d.tls !== 'off'
        if ((d.http2 || d.hsts) && !tlsOn) {
            setError('Enable TLS first to use HTTP/2 or HSTS.')
            return
        }
        const payload: Redirect = { domain, to: d.to.trim() }
        if (!d.enabled) payload.enabled = false
        if (d.listen.trim()) payload.listen = Number(d.listen)
        if (d.code !== '301') payload.code = Number(d.code) as RedirectCode
        if (d.scheme !== 'auto') payload.scheme = d.scheme
        if (!d.preservePath) payload.preserve_path = false
        if (tlsOn) payload.tls = d.tls
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
        const outcome = await saveRouting('/api/routing/redirects', payload)
        setBusy(false)
        if (!outcome.ok) {
            setError(saveErrorMessage('redirect', outcome))
            return
        }
        setWarnings(outcome.warnings)
        close()
        onChanged()
    }, [form, busy, close, onChanged])

    const doRemove = useCallback(async () => {
        const redirectDomain = pending
        if (!redirectDomain || busy) return
        setPending(null)
        setBusy(true)
        setError(null)
        try {
            const res = await fetch(`/api/routing/redirects?domain=${encodeURIComponent(redirectDomain)}`, {
                method: 'DELETE',
            })
            if (!res.ok && res.status !== 204) {
                setError(`Couldn’t remove ${redirectDomain} (error ${res.status}).`)
                return
            }
            onChanged()
        } catch {
            setError(`Couldn’t remove ${redirectDomain} — network error.`)
        } finally {
            setBusy(false)
        }
    }, [pending, busy, onChanged])

    // Flip a redirect's enabled state by POSTing the full object back (replace-by-domain).
    const applyEnabled = useCallback(
        async (redirectDomain: string, next: boolean) => {
            const r = redirects.find((x) => x.domain === redirectDomain)
            if (!r || busy) return
            setBusy(true)
            setError(null)
            const verb = next ? 'enable' : 'disable'
            const outcome = await saveRouting('/api/routing/redirects', {
                ...r,
                enabled: next ? undefined : false,
            })
            setBusy(false)
            if (!outcome.ok) {
                setError(saveErrorMessage(`${verb} of ${redirectDomain}`, outcome))
                return
            }
            onChanged()
        },
        [redirects, busy, onChanged],
    )

    // Enable is instant; disable stops the redirect answering, so it goes through a confirm.
    const toggle = useCallback(
        (redirectDomain: string) => {
            const r = redirects.find((x) => x.domain === redirectDomain)
            if (!r) return
            if (r.enabled === false) void applyEnabled(redirectDomain, true)
            else setPendingDisable(redirectDomain)
        },
        [redirects, applyEnabled],
    )

    const resourceStates = useResourceStates('redirect')
    const items = useMemo<RoutingListItem[]>(
        () =>
            redirects.map((r) => {
                const code = r.code ?? 301
                return {
                    name: r.domain,
                    nameExtraHtml: r.domain.startsWith('*.')
                        ? ` ${cellBadge('wildcard', 'info', 'Needs a DNS-01 wildcard cert (Certificates, challenge: dns).')}`
                        : undefined,
                    cells: {
                        target: targetCellHtml(r),
                        code: cellBadge(String(code), 'secondary', CODE_HINTS[code]),
                        path: r.preserve_path !== false
                            ? cellMuted('kept')
                            : cellBadge('dropped', 'secondary', 'The original path + query are not appended to the target.'),
                        listen: cellMono(`:${r.listen ?? 80}`),
                        tls: cellTls(r),
                        access: cellAccessList(r.access_list),
                        options: optionsCellHtml(r),
                        status: cellEnabled(r.enabled !== false),
                    },
                    toggleLabel: r.enabled === false ? 'Enable' : 'Disable',
                    stateChip: resourceStates.get(r.domain)?.state,
                    stateReason: resourceStates.get(r.domain)?.reason,
                }
            }),
        [redirects, resourceStates],
    )

    const d = form?.draft
    const tlsOff = d ? d.tls === 'off' : true

    return (
        <>
            <tc-section-card title="Redirection hosts" icon="corner-up-right">
                <div className="quaykeeper-admin-section">
                    <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                        {redirects.length} redirect{redirects.length === 1 ? '' : 's'}. Each answers every request on
                        its domain with a 30x to another host. Wildcard domains (*.example.com) are supported — a
                        wildcard needs a DNS-01 wildcard cert (issue via Certificates with challenge: dns).
                    </p>
                    {error && !form && <tc-banner variant="danger">{error}</tc-banner>}
                    <SaveWarningsBanner warnings={warnings} onDismiss={() => setWarnings([])} />

                    <div className="quaykeeper-list-actions">
                        <tc-button variant="primary" size="sm" onClick={openCreate}>
                            New redirect
                        </tc-button>
                    </div>

                    {redirects.length === 0 ? (
                        <tc-empty-state icon="corner-up-right">No redirects yet.</tc-empty-state>
                    ) : (
                        <RoutingListTable
                            columns={REDIRECT_COLUMNS}
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
                    title={form.editing ? `Edit redirect — ${form.editing}` : 'New redirect'}
                    busy={busy}
                    submitLabel={form.editing ? 'Save changes' : 'Create redirect'}
                    onSubmit={() => void save()}
                    onClose={close}
                >
                    {error && <tc-banner variant="danger">{error}</tc-banner>}
                    <FormGroup title="Identity">
                        <div className="quaykeeper-form-grid">
                            <div className="quaykeeper-form-span">
                                <TextField
                                    label="Domain"
                                    placeholder="old.example.com or *.example.com"
                                    help="A wildcard (*.example.com) needs a DNS-01 wildcard cert — issue via Certificates with challenge: dns."
                                    value={d.domain}
                                    disabled={!!form.editing}
                                    onValue={(v) => patch({ domain: v })}
                                />
                            </div>
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

                    <FormGroup title="Target">
                        <div className="quaykeeper-form-grid">
                            <div className="quaykeeper-form-span">
                                <TextField
                                    label="Redirect to (host, optional :port)"
                                    placeholder="new.example.com"
                                    value={d.to}
                                    onValue={(v) => patch({ to: v })}
                                />
                            </div>
                            <SelectField
                                label="Code"
                                value={d.code}
                                options={CODE_OPTIONS}
                                onValue={(v) => patch({ code: v })}
                            />
                            <SelectField
                                label="Scheme"
                                value={d.scheme}
                                options={SCHEME_OPTIONS}
                                onValue={(v) => patch({ scheme: v as RedirectScheme })}
                            />
                            <SwitchField
                                label="Preserve path"
                                help="Appends the original path + query to the target."
                                checked={d.preservePath}
                                onChecked={(c) => patch({ preservePath: c })}
                            />
                        </div>
                    </FormGroup>

                    <FormGroup title="TLS & security">
                        <div className="quaykeeper-form-grid">
                            <SelectField
                                label="TLS"
                                help="auto/required lets the redirect answer https too. No Force HTTPS here — the redirect IS the redirect."
                                value={d.tls}
                                options={TLS_OPTIONS}
                                onValue={(v) => {
                                    const mode = v as TlsMode
                                    patch(mode === 'off' ? { tls: mode, http2: false, hsts: false } : { tls: mode })
                                }}
                            />
                            <SelectField
                                label="Access list"
                                help="IP allow/deny + basic auth policy (Routing → Access lists)."
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
                            help="Rides the daemon's nginx -t gate — a bad snippet quarantines only this redirect."
                            value={d.advanced}
                            onValue={(v) => patch({ advanced: v })}
                        />
                    </FormGroup>
                </FormModal>
            )}

            <VhostPreviewModal domain={viewing} onClose={() => setViewing(null)} />

            <ConfirmDialog
                open={!!pendingDisable}
                title="Disable redirect?"
                message={
                    pendingDisable
                        ? `Disable the redirect for ${pendingDisable}. The domain stops answering once nginx reloads; the configuration is kept and can be re-enabled anytime.`
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
                title="Remove redirect?"
                message={
                    pending
                        ? `Remove the redirect for ${pending}. The domain stops answering once nginx reloads.`
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
