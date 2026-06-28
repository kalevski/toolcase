'use client'

import { useCallback, useMemo, useState } from 'react'
import type { ExtendedSelectItem } from '@toolcase/web-components'
import { useTc, detailValue, targetValue } from '@/lib/tc'
import { BASE_DOMAIN_TIERS, type BaseDomain, type BaseDomainTier, type BaseDomainTls } from '@/server/domain/types'
import { AdminPage, json, useOwnerData } from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { SelectField, type SelectOption } from '@/components/fields'

// Owner-only subdomain pool (§10/§13). The owner registers base domains, each one
// backing `<label>.<domain>` sites, and assigns each to one of three audience
// tiers: `free` (every account), `paid` (sponsored accounts), `staff` (maintainers
// & owner). The standard `/api/base-domains` projection the wizard reads is filtered
// by the caller's tier; this owner surface shows the whole pool grouped by tier.
// Add via POST, remove via DELETE; both append to the audit log server-side.

/** Human labels + a one-line note for each tier, shown in the selector and group headers. */
const TIER_META: Record<BaseDomainTier, { label: string; note: string }> = {
    free: { label: 'Free', note: 'Visible to every account, including free plans.' },
    paid: { label: 'Paid (sponsors)', note: 'Visible to sponsored (paid-plan) accounts and staff.' },
    staff: { label: 'Staff', note: 'Visible only to maintainers and the owner.' },
}

const TIER_ITEMS: ExtendedSelectItem[] = BASE_DOMAIN_TIERS.map((t) => ({ key: t, label: TIER_META[t].label }))

// Subdomain TLS policy (§0/Phase D) — one wildcard cert per base domain; `auto`
// degrades to HTTP if the cert isn't issued yet. This per-base-domain select is the
// only place subdomain TLS is set (never per subdomain).
const TLS_OPTIONS: SelectOption[] = [
    { value: 'auto', label: 'HTTPS (auto)' },
    { value: 'off', label: 'HTTP only' },
]

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

function BaseDomainsForm({
    baseDomains,
    onChanged,
}: {
    baseDomains: BaseDomain[]
    onChanged: () => void
}) {
    const [draft, setDraft] = useState('')
    const [tier, setTier] = useState<BaseDomainTier>('free')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    // The domain awaiting remove confirmation (drives the ConfirmDialog).
    const [pending, setPending] = useState<string | null>(null)

    const inputRef = useTc<HTMLElement>(undefined, {
        input: (event: Event) => setDraft(targetValue(event)),
    })
    const tierRef = useTc<HTMLElement>(
        useMemo(() => ({ items: TIER_ITEMS, value: tier }), [tier]),
        { 'tc-change': (event: Event) => setTier(detailValue<BaseDomainTier>(event)) },
    )

    // Bucket the pool by tier for grouped display, in the canonical free→paid→staff order.
    const byTier = useMemo(() => {
        const groups = new Map<BaseDomainTier, BaseDomain[]>()
        for (const t of BASE_DOMAIN_TIERS) groups.set(t, [])
        for (const b of baseDomains) groups.get(b.tier)?.push(b)
        return groups
    }, [baseDomains])

    const add = useCallback(async () => {
        const domain = draft.trim()
        if (!domain || busy) return
        setBusy(true)
        setError(null)
        try {
            const res = await fetch('/api/admin/base-domains', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ domain, tier }),
            })
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null
                setError(body?.error ? `Couldn’t add domain: ${body.error}.` : `Couldn’t add domain (error ${res.status}).`)
                return
            }
            setDraft('')
            if (inputRef.current) (inputRef.current as any).value = ''
            onChanged()
        } catch {
            setError('Couldn’t add domain — network error.')
        } finally {
            setBusy(false)
        }
    }, [draft, tier, busy, onChanged, inputRef])

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

    return (
        <tc-section-card title="Base domains" icon="globe">
            <div className="perch-admin-section">
                <p className="perch-home-lead perch-admin-hint">
                    The subdomain pool. Each base domain backs <code>&lt;label&gt;.&lt;domain&gt;</code> sites and is
                    offered to one audience: free accounts, paid (sponsor) accounts, or staff.
                </p>
                {error && <tc-banner variant="danger">{error}</tc-banner>}

                {baseDomains.length === 0 ? (
                    <tc-empty-state icon="globe">No base domains registered.</tc-empty-state>
                ) : (
                    BASE_DOMAIN_TIERS.map((t) => {
                        const rows = byTier.get(t) ?? []
                        if (rows.length === 0) return null
                        return (
                            <div key={t} className="perch-admin-domain-group">
                                <h4 className="perch-admin-domain-group-title">
                                    {TIER_META[t].label}
                                    <span className="perch-admin-hint"> — {TIER_META[t].note}</span>
                                </h4>
                                <ul className="perch-admin-list">
                                    {rows.map((b) => (
                                        <li key={b.domain} className="perch-admin-list-row">
                                            <span className="perch-admin-mono">{b.domain}</span>
                                            <span className="perch-admin-domain-controls">
                                                <SelectField
                                                    size="sm"
                                                    ariaLabel={`Subdomain HTTPS for ${b.domain}`}
                                                    value={b.tls}
                                                    options={TLS_OPTIONS}
                                                    onValue={(v) => void setTls(b.domain, v as BaseDomainTls)}
                                                />
                                                <tc-button
                                                    variant="danger"
                                                    size="sm"
                                                    outline
                                                    disabled={busy || undefined}
                                                    onClick={() => setPending(b.domain)}
                                                >
                                                    Remove
                                                </tc-button>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )
                    })
                )}

                <form
                    className="perch-admin-add-row"
                    onSubmit={(e) => {
                        e.preventDefault()
                        void add()
                    }}
                >
                    <tc-input
                        ref={inputRef}
                        placeholder="perch.dev"
                        aria-label="New base domain"
                        autocomplete="off"
                    />
                    <tc-extended-select ref={tierRef} aria-label="Audience tier" placeholder="Tier…" />
                    <tc-button type="submit" variant="primary" disabled={!draft.trim() || busy || undefined}>
                        Add domain
                    </tc-button>
                </form>
            </div>
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
        </tc-section-card>
    )
}
