'use client'

import { useCallback, useMemo, useState } from 'react'
import type { AdvancedTableColumn } from '@toolcase/web-components'
import { iconBtnHtml } from '@/lib/action-icons'
import { escapeHtml, useTc } from '@/lib/tc'
import { type BaseDomain, type BaseDomainTls } from '@/server/domain/types'
import { AdminPage, json, useOwnerData } from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormModal, FormGroup } from '@/components/FormModal'
import { SelectField, TextField } from '@/components/fields'

// Owner-only subdomain pool (§10/§13). The owner registers base domains, each one
// backing `<label>.<domain>` sites. Every base domain is offered to every user —
// there is no audience tier. The pool is per-realm (multiple_realms.md §E.2), so
// this page carries the active-realm selector. Add via POST, remove via DELETE;
// both append to the audit log server-side.

// Subdomain TLS policy (§0/Phase D) — one wildcard cert per base domain; `auto`
// degrades to HTTP if the cert isn't issued yet. Set at add time and per row —
// always per base domain, never per subdomain.
const TLS_OPTIONS: { value: BaseDomainTls; label: string }[] = [
    { value: 'auto', label: 'HTTPS (auto)' },
    { value: 'off', label: 'HTTP only' },
]

// Wildcard-wide HTTP/2 policy. Per base domain, never per subdomain: one wildcard
// cert lets a browser coalesce sibling labels onto a single TLS connection, and
// vhosts that disagree on HTTP/2 make nginx answer 421. Inert while TLS is off.
const HTTP2_OPTIONS: { value: string; label: string }[] = [
    { value: 'on', label: 'HTTP/2 on' },
    { value: 'off', label: 'HTTP/1.1 only' },
]

// Wildcard-wide HSTS policy. Per base domain for the same cert-scoped reason as
// HTTP/2, plus a stronger one: `includeSubDomains` is declared by one host but binds
// the browser for the whole registrable domain. Off by default, and turning it ON
// asks for confirmation first — see `pendingHsts` below.
const HSTS_OPTIONS: { value: string; label: string }[] = [
    { value: 'off', label: 'HSTS off' },
    { value: 'on', label: 'HSTS on' },
]

interface DomainRow {
    domain: string
    tls: BaseDomainTls
    http2: boolean
    hsts: boolean
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
        key: 'http2',
        label: 'HTTP/2',
        width: '12rem',
    },
    {
        key: 'hsts',
        label: 'HSTS',
        width: '10rem',
    },
    {
        key: 'action',
        label: '',
        align: 'right',
    },
]

/** The injected `<tbody>` HTML — every interpolated value is escaped. The TLS,
 *  HTTP/2 and HSTS cells are native <select>s; their bubbling `change` and the remove
 *  button's `click` are all caught by ONE delegated listener on the table host via
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
            // HTTP/2 requires TLS (nginxpilot rejects the combination outright), so the
            // control is disabled — not just ignored — while this base domain is HTTP-only.
            const http2Disabled = busy || row.tls === 'off'
            const http2Options = HTTP2_OPTIONS.map(
                (o) =>
                    `<option value="${o.value}"${o.value === (row.http2 ? 'on' : 'off') ? ' selected' : ''}>${o.label}</option>`,
            ).join('')
            const http2Select =
                `<select class="form-select form-select-sm" data-action="http2" data-id="${domain}"` +
                ` aria-label="HTTP/2 for ${domain}"${http2Disabled ? ' disabled' : ''}>` +
                http2Options +
                `</select>`
            // HSTS also requires TLS, so it follows the same disabled rule as HTTP/2.
            const hstsOptions = HSTS_OPTIONS.map(
                (o) =>
                    `<option value="${o.value}"${o.value === (row.hsts ? 'on' : 'off') ? ' selected' : ''}>${o.label}</option>`,
            ).join('')
            const hstsSelect =
                `<select class="form-select form-select-sm" data-action="hsts" data-id="${domain}"` +
                ` aria-label="HSTS for ${domain}"${http2Disabled ? ' disabled' : ''}>` +
                hstsOptions +
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
                `<td>${http2Select}</td>` +
                `<td>${hstsSelect}</td>` +
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
            subtitle="The subdomain pool backing tenant sites, on the active NGINX server. Owner-only."
            icon="globe"
            iconColor="cyan"
            state={state}
            onRetry={() => void reload()}
            realmScoped
        >
            {(baseDomains) => <BaseDomainsForm baseDomains={baseDomains} onChanged={() => void reload()} />}
        </AdminPage>
    )
}

/** Everything the add-domain form holds — one draft object; the modal resets by remount. */
interface DomainDraft {
    domain: string
    tls: BaseDomainTls
    http2: boolean
    hsts: boolean
}

// HSTS starts off: it is the one policy here a browser remembers on its own, so it
// has to be chosen, never inherited from a default.
const emptyDraft = (): DomainDraft => ({ domain: '', tls: 'auto', http2: true, hsts: false })

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
    // The domain awaiting HSTS *enable* confirmation. Turning HSTS on is effectively
    // one-way — browsers that have seen the header refuse plain HTTP to the domain for
    // max_age (two years by default) whatever this page says afterwards — so the switch
    // gets its own confirm step. Turning it OFF is unguarded; it is the safe direction.
    const [pendingHsts, setPendingHsts] = useState<string | null>(null)

    const patchDraft = (p: Partial<DomainDraft>) => setForm((prev) => (prev ? { ...prev, ...p } : prev))

    const openCreate = () => {
        setError(null)
        setForm(emptyDraft())
    }

    const close = useCallback(() => {
        setForm(null)
        setError(null)
    }, [])

    // The flat pool as table rows — a stable (memoised) set so the injected `rows`
    // HTML only regenerates when the pool actually changes.
    const rows = useMemo<DomainRow[]>(
        () => baseDomains.map((b) => ({ domain: b.domain, tls: b.tls, http2: b.http2, hsts: b.hsts })),
        [baseDomains],
    )

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
                body: JSON.stringify({ domain, tls: form.tls, http2: form.http2, hsts: form.hsts }),
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

    // Flip a base domain's wildcard-wide HTTP/2 policy in place (PATCH). Applies to
    // every `<label>.<domain>` site under it on their next deploy — moving them
    // together is the point, since mismatched siblings under one wildcard cert are
    // what produce 421s on coalesced connections.
    const setHttp2 = useCallback(
        async (domain: string, http2: boolean) => {
            setError(null)
            try {
                const res = await fetch('/api/admin/base-domains', {
                    method: 'PATCH',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ domain, http2 }),
                })
                if (!res.ok) {
                    const body = (await res.json().catch(() => null)) as { error?: string } | null
                    setError(
                        body?.error
                            ? `Couldn’t update HTTP/2: ${body.error}.`
                            : `Couldn’t update HTTP/2 (error ${res.status}).`,
                    )
                    return
                }
                onChanged()
            } catch {
                setError('Couldn’t update HTTP/2 — network error.')
            }
        },
        [onChanged],
    )

    // Flip a base domain's wildcard-wide HSTS policy in place (PATCH). Enabling is
    // routed through `pendingHsts` first; this is the part that actually writes.
    const setHsts = useCallback(
        async (domain: string, hsts: boolean) => {
            setError(null)
            try {
                const res = await fetch('/api/admin/base-domains', {
                    method: 'PATCH',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ domain, hsts }),
                })
                if (!res.ok) {
                    const body = (await res.json().catch(() => null)) as { error?: string } | null
                    setError(
                        body?.error
                            ? `Couldn’t update HSTS: ${body.error}.`
                            : `Couldn’t update HSTS (error ${res.status}).`,
                    )
                }
            } catch {
                setError('Couldn’t update HSTS — network error.')
            } finally {
                // Reload either way: on failure this snaps the select back to the stored
                // value rather than leaving it showing a change that never landed.
                onChanged()
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
    // routes their data-action events back to the React handlers: the TLS select's
    // `change` and the remove button's `click`.
    const onDelegated = useCallback(
        (event: Event) => {
            const el = (event.target as HTMLElement)?.closest?.('[data-action]') as HTMLElement | null
            if (!el) return
            const action = el.getAttribute('data-action')
            const domain = el.getAttribute('data-id')
            if (!action || !domain) return
            if (action === 'tls' && event.type === 'change') {
                void setTls(domain, (el as HTMLSelectElement).value as BaseDomainTls)
            } else if (action === 'http2' && event.type === 'change') {
                void setHttp2(domain, (el as HTMLSelectElement).value === 'on')
            } else if (action === 'hsts' && event.type === 'change') {
                if ((el as HTMLSelectElement).value === 'on') setPendingHsts(domain)
                else void setHsts(domain, false)
            } else if (action === 'remove' && event.type === 'click') {
                setPending(domain)
            }
        },
        [setTls, setHttp2, setHsts],
    )

    return (
        <>
            <tc-section-card title="Base domains" icon="globe">
                <div className="quaykeeper-admin-section">
                    <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                        The subdomain pool. Each base domain backs <code>&lt;label&gt;.&lt;domain&gt;</code> sites and is
                        available to every user.
                    </p>
                    {error && !form && <tc-banner variant="error">{error}</tc-banner>}

                    <div className="quaykeeper-list-actions">
                        <tc-button variant="primary" size="sm" onClick={openCreate}>
                            Add domain
                        </tc-button>
                    </div>

                    {baseDomains.length === 0 ? (
                        <tc-empty-state icon="globe">No base domains registered.</tc-empty-state>
                    ) : (
                        <DomainTable rows={rows} busy={busy} onDelegated={onDelegated} />
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
                    {error && <tc-banner variant="error">{error}</tc-banner>}
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
                        <SelectField
                            label="Subdomain TLS"
                            help="auto serves HTTPS once the wildcard cert is issued; off keeps subdomains HTTP-only."
                            value={form.tls}
                            options={TLS_OPTIONS}
                            onValue={(v) => patchDraft({ tls: v as BaseDomainTls })}
                        />
                        <SelectField
                            label="HTTP/2"
                            help="Applies to every subdomain under this base. Keep it uniform — siblings sharing the wildcard cert that disagree on HTTP/2 can return 421. Needs TLS."
                            value={form.http2 ? 'on' : 'off'}
                            options={HTTP2_OPTIONS}
                            onValue={(v) => patchDraft({ http2: v === 'on' })}
                        />
                        <SelectField
                            label="HSTS"
                            help="Tells browsers to reach every subdomain over HTTPS only. Sticky: once sent, a browser keeps refusing plain HTTP for two years even if you turn this back off. Needs TLS."
                            value={form.hsts ? 'on' : 'off'}
                            options={HSTS_OPTIONS}
                            onValue={(v) => patchDraft({ hsts: v === 'on' })}
                        />
                    </FormGroup>
                </FormModal>
            )}

            <ConfirmDialog
                open={!!pendingHsts}
                title="Turn on HSTS?"
                message={
                    pendingHsts
                        ? `Every subdomain under ${pendingHsts} will send Strict-Transport-Security on its next deploy. Browsers that see it refuse plain HTTP to the domain for two years — turning this back off later does not undo that for anyone who has already visited. Only enable it once HTTPS is working everywhere under this base.`
                        : undefined
                }
                confirmLabel="Turn on HSTS"
                danger
                onConfirm={() => {
                    const domain = pendingHsts
                    setPendingHsts(null)
                    if (domain) void setHsts(domain, true)
                }}
                onCancel={() => {
                    setPendingHsts(null)
                    // Snap the select back — the user picked "on" and then backed out.
                    onChanged()
                }}
            />

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

/** The pool table — its own component so it gets its own `useTc` ref feeding the
 *  element-owned `rows` HTML string (relocation-safe — re-applied by the component
 *  on every internal re-render). */
function DomainTable({
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
