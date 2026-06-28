'use client'

import { useCallback, useState } from 'react'
import type { Stream, StreamTlsMode, StreamUpstream } from '@/server/domain/streams'
import { RoutingPage, json, useMaintainerData } from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { CheckField, SelectField, TextField, type SelectOption } from '@/components/fields'

// Maintainer routing surface — L4 TCP/UDP stream listeners (nginx `stream { server{} }`).
// List the configured streams, add one (routing to a named stream-upstream pool or an
// inline `host:port`, with optional TLS termination), and remove one. Drives the
// `/api/routing/streams` endpoints (`authorize('maintainer')`-gated). Stream upstreams
// are fetched alongside to populate the target dropdown; a stream naming an unknown
// pool is rejected by nginxpilot (400).

interface StreamsData {
    streams: Stream[]
    upstreams: StreamUpstream[]
}

type TargetKind = 'upstream' | 'pass'

const PROTOCOL_OPTIONS: SelectOption[] = [
    { value: 'tcp', label: 'tcp' },
    { value: 'udp', label: 'udp' },
]

const KIND_OPTIONS: SelectOption[] = [
    { value: 'upstream', label: 'upstream' },
    { value: 'pass', label: 'pass (host:port)' },
]

const TLS_OPTIONS: SelectOption[] = [
    { value: 'off', label: 'off' },
    { value: 'auto', label: 'auto' },
    { value: 'required', label: 'required' },
]

export function Streams() {
    const fetcher = useCallback(async (): Promise<StreamsData | null> => {
        try {
            const [streams, upstreams] = await Promise.all([
                fetch('/api/routing/streams', { cache: 'no-store' }).then((r) => json<Stream[]>(r)),
                fetch('/api/routing/stream-upstreams', { cache: 'no-store' }).then((r) => json<StreamUpstream[]>(r)),
            ])
            return { streams, upstreams }
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useMaintainerData(fetcher)

    return (
        <RoutingPage
            title="Streams"
            subtitle="TCP/UDP listeners forwarding to stream-upstream pools or inline targets. Maintainer access."
            icon="cable"
            iconColor="cyan"
            state={state}
            onRetry={() => void reload()}
        >
            {(data) => (
                <StreamsManager streams={data.streams} upstreams={data.upstreams} onChanged={() => void reload()} />
            )}
        </RoutingPage>
    )
}

function describeTarget(s: Stream): string {
    if (s.upstream) return `→ ${s.upstream}`
    if (s.pass) return `→ ${s.pass}`
    return '—'
}

function StreamsManager({
    streams,
    upstreams,
    onChanged,
}: {
    streams: Stream[]
    upstreams: StreamUpstream[]
    onChanged: () => void
}) {
    const [name, setName] = useState('')
    const [listen, setListen] = useState('')
    const [protocol, setProtocol] = useState<'tcp' | 'udp'>('tcp')
    const [targetKind, setTargetKind] = useState<TargetKind>('upstream')
    const [targetValue, setTargetValue] = useState('')
    const [proxyProtocol, setProxyProtocol] = useState(false)
    const [connectTimeout, setConnectTimeout] = useState('')
    const [timeout, setTimeoutValue] = useState('')
    const [tls, setTls] = useState<StreamTlsMode>('off')
    const [tlsDomain, setTlsDomain] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [pending, setPending] = useState<string | null>(null)

    const reset = () => {
        setName('')
        setListen('')
        setProtocol('tcp')
        setTargetKind('upstream')
        setTargetValue('')
        setProxyProtocol(false)
        setConnectTimeout('')
        setTimeoutValue('')
        setTls('off')
        setTlsDomain('')
    }

    const create = useCallback(async () => {
        if (busy) return
        const n = name.trim()
        if (!n) {
            setError('A stream needs a name.')
            return
        }
        if (!listen.trim()) {
            setError('A stream needs a listen port.')
            return
        }
        if (!targetValue.trim()) {
            setError('Set a target — a stream upstream pool or an inline host:port.')
            return
        }
        if (tls !== 'off' && !tlsDomain.trim()) {
            setError('TLS needs a domain (no SNI at L4) — set tls_domain.')
            return
        }
        const payload: Stream = { name: n, listen: Number(listen) }
        if (protocol !== 'tcp') payload.protocol = protocol
        if (targetKind === 'upstream') payload.upstream = targetValue.trim()
        else payload.pass = targetValue.trim()
        if (proxyProtocol) payload.proxy_protocol = true
        if (connectTimeout.trim()) payload.connect_timeout = connectTimeout.trim()
        if (timeout.trim()) payload.timeout = timeout.trim()
        if (tls !== 'off') {
            payload.tls = tls
            payload.tls_domain = tlsDomain.trim()
        }

        setBusy(true)
        setError(null)
        try {
            const res = await fetch('/api/routing/streams', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null
                setError(
                    body?.error ? `Couldn’t save stream: ${body.error}.` : `Couldn’t save stream (error ${res.status}).`,
                )
                return
            }
            reset()
            onChanged()
        } catch {
            setError('Couldn’t save stream — network error.')
        } finally {
            setBusy(false)
        }
    }, [busy, name, listen, protocol, targetKind, targetValue, proxyProtocol, connectTimeout, timeout, tls, tlsDomain, onChanged])

    const doRemove = useCallback(async () => {
        const streamName = pending
        if (!streamName || busy) return
        setPending(null)
        setBusy(true)
        setError(null)
        try {
            const res = await fetch(`/api/routing/streams?name=${encodeURIComponent(streamName)}`, { method: 'DELETE' })
            if (!res.ok && res.status !== 204) {
                setError(`Couldn’t remove ${streamName} (error ${res.status}).`)
                return
            }
            onChanged()
        } catch {
            setError(`Couldn’t remove ${streamName} — network error.`)
        } finally {
            setBusy(false)
        }
    }, [pending, busy, onChanged])

    // Stream-upstream pool options, with a leading clear choice.
    const upstreamOptions: SelectOption[] = [
        { value: '', label: '— pick stream upstream —' },
        ...upstreams.map((u) => ({ value: u.name, label: u.name })),
    ]

    const targetControl =
        targetKind === 'upstream' ? (
            <SelectField
                className="perch-admin-field"
                size="sm"
                label="Target"
                value={targetValue}
                options={upstreamOptions}
                onValue={setTargetValue}
            />
        ) : (
            <TextField
                className="perch-admin-field"
                size="sm"
                label="Target"
                placeholder="10.0.0.9:5432"
                value={targetValue}
                onValue={setTargetValue}
            />
        )

    return (
        <>
            <tc-section-card title="Streams" icon="cable">
                <div className="perch-admin-section">
                    <p className="perch-home-lead perch-admin-hint">
                        {streams.length} stream{streams.length === 1 ? '' : 's'}. Each forwards a TCP/UDP port to a pool
                        or an inline target.
                    </p>
                    {error && <tc-banner variant="danger">{error}</tc-banner>}

                    {streams.length === 0 ? (
                        <tc-empty-state icon="cable">No streams yet.</tc-empty-state>
                    ) : (
                        <ul className="perch-admin-list">
                            {streams.map((s) => (
                                <li key={s.name} className="perch-admin-list-row">
                                    <span>
                                        <span className="perch-admin-mono">{s.name}</span>{' '}
                                        <span className="perch-admin-hint">
                                            {s.protocol ?? 'tcp'} :{s.listen} {describeTarget(s)}
                                            {s.tls ? ` · TLS ${s.tls}` : ''}
                                        </span>
                                    </span>
                                    <tc-button
                                        variant="danger"
                                        size="sm"
                                        outline
                                        disabled={busy || undefined}
                                        onClick={() => setPending(s.name)}
                                    >
                                        Remove
                                    </tc-button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </tc-section-card>

            <tc-section-card title="New stream" icon="plus">
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
                            placeholder="postgres"
                            value={name}
                            onValue={setName}
                        />
                        <TextField
                            className="perch-admin-field"
                            type="number"
                            min={1}
                            max={65535}
                            size="sm"
                            label="Listen"
                            placeholder="5432"
                            value={listen}
                            onValue={setListen}
                        />
                        <SelectField
                            className="perch-admin-field"
                            size="sm"
                            label="Protocol"
                            value={protocol}
                            options={PROTOCOL_OPTIONS}
                            onValue={(v) => setProtocol(v as 'tcp' | 'udp')}
                        />
                    </div>

                    <span className="perch-admin-field-label">Target</span>
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
                        {targetControl}
                    </div>

                    <span className="perch-admin-field-label">Options</span>
                    <div className="perch-admin-tier-row">
                        <TextField
                            className="perch-admin-field"
                            size="sm"
                            label="Connect timeout"
                            placeholder="5s"
                            value={connectTimeout}
                            onValue={setConnectTimeout}
                        />
                        <TextField
                            className="perch-admin-field"
                            size="sm"
                            label="Timeout"
                            placeholder="10m"
                            value={timeout}
                            onValue={setTimeoutValue}
                        />
                        <CheckField
                            className="perch-routing-check"
                            inline
                            label="proxy_protocol"
                            checked={proxyProtocol}
                            onChecked={setProxyProtocol}
                        />
                    </div>

                    <span className="perch-admin-field-label">TLS termination</span>
                    <div className="perch-admin-tier-row">
                        <SelectField
                            className="perch-admin-field"
                            size="sm"
                            label="TLS"
                            value={tls}
                            options={TLS_OPTIONS}
                            onValue={(v) => {
                                const mode = v as StreamTlsMode
                                setTls(mode)
                                if (mode === 'off') setTlsDomain('')
                            }}
                        />
                        {tls !== 'off' && (
                            <TextField
                                className="perch-admin-field"
                                size="sm"
                                label="TLS domain"
                                placeholder="db.example.com"
                                value={tlsDomain}
                                onValue={setTlsDomain}
                            />
                        )}
                    </div>

                    <div className="perch-admin-tier-actions">
                        <tc-button type="submit" variant="primary" loading={busy || undefined}>
                            Create stream
                        </tc-button>
                    </div>
                </form>
            </tc-section-card>

            <ConfirmDialog
                open={!!pending}
                title="Remove stream?"
                message={
                    pending
                        ? `Remove the stream ${pending}. Traffic to its listener stops being forwarded once nginx reloads.`
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
