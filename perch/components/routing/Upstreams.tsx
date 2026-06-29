'use client'

import { useCallback, useMemo, useState } from 'react'
import type { BalancerMethod, Upstream, UpstreamServer } from '@/server/domain/routing'
import { RoutingPage, RoutingListTable, json, useMaintainerData, type RoutingListItem } from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CheckField, SelectField, TextField, type SelectOption } from '@/components/fields'

// Maintainer routing surface — nginx `upstream{}` pools. List the configured
// upstreams (each a named pool of backend servers), add a new one, and remove one
// (nginxpilot returns 409 if a proxy still references it — surfaced inline). Drives
// the `/api/routing/upstreams` endpoints, themselves `authorize('maintainer')`-gated.

const BALANCERS: (BalancerMethod | '')[] = ['', 'least_conn', 'ip_hash']
const balancerLabel = (b?: BalancerMethod | '') => (b ? b : 'round_robin')
const BALANCER_OPTIONS: SelectOption[] = BALANCERS.map((b) => ({ value: b, label: balancerLabel(b) }))

export function Upstreams() {
    const fetcher = useCallback(async (): Promise<Upstream[] | null> => {
        try {
            return await fetch('/api/routing/upstreams', { cache: 'no-store' }).then((r) => json<Upstream[]>(r))
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useMaintainerData(fetcher)

    return (
        <RoutingPage
            title="Upstreams"
            subtitle="Named pools of backend servers a proxy can route to. Maintainer access."
            icon="server"
            iconColor="blue"
            state={state}
            onRetry={() => void reload()}
        >
            {(upstreams) => <UpstreamsManager upstreams={upstreams} onChanged={() => void reload()} />}
        </RoutingPage>
    )
}

interface ServerDraft {
    address: string
    weight: string
    maxFails: string
    failTimeout: string
    backup: boolean
    down: boolean
}

const emptyServer = (): ServerDraft => ({ address: '', weight: '', maxFails: '', failTimeout: '', backup: false, down: false })

function UpstreamsManager({ upstreams, onChanged }: { upstreams: Upstream[]; onChanged: () => void }) {
    const [name, setName] = useState('')
    const [balancer, setBalancer] = useState<BalancerMethod | ''>('')
    const [keepalive, setKeepalive] = useState('')
    const [servers, setServers] = useState<ServerDraft[]>(() => [emptyServer()])
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    // The upstream awaiting remove confirmation (drives the ConfirmDialog).
    const [pending, setPending] = useState<string | null>(null)

    const setServer = (i: number, patch: Partial<ServerDraft>) =>
        setServers((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
    const addServer = () => setServers((prev) => [...prev, emptyServer()])
    const removeServer = (i: number) => setServers((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))

    const reset = () => {
        setName('')
        setBalancer('')
        setKeepalive('')
        setServers([emptyServer()])
    }

    const create = useCallback(async () => {
        if (busy) return
        const trimmed = name.trim()
        if (!trimmed) {
            setError('An upstream needs a name.')
            return
        }
        const built: UpstreamServer[] = []
        for (const s of servers) {
            const address = s.address.trim()
            if (!address) {
                setError('Every server needs an address (host:port or unix:/path).')
                return
            }
            const server: UpstreamServer = { address }
            if (s.weight.trim()) server.weight = Number(s.weight)
            if (s.maxFails.trim()) server.max_fails = Number(s.maxFails)
            if (s.failTimeout.trim()) server.fail_timeout = s.failTimeout.trim()
            if (s.backup) server.backup = true
            if (s.down) server.down = true
            built.push(server)
        }
        const payload: Upstream = { name: trimmed, servers: built }
        if (balancer) payload.balancer = balancer
        if (keepalive.trim()) payload.keepalive = Number(keepalive)

        setBusy(true)
        setError(null)
        try {
            const res = await fetch('/api/routing/upstreams', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null
                setError(body?.error ? `Couldn’t save upstream: ${body.error}.` : `Couldn’t save upstream (error ${res.status}).`)
                return
            }
            reset()
            onChanged()
        } catch {
            setError('Couldn’t save upstream — network error.')
        } finally {
            setBusy(false)
        }
    }, [busy, name, balancer, keepalive, servers, onChanged])

    const doRemove = useCallback(async () => {
        const upstreamName = pending
        if (!upstreamName || busy) return
        setPending(null)
        setBusy(true)
        setError(null)
        try {
            const res = await fetch(`/api/routing/upstreams?name=${encodeURIComponent(upstreamName)}`, {
                method: 'DELETE',
            })
            if (!res.ok && res.status !== 204) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null
                setError(
                    body?.error === 'in_use'
                        ? `${upstreamName} is still referenced by a proxy — repoint or delete that proxy first.`
                        : `Couldn’t remove ${upstreamName} (error ${res.status}).`,
                )
                return
            }
            onChanged()
        } catch {
            setError(`Couldn’t remove ${upstreamName} — network error.`)
        } finally {
            setBusy(false)
        }
    }, [pending, busy, onChanged])

    const items = useMemo<RoutingListItem[]>(
        () =>
            upstreams.map((u) => ({
                name: u.name,
                hint: `${balancerLabel(u.balancer)} · ${u.servers.length} server${u.servers.length === 1 ? '' : 's'} (${u.servers.map((s) => s.address).join(', ')})`,
            })),
        [upstreams],
    )

    return (
        <>
            <tc-section-card title="Upstream pools" icon="server">
                <div className="perch-admin-section">
                    <p className="perch-home-lead perch-admin-hint">
                        {upstreams.length} pool{upstreams.length === 1 ? '' : 's'}. A proxy routes to a pool by name.
                    </p>
                    {error && <tc-banner variant="danger">{error}</tc-banner>}

                    {upstreams.length === 0 ? (
                        <tc-empty-state icon="server">No upstreams yet.</tc-empty-state>
                    ) : (
                        <RoutingListTable items={items} busy={busy} onRemove={setPending} />
                    )}
                </div>
            </tc-section-card>

            <tc-section-card title="New upstream" icon="plus">
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
                            label="Name"
                            placeholder="api_pool"
                            value={name}
                            onValue={setName}
                        />
                        <SelectField
                            className="perch-admin-field"
                            size="sm"
                            label="Balancer"
                            value={balancer}
                            options={BALANCER_OPTIONS}
                            onValue={(v) => setBalancer(v as BalancerMethod | '')}
                        />
                        <TextField
                            className="perch-admin-field"
                            type="number"
                            min={0}
                            size="sm"
                            label="Keepalive"
                            placeholder="0"
                            value={keepalive}
                            onValue={setKeepalive}
                        />
                    </div>

                    <span className="perch-admin-field-label">Servers</span>
                    {servers.map((s, i) => (
                        <div className="perch-admin-tier-row" key={i}>
                            <TextField
                                className="perch-admin-field"
                                size="sm"
                                label="Address"
                                placeholder="10.0.0.1:8080"
                                value={s.address}
                                onValue={(v) => setServer(i, { address: v })}
                            />
                            <TextField
                                className="perch-admin-field"
                                type="number"
                                min={0}
                                size="sm"
                                label="Weight"
                                value={s.weight}
                                onValue={(v) => setServer(i, { weight: v })}
                            />
                            <TextField
                                className="perch-admin-field"
                                type="number"
                                min={0}
                                size="sm"
                                label="Max fails"
                                value={s.maxFails}
                                onValue={(v) => setServer(i, { maxFails: v })}
                            />
                            <TextField
                                className="perch-admin-field"
                                size="sm"
                                label="Fail timeout"
                                placeholder="30s"
                                value={s.failTimeout}
                                onValue={(v) => setServer(i, { failTimeout: v })}
                            />
                            <CheckField
                                className="perch-routing-check"
                                inline
                                label="backup"
                                checked={s.backup}
                                onChecked={(c) => setServer(i, { backup: c })}
                            />
                            <CheckField
                                className="perch-routing-check"
                                inline
                                label="down"
                                checked={s.down}
                                onChecked={(c) => setServer(i, { down: c })}
                            />
                            <tc-button
                                variant="danger"
                                size="sm"
                                outline
                                disabled={servers.length <= 1 || undefined}
                                onClick={() => removeServer(i)}
                            >
                                Remove
                            </tc-button>
                        </div>
                    ))}

                    <div className="perch-admin-tier-actions">
                        <tc-button variant="secondary" outline onClick={addServer}>
                            Add server
                        </tc-button>
                        <tc-button type="submit" variant="primary" loading={busy || undefined}>
                            Create upstream
                        </tc-button>
                    </div>
                </form>
            </tc-section-card>

            <ConfirmDialog
                open={!!pending}
                title="Remove upstream?"
                message={
                    pending
                        ? `Remove the upstream pool ${pending}. A proxy that still references it will be rejected until repointed.`
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
