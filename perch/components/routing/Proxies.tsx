'use client'

import { useCallback, useMemo, useState } from 'react'
import type { AdvancedTableColumn, TabBarItem } from '@toolcase/web-components'
import { useTc } from '@/lib/tc'
import { hstsEnabled, type Proxy, type ProxyLocation, type TlsMode, type Upstream } from '@/server/domain/routing'
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
import { UpstreamsManager } from './Upstreams'

// Maintainer routing surface — reverse-proxy vhosts (nginx `server{}` blocks) AND
// their upstream pools, on ONE page: list the configured proxies, create/edit one in
// a FormModal (impl §10 — routing to a named upstream pool or an inline `pass` URL,
// with optional per-path locations; the POST endpoint replaces by domain), remove
// one, and manage the `upstream{}` pools those proxies target on the sibling tab.
// Drives the `/api/routing/proxies` + `/api/routing/upstreams` endpoints
// (`authorize('maintainer')`-gated). A proxy that names an unknown upstream is
// rejected by nginxpilot (400) — create the pool first, same page.

interface ProxiesData {
    proxies: Proxy[]
    upstreams: Upstream[]
    accessLists: AccessList[]
}

// The page's two surfaces as sibling tabs (a local tc-tab-bar, NOT route
// navigation — both read the same loaded slice and share one reload).
type ProxyTab = 'proxies' | 'upstreams'

const PROXY_TABS: TabBarItem[] = [
    { id: 'proxies', label: 'Proxies', icon: 'globe' },
    { id: 'upstreams', label: 'Upstreams', icon: 'server' },
]

export function Proxies() {
    const [tab, setTab] = useState<ProxyTab>('proxies')
    const tabRef = useTc<HTMLElement>(
        useMemo(() => ({ tabs: PROXY_TABS, onChange: (id: string) => setTab(id as ProxyTab) }), []),
    )
    const fetcher = useCallback(async (): Promise<ProxiesData | null> => {
        try {
            const [proxies, upstreams] = await Promise.all([
                fetch('/api/routing/proxies', { cache: 'no-store' }).then((r) => json<Proxy[]>(r)),
                fetch('/api/routing/upstreams', { cache: 'no-store' }).then((r) => json<Upstream[]>(r)),
            ])
            // Access lists are an enrichment (the select) — an older daemon without
            // them must not error the whole page.
            const accessLists = await fetch('/api/routing/access-lists', { cache: 'no-store' })
                .then((r) => json<AccessList[]>(r))
                .catch(() => [] as AccessList[])
            return { proxies, upstreams, accessLists }
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useMaintainerData(fetcher)

    return (
        <RoutingPage
            title="Proxies"
            subtitle="Reverse-proxy vhosts and the upstream pools they route to. Maintainer access."
            icon="globe"
            iconColor="cyan"
            state={state}
            onRetry={() => void reload()}
        >
            {(data) => (
                <>
                    <tc-tab-bar ref={tabRef} active-id={tab} className="perch-sub-tabs" />
                    {tab === 'proxies' && (
                        <ProxiesManager
                            proxies={data.proxies}
                            upstreams={data.upstreams}
                            accessLists={data.accessLists}
                            onChanged={() => void reload()}
                        />
                    )}
                    {tab === 'upstreams' && (
                        <UpstreamsManager upstreams={data.upstreams} onChanged={() => void reload()} />
                    )}
                </>
            )}
        </RoutingPage>
    )
}

type TargetKind = 'upstream' | 'pass'
type LocTargetKind = 'inherit' | 'upstream' | 'pass'

interface LocationDraft {
    path: string
    kind: LocTargetKind
    value: string
    websocket: boolean
    /** Whether the per-location advanced disclosure is open (A4). */
    showAdvanced: boolean
    advanced: string
}

const emptyLocation = (): LocationDraft => ({
    path: '/',
    kind: 'inherit',
    value: '',
    websocket: false,
    showAdvanced: false,
    advanced: '',
})

// Default-target kind (a proxy routes to a named upstream pool or an inline pass URL).
const KIND_OPTIONS: SelectOption[] = [
    { value: 'upstream', label: 'upstream' },
    { value: 'pass', label: 'pass (URL)' },
]

// Per-location kind adds an 'inherit' choice (fall back to the proxy default target).
const LOC_KIND_OPTIONS: SelectOption[] = [
    { value: 'inherit', label: 'inherit default' },
    ...KIND_OPTIONS,
]

// TLS termination modes (managed mode, §0/Phase B).
const TLS_OPTIONS: SelectOption[] = [
    { value: 'off', label: 'off' },
    { value: 'auto', label: 'auto' },
    { value: 'required', label: 'required' },
]

// List columns (between the built-in Domain column and the actions).
const PROXY_COLUMNS: AdvancedTableColumn[] = [
    { key: 'target', label: 'Target' },
    { key: 'listen', label: 'Listen' },
    { key: 'tls', label: 'TLS' },
    { key: 'access', label: 'Access' },
    { key: 'options', label: 'Options' },
    { key: 'status', label: 'Status' },
]

/** Target cell: the default upstream/pass target plus the per-path location count. */
function targetCellHtml(p: Proxy): string {
    const parts: string[] = []
    if (p.upstream) parts.push(cellMono(`→ ${p.upstream}`))
    else if (p.pass) parts.push(cellMono(`→ ${p.pass}`))
    const locs = p.locations?.length ?? 0
    if (locs) parts.push(cellMuted(`${locs} location${locs === 1 ? '' : 's'}`))
    return cellJoin(parts)
}

/** Option chips beyond TLS: websocket/gzip/cache/exploit blocking, limits, timeouts. */
function optionsCellHtml(p: Proxy): string {
    const chips: string[] = []
    if (p.websocket) chips.push(cellBadge('websocket'))
    if (p.gzip) chips.push(cellBadge('gzip'))
    if (p.cache?.enabled) chips.push(cellBadge('cache', 'secondary', p.cache.valid?.join(', ')))
    if (p.block_exploits) chips.push(cellBadge('block exploits'))
    if (p.client_max_body_size) chips.push(cellBadge(`body ≤ ${p.client_max_body_size}`))
    const timeouts = [
        p.connect_timeout && `connect ${p.connect_timeout}`,
        p.read_timeout && `read ${p.read_timeout}`,
        p.send_timeout && `send ${p.send_timeout}`,
    ].filter(Boolean) as string[]
    if (timeouts.length) chips.push(cellMuted(timeouts.join(' · ')))
    if (p.advanced) chips.push(cellBadge('raw nginx', 'secondary', 'Carries a raw nginx passthrough snippet.'))
    return cellJoin(chips)
}

/** Everything the proxy form holds — one draft object; the modal resets by remount. */
interface ProxyDraft {
    domain: string
    enabled: boolean
    listen: string
    targetKind: TargetKind
    targetValue: string
    maxBody: string
    // Proxy HTTP timeouts — parsed and re-rendered by the domain layer; the form
    // must round-trip them or an edit silently drops values set via the API/YAML.
    connectTimeout: string
    readTimeout: string
    sendTimeout: string
    locations: LocationDraft[]
    tls: TlsMode
    forceSsl: boolean
    http2: boolean
    hsts: boolean
    hstsOpts: HstsDraft
    blockExploits: boolean
    websocket: boolean
    gzip: boolean
    cacheEnabled: boolean
    cacheZone: string
    cacheValid: string
    accessList: string
    advanced: string
}

const emptyDraft = (): ProxyDraft => ({
    domain: '',
    enabled: true,
    listen: '',
    targetKind: 'upstream',
    targetValue: '',
    maxBody: '',
    connectTimeout: '',
    readTimeout: '',
    sendTimeout: '',
    locations: [],
    tls: 'off',
    forceSsl: false,
    http2: false,
    hsts: false,
    hstsOpts: defaultHstsDraft(),
    blockExploits: false,
    websocket: false,
    gzip: false,
    cacheEnabled: false,
    cacheZone: '',
    cacheValid: '',
    accessList: '',
    advanced: '',
})

const draftFrom = (p: Proxy): ProxyDraft => ({
    domain: p.domain,
    enabled: p.enabled !== false,
    listen: p.listen ? String(p.listen) : '',
    targetKind: p.pass ? 'pass' : 'upstream',
    targetValue: p.pass ?? p.upstream ?? '',
    maxBody: p.client_max_body_size ?? '',
    connectTimeout: p.connect_timeout ?? '',
    readTimeout: p.read_timeout ?? '',
    sendTimeout: p.send_timeout ?? '',
    locations: (p.locations ?? []).map((l) => ({
        path: l.path,
        kind: l.upstream ? 'upstream' : l.pass ? 'pass' : 'inherit',
        value: l.upstream ?? l.pass ?? '',
        websocket: !!l.websocket,
        showAdvanced: !!l.advanced,
        advanced: l.advanced ?? '',
    })),
    tls: p.tls ?? 'off',
    forceSsl: !!p.force_ssl,
    http2: !!p.http2,
    hsts: hstsEnabled(p.hsts),
    hstsOpts: hstsDraftFrom(p.hsts),
    blockExploits: !!p.block_exploits,
    websocket: !!p.websocket,
    gzip: !!p.gzip,
    cacheEnabled: !!p.cache?.enabled,
    cacheZone: p.cache?.zone_size ?? '',
    cacheValid: p.cache?.valid?.join(', ') ?? '',
    accessList: p.access_list ?? '',
    advanced: p.advanced ?? '',
})

export function ProxiesManager({
    proxies,
    upstreams,
    accessLists,
    onChanged,
}: {
    proxies: Proxy[]
    upstreams: Upstream[]
    accessLists: AccessList[]
    onChanged: () => void
}) {
    // The open form: null = closed; { editing: null } = create; { editing: domain } = edit.
    const [form, setForm] = useState<{ editing: string | null; draft: ProxyDraft } | null>(null)
    const [error, setError] = useState<string | null>(null)
    // Advisory target-check warnings from the last successful save (A5) — dismissible.
    const [warnings, setWarnings] = useState<string[]>([])
    // The payload blocked by the daemon's DNS check, held for the "Save anyway" retry.
    const [dnsRetry, setDnsRetry] = useState<Proxy | null>(null)
    const [busy, setBusy] = useState(false)
    // The proxy awaiting remove confirmation (drives the ConfirmDialog).
    const [pending, setPending] = useState<string | null>(null)
    // The proxy awaiting disable confirmation (disabling stops its traffic).
    const [pendingDisable, setPendingDisable] = useState<string | null>(null)
    // The domain whose rendered vhost is being previewed (impl §5).
    const [viewing, setViewing] = useState<string | null>(null)

    const patch = (p: Partial<ProxyDraft>) =>
        setForm((prev) => (prev ? { ...prev, draft: { ...prev.draft, ...p } } : prev))

    const patchLoc = (i: number, p: Partial<LocationDraft>) =>
        setForm((prev) =>
            prev
                ? {
                      ...prev,
                      draft: {
                          ...prev.draft,
                          locations: prev.draft.locations.map((l, idx) => (idx === i ? { ...l, ...p } : l)),
                      },
                  }
                : prev,
        )
    const addLoc = () =>
        setForm((prev) =>
            prev ? { ...prev, draft: { ...prev.draft, locations: [...prev.draft.locations, emptyLocation()] } } : prev,
        )
    const removeLoc = (i: number) =>
        setForm((prev) =>
            prev
                ? {
                      ...prev,
                      draft: { ...prev.draft, locations: prev.draft.locations.filter((_, idx) => idx !== i) },
                  }
                : prev,
        )

    const openCreate = () => {
        setError(null)
        setDnsRetry(null)
        setForm({ editing: null, draft: emptyDraft() })
    }

    // Load an existing proxy into the form (edit mode). Saving POSTs the same
    // endpoint, which replaces the fragment for that domain.
    const startEdit = useCallback(
        (proxyDomain: string) => {
            const p = proxies.find((x) => x.domain === proxyDomain)
            if (!p) return
            setError(null)
            setDnsRetry(null)
            setForm({ editing: p.domain, draft: draftFrom(p) })
        },
        [proxies],
    )

    const close = useCallback(() => {
        setForm(null)
        setError(null)
        setDnsRetry(null)
    }, [])

    /** Build the POST payload from the draft, or set an error and return null. */
    const buildPayload = useCallback((): Proxy | null => {
        if (!form) return null
        const d = form.draft
        const domain = d.domain.trim()
        if (!domain) {
            setError('A proxy needs a domain.')
            return null
        }
        const payload: Proxy = { domain }
        if (!d.enabled) payload.enabled = false
        if (d.listen.trim()) payload.listen = Number(d.listen)
        if (d.targetValue.trim()) {
            if (d.targetKind === 'upstream') payload.upstream = d.targetValue.trim()
            else payload.pass = d.targetValue.trim()
        }
        if (d.maxBody.trim()) payload.client_max_body_size = d.maxBody.trim()
        if (d.connectTimeout.trim()) payload.connect_timeout = d.connectTimeout.trim()
        if (d.readTimeout.trim()) payload.read_timeout = d.readTimeout.trim()
        if (d.sendTimeout.trim()) payload.send_timeout = d.sendTimeout.trim()

        // TLS & security. Guard the daemon's rule client-side so the user sees it
        // before the round-trip (parseProxy enforces the same).
        const tlsOn = d.tls !== 'off'
        if ((d.forceSsl || d.http2 || d.hsts) && !tlsOn) {
            setError('Enable TLS first to use Force HTTPS, HTTP/2 or HSTS.')
            return null
        }
        if (tlsOn) payload.tls = d.tls
        if (d.forceSsl) payload.force_ssl = true
        if (d.http2) payload.http2 = true
        if (d.hsts) {
            const h = hstsPayload(d.hstsOpts)
            if ('error' in h) {
                setError(h.error)
                return null
            }
            payload.hsts = h.value
        }
        if (d.blockExploits) payload.block_exploits = true
        if (d.websocket) payload.websocket = true
        if (d.gzip) payload.gzip = true
        if (d.cacheEnabled) {
            const valid = d.cacheValid.split(',').map((s) => s.trim()).filter(Boolean)
            payload.cache = { enabled: true }
            if (valid.length) payload.cache.valid = valid
            if (d.cacheZone.trim()) payload.cache.zone_size = d.cacheZone.trim()
        }
        if (d.accessList) payload.access_list = d.accessList
        if (d.advanced.trim()) payload.advanced = d.advanced

        const builtLocs: ProxyLocation[] = []
        for (const l of d.locations) {
            const path = l.path.trim() || '/'
            const loc: ProxyLocation = { path }
            if (l.kind !== 'inherit') {
                if (!l.value.trim()) {
                    setError(`Location ${path} needs a target value.`)
                    return null
                }
                if (l.kind === 'upstream') loc.upstream = l.value.trim()
                else loc.pass = l.value.trim()
            }
            if (l.websocket) loc.websocket = true
            if (l.advanced.trim()) loc.advanced = l.advanced
            builtLocs.push(loc)
        }
        if (builtLocs.length) payload.locations = builtLocs

        if (!payload.upstream && !payload.pass && builtLocs.length === 0) {
            setError('Set a default target (upstream or pass) or add at least one location.')
            return null
        }
        return payload
    }, [form])

    const save = useCallback(async () => {
        if (busy) return
        const payload = buildPayload()
        if (!payload) return

        setBusy(true)
        setError(null)
        setWarnings([])
        setDnsRetry(null)
        const outcome = await saveRouting('/api/routing/proxies', payload)
        setBusy(false)
        if (!outcome.ok) {
            setError(saveErrorMessage('proxy', outcome))
            // The daemon's DNS gate — offer its own ?skip_target_checks=true override.
            if (outcome.dnsBlocked) setDnsRetry(payload)
            return
        }
        setWarnings(outcome.warnings)
        close()
        onChanged()
    }, [busy, buildPayload, close, onChanged])

    // The "Save anyway" retry for a DNS-blocked save — the daemon's own escape hatch
    // for a target host whose DNS record lands later (?skip_target_checks=true).
    const retrySkippingDns = useCallback(async () => {
        const payload = dnsRetry
        if (!payload || busy) return
        setBusy(true)
        setError(null)
        const outcome = await saveRouting('/api/routing/proxies', payload, true)
        setBusy(false)
        if (!outcome.ok) {
            setError(saveErrorMessage('proxy', outcome))
            return
        }
        setDnsRetry(null)
        setWarnings(outcome.warnings)
        close()
        onChanged()
    }, [dnsRetry, busy, close, onChanged])

    const doRemove = useCallback(async () => {
        const proxyDomain = pending
        if (!proxyDomain || busy) return
        setPending(null)
        setBusy(true)
        setError(null)
        try {
            const res = await fetch(`/api/routing/proxies?domain=${encodeURIComponent(proxyDomain)}`, {
                method: 'DELETE',
            })
            if (!res.ok && res.status !== 204) {
                setError(`Couldn’t remove ${proxyDomain} (error ${res.status}).`)
                return
            }
            onChanged()
        } catch {
            setError(`Couldn’t remove ${proxyDomain} — network error.`)
        } finally {
            setBusy(false)
        }
    }, [pending, busy, onChanged])

    // Flip a proxy's enabled state by POSTing the full object back (the endpoint
    // replaces by domain). `enabled: undefined` drops out of the JSON, which is
    // the daemon's default-enabled form.
    const applyEnabled = useCallback(
        async (proxyDomain: string, next: boolean) => {
            const p = proxies.find((x) => x.domain === proxyDomain)
            if (!p || busy) return
            setBusy(true)
            setError(null)
            const verb = next ? 'enable' : 'disable'
            const outcome = await saveRouting('/api/routing/proxies', {
                ...p,
                enabled: next ? undefined : false,
            })
            setBusy(false)
            if (!outcome.ok) {
                setError(saveErrorMessage(`${verb} of ${proxyDomain}`, outcome))
                return
            }
            setWarnings(outcome.warnings)
            onChanged()
        },
        [proxies, busy, onChanged],
    )

    // Enable is instant; disable stops traffic, so it goes through a confirm.
    const toggle = useCallback(
        (proxyDomain: string) => {
            const p = proxies.find((x) => x.domain === proxyDomain)
            if (!p) return
            if (p.enabled === false) void applyEnabled(proxyDomain, true)
            else setPendingDisable(proxyDomain)
        },
        [proxies, applyEnabled],
    )

    const resourceStates = useResourceStates('proxy')
    const items = useMemo<RoutingListItem[]>(
        () =>
            proxies.map((p) => ({
                name: p.domain,
                nameExtraHtml: p.domain.startsWith('*.')
                    ? ` ${cellBadge('wildcard', 'info', 'Needs a DNS-01 wildcard cert (Certificates, challenge: dns).')}`
                    : undefined,
                cells: {
                    target: targetCellHtml(p),
                    listen: cellMono(`:${p.listen ?? 80}`),
                    tls: cellTls(p),
                    access: cellAccessList(p.access_list),
                    options: optionsCellHtml(p),
                    status: cellEnabled(p.enabled !== false),
                },
                toggleLabel: p.enabled === false ? 'Enable' : 'Disable',
                stateChip: resourceStates.get(p.domain)?.state,
                stateReason: resourceStates.get(p.domain)?.reason,
            })),
        [proxies, resourceStates],
    )

    // Upstream-pool options, with a leading clear choice. Rebuilt as the pool set
    // changes; SelectField remounts cleanly on a different option set.
    const upstreamOptions: SelectOption[] = [
        { value: '', label: '— pick upstream —' },
        ...upstreams.map((u) => ({ value: u.name, label: u.name })),
    ]

    // Access-list options (C1): open by default, or one of the named policies.
    const accessListOptions: SelectOption[] = [
        { value: '', label: 'open (no access list)' },
        ...accessLists.map((l) => ({ value: l.name, label: l.name })),
    ]

    // A target value control: an upstream dropdown, or a free-text pass URL.
    const targetControl = (kind: TargetKind | LocTargetKind, value: string, onChange: (v: string) => void) => {
        if (kind === 'upstream') {
            return <SelectField label="Target" value={value} options={upstreamOptions} onValue={onChange} />
        }
        if (kind === 'pass') {
            return (
                <TextField label="Target" placeholder="http://127.0.0.1:9000" value={value} onValue={onChange} />
            )
        }
        return null
    }

    const d = form?.draft
    const tlsOff = d ? d.tls === 'off' : true

    return (
        <>
            <tc-section-card title="Reverse proxies" icon="globe">
                <div className="perch-admin-section">
                    <p className="perch-home-lead perch-admin-hint">
                        {proxies.length} prox{proxies.length === 1 ? 'y' : 'ies'}. Each routes a domain to an upstream
                        pool or an inline target.
                    </p>
                    {error && !form && <tc-banner variant="danger">{error}</tc-banner>}
                    <SaveWarningsBanner warnings={warnings} onDismiss={() => setWarnings([])} />

                    <div className="perch-list-actions">
                        <tc-button variant="primary" size="sm" onClick={openCreate}>
                            New proxy
                        </tc-button>
                    </div>

                    {proxies.length === 0 ? (
                        <tc-empty-state icon="globe">No proxies yet.</tc-empty-state>
                    ) : (
                        <RoutingListTable
                            columns={PROXY_COLUMNS}
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
                    title={form.editing ? `Edit proxy — ${form.editing}` : 'New proxy'}
                    busy={busy}
                    submitLabel={form.editing ? 'Save changes' : 'Create proxy'}
                    onSubmit={() => void save()}
                    onClose={close}
                    secondary={
                        dnsRetry
                            ? { label: 'Save anyway (skip DNS check)', onClick: () => void retrySkippingDns() }
                            : undefined
                    }
                >
                    {error && <tc-banner variant="danger">{error}</tc-banner>}
                    {dnsRetry && (
                        <tc-banner variant="warning">
                            The target host doesn’t resolve yet. If its DNS record lands later, you can save anyway
                            and skip the daemon’s DNS check (the footer button).
                        </tc-banner>
                    )}
                    <FormGroup title="Identity">
                        <div className="perch-form-grid">
                            <div className="perch-form-span">
                                <TextField
                                    label="Domain"
                                    placeholder="api.example.com or *.example.com"
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
                        <div className="perch-form-grid">
                            <SelectField
                                label="Kind"
                                help="Route to a named upstream pool, or straight to a URL."
                                value={d.targetKind}
                                options={KIND_OPTIONS}
                                onValue={(v) => patch({ targetKind: v as TargetKind, targetValue: '' })}
                            />
                            {targetControl(d.targetKind, d.targetValue, (v) => patch({ targetValue: v }))}
                        </div>
                        {d.locations.map((l, i) => (
                            <div key={i} className="perch-form-item">
                                <div className="perch-form-row">
                                    <TextField
                                        size="sm"
                                        label="Path"
                                        placeholder="/api"
                                        value={l.path}
                                        onValue={(v) => patchLoc(i, { path: v })}
                                    />
                                    <SelectField
                                        size="sm"
                                        label="Kind"
                                        value={l.kind}
                                        options={LOC_KIND_OPTIONS}
                                        onValue={(v) => patchLoc(i, { kind: v as LocTargetKind, value: '' })}
                                    />
                                    {l.kind !== 'inherit' &&
                                        targetControl(l.kind, l.value, (v) => patchLoc(i, { value: v }))}
                                </div>
                                <div className="perch-form-switches">
                                    <SwitchField
                                        label="WebSocket"
                                        checked={l.websocket}
                                        onChecked={(c) => patchLoc(i, { websocket: c })}
                                    />
                                    <SwitchField
                                        label="Advanced (raw nginx)"
                                        checked={l.showAdvanced}
                                        onChecked={(c) => patchLoc(i, { showAdvanced: c })}
                                    />
                                </div>
                                {l.showAdvanced && (
                                    <TextAreaField
                                        label={`Raw nginx for ${l.path.trim() || '/'}`}
                                        rows={3}
                                        placeholder="proxy_set_header X-Location-Scoped 1;"
                                        help="A bad snippet disables only this proxy via nginx -t."
                                        value={l.advanced}
                                        onValue={(v) => patchLoc(i, { advanced: v })}
                                    />
                                )}
                                <div className="perch-list-actions">
                                    <tc-button variant="danger" size="sm" outline onClick={() => removeLoc(i)}>
                                        Remove location
                                    </tc-button>
                                </div>
                            </div>
                        ))}
                        <div className="perch-form-row">
                            <tc-button variant="secondary" size="sm" outline onClick={addLoc}>
                                Add location
                            </tc-button>
                        </div>
                    </FormGroup>

                    <FormGroup title="TLS & security">
                        <div className="perch-form-grid">
                            <SelectField
                                label="TLS"
                                help="auto degrades to HTTP while no cert exists; required quarantines without one."
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
                                help="IP allow/deny + basic auth policy (Routing → Access lists)."
                                value={d.accessList}
                                options={accessListOptions}
                                onValue={(v) => patch({ accessList: v })}
                            />
                        </div>
                        <div className="perch-form-switches">
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
                        </div>
                        {d.hsts && !tlsOff && (
                            <HstsOptionsRow draft={d.hstsOpts} onDraft={(next) => patch({ hstsOpts: next })} />
                        )}
                    </FormGroup>

                    <FormGroup title="Performance">
                        <div className="perch-form-grid">
                            <TextField
                                label="Max body size"
                                placeholder="512MiB"
                                value={d.maxBody}
                                onValue={(v) => patch({ maxBody: v })}
                            />
                            <TextField
                                label="Connect timeout"
                                placeholder="60s"
                                help="Blank = nginx default."
                                value={d.connectTimeout}
                                onValue={(v) => patch({ connectTimeout: v })}
                            />
                            <TextField
                                label="Read timeout"
                                placeholder="60s"
                                value={d.readTimeout}
                                onValue={(v) => patch({ readTimeout: v })}
                            />
                            <TextField
                                label="Send timeout"
                                placeholder="60s"
                                value={d.sendTimeout}
                                onValue={(v) => patch({ sendTimeout: v })}
                            />
                        </div>
                        <div className="perch-form-switches">
                            <SwitchField
                                label="WebSocket (all locations)"
                                checked={d.websocket}
                                onChecked={(c) => patch({ websocket: c })}
                            />
                            <SwitchField label="Gzip" checked={d.gzip} onChecked={(c) => patch({ gzip: c })} />
                            <SwitchField
                                label="Cache"
                                checked={d.cacheEnabled}
                                onChecked={(c) => patch({ cacheEnabled: c })}
                            />
                        </div>
                        {d.cacheEnabled && (
                            <div className="perch-form-grid">
                                <TextField
                                    label="Cache zone size"
                                    placeholder="10m"
                                    value={d.cacheZone}
                                    onValue={(v) => patch({ cacheZone: v })}
                                />
                                <TextField
                                    label="Cache valid (comma-separated)"
                                    placeholder="200 10m, 404 1m"
                                    value={d.cacheValid}
                                    onValue={(v) => patch({ cacheValid: v })}
                                />
                            </div>
                        )}
                    </FormGroup>

                    <FormGroup title="Advanced">
                        <TextAreaField
                            label="Raw nginx (server block)"
                            rows={3}
                            placeholder="add_header X-Frame-Options SAMEORIGIN;"
                            help="Rides the daemon's nginx -t gate — a bad snippet quarantines only this proxy."
                            value={d.advanced}
                            onValue={(v) => patch({ advanced: v })}
                        />
                    </FormGroup>
                </FormModal>
            )}

            <VhostPreviewModal domain={viewing} onClose={() => setViewing(null)} />

            <ConfirmDialog
                open={!!pendingDisable}
                title="Disable proxy?"
                message={
                    pendingDisable
                        ? `Disable the reverse proxy for ${pendingDisable}. Traffic to it stops being routed once nginx reloads; the configuration is kept and can be re-enabled anytime.`
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
                title="Remove proxy?"
                message={
                    pending
                        ? `Remove the reverse proxy for ${pending}. Traffic to it stops being routed once nginx reloads.`
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
