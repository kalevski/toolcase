'use client'

import { useCallback, useState } from 'react'
import type { Proxy, ProxyLocation, Upstream } from '@/server/domain/routing'
import { RoutingPage, json, useMaintainerData } from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CheckField, SelectField, TextField, type SelectOption } from '@/components/fields'

// Maintainer routing surface — reverse-proxy vhosts (nginx `server{}` blocks). List
// the configured proxies, add one (routing to a named upstream pool or an inline
// `pass` URL, with optional per-path locations), and remove one. Drives the
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
    const [listen, setListen] = useState('')
    const [targetKind, setTargetKind] = useState<TargetKind>('upstream')
    const [targetValue, setTargetValue] = useState('')
    const [maxBody, setMaxBody] = useState('')
    const [locations, setLocations] = useState<LocationDraft[]>([])
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    // The proxy awaiting remove confirmation (drives the ConfirmDialog).
    const [pending, setPending] = useState<string | null>(null)

    const setLoc = (i: number, patch: Partial<LocationDraft>) =>
        setLocations((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
    const addLoc = () => setLocations((prev) => [...prev, emptyLocation()])
    const removeLoc = (i: number) => setLocations((prev) => prev.filter((_, idx) => idx !== i))

    const reset = () => {
        setDomain('')
        setListen('')
        setTargetKind('upstream')
        setTargetValue('')
        setMaxBody('')
        setLocations([])
    }

    const create = useCallback(async () => {
        if (busy) return
        const d = domain.trim()
        if (!d) {
            setError('A proxy needs a domain.')
            return
        }
        const payload: Proxy = { domain: d }
        if (listen.trim()) payload.listen = Number(listen)
        if (targetValue.trim()) {
            if (targetKind === 'upstream') payload.upstream = targetValue.trim()
            else payload.pass = targetValue.trim()
        }
        if (maxBody.trim()) payload.client_max_body_size = maxBody.trim()

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
    }, [busy, domain, listen, targetKind, targetValue, maxBody, locations, onChanged])

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
                        <ul className="perch-admin-list">
                            {proxies.map((p) => (
                                <li key={p.domain} className="perch-admin-list-row">
                                    <span>
                                        <span className="perch-admin-mono">{p.domain}</span>{' '}
                                        <span className="perch-admin-hint">
                                            :{p.listen ?? 80} {describeTarget(p)}
                                        </span>
                                    </span>
                                    <tc-button
                                        variant="danger"
                                        size="sm"
                                        outline
                                        disabled={busy || undefined}
                                        onClick={() => setPending(p.domain)}
                                    >
                                        Remove
                                    </tc-button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </tc-section-card>

            <tc-section-card title="New proxy" icon="plus">
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
                        <tc-button type="submit" variant="primary" loading={busy || undefined}>
                            Create proxy
                        </tc-button>
                    </div>
                </form>
            </tc-section-card>

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
