'use client'

import { useCallback, useMemo, useState } from 'react'
import type { AdvancedTableColumn } from '@toolcase/web-components'
import { iconBtnHtml } from '@/lib/action-icons'
import { escapeHtml, useTc } from '@/lib/tc'
import { BASE_DOMAIN_TIERS, type BaseDomain, type BaseDomainTier, type BaseDomainTls } from '@/server/domain/types'
import { AdminPage, json, useOwnerData } from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormModal, FormGroup } from '@/components/FormModal'
import { SelectField, TextField, type SelectOption } from '@/components/fields'

// Owner-only subdomain pool (§10/§13). The owner registers base domains, each one
// backing `<label>.<domain>` sites, and assigns each to an audience tier: `free`
// (every account) or `staff` (maintainers & owner). The standard `/api/base-domains`
// projection the wizard reads is filtered by the caller's tier; this owner surface
// shows the whole pool grouped by tier. Add via POST, remove via DELETE; both
// append to the audit log server-side.

/** Human labels + a one-line note for each tier, shown in the selector and group headers. */
const TIER_META: Record<BaseDomainTier, { label: string; note: string }> = {
    free: { label: 'Free', note: 'Visible to every account, including free plans.' },
    staff: { label: 'Staff', note: 'Visible only to maintainers and the owner.' },
}

const TIER_OPTIONS: SelectOption[] = BASE_DOMAIN_TIERS.map((t) => ({ value: t, label: TIER_META[t].label }))

// Subdomain TLS policy (§0/Phase D) — one wildcard cert per base domain; `auto`
// degrades to HTTP if the cert isn't issued yet. Set at add time and per row —
// always per base domain, never per subdomain.
const TLS_OPTIONS: { value: BaseDomainTls; label: string }[] = [
    { value: 'auto', label: 'HTTPS (auto)' },
    { value: 'off', label: 'HTTP only' },
]

interface DomainRow {
    domain: string
    tls: BaseDomainTls
}

const DOMAIN_COLUMNS: AdvancedTableColumn[] = [
    {
        key: 'domain',
        label: 'Domain',
    },
    {
        key: 'tls',
        label: 'Subdomain TLS',
        width: '12rem',
    },
    {
        key: 'action',
        label: '',
        align: 'right',
    },
]

/** The injected `<tbody>` HTML — every interpolated value is escaped. The TLS
 *  cell is a native <select>; its bubbling `change` and the remove button's
 *  `click` are both caught by ONE delegated listener on the table host via
 *  their `data-action` attributes. */
function domainRowsHtml(rows: DomainRow[], busy: boolean): string {
    return rows
        .map((row) => {
            const domain = escapeHtml(row.domain)
            const options = TLS_OPTIONS.map(
                (o) => `<option value="${o.value}"${o.value === row.tls ? ' selected' : ''}>${o.label}</option>`,
            ).join('')
            const select =
                `<select class="form-select form-select-sm" data-action="tls" data-id="${domain}"` +
                ` aria-label="Subdomain HTTPS for ${domain}"${busy ? ' disabled' : ''}>` +
                options +
                `</select>`
            const remove = iconBtnHtml({
                icon: 'remove',
                label: `Remove ${row.domain}`,
                danger: true,
                disabled: busy,
                data: { action: 'remove', id: row.domain },
            })
            return (
                `<tr>` +
                `<td class="quaykeeper-admin-mono">${domain}</td>` +
                `<td>${select}</td>` +
                `<td class="text-end">${remove}</td>` +
                `</tr>`
            )
        })
        .join('')
}

export function AdminDomains() {
    const fetcher = useCallback(async (): Promise<BaseDomain[] | null> => {
        try {
            return await fetch('/api/admin/base-domains', { cache: 'no-store' }).then((r) => json<BaseDomain[]>(r))
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useOwnerData(fetcher)

    return (
        <AdminPage
            title="Domains"
            subtitle="The subdomain pool backing tenant sites, grouped by audience. Owner-only."
            icon="globe"
            iconColor="cyan"
            state={state}
            onRetry={() => void reload()}
        >
            {(baseDomains) => <BaseDomainsForm baseDomains={baseDomains} onChanged={() => void reload()} />}
        </AdminPage>
    )
}

/** Everything the add-domain form holds — one draft object; the modal resets by remount. */
interface DomainDraft {
    domain: string
    tier: BaseDomainTier
    tls: BaseDomainTls
}

const emptyDraft = (): DomainDraft => ({ domain: '', tier: 'free', tls: 'auto' })

function BaseDomainsForm({
    baseDomains,
    onChanged,
}: {
    baseDomains: BaseDomain[]
    onChanged: () => void
}) {
    // The add-domain form: null = closed; a draft = the modal is open (create-only —
    // TLS flips happen in place per row, removal via the confirm dialog).
    const [form, setForm] = useState<DomainDraft | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    // The domain awaiting remove confirmation (drives the ConfirmDialog).
    const [pending, setPending] = useState<string | null>(null)

    const patchDraft = (p: Partial<DomainDraft>) => setForm((prev) => (prev ? { ...prev, ...p } : prev))

    const openCreate = () => {
        setError(null)
        setForm(emptyDraft())
    }

    const close = useCallback(() => {
        setForm(null)
        setError(null)
    }, [])

    // Bucket the pool by tier for grouped display, in the canonical free→paid→staff
    // order. Each bucket is a stable (memoised) row set so each tier table's `rows`
    // HTML only regenerates when the pool actually changes.
    const byTier = useMemo(() => {
        const groups = new Map<BaseDomainTier, DomainRow[]>()
        for (const t of BASE_DOMAIN_TIERS) groups.set(t, [])
        for (const b of baseDomains) groups.get(b.tier)?.push({ domain: b.domain, tls: b.tls })
        return groups
    }, [baseDomains])

    const add = useCallback(async () => {
        if (!form || busy) return
        const domain = form.domain.trim()
        if (!domain) {
            setError('A base domain needs a domain name.')
            return
        }
        setBusy(true)
        setError(null)
        try {
            const res = await fetch('/api/admin/base-domains', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ domain, tier: form.tier, tls: form.tls }),
            })
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null
                setError(body?.error ? `Couldn’t add domain: ${body.error}.` : `Couldn’t add domain (error ${res.status}).`)
                return
            }
            setForm(null)
            onChanged()
        } catch {
            setError('Couldn’t add domain — network error.')
        } finally {
            setBusy(false)
        }
    }, [form, busy, onChanged])

    // Flip a base domain's subdomain TLS policy in place (PATCH). Applies to every
    // `<label>.<domain>` site under it on their next deploy (§0/Phase D).
    const setTls = useCallback(
        async (domain: string, tls: BaseDomainTls) => {
            setError(null)
            try {
                const res = await fetch('/api/admin/base-domains', {
                    method: 'PATCH',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ domain, tls }),
                })
                if (!res.ok) {
                    const body = (await res.json().catch(() => null)) as { error?: string } | null
                    setError(
                        body?.error ? `Couldn’t update TLS: ${body.error}.` : `Couldn’t update TLS (error ${res.status}).`,
                    )
                    return
                }
                onChanged()
            } catch {
                setError('Couldn’t update TLS — network error.')
            }
        },
        [onChanged],
    )

    const doRemove = useCallback(async () => {
        const domain = pending
        if (!domain || busy) return
        setPending(null)
        setBusy(true)
        setError(null)
        try {
            const res = await fetch(`/api/admin/base-domains?domain=${encodeURIComponent(domain)}`, {
                method: 'DELETE',
            })
            if (!res.ok && res.status !== 204) {
                setError(`Couldn’t remove ${domain} (error ${res.status}).`)
                return
            }
            onChanged()
        } catch {
            setError(`Couldn’t remove ${domain} — network error.`)
        } finally {
            setBusy(false)
        }
    }, [pending, busy, onChanged])

    // Row controls live in the injected tbody HTML — one delegated host listener
    // (shared by every tier table) routes their data-action events back to the
    // React handlers: the TLS select's `change` and the remove button's `click`.
    const onDelegated = useCallback(
        (event: Event) => {
            const el = (event.target as HTMLElement)?.closest?.('[data-action]') as HTMLElement | null
            if (!el) return
            const action = el.getAttribute('data-action')
            const domain = el.getAttribute('data-id')
            if (!action || !domain) return
            if (action === 'tls' && event.type === 'change') {
                void setTls(domain, (el as HTMLSelectElement).value as BaseDomainTls)
            } else if (action === 'remove' && event.type === 'click') {
                setPending(domain)
            }
        },
        [setTls],
    )

    return (
        <>
            <tc-section-card title="Base domains" icon="globe">
                <div className="quaykeeper-admin-section">
                    <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                        The subdomain pool. Each base domain backs <code>&lt;label&gt;.&lt;domain&gt;</code> sites and is
                        offered to one audience: free accounts or staff.
                    </p>
                    {error && !form && <tc-banner variant="danger">{error}</tc-banner>}

                    <div className="quaykeeper-list-actions">
                        <tc-button variant="primary" size="sm" onClick={openCreate}>
                            Add domain
                        </tc-button>
                    </div>

                    {baseDomains.length === 0 ? (
                        <tc-empty-state icon="globe">No base domains registered.</tc-empty-state>
                    ) : (
                        BASE_DOMAIN_TIERS.map((t) => {
                            const rows = byTier.get(t) ?? []
                            if (rows.length === 0) return null
                            return (
                                <div key={t} className="quaykeeper-admin-domain-group">
                                    <h4 className="quaykeeper-admin-domain-group-title">
                                        {TIER_META[t].label}
                                        <span className="quaykeeper-admin-hint"> — {TIER_META[t].note}</span>
                                    </h4>
                                    <DomainTierTable rows={rows} busy={busy} onDelegated={onDelegated} />
                                </div>
                            )
                        })
                    )}
                </div>
            </tc-section-card>

            {form && (
                <FormModal
                    key="new"
                    title="Add base domain"
                    busy={busy}
                    submitLabel="Add domain"
                    onSubmit={() => void add()}
                    onClose={close}
                >
                    {error && <tc-banner variant="danger">{error}</tc-banner>}
                    <FormGroup title="Identity">
                        <TextField
                            label="Domain"
                            placeholder="quaykeeper.dev"
                            help="Backs <label>.<domain> tenant sites."
                            value={form.domain}
                            onValue={(v) => patchDraft({ domain: v })}
                        />
                    </FormGroup>
                    <FormGroup title="Policy">
                        <div className="quaykeeper-form-grid">
                            <SelectField
                                label="Audience tier"
                                help={TIER_META[form.tier].note}
                                value={form.tier}
                                options={TIER_OPTIONS}
                                onValue={(v) => patchDraft({ tier: v as BaseDomainTier })}
                            />
                            <SelectField
                                label="Subdomain TLS"
                                help="auto serves HTTPS once the wildcard cert is issued; off keeps subdomains HTTP-only."
                                value={form.tls}
                                options={TLS_OPTIONS}
                                onValue={(v) => patchDraft({ tls: v as BaseDomainTls })}
                            />
                        </div>
                    </FormGroup>
                </FormModal>
            )}

            <ConfirmDialog
                open={!!pending}
                title="Remove base domain?"
                message={
                    pending
                        ? `Remove ${pending} from the pool. New sites can no longer be created under it. Existing <label>.${pending} sites keep serving until deleted.`
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

/** One tier's table — its own component so each tier gets its own `useTc` ref
 *  feeding the element-owned `rows` HTML string (relocation-safe — re-applied by
 *  the component on every internal re-render). */
function DomainTierTable({
    rows,
    busy,
    onDelegated,
}: {
    rows: DomainRow[]
    busy: boolean
    onDelegated: (event: Event) => void
}) {
    const tableProps = useMemo(
        () => ({
            columns: DOMAIN_COLUMNS,
            total: rows.length,
            limit: rows.length || 10,
            offset: 0,
            rows: domainRowsHtml(rows, busy),
        }),
        [rows, busy],
    )
    const tableRef = useTc<HTMLElement>(tableProps, { click: onDelegated, change: onDelegated })
    return <tc-advanced-table ref={tableRef} />
}
