'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { hstsEnabled, type Proxy, type ProxyLocation, type TlsMode, type Upstream } from '@/server/domain/routing'
import { RoutingPage, RoutingListTable, json, useMaintainerData, type RoutingListItem } from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CheckField, SelectField, TextAreaField, TextField, type SelectOption } from '@/components/fields'

// Maintainer routing surface — reverse-proxy vhosts (nginx `server{}` blocks). List
// the configured proxies, add one (routing to a named upstream pool or an inline
// `pass` URL, with optional per-path locations), edit one (the same form, prefilled
// — the POST endpoint replaces by domain), and remove one. Drives the
// `/api/routing/proxies` endpoints (`authorize('maintainer')`-gated). Upstreams are
// fetched alongside to populate the target dropdowns; a proxy that names an unknown
// upstream is rejected by nginxpilot (400).

interface ProxiesData {
    proxies: Proxy[]
    upstreams: Upstream[]
}

export function Proxies() {
    const fetcher = useCallback(async (): Promise<ProxiesData | null> => {
        try {
            const [proxies, upstreams] = await Promise.all([
                fetch('/api/routing/proxies', { cache: 'no-store' }).then((r) => json<Proxy[]>(r)),
                fetch('/api/routing/upstreams', { cache: 'no-store' }).then((r) => json<Upstream[]>(r)),
            ])
            return { proxies, upstreams }
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useMaintainerData(fetcher)

    return (
        <RoutingPage
            title="Proxies"
            subtitle="Reverse-proxy vhosts routing to upstream pools or inline targets. Maintainer access."
            icon="globe"
            iconColor="cyan"
            state={state}
            onRetry={() => void reload()}
        >
            {(data) => (
                <ProxiesManager proxies={data.proxies} upstreams={data.upstreams} onChanged={() => void reload()} />
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
}

const emptyLocation = (): LocationDraft => ({ path: '/', kind: 'inherit', value: '', websocket: false })

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

function describeTarget(p: Proxy): string {
    if (p.upstream) return `→ ${p.upstream}`
    if (p.pass) return `→ ${p.pass}`
    if (p.locations?.length) return `${p.locations.length} location${p.locations.length === 1 ? '' : 's'}`
    return '—'
}

function ProxiesManager({
    proxies,
    upstreams,
    onChanged,
}: {
    proxies: Proxy[]
    upstreams: Upstream[]
    onChanged: () => void
}) {
    const [domain, setDomain] = useState('')
    const [enabled, setEnabled] = useState(true)
    const [listen, setListen] = useState('')
    const [targetKind, setTargetKind] = useState<TargetKind>('upstream')
    const [targetValue, setTargetValue] = useState('')
    const [maxBody, setMaxBody] = useState('')
    const [locations, setLocations] = useState<LocationDraft[]>([])
    // TLS & security toggles (Phase B).
    const [tls, setTls] = useState<TlsMode>('off')
    const [forceSsl, setForceSsl] = useState(false)
    const [http2, setHttp2] = useState(false)
    const [hsts, setHsts] = useState(false)
    const [blockExploits, setBlockExploits] = useState(false)
    const [websocket, setWebsocket] = useState(false)
    const [gzip, setGzip] = useState(false)
    const [cacheEnabled, setCacheEnabled] = useState(false)
    const [cacheZone, setCacheZone] = useState('')
    const [cacheValid, setCacheValid] = useState('')
    const [advanced, setAdvanced] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    // The proxy awaiting remove confirmation (drives the ConfirmDialog).
    const [pending, setPending] = useState<string | null>(null)
    // The proxy awaiting disable confirmation (disabling stops its traffic).
    const [pendingDisable, setPendingDisable] = useState<string | null>(null)
    // The domain being edited (null = the form creates a new proxy). Editing keeps
    // the domain locked — it's the replace key of `POST /api/routing/proxies`.
    const [editing, setEditing] = useState<string | null>(null)
    const formCard = useRef<HTMLElement>(null)

    const setLoc = (i: number, patch: Partial<LocationDraft>) =>
        setLocations((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
    const addLoc = () => setLocations((prev) => [...prev, emptyLocation()])
    const removeLoc = (i: number) => setLocations((prev) => prev.filter((_, idx) => idx !== i))

    const reset = () => {
        setEditing(null)
        setDomain('')
        setEnabled(true)
        setListen('')
        setTargetKind('upstream')
        setTargetValue('')
        setMaxBody('')
        setLocations([])
        setTls('off')
        setForceSsl(false)
        setHttp2(false)
        setHsts(false)
        setBlockExploits(false)
        setWebsocket(false)
        setGzip(false)
        setCacheEnabled(false)
        setCacheZone('')
        setCacheValid('')
        setAdvanced('')
    }

    // Load an existing proxy into the form (edit mode). Saving POSTs the same
    // endpoint, which replaces the fragment for that domain.
    const startEdit = useCallback(
        (proxyDomain: string) => {
            const p = proxies.find((x) => x.domain === proxyDomain)
            if (!p) return
            setEditing(p.domain)
            setDomain(p.domain)
            setEnabled(p.enabled !== false)
            setListen(p.listen ? String(p.listen) : '')
            if (p.pass) {
                setTargetKind('pass')
                setTargetValue(p.pass)
            } else {
                setTargetKind('upstream')
                setTargetValue(p.upstream ?? '')
            }
            setMaxBody(p.client_max_body_size ?? '')
            setLocations(
                (p.locations ?? []).map((l) => ({
                    path: l.path,
                    kind: l.upstream ? 'upstream' : l.pass ? 'pass' : 'inherit',
                    value: l.upstream ?? l.pass ?? '',
                    websocket: !!l.websocket,
                })),
            )
            setTls(p.tls ?? 'off')
            setForceSsl(!!p.force_ssl)
            setHttp2(!!p.http2)
            setHsts(hstsEnabled(p.hsts))
            setBlockExploits(!!p.block_exploits)
            setWebsocket(!!p.websocket)
            setGzip(!!p.gzip)
            setCacheEnabled(!!p.cache?.enabled)
            setCacheZone(p.cache?.zone_size ?? '')
            setCacheValid(p.cache?.valid?.join(', ') ?? '')
            setAdvanced(p.advanced ?? '')
            setError(null)
            formCard.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        },
        [proxies],
    )

    const create = useCallback(async () => {
        if (busy) return
        const d = domain.trim()
        if (!d) {
            setError('A proxy needs a domain.')
            return
        }
        const payload: Proxy = { domain: d }
        if (!enabled) payload.enabled = false
        if (listen.trim()) payload.listen = Number(listen)
        if (targetValue.trim()) {
            if (targetKind === 'upstream') payload.upstream = targetValue.trim()
            else payload.pass = targetValue.trim()
        }
        if (maxBody.trim()) payload.client_max_body_size = maxBody.trim()

        // TLS & security. Guard the daemon's rule client-side so the user sees it
        // before the round-trip (parseProxy enforces the same).
        const tlsOn = tls !== 'off'
        if ((forceSsl || http2 || hsts) && !tlsOn) {
            setError('Enable TLS first to use Force HTTPS, HTTP/2 or HSTS.')
            return
        }
        if (tlsOn) payload.tls = tls
        if (forceSsl) payload.force_ssl = true
        if (http2) payload.http2 = true
        if (hsts) payload.hsts = true
        if (blockExploits) payload.block_exploits = true
        if (websocket) payload.websocket = true
        if (gzip) payload.gzip = true
        if (cacheEnabled) {
            const valid = cacheValid.split(',').map((s) => s.trim()).filter(Boolean)
            payload.cache = { enabled: true }
            if (valid.length) payload.cache.valid = valid
            if (cacheZone.trim()) payload.cache.zone_size = cacheZone.trim()
        }
        if (advanced.trim()) payload.advanced = advanced

        const builtLocs: ProxyLocation[] = []
        for (const l of locations) {
            const path = l.path.trim() || '/'
            const loc: ProxyLocation = { path }
            if (l.kind !== 'inherit') {
                if (!l.value.trim()) {
                    setError(`Location ${path} needs a target value.`)
                    return
                }
                if (l.kind === 'upstream') loc.upstream = l.value.trim()
                else loc.pass = l.value.trim()
            }
            if (l.websocket) loc.websocket = true
            builtLocs.push(loc)
        }
        if (builtLocs.length) payload.locations = builtLocs

        if (!payload.upstream && !payload.pass && builtLocs.length === 0) {
            setError('Set a default target (upstream or pass) or add at least one location.')
            return
        }

        setBusy(true)
        setError(null)
        try {
            const res = await fetch('/api/routing/proxies', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null
                setError(body?.error ? `Couldn’t save proxy: ${body.error}.` : `Couldn’t save proxy (error ${res.status}).`)
                return
            }
            reset()
            onChanged()
        } catch {
            setError('Couldn’t save proxy — network error.')
        } finally {
            setBusy(false)
        }
    }, [
        busy,
        domain,
        enabled,
        listen,
        targetKind,
        targetValue,
        maxBody,
        locations,
        tls,
        forceSsl,
        http2,
        hsts,
        blockExploits,
        websocket,
        gzip,
        cacheEnabled,
        cacheZone,
        cacheValid,
        advanced,
        onChanged,
    ])

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
            try {
                const res = await fetch('/api/routing/proxies', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ ...p, enabled: next ? undefined : false }),
                })
                if (!res.ok) {
                    const body = (await res.json().catch(() => null)) as { error?: string } | null
                    setError(
                        body?.error
                            ? `Couldn’t ${verb} ${proxyDomain}: ${body.error}.`
                            : `Couldn’t ${verb} ${proxyDomain} (error ${res.status}).`,
                    )
                    return
                }
                onChanged()
            } catch {
                setError(`Couldn’t ${verb} ${proxyDomain} — network error.`)
            } finally {
                setBusy(false)
            }
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

    const items = useMemo<RoutingListItem[]>(
        () =>
            proxies.map((p) => ({
                name: p.domain,
                hint: `:${p.listen ?? 80} ${describeTarget(p)}${p.tls ? ` · TLS ${p.tls}` : ''}${
                    p.enabled === false ? ' · disabled' : ''
                }`,
                toggleLabel: p.enabled === false ? 'Enable' : 'Disable',
            })),
        [proxies],
    )

    // Upstream-pool options, with a leading clear choice. Rebuilt as the pool set
    // changes; SelectField remounts cleanly on a different option set.
    const upstreamOptions: SelectOption[] = [
        { value: '', label: '— pick upstream —' },
        ...upstreams.map((u) => ({ value: u.name, label: u.name })),
    ]

    // A target value control: an upstream dropdown, or a free-text pass URL.
    const targetControl = (kind: TargetKind | LocTargetKind, value: string, onChange: (v: string) => void) => {
        if (kind === 'upstream') {
            return (
                <SelectField
                    className="perch-admin-field"
                    size="sm"
                    label="Target"
                    value={value}
                    options={upstreamOptions}
                    onValue={onChange}
                />
            )
        }
        if (kind === 'pass') {
            return (
                <TextField
                    className="perch-admin-field"
                    size="sm"
                    label="Target"
                    placeholder="http://127.0.0.1:9000"
                    value={value}
                    onValue={onChange}
                />
            )
        }
        return null
    }

    return (
        <>
            <tc-section-card title="Reverse proxies" icon="globe">
                <div className="perch-admin-section">
                    <p className="perch-home-lead perch-admin-hint">
                        {proxies.length} prox{proxies.length === 1 ? 'y' : 'ies'}. Each routes a domain to an upstream
                        pool or an inline target.
                    </p>
                    {error && <tc-banner variant="danger">{error}</tc-banner>}

                    {proxies.length === 0 ? (
                        <tc-empty-state icon="globe">No proxies yet.</tc-empty-state>
                    ) : (
                        <RoutingListTable
                            items={items}
                            busy={busy}
                            onEdit={startEdit}
                            onToggle={toggle}
                            onRemove={setPending}
                        />
                    )}
                </div>
            </tc-section-card>

            <tc-section-card
                ref={formCard}
                title={editing ? `Edit proxy — ${editing}` : 'New proxy'}
                icon={editing ? 'pencil' : 'plus'}
            >
                <form
                    className="perch-admin-section"
                    onSubmit={(e) => {
                        e.preventDefault()
                        void create()
                    }}
                >
                    <div className="perch-admin-tier-row">
                        <TextField
                            className="perch-admin-field"
                            size="sm"
                            label="Domain"
                            placeholder="api.example.com"
                            value={domain}
                            disabled={!!editing}
                            onValue={setDomain}
                        />
                        <TextField
                            className="perch-admin-field"
                            type="number"
                            min={1}
                            max={65535}
                            size="sm"
                            label="Listen"
                            placeholder="80"
                            value={listen}
                            onValue={setListen}
                        />
                        <TextField
                            className="perch-admin-field"
                            size="sm"
                            label="Max body size"
                            placeholder="512MiB"
                            value={maxBody}
                            onValue={setMaxBody}
                        />
                        <CheckField
                            className="perch-routing-check"
                            inline
                            label="Enabled"
                            checked={enabled}
                            onChecked={setEnabled}
                        />
                    </div>

                    <span className="perch-admin-field-label">Default target (used by locations that don’t set one)</span>
                    <div className="perch-admin-tier-row">
                        <SelectField
                            className="perch-admin-field"
                            size="sm"
                            label="Kind"
                            value={targetKind}
                            options={KIND_OPTIONS}
                            onValue={(v) => {
                                setTargetKind(v as TargetKind)
                                setTargetValue('')
                            }}
                        />
                        {targetControl(targetKind, targetValue, setTargetValue)}
                    </div>

                    <span className="perch-admin-field-label">TLS &amp; security</span>
                    <div className="perch-admin-tier-row">
                        <SelectField
                            className="perch-admin-field"
                            size="sm"
                            label="TLS"
                            value={tls}
                            options={TLS_OPTIONS}
                            onValue={(v) => {
                                const mode = v as TlsMode
                                setTls(mode)
                                if (mode === 'off') {
                                    setForceSsl(false)
                                    setHttp2(false)
                                    setHsts(false)
                                }
                            }}
                        />
                        <CheckField
                            className="perch-routing-check"
                            inline
                            label="Force HTTPS"
                            disabled={tls === 'off'}
                            checked={forceSsl}
                            onChecked={setForceSsl}
                        />
                        <CheckField
                            className="perch-routing-check"
                            inline
                            label="HTTP/2"
                            disabled={tls === 'off'}
                            checked={http2}
                            onChecked={setHttp2}
                        />
                        <CheckField
                            className="perch-routing-check"
                            inline
                            label="HSTS"
                            disabled={tls === 'off'}
                            checked={hsts}
                            onChecked={setHsts}
                        />
                        <CheckField
                            className="perch-routing-check"
                            inline
                            label="Block exploits"
                            checked={blockExploits}
                            onChecked={setBlockExploits}
                        />
                        <CheckField
                            className="perch-routing-check"
                            inline
                            label="WebSocket (all)"
                            checked={websocket}
                            onChecked={setWebsocket}
                        />
                        <CheckField
                            className="perch-routing-check"
                            inline
                            label="Gzip"
                            checked={gzip}
                            onChecked={setGzip}
                        />
                        <CheckField
                            className="perch-routing-check"
                            inline
                            label="Cache"
                            checked={cacheEnabled}
                            onChecked={setCacheEnabled}
                        />
                    </div>
                    {cacheEnabled && (
                        <div className="perch-admin-tier-row">
                            <TextField
                                className="perch-admin-field"
                                size="sm"
                                label="Cache zone size"
                                placeholder="10m"
                                value={cacheZone}
                                onValue={setCacheZone}
                            />
                            <TextField
                                className="perch-admin-field"
                                size="sm"
                                label="Cache valid (comma-separated)"
                                placeholder="200 10m, 404 1m"
                                value={cacheValid}
                                onValue={setCacheValid}
                            />
                        </div>
                    )}
                    <TextAreaField
                        className="perch-admin-field"
                        label="Advanced (raw nginx)"
                        rows={3}
                        placeholder="add_header X-Frame-Options SAMEORIGIN;"
                        value={advanced}
                        onValue={setAdvanced}
                    />

                    <span className="perch-admin-field-label">Locations (optional)</span>
                    {locations.map((l, i) => (
                        <div className="perch-admin-tier-row" key={i}>
                            <TextField
                                className="perch-admin-field"
                                size="sm"
                                label="Path"
                                placeholder="/api"
                                value={l.path}
                                onValue={(v) => setLoc(i, { path: v })}
                            />
                            <SelectField
                                className="perch-admin-field"
                                size="sm"
                                label="Kind"
                                value={l.kind}
                                options={LOC_KIND_OPTIONS}
                                onValue={(v) => setLoc(i, { kind: v as LocTargetKind, value: '' })}
                            />
                            {l.kind !== 'inherit' && targetControl(l.kind, l.value, (v) => setLoc(i, { value: v }))}
                            <CheckField
                                className="perch-routing-check"
                                inline
                                label="websocket"
                                checked={l.websocket}
                                onChecked={(c) => setLoc(i, { websocket: c })}
                            />
                            <tc-button variant="danger" size="sm" outline onClick={() => removeLoc(i)}>
                                Remove
                            </tc-button>
                        </div>
                    ))}

                    <div className="perch-admin-tier-actions">
                        <tc-button variant="secondary" outline onClick={addLoc}>
                            Add location
                        </tc-button>
                        {editing && (
                            <tc-button variant="secondary" outline onClick={reset}>
                                Cancel
                            </tc-button>
                        )}
                        <tc-button type="submit" variant="primary" loading={busy || undefined}>
                            {editing ? 'Save changes' : 'Create proxy'}
                        </tc-button>
                    </div>
                </form>
            </tc-section-card>

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
                    const d = pendingDisable
                    setPendingDisable(null)
                    if (d) void applyEnabled(d, false)
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
