'use client'

import { useCallback, useMemo, useState } from 'react'
import type { TabBarItem } from '@toolcase/web-components'
import { useTc } from '@/lib/tc'
import type { Stream, StreamTlsMode, StreamUpstream } from '@/server/domain/streams'
import {
    RoutingPage,
    RoutingListTable,
    SaveWarningsBanner,
    json,
    saveErrorMessage,
    saveRouting,
    useMaintainerData,
    useResourceStates,
    type RoutingListItem,
} from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormModal, FormGroup } from '@/components/FormModal'
import { SelectField, SwitchField, TextField, type SelectOption } from '@/components/fields'
import { StreamUpstreamsManager } from './StreamUpstreams'

// Maintainer routing surface — L4 TCP/UDP stream listeners (nginx `stream { server{} }`)
// AND their stream-upstream pools, on ONE page: list the configured streams, create/edit
// one in a FormModal (impl §10 — POST replaces by name; routing to a named stream-upstream
// pool or an inline `host:port`, with optional TLS termination), remove one, and manage
// the pools those streams target in the sibling tab. Drives the `/api/routing/streams` +
// `/api/routing/stream-upstreams` endpoints (`authorize('maintainer')`-gated). A stream
// naming an unknown pool is rejected by nginxpilot (400) — create the pool first, same page.

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

// The page's two surfaces as sibling tabs (a local tc-tab-bar, NOT route
// navigation — both read the same loaded slice and share one reload).
type StreamTab = 'streams' | 'upstreams'

const STREAM_TABS: TabBarItem[] = [
    { id: 'streams', label: 'Streams', icon: 'cable' },
    { id: 'upstreams', label: 'Upstreams', icon: 'server' },
]

export function Streams() {
    const [tab, setTab] = useState<StreamTab>('streams')
    const tabRef = useTc<HTMLElement>(
        useMemo(() => ({ tabs: STREAM_TABS, onChange: (id: string) => setTab(id as StreamTab) }), []),
    )
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
            subtitle="TCP/UDP listeners and the stream-upstream pools they forward to. Maintainer access."
            icon="cable"
            iconColor="cyan"
            requiresPath="/streams"
            state={state}
            onRetry={() => void reload()}
        >
            {(data) => (
                <>
                    <tc-tab-bar ref={tabRef} active-id={tab} className="perch-sub-tabs" />
                    {tab === 'streams' && (
                        <StreamsManager
                            streams={data.streams}
                            upstreams={data.upstreams}
                            onChanged={() => void reload()}
                        />
                    )}
                    {tab === 'upstreams' && (
                        <StreamUpstreamsManager upstreams={data.upstreams} onChanged={() => void reload()} />
                    )}
                </>
            )}
        </RoutingPage>
    )
}

function describeTarget(s: Stream): string {
    if (s.upstream) return `→ ${s.upstream}`
    if (s.pass) return `→ ${s.pass}`
    return '—'
}

/** Everything the stream form holds — one draft object; the modal resets by remount. */
interface StreamDraft {
    name: string
    listen: string
    protocol: 'tcp' | 'udp'
    targetKind: TargetKind
    targetValue: string
    proxyProtocol: boolean
    connectTimeout: string
    timeout: string
    tls: StreamTlsMode
    tlsDomain: string
}

const emptyDraft = (): StreamDraft => ({
    name: '',
    listen: '',
    protocol: 'tcp',
    targetKind: 'upstream',
    targetValue: '',
    proxyProtocol: false,
    connectTimeout: '',
    timeout: '',
    tls: 'off',
    tlsDomain: '',
})

const draftFrom = (s: Stream): StreamDraft => ({
    name: s.name,
    listen: String(s.listen),
    protocol: s.protocol ?? 'tcp',
    targetKind: s.pass ? 'pass' : 'upstream',
    targetValue: s.pass ?? s.upstream ?? '',
    proxyProtocol: !!s.proxy_protocol,
    connectTimeout: s.connect_timeout ?? '',
    timeout: s.timeout ?? '',
    tls: s.tls ?? 'off',
    tlsDomain: s.tls_domain ?? '',
})

function StreamsManager({
    streams,
    upstreams,
    onChanged,
}: {
    streams: Stream[]
    upstreams: StreamUpstream[]
    onChanged: () => void
}) {
    // The open form: null = closed; { editing: null } = create; { editing: name } = edit.
    const [form, setForm] = useState<{ editing: string | null; draft: StreamDraft } | null>(null)
    const [error, setError] = useState<string | null>(null)
    // Advisory target-check warnings from the last successful save (A5) — dismissible.
    const [warnings, setWarnings] = useState<string[]>([])
    // The payload blocked by the daemon's DNS check, held for the "Save anyway" retry.
    const [dnsRetry, setDnsRetry] = useState<Stream | null>(null)
    const [busy, setBusy] = useState(false)
    const [pending, setPending] = useState<string | null>(null)

    const patch = (p: Partial<StreamDraft>) =>
        setForm((prev) => (prev ? { ...prev, draft: { ...prev.draft, ...p } } : prev))

    const openCreate = () => {
        setError(null)
        setDnsRetry(null)
        setForm({ editing: null, draft: emptyDraft() })
    }

    const startEdit = useCallback(
        (streamName: string) => {
            const s = streams.find((x) => x.name === streamName)
            if (!s) return
            setError(null)
            setDnsRetry(null)
            setForm({ editing: s.name, draft: draftFrom(s) })
        },
        [streams],
    )

    const close = useCallback(() => {
        setForm(null)
        setError(null)
    }, [])

    const save = useCallback(async () => {
        if (!form || busy) return
        const d = form.draft
        const n = d.name.trim()
        if (!n) {
            setError('A stream needs a name.')
            return
        }
        if (!d.listen.trim()) {
            setError('A stream needs a listen port.')
            return
        }
        if (!d.targetValue.trim()) {
            setError('Set a target — a stream upstream pool or an inline host:port.')
            return
        }
        if (d.tls !== 'off' && !d.tlsDomain.trim()) {
            setError('TLS needs a domain (no SNI at L4) — set tls_domain.')
            return
        }
        const payload: Stream = { name: n, listen: Number(d.listen) }
        if (d.protocol !== 'tcp') payload.protocol = d.protocol
        if (d.targetKind === 'upstream') payload.upstream = d.targetValue.trim()
        else payload.pass = d.targetValue.trim()
        if (d.proxyProtocol) payload.proxy_protocol = true
        if (d.connectTimeout.trim()) payload.connect_timeout = d.connectTimeout.trim()
        if (d.timeout.trim()) payload.timeout = d.timeout.trim()
        if (d.tls !== 'off') {
            payload.tls = d.tls
            payload.tls_domain = d.tlsDomain.trim()
        }

        setBusy(true)
        setError(null)
        setWarnings([])
        setDnsRetry(null)
        const outcome = await saveRouting('/api/routing/streams', payload)
        setBusy(false)
        if (!outcome.ok) {
            setError(saveErrorMessage('stream', outcome))
            // The daemon's DNS gate — offer its own ?skip_target_checks=true override.
            if (outcome.dnsBlocked) setDnsRetry(payload)
            return
        }
        setWarnings(outcome.warnings)
        close()
        onChanged()
    }, [form, busy, close, onChanged])

    // The "Save anyway" retry for a DNS-blocked save (?skip_target_checks=true).
    const retrySkippingDns = useCallback(async () => {
        const payload = dnsRetry
        if (!payload || busy) return
        setBusy(true)
        setError(null)
        const outcome = await saveRouting('/api/routing/streams', payload, true)
        setBusy(false)
        if (!outcome.ok) {
            setError(saveErrorMessage('stream', outcome))
            return
        }
        setDnsRetry(null)
        setWarnings(outcome.warnings)
        close()
        onChanged()
    }, [dnsRetry, busy, close, onChanged])

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

    const resourceStates = useResourceStates('stream')
    const items = useMemo<RoutingListItem[]>(
        () =>
            streams.map((s) => ({
                name: s.name,
                hint: `${s.protocol ?? 'tcp'} :${s.listen} ${describeTarget(s)}${s.tls ? ` · TLS ${s.tls}` : ''}`,
                stateChip: resourceStates.get(s.name)?.state,
                stateReason: resourceStates.get(s.name)?.reason,
            })),
        [streams, resourceStates],
    )

    // Stream-upstream pool options, with a leading clear choice.
    const upstreamOptions: SelectOption[] = [
        { value: '', label: '— pick stream upstream —' },
        ...upstreams.map((u) => ({ value: u.name, label: u.name })),
    ]

    const d = form?.draft

    return (
        <>
            <tc-section-card title="Streams" icon="cable">
                <div className="perch-admin-section">
                    <p className="perch-home-lead perch-admin-hint">
                        {streams.length} stream{streams.length === 1 ? '' : 's'}. Each forwards a TCP/UDP port to a pool
                        or an inline target.
                    </p>
                    {error && !form && <tc-banner variant="danger">{error}</tc-banner>}
                    {dnsRetry && !form && (
                        <tc-banner variant="warning">
                            The target host doesn’t resolve yet. If its DNS record lands later, you can save anyway
                            and skip the daemon’s DNS check.
                            <tc-button
                                variant="secondary"
                                size="sm"
                                outline
                                disabled={busy || undefined}
                                onClick={() => void retrySkippingDns()}
                            >
                                Save anyway (skip DNS check)
                            </tc-button>
                        </tc-banner>
                    )}
                    <SaveWarningsBanner warnings={warnings} onDismiss={() => setWarnings([])} />

                    <div className="perch-list-actions">
                        <tc-button variant="primary" size="sm" onClick={openCreate}>
                            New stream
                        </tc-button>
                    </div>

                    {streams.length === 0 ? (
                        <tc-empty-state icon="cable">No streams yet.</tc-empty-state>
                    ) : (
                        <RoutingListTable items={items} busy={busy} onEdit={startEdit} onRemove={setPending} />
                    )}
                </div>
            </tc-section-card>

            {form && d && (
                <FormModal
                    // The `:dns` suffix re-keys the modal when the DNS-retry footer action
                    // appears, so tc-modal re-captures its footer (see FormModal's notes).
                    key={`${form.editing ?? 'new'}${dnsRetry ? ':dns' : ''}`}
                    title={form.editing ? `Edit stream — ${form.editing}` : 'New stream'}
                    busy={busy}
                    submitLabel={form.editing ? 'Save changes' : 'Create stream'}
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
                            and skip the daemon’s DNS check.
                        </tc-banner>
                    )}
                    <FormGroup title="Identity">
                        <div className="perch-form-grid">
                            <div className="perch-form-span">
                                <TextField
                                    label="Name"
                                    placeholder="postgres"
                                    help="Identity key (L4 has no Host) — letters, digits, underscores."
                                    value={d.name}
                                    disabled={!!form.editing}
                                    onValue={(v) => patch({ name: v })}
                                />
                            </div>
                            <TextField
                                type="number"
                                min={1}
                                max={65535}
                                label="Listen"
                                placeholder="5432"
                                value={d.listen}
                                onValue={(v) => patch({ listen: v })}
                            />
                            <SelectField
                                label="Protocol"
                                value={d.protocol}
                                options={PROTOCOL_OPTIONS}
                                onValue={(v) => patch({ protocol: v as 'tcp' | 'udp' })}
                            />
                        </div>
                    </FormGroup>

                    <FormGroup title="Target">
                        <div className="perch-form-grid">
                            <SelectField
                                label="Kind"
                                help="A named stream-upstream pool, or an inline host:port."
                                value={d.targetKind}
                                options={KIND_OPTIONS}
                                onValue={(v) => patch({ targetKind: v as TargetKind, targetValue: '' })}
                            />
                            {d.targetKind === 'upstream' ? (
                                <SelectField
                                    label="Target"
                                    value={d.targetValue}
                                    options={upstreamOptions}
                                    onValue={(v) => patch({ targetValue: v })}
                                />
                            ) : (
                                <TextField
                                    label="Target"
                                    placeholder="10.0.0.9:5432"
                                    value={d.targetValue}
                                    onValue={(v) => patch({ targetValue: v })}
                                />
                            )}
                        </div>
                    </FormGroup>

                    <FormGroup title="Tuning">
                        <div className="perch-form-grid">
                            <TextField
                                label="Connect timeout"
                                placeholder="5s"
                                value={d.connectTimeout}
                                onValue={(v) => patch({ connectTimeout: v })}
                            />
                            <TextField
                                label="Timeout"
                                placeholder="10m"
                                value={d.timeout}
                                onValue={(v) => patch({ timeout: v })}
                            />
                        </div>
                        <div className="perch-form-switches">
                            <SwitchField
                                label="proxy_protocol"
                                checked={d.proxyProtocol}
                                onChecked={(c) => patch({ proxyProtocol: c })}
                            />
                        </div>
                    </FormGroup>

                    <FormGroup title="TLS termination">
                        <div className="perch-form-grid">
                            <SelectField
                                label="TLS"
                                help="auto/required terminates TLS at the listener."
                                value={d.tls}
                                options={TLS_OPTIONS}
                                onValue={(v) => {
                                    const mode = v as StreamTlsMode
                                    patch(mode === 'off' ? { tls: mode, tlsDomain: '' } : { tls: mode })
                                }}
                            />
                            <TextField
                                label="TLS domain"
                                placeholder="db.example.com"
                                help="Required when TLS is on — no SNI at L4."
                                disabled={d.tls === 'off'}
                                value={d.tlsDomain}
                                onValue={(v) => patch({ tlsDomain: v })}
                            />
                        </div>
                    </FormGroup>
                </FormModal>
            )}

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
