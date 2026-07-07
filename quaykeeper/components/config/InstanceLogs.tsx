'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AdvancedTableColumn } from '@toolcase/web-components'
import { escapeHtml, useTc } from '@/lib/tc'
import type { LogShaping } from '@/server/domain/nginxpilot-logdest-fragment'
import { iconBtnHtml } from '@/lib/action-icons'
import { callApi, json } from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormModal, FormGroup } from '@/components/FormModal'
import { SelectField, SwitchField } from '@/components/fields'
import {
    ShapingFields,
    buildShapingPayload,
    emptyShapingDraft,
    shapingDraftOf,
    type ShapingDraft,
} from '@/components/LogShapingFields'
import { LoadingState, ErrorState } from '@/components/states'
import { useToast } from '@/components/Toast'

// Instance Logs tab (logs_feature.md §12): bind owner-defined log destinations to
// this instance's app logs. Maintainers *choose* from the owner's endpoints (D3)
// and set the per-binding shaping (labels when the destination is loki, filter,
// parse templates, shipping tunables). App-log shipping happens client-side via
// quaykeeper-client; a change here is delivered on the client's next config fetch
// (the snapshot version bump) — no daemon is involved.

/** One binding as `/api/instances/{id}/logs` returns it. */
interface LogBindingDto {
    id: string
    destinationId: string
    destinationName: string
    destinationType: string
    destinationUrl: string
    enabled: boolean
    shaping: LogShaping
    logql: string
    updatedAt: string
}

/** A destination option for the binding select. */
interface DestOption {
    id: string
    name: string
    type: string
    url: string
}

interface LogsData {
    bindings: LogBindingDto[]
    destinations: DestOption[]
}

type LoadState = { phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; data: LogsData }

const LOG_COLUMNS: AdvancedTableColumn[] = [
    { key: 'destination', label: 'Destination' },
    { key: 'enabled', label: 'Enabled', width: '8rem' },
    { key: 'actions', label: '', align: 'right' },
]

/** The injected <tbody> HTML — every interpolated value is escaped. The enabled
 *  cell is a real <tc-switch>; its bubbling `change` and the edit/delete buttons'
 *  clicks are caught by ONE delegated listener via `data-action` (the flags pattern). */
function bindingRowsHtml(bindings: LogBindingDto[]): string {
    return bindings
        .map((b) => {
            const id = escapeHtml(b.id)
            const name = escapeHtml(b.destinationName)
            const toggle =
                `<tc-switch label="${name}" data-action="toggle" data-id="${id}" data-name="${name}"` +
                (b.enabled ? ' checked' : '') +
                `></tc-switch>`
            const sub = b.destinationType === 'loki' && b.logql ? b.logql : b.destinationUrl
            const controls = [
                iconBtnHtml({ icon: 'edit', label: `Edit binding for ${b.destinationName}`, data: { action: 'edit', id: b.id } }),
                iconBtnHtml({
                    icon: 'remove',
                    label: `Remove binding for ${b.destinationName}`,
                    danger: true,
                    data: { action: 'delete', id: b.id, name: b.destinationName },
                }),
            ].join('')
            return (
                `<tr>` +
                `<td><span class="quaykeeper-admin-realm-id">` +
                `<span class="quaykeeper-admin-realm-name">${name}</span>` +
                `<span class="quaykeeper-admin-mono quaykeeper-admin-hint">${escapeHtml(sub)}</span>` +
                `<span class="quaykeeper-admin-badges"><span class="badge text-bg-info">${escapeHtml(b.destinationType)}</span></span>` +
                `</span></td>` +
                `<td>${toggle}</td>` +
                `<td style="text-align:right"><span class="quaykeeper-admin-domain-controls">${controls}</span></td>` +
                `</tr>`
            )
        })
        .join('')
}

interface BindingDraft {
    /** null = creating; the binding id when editing (destination immutable then). */
    bindingId: string | null
    destinationId: string
    enabled: boolean
    shaping: ShapingDraft
}

export function InstanceLogs({ instanceId }: { instanceId: string }) {
    const toast = useToast()
    const [state, setState] = useState<LoadState>({ phase: 'loading' })
    const [form, setForm] = useState<BindingDraft | null>(null)
    const [pending, setPending] = useState<{ id: string; name: string } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const data = useMemo<LogsData>(
        () => (state.phase === 'ready' ? state.data : { bindings: [], destinations: [] }),
        [state],
    )

    const load = useCallback(async () => {
        setState({ phase: 'loading' })
        try {
            const next = await fetch(`/api/instances/${instanceId}/logs`, { cache: 'no-store' }).then((r) =>
                json<LogsData>(r),
            )
            setState({ phase: 'ready', data: next })
        } catch {
            setState({ phase: 'error' })
        }
    }, [instanceId])

    useEffect(() => {
        void load()
    }, [load])

    const toggle = useCallback(
        async (id: string, name: string, enabled: boolean) => {
            const res = await callApi(`/api/instances/${instanceId}/logs/${id}`, 'PATCH', { enabled })
            if (!res.ok) {
                toast.show(`Couldn’t update “${name}”: ${res.message}`, { variant: 'error' })
            }
            // Reload either way: sync updatedAt on success, revert the switch on failure.
            void load()
        },
        [instanceId, load, toast],
    )

    // One delegated handler for everything inside the injected rows.
    const onDelegated = useCallback(
        (event: Event) => {
            const el = (event.target as HTMLElement)?.closest?.('[data-action]') as HTMLElement | null
            if (!el) return
            const action = el.getAttribute('data-action')
            const id = el.getAttribute('data-id')
            const name = el.getAttribute('data-name') ?? ''
            if (!action || !id) return
            if (action === 'toggle' && event.type === 'change') {
                const checked = (el as HTMLElement & { checked?: boolean }).checked === true
                void toggle(id, name, checked)
            } else if (action === 'edit' && event.type === 'click') {
                const binding = data.bindings.find((b) => b.id === id)
                if (!binding) return
                setError(null)
                setForm({
                    bindingId: binding.id,
                    destinationId: binding.destinationId,
                    enabled: binding.enabled,
                    shaping: shapingDraftOf(binding.shaping),
                })
            } else if (action === 'delete' && event.type === 'click') {
                setPending({ id, name })
            }
        },
        [toggle, data.bindings],
    )

    const tableProps = useMemo(
        () => ({
            columns: LOG_COLUMNS,
            total: data.bindings.length,
            limit: Math.max(data.bindings.length, 1),
            offset: 0,
            rows: bindingRowsHtml(data.bindings),
        }),
        [data.bindings],
    )
    const tableRef = useTc<HTMLElement>(tableProps, { click: onDelegated, change: onDelegated })

    const openCreate = () => {
        setError(null)
        setForm({
            bindingId: null,
            destinationId: data.destinations[0]?.id ?? '',
            enabled: true,
            shaping: emptyShapingDraft('instance'),
        })
    }
    const closeForm = () => {
        setForm(null)
        setError(null)
    }

    const chosenDest = form ? data.destinations.find((d) => d.id === form.destinationId) : undefined

    const submit = useCallback(async () => {
        if (!form || busy) return
        if (!form.destinationId) {
            setError('Pick a destination.')
            return
        }
        setBusy(true)
        setError(null)
        const dest = data.destinations.find((d) => d.id === form.destinationId)
        const shaping = buildShapingPayload(form.shaping, { scope: 'instance', loki: dest?.type === 'loki' })
        const res = form.bindingId
            ? await callApi(`/api/instances/${instanceId}/logs/${form.bindingId}`, 'PATCH', {
                  enabled: form.enabled,
                  shaping,
              })
            : await callApi(`/api/instances/${instanceId}/logs`, 'POST', {
                  destinationId: form.destinationId,
                  enabled: form.enabled,
                  shaping,
              })
        setBusy(false)
        if (!res.ok) {
            setError(`Couldn’t save the log destination: ${res.message}`)
            return
        }
        toast.show(
            form.bindingId ? `Log binding for “${dest?.name}” updated.` : `Logs now ship to “${dest?.name}”.`,
            { variant: 'success' },
        )
        setForm(null)
        void load()
    }, [form, busy, instanceId, data.destinations, load, toast])

    const doDelete = useCallback(async () => {
        if (!pending || busy) return
        const { id, name } = pending
        setPending(null)
        setBusy(true)
        const res = await callApi(`/api/instances/${instanceId}/logs/${id}`, 'DELETE')
        setBusy(false)
        if (!res.ok) {
            toast.show(`Couldn’t remove “${name}”: ${res.message}`, { variant: 'error' })
            return
        }
        toast.show(`Log binding for “${name}” removed.`, { variant: 'success' })
        void load()
    }, [pending, busy, instanceId, load, toast])

    if (state.phase === 'loading') return <LoadingState shape="rows" count={3} />
    if (state.phase === 'error') {
        return (
            <ErrorState
                title="Couldn’t load log destinations"
                message="The log bindings didn’t come back. This is usually temporary."
                onRetry={() => void load()}
            />
        )
    }

    const { bindings, destinations } = data

    return (
        <>
            <tc-section-card title="Log shipping" icon="scroll-text">
                <div className="quaykeeper-admin-section">
                    <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                        Ship this instance’s app logs to an owner-defined destination. Shipping happens client-side via
                        quaykeeper-client; changes are delivered on the next config fetch. Credentials are referenced by
                        env-var / file name — provision them as instance variables.
                    </p>
                    {error && !form && <tc-banner variant="danger">{error}</tc-banner>}
                    <div className="quaykeeper-instance-toolbar">
                        <tc-button variant="primary" size="sm" onClick={openCreate} disabled={destinations.length === 0}>
                            Add log destination
                        </tc-button>
                    </div>
                    {bindings.length === 0 ? (
                        <tc-empty-state icon="scroll-text">
                            {destinations.length === 0
                                ? 'No destinations exist yet — an owner defines them under Admin → Log destinations.'
                                : 'No log destinations bound yet.'}
                        </tc-empty-state>
                    ) : (
                        <tc-advanced-table ref={tableRef} />
                    )}
                </div>
            </tc-section-card>

            {form && (
                <FormModal
                    key={form.bindingId ?? 'new'}
                    title={form.bindingId ? `Edit — ${chosenDest?.name ?? ''}` : 'Add log destination'}
                    busy={busy}
                    submitLabel={form.bindingId ? 'Save' : 'Bind destination'}
                    onSubmit={() => void submit()}
                    onClose={closeForm}
                >
                    {error && <tc-banner variant="danger">{error}</tc-banner>}
                    <FormGroup title="Destination">
                        <SelectField
                            label="Destination"
                            help="Owner-defined endpoint (Admin → Log destinations). Immutable per binding — remove and re-add to switch."
                            value={form.destinationId}
                            disabled={form.bindingId !== null}
                            options={destinations.map((d) => ({ value: d.id, label: `${d.name} — ${d.url}` }))}
                            onValue={(v) => setForm((p) => (p ? { ...p, destinationId: v } : p))}
                        />
                        <SwitchField
                            label="Enabled"
                            checked={form.enabled}
                            onChecked={(c) => setForm((p) => (p ? { ...p, enabled: c } : p))}
                        />
                    </FormGroup>
                    <ShapingFields
                        draft={form.shaping}
                        onPatch={(p) => setForm((prev) => (prev ? { ...prev, shaping: { ...prev.shaping, ...p } } : prev))}
                        scope="instance"
                        loki={chosenDest?.type === 'loki'}
                    />
                </FormModal>
            )}

            <ConfirmDialog
                open={!!pending}
                title="Remove log binding?"
                message={
                    pending
                        ? `Stop shipping this instance’s logs to “${pending.name}”. Applied on the client’s next config fetch.`
                        : undefined
                }
                confirmLabel="Remove"
                danger
                onConfirm={() => void doDelete()}
                onCancel={() => setPending(null)}
            />
        </>
    )
}
