'use client'

import { useCallback, useMemo, useState } from 'react'
import type { StreamBalancer, StreamServer, StreamUpstream } from '@/server/domain/streams'
import {
    RoutingListTable,
    SaveWarningsBanner,
    saveErrorMessage,
    saveRouting,
    useResourceStates,
    type RoutingListItem,
} from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormModal, FormGroup } from '@/components/FormModal'
import { SelectField, SwitchField, TextField, type SelectOption } from '@/components/fields'

// Maintainer routing surface — L4 `stream { upstream{} }` pools (the TCP/UDP
// counterpart to Upstreams). Lists the configured stream upstreams, creates/edits
// one in a FormModal (impl §10 — POST replaces by name), and removes one
// (nginxpilot returns 409 if a stream still references it — surfaced inline).
// Drives the `/api/routing/stream-upstreams` endpoints, `authorize('maintainer')`-
// gated. Note the balancer set uses `hash` (not `ip_hash`) and there is no `keepalive`.
// Rendered as a section of the combined Streams page (pools exist to be stream
// targets, so they live beside the streams that reference them).

const BALANCERS: (StreamBalancer | '')[] = ['', 'least_conn', 'hash']
const balancerLabel = (b?: StreamBalancer | '') => (b ? b : 'round_robin')
const BALANCER_OPTIONS: SelectOption[] = BALANCERS.map((b) => ({ value: b, label: balancerLabel(b) }))

interface ServerDraft {
    address: string
    weight: string
    maxFails: string
    failTimeout: string
    backup: boolean
    down: boolean
}

const emptyServer = (): ServerDraft => ({ address: '', weight: '', maxFails: '', failTimeout: '', backup: false, down: false })

const serverDraftFrom = (s: StreamServer): ServerDraft => ({
    address: s.address,
    weight: s.weight != null ? String(s.weight) : '',
    maxFails: s.max_fails != null ? String(s.max_fails) : '',
    failTimeout: s.fail_timeout ?? '',
    backup: !!s.backup,
    down: !!s.down,
})

/** Everything the stream-upstream form holds — one draft object; the modal resets by remount. */
interface StreamUpstreamDraft {
    name: string
    balancer: StreamBalancer | ''
    servers: ServerDraft[]
}

const emptyDraft = (): StreamUpstreamDraft => ({
    name: '',
    balancer: '',
    servers: [emptyServer()],
})

const draftFrom = (u: StreamUpstream): StreamUpstreamDraft => ({
    name: u.name,
    balancer: u.balancer ?? '',
    servers: u.servers.length > 0 ? u.servers.map(serverDraftFrom) : [emptyServer()],
})

export function StreamUpstreamsManager({
    upstreams,
    onChanged,
}: {
    upstreams: StreamUpstream[]
    onChanged: () => void
}) {
    // The open form: null = closed; { editing: null } = create; { editing: name } = edit.
    const [form, setForm] = useState<{ editing: string | null; draft: StreamUpstreamDraft } | null>(null)
    const [error, setError] = useState<string | null>(null)
    // Advisory target-check warnings from the last successful save (A5) — dismissible.
    const [warnings, setWarnings] = useState<string[]>([])
    // The payload blocked by the daemon's DNS check, held for the "Save anyway" retry.
    const [dnsRetry, setDnsRetry] = useState<StreamUpstream | null>(null)
    const [busy, setBusy] = useState(false)
    // The stream upstream awaiting remove confirmation (drives the ConfirmDialog).
    const [pending, setPending] = useState<string | null>(null)

    const patch = (p: Partial<StreamUpstreamDraft>) =>
        setForm((prev) => (prev ? { ...prev, draft: { ...prev.draft, ...p } } : prev))

    const setServer = (i: number, p: Partial<ServerDraft>) =>
        setForm((prev) =>
            prev
                ? {
                      ...prev,
                      draft: {
                          ...prev.draft,
                          servers: prev.draft.servers.map((s, idx) => (idx === i ? { ...s, ...p } : s)),
                      },
                  }
                : prev,
        )
    const addServer = () =>
        setForm((prev) =>
            prev ? { ...prev, draft: { ...prev.draft, servers: [...prev.draft.servers, emptyServer()] } } : prev,
        )
    const removeServer = (i: number) =>
        setForm((prev) =>
            prev && prev.draft.servers.length > 1
                ? { ...prev, draft: { ...prev.draft, servers: prev.draft.servers.filter((_, idx) => idx !== i) } }
                : prev,
        )

    const openCreate = () => {
        setError(null)
        setDnsRetry(null)
        setForm({ editing: null, draft: emptyDraft() })
    }

    const startEdit = useCallback(
        (upstreamName: string) => {
            const u = upstreams.find((x) => x.name === upstreamName)
            if (!u) return
            setError(null)
            setDnsRetry(null)
            setForm({ editing: u.name, draft: draftFrom(u) })
        },
        [upstreams],
    )

    const close = useCallback(() => {
        setForm(null)
        setError(null)
        setDnsRetry(null)
    }, [])

    const save = useCallback(async () => {
        if (!form || busy) return
        const d = form.draft
        const trimmed = d.name.trim()
        if (!trimmed) {
            setError('A stream upstream needs a name.')
            return
        }
        const built: StreamServer[] = []
        for (const s of d.servers) {
            const address = s.address.trim()
            if (!address) {
                setError('Every server needs an address (host:port or unix:/path).')
                return
            }
            const server: StreamServer = { address }
            if (s.weight.trim()) server.weight = Number(s.weight)
            if (s.maxFails.trim()) server.max_fails = Number(s.maxFails)
            if (s.failTimeout.trim()) server.fail_timeout = s.failTimeout.trim()
            if (s.backup) server.backup = true
            if (s.down) server.down = true
            built.push(server)
        }
        const payload: StreamUpstream = { name: trimmed, servers: built }
        if (d.balancer) payload.balancer = d.balancer

        setBusy(true)
        setError(null)
        setWarnings([])
        setDnsRetry(null)
        const outcome = await saveRouting('/api/routing/stream-upstreams', payload)
        setBusy(false)
        if (!outcome.ok) {
            setError(saveErrorMessage('stream upstream', outcome))
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
        const outcome = await saveRouting('/api/routing/stream-upstreams', payload, true)
        setBusy(false)
        if (!outcome.ok) {
            setError(saveErrorMessage('stream upstream', outcome))
            return
        }
        setDnsRetry(null)
        setWarnings(outcome.warnings)
        close()
        onChanged()
    }, [dnsRetry, busy, close, onChanged])

    const doRemove = useCallback(async () => {
        const upstreamName = pending
        if (!upstreamName || busy) return
        setPending(null)
        setBusy(true)
        setError(null)
        try {
            const res = await fetch(`/api/routing/stream-upstreams?name=${encodeURIComponent(upstreamName)}`, {
                method: 'DELETE',
            })
            if (!res.ok && res.status !== 204) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null
                setError(
                    body?.error === 'in_use'
                        ? `${upstreamName} is still referenced by a stream — repoint or delete that stream first.`
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

    const resourceStates = useResourceStates('stream-upstream')
    const items = useMemo<RoutingListItem[]>(
        () =>
            upstreams.map((u) => ({
                name: u.name,
                hint: `${balancerLabel(u.balancer)} · ${u.servers.length} server${u.servers.length === 1 ? '' : 's'} (${u.servers.map((s) => s.address).join(', ')})`,
                stateChip: resourceStates.get(u.name)?.state,
                stateReason: resourceStates.get(u.name)?.reason,
            })),
        [upstreams, resourceStates],
    )

    const d = form?.draft

    return (
        <>
            <tc-section-card title="Stream upstream pools" icon="server">
                <div className="perch-admin-section">
                    <p className="perch-home-lead perch-admin-hint">
                        {upstreams.length} pool{upstreams.length === 1 ? '' : 's'}. A stream routes to a pool by name.
                    </p>
                    {error && !form && <tc-banner variant="danger">{error}</tc-banner>}
                    <SaveWarningsBanner warnings={warnings} onDismiss={() => setWarnings([])} />

                    <div className="perch-list-actions">
                        <tc-button variant="primary" size="sm" onClick={openCreate}>
                            New stream upstream
                        </tc-button>
                    </div>

                    {upstreams.length === 0 ? (
                        <tc-empty-state icon="server">No stream upstreams yet.</tc-empty-state>
                    ) : (
                        <RoutingListTable items={items} busy={busy} onEdit={startEdit} onRemove={setPending} />
                    )}
                </div>
            </tc-section-card>

            {form && d && (
                <FormModal
                    // Re-keyed when the DNS retry appears — the secondary footer button
                    // needs a fresh tc-modal slot capture (see FormModal's relocation note).
                    key={`${form.editing ?? 'new'}${dnsRetry ? ':dns' : ''}`}
                    title={form.editing ? `Edit stream upstream — ${form.editing}` : 'New stream upstream'}
                    busy={busy}
                    submitLabel={form.editing ? 'Save changes' : 'Create stream upstream'}
                    onSubmit={() => void save()}
                    onClose={close}
                    secondary={
                        dnsRetry
                            ? { label: 'Save anyway (skip DNS check)', onClick: () => void retrySkippingDns() }
                            : undefined
                    }
                >
                    {error && <tc-banner variant="danger">{error}</tc-banner>}
                    <FormGroup title="Identity">
                        <div className="perch-form-grid">
                            <div className="perch-form-span">
                                <TextField
                                    label="Name"
                                    placeholder="db_pool"
                                    value={d.name}
                                    disabled={!!form.editing}
                                    onValue={(v) => patch({ name: v })}
                                />
                            </div>
                            <SelectField
                                label="Balancer"
                                value={d.balancer}
                                options={BALANCER_OPTIONS}
                                onValue={(v) => patch({ balancer: v as StreamBalancer | '' })}
                            />
                        </div>
                    </FormGroup>

                    <FormGroup title="Servers">
                        {d.servers.map((s, i) => (
                            <div className="perch-form-item" key={i}>
                                <div className="perch-form-row">
                                    <TextField
                                        label="Address"
                                        placeholder="10.0.0.1:5432"
                                        value={s.address}
                                        onValue={(v) => setServer(i, { address: v })}
                                    />
                                    <TextField
                                        type="number"
                                        min={0}
                                        label="Weight"
                                        value={s.weight}
                                        onValue={(v) => setServer(i, { weight: v })}
                                    />
                                    <TextField
                                        type="number"
                                        min={0}
                                        label="Max fails"
                                        value={s.maxFails}
                                        onValue={(v) => setServer(i, { maxFails: v })}
                                    />
                                    <TextField
                                        label="Fail timeout"
                                        placeholder="30s"
                                        value={s.failTimeout}
                                        onValue={(v) => setServer(i, { failTimeout: v })}
                                    />
                                    <SwitchField
                                        label="Backup"
                                        checked={s.backup}
                                        onChecked={(c) => setServer(i, { backup: c })}
                                    />
                                    <SwitchField
                                        label="Down"
                                        checked={s.down}
                                        onChecked={(c) => setServer(i, { down: c })}
                                    />
                                    <tc-button
                                        variant="danger"
                                        size="sm"
                                        outline
                                        disabled={d.servers.length <= 1 || undefined}
                                        onClick={() => removeServer(i)}
                                    >
                                        Remove
                                    </tc-button>
                                </div>
                            </div>
                        ))}
                        <div className="perch-form-row">
                            <tc-button variant="secondary" size="sm" outline onClick={addServer}>
                                Add server
                            </tc-button>
                        </div>
                    </FormGroup>
                </FormModal>
            )}

            <ConfirmDialog
                open={!!pending}
                title="Remove stream upstream?"
                message={
                    pending
                        ? `Remove the stream upstream pool ${pending}. A stream that still references it will be rejected until repointed.`
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
