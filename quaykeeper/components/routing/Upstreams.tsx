'use client'

import { useCallback, useMemo, useState } from 'react'
import type { AdvancedTableColumn } from '@toolcase/web-components'
import type { BalancerMethod, Upstream, UpstreamServer } from '@/server/domain/routing'
import {
    RoutingListTable,
    SaveWarningsBanner,
    cellMono,
    cellMuted,
    saveErrorMessage,
    saveRouting,
    useResourceStates,
    type RoutingListItem,
} from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormModal, FormGroup } from '@/components/FormModal'
import { SelectField, SwitchField, TextField, type SelectOption } from '@/components/fields'

// Maintainer routing surface — nginx `upstream{}` pools. Lists the configured
// upstreams (each a named pool of backend servers), creates/edits one in a FormModal
// (impl §10 — POST replaces by name), and removes one (nginxpilot returns 409 if a
// proxy still references it — surfaced inline). Drives the `/api/routing/upstreams`
// endpoints, themselves `authorize('maintainer')`-gated. Rendered as a section of
// the combined Proxies page (upstreams exist to be proxy targets, so they live
// beside the proxies that reference them).

const BALANCERS: (BalancerMethod | '')[] = ['', 'least_conn', 'ip_hash']
const balancerLabel = (b?: BalancerMethod | '') => (b ? b : 'round_robin')
const BALANCER_OPTIONS: SelectOption[] = BALANCERS.map((b) => ({ value: b, label: balancerLabel(b) }))

// List columns (between the built-in Name column and the actions).
const UPSTREAM_COLUMNS: AdvancedTableColumn[] = [
    { key: 'balancer', label: 'Balancer' },
    { key: 'keepalive', label: 'Keepalive' },
    { key: 'servers', label: 'Servers' },
]

/** Servers cell: count plus every backend with its weight/backup/down markers. */
function serversCellHtml(servers: UpstreamServer[]): string {
    const detail = servers
        .map(
            (s) =>
                s.address +
                (s.weight != null ? ` w${s.weight}` : '') +
                (s.backup ? ' [backup]' : '') +
                (s.down ? ' [down]' : ''),
        )
        .join(', ')
    return `${cellMuted(`${servers.length} ·`)} ${cellMono(detail)}`
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

const serverDraftFrom = (s: UpstreamServer): ServerDraft => ({
    address: s.address,
    weight: s.weight != null ? String(s.weight) : '',
    maxFails: s.max_fails != null ? String(s.max_fails) : '',
    failTimeout: s.fail_timeout ?? '',
    backup: !!s.backup,
    down: !!s.down,
})

/** Everything the upstream form holds — one draft object; the modal resets by remount. */
interface UpstreamDraft {
    name: string
    balancer: BalancerMethod | ''
    keepalive: string
    servers: ServerDraft[]
}

const emptyDraft = (): UpstreamDraft => ({
    name: '',
    balancer: '',
    keepalive: '',
    servers: [emptyServer()],
})

const draftFrom = (u: Upstream): UpstreamDraft => ({
    name: u.name,
    balancer: u.balancer ?? '',
    keepalive: u.keepalive != null ? String(u.keepalive) : '',
    servers: u.servers.length > 0 ? u.servers.map(serverDraftFrom) : [emptyServer()],
})

export function UpstreamsManager({ upstreams, onChanged }: { upstreams: Upstream[]; onChanged: () => void }) {
    // The open form: null = closed; { editing: null } = create; { editing: name } = edit.
    const [form, setForm] = useState<{ editing: string | null; draft: UpstreamDraft } | null>(null)
    const [error, setError] = useState<string | null>(null)
    // Advisory target-check warnings from the last successful save (A5) — dismissible.
    const [warnings, setWarnings] = useState<string[]>([])
    // The payload blocked by the daemon's DNS check, held for the "Save anyway" retry.
    const [dnsRetry, setDnsRetry] = useState<Upstream | null>(null)
    const [busy, setBusy] = useState(false)
    // The upstream awaiting remove confirmation (drives the ConfirmDialog).
    const [pending, setPending] = useState<string | null>(null)

    const patch = (p: Partial<UpstreamDraft>) =>
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
            setError('An upstream needs a name.')
            return
        }
        const built: UpstreamServer[] = []
        for (const s of d.servers) {
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
        if (d.balancer) payload.balancer = d.balancer
        if (d.keepalive.trim()) payload.keepalive = Number(d.keepalive)

        setBusy(true)
        setError(null)
        setWarnings([])
        setDnsRetry(null)
        const outcome = await saveRouting('/api/routing/upstreams', payload)
        setBusy(false)
        if (!outcome.ok) {
            setError(saveErrorMessage('upstream', outcome))
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
        const outcome = await saveRouting('/api/routing/upstreams', payload, true)
        setBusy(false)
        if (!outcome.ok) {
            setError(saveErrorMessage('upstream', outcome))
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

    const resourceStates = useResourceStates('upstream')
    const items = useMemo<RoutingListItem[]>(
        () =>
            upstreams.map((u) => ({
                name: u.name,
                cells: {
                    balancer: cellMono(balancerLabel(u.balancer)),
                    keepalive: u.keepalive != null ? cellMono(u.keepalive) : cellMuted('—'),
                    servers: serversCellHtml(u.servers),
                },
                stateChip: resourceStates.get(u.name)?.state,
                stateReason: resourceStates.get(u.name)?.reason,
            })),
        [upstreams, resourceStates],
    )

    const d = form?.draft

    return (
        <>
            <tc-section-card title="Upstream pools" icon="server">
                <div className="quaykeeper-admin-section">
                    <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                        {upstreams.length} pool{upstreams.length === 1 ? '' : 's'}. A proxy routes to a pool by name.
                    </p>
                    {error && !form && <tc-banner variant="error">{error}</tc-banner>}
                    <SaveWarningsBanner warnings={warnings} onDismiss={() => setWarnings([])} />

                    <div className="quaykeeper-list-actions">
                        <tc-button variant="primary" size="sm" onClick={openCreate}>
                            New upstream
                        </tc-button>
                    </div>

                    {upstreams.length === 0 ? (
                        <tc-empty-state icon="server">No upstreams yet.</tc-empty-state>
                    ) : (
                        <RoutingListTable
                            columns={UPSTREAM_COLUMNS}
                            items={items}
                            busy={busy}
                            onEdit={startEdit}
                            onRemove={setPending}
                        />
                    )}
                </div>
            </tc-section-card>

            {form && d && (
                <FormModal
                    // Re-keyed when the DNS retry appears — the secondary footer button
                    // needs a fresh tc-modal slot capture (see FormModal's relocation note).
                    key={`${form.editing ?? 'new'}${dnsRetry ? ':dns' : ''}`}
                    title={form.editing ? `Edit upstream — ${form.editing}` : 'New upstream'}
                    busy={busy}
                    submitLabel={form.editing ? 'Save changes' : 'Create upstream'}
                    onSubmit={() => void save()}
                    onClose={close}
                    secondary={
                        dnsRetry
                            ? { label: 'Save anyway (skip DNS check)', onClick: () => void retrySkippingDns() }
                            : undefined
                    }
                >
                    {error && <tc-banner variant="error">{error}</tc-banner>}
                    <FormGroup title="Identity">
                        <div className="quaykeeper-form-grid">
                            <div className="quaykeeper-form-span">
                                <TextField
                                    label="Name"
                                    placeholder="api_pool"
                                    value={d.name}
                                    disabled={!!form.editing}
                                    onValue={(v) => patch({ name: v })}
                                />
                            </div>
                            <SelectField
                                label="Balancer"
                                value={d.balancer}
                                options={BALANCER_OPTIONS}
                                onValue={(v) => patch({ balancer: v as BalancerMethod | '' })}
                            />
                            <TextField
                                type="number"
                                min={0}
                                label="Keepalive"
                                placeholder="0"
                                value={d.keepalive}
                                onValue={(v) => patch({ keepalive: v })}
                            />
                        </div>
                    </FormGroup>

                    <FormGroup title="Servers">
                        {d.servers.map((s, i) => (
                            <div className="quaykeeper-form-item" key={i}>
                                <div className="quaykeeper-form-row">
                                    <TextField
                                        label="Address"
                                        placeholder="10.0.0.1:8080"
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
                        <div className="quaykeeper-form-row">
                            <tc-button variant="secondary" size="sm" outline onClick={addServer}>
                                Add server
                            </tc-button>
                        </div>
                    </FormGroup>
                </FormModal>
            )}

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
