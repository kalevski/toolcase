'use client'

// Admin-only multi-account management — list the Claude identities TaskForge can
// dispatch under, verify token health, remove them, and register new ones.
// Mirrors the other admin screens (UsersClient / HealthClient). Never shows a
// secret: apikey accounts reference an env-var *name* only; the value lives in
// the host environment and is resolved server-side at spawn time.

import React, { useMemo, useState } from 'react'
import { toast } from '@/lib/toast'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { escapeHtml, useTc, useTcEvents } from '@/lib/tc'
import { tcIcon } from '@/lib/icons'
import type { Account, AccountHealth, AccountSummary } from '@/server/domain/types'
import { useConfirm } from './ConfirmModal'
import { helpTexts } from './helpTexts'

type AuthMethod = 'oauth' | 'apikey'

// tc-advanced-table header descriptors. Body rows are fed through the `rows`
// HTML-string property (the component owns its <tbody>; React <tr> children
// would be relocated out from under the reconciler and break SSR hydration).
// The per-row Verify/Remove buttons are delegated data-action clicks.
const ADV_COLUMNS = [
    { key: 'account', label: 'Account' },
    { key: 'auth', label: 'Auth', width: '8rem' },
    { key: 'lastUsed', label: 'Last used', width: '12rem' },
    { key: 'state', label: 'State', width: '9rem' },
    { key: 'health', label: 'Health' },
    { key: 'actions', label: 'Actions', width: '14rem' },
]

// Live verify state per alias — absent = never run this session, 'pending' =
// in-flight, otherwise the last AccountHealth outcome.
type VerifyState = AccountHealth | 'pending'

/** The injected tbody HTML — every interpolated value is escaped. */
function accountRowsHtml(
    rows: AccountSummary[],
    verify: Record<string, VerifyState>,
    busy: Record<string, boolean>,
): string {
    return rows
        .map((a) => {
            const v = verify[a.alias]
            const account =
                `<strong>${escapeHtml(a.alias)}</strong>` +
                (a.label ? `<div style="font-size: 0.8rem; opacity: 0.7">${escapeHtml(a.label)}</div>` : '')
            const auth =
                `<tc-badge variant="secondary">${escapeHtml(a.auth)}</tc-badge>` +
                (a.auth === 'apikey' && a.apiKeyEnv
                    ? `<div style="margin-top: 0.25rem"><code>${escapeHtml(a.apiKeyEnv)}</code></div>`
                    : '')
            const lastUsed = a.lastUsedAt
                ? `<tc-text variant="muted">${escapeHtml(new Date(a.lastUsedAt).toLocaleString())}</tc-text>`
                : '<span style="opacity: 0.4">never</span>'
            const state = a.cooling
                ? `<tc-badge variant="warning">cooling${a.coolingUntil ? escapeHtml(` · ${new Date(a.coolingUntil).toLocaleTimeString()}`) : ''}</tc-badge>`
                : '<tc-stack inline direction="horizontal" gap="0.4rem" align="center"><tc-status-dot status="online"></tc-status-dot>ready</tc-stack>'
            let health: string
            if (v === 'pending') health = '<tc-text variant="muted">checking…</tc-text>'
            else if (v)
                health =
                    `<tc-stack inline direction="horizontal" gap="0.4rem" align="center">` +
                    `<tc-status-dot status="${v.ok ? 'online' : 'offline'}"></tc-status-dot>` +
                    `<tc-text${v.ok ? '' : ' variant="muted"'}>${escapeHtml(v.detail)}</tc-text></tc-stack>`
            else if (a.lastUsedAt)
                health = `<tc-text variant="muted">last good ${escapeHtml(new Date(a.lastUsedAt).toLocaleDateString())}</tc-text>`
            else health = '<tc-text variant="muted">unverified</tc-text>'
            const pending = v === 'pending'
            const rowBusy = !!busy[a.alias]
            const actions =
                `<span style="display: inline-flex; gap: 0.4rem">` +
                `<tc-button size="sm" variant="secondary" outline${pending ? ' loading disabled' : rowBusy ? ' disabled' : ''} data-action="verify" data-alias="${escapeHtml(a.alias)}">Verify</tc-button>` +
                `<tc-button size="sm" variant="danger" outline${rowBusy ? ' disabled' : ''} data-action="remove" data-alias="${escapeHtml(a.alias)}">Remove</tc-button>` +
                `</span>`
            return `<tr><td>${account}</td><td>${auth}</td><td>${lastUsed}</td><td>${state}</td><td>${health}</td><td>${actions}</td></tr>`
        })
        .join('')
}

function summaryOf(account: Account): AccountSummary {
    return {
        alias: account.alias,
        dir: account.dir,
        auth: account.auth,
        label: account.label,
        apiKeyEnv: account.apiKeyEnv,
        lastUsedAt: account.lastUsedAt,
        coolingUntil: account.coolingUntil,
        cooling: false,
    }
}

export function AccountsClient({ accounts }: { accounts: AccountSummary[] }) {
    const confirm = useConfirm()
    const [rows, setRows] = useState(accounts)
    const [verify, setVerify] = useState<Record<string, VerifyState>>({})
    const [busy, setBusy] = useState<Record<string, boolean>>({})

    const runVerify = async (alias: string) => {
        setVerify((v) => ({ ...v, [alias]: 'pending' }))
        try {
            // Spawns a one-shot claude run on the host — no client deadline.
            const health = await apiFetch<AccountHealth>(`/api/accounts/${alias}/verify`, {
                method: 'POST',
                timeoutMs: 0,
            })
            setVerify((v) => ({ ...v, [alias]: health }))
            if (health.ok) {
                // A passing verify stamps lastUsedAt server-side — reflect it.
                setRows((rs) => rs.map((r) => (r.alias === alias ? { ...r, lastUsedAt: new Date().toISOString() } : r)))
                toast.success(`${alias} verified`)
            } else {
                toast.error(`${alias}: ${health.detail}`)
            }
        } catch (e) {
            const detail = describeApiError(e)
            setVerify((v) => ({ ...v, [alias]: { ok: false, detail } }))
            toast.error(detail)
        }
    }

    const remove = async (alias: string) => {
        const ok = await confirm({
            title: `Remove account "${alias}"?`,
            body: 'Deletes the registry row and its isolated config dir on the host. This cannot be undone.',
            confirmLabel: 'Remove',
            confirmVariant: 'danger',
        })
        if (!ok) return
        setBusy((b) => ({ ...b, [alias]: true }))
        try {
            await apiFetch(`/api/accounts/${alias}`, { method: 'DELETE' })
            setRows((rs) => rs.filter((r) => r.alias !== alias))
            setVerify((v) => {
                const next = { ...v }
                delete next[alias]
                return next
            })
            toast.success(`Removed ${alias}`)
        } catch (e) {
            toast.error(describeApiError(e))
        } finally {
            setBusy((b) => ({ ...b, [alias]: false }))
        }
    }

    const onCreated = (account: Account) => {
        setRows((rs) => [...rs, summaryOf(account)].sort((a, b) => a.alias.localeCompare(b.alias)))
    }

    // Row-action buttons live in the injected tbody HTML — one delegated click
    // listener routes their data-action back to the React handlers.
    const onDelegated = (event: Event) => {
        const el = (event.target as HTMLElement)?.closest?.('[data-action]') as HTMLElement | null
        if (!el) return
        const alias = el.getAttribute('data-alias')
        if (!alias) return
        const action = el.getAttribute('data-action')
        if (action === 'verify') void runVerify(alias)
        else if (action === 'remove') void remove(alias)
    }

    const tableProps = useMemo(
        () => ({ columns: ADV_COLUMNS, rows: accountRowsHtml(rows, verify, busy) }),
        [rows, verify, busy],
    )
    const tableRef = useTc<HTMLElement>(tableProps, { click: onDelegated })

    return (
        <div className="taskforge-page">
            <tc-rich-page-header
                title-text="Accounts"
                icon-name="Key"
                icon-color="cyan"
                description={helpTexts.accounts.intro}
            />

            <AddAccountForm existing={rows.map((r) => r.alias)} onCreated={onCreated} />

            {rows.length === 0 ? (
                <tc-empty-state icon={tcIcon('key')}>
                    <h3>No accounts yet</h3>
                    <p>Register a Claude identity above to let TaskForge dispatch under it.</p>
                </tc-empty-state>
            ) : (
                <tc-advanced-table ref={tableRef} />
            )}
        </div>
    )
}

const AUTH_OPTIONS: { value: AuthMethod; label: string }[] = [
    { value: 'oauth', label: 'oauth (claude /login)' },
    { value: 'apikey', label: 'apikey (env var)' },
]

function AddAccountForm({ existing, onCreated }: { existing: string[]; onCreated: (a: Account) => void }) {
    const [alias, setAlias] = useState('')
    const [label, setLabel] = useState('')
    const [auth, setAuth] = useState<AuthMethod>('oauth')
    const [apiKeyEnv, setApiKeyEnv] = useState('')
    const [submitting, setSubmitting] = useState(false)
    // Host-side next-step instruction returned for a new oauth account.
    const [guidance, setGuidance] = useState<string | null>(null)

    const aliasRef = useTcEvents<HTMLElement>({ input: (e) => setAlias((e.target as HTMLInputElement).value) })
    const labelRef = useTcEvents<HTMLElement>({ input: (e) => setLabel((e.target as HTMLInputElement).value) })
    const authRef = useTcEvents<HTMLElement>({ change: (e) => setAuth((e.target as HTMLSelectElement).value as AuthMethod) })
    const envRef = useTcEvents<HTMLElement>({ input: (e) => setApiKeyEnv((e.target as HTMLInputElement).value) })

    const trimmedAlias = alias.trim()
    const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedAlias)
    const duplicate = existing.includes(trimmedAlias)
    const needsEnv = auth === 'apikey' && apiKeyEnv.trim() === ''
    const valid = kebab && !duplicate && !needsEnv

    const submit = async () => {
        if (!valid) return
        setSubmitting(true)
        try {
            const data = await apiFetch<{ account: Account; guidance?: string }>('/api/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    alias: trimmedAlias,
                    auth,
                    label: label.trim() || undefined,
                    apiKeyEnv: auth === 'apikey' ? apiKeyEnv.trim() : undefined,
                }),
            })
            onCreated(data.account)
            toast.success(`Added ${trimmedAlias}`)
            setGuidance(data.guidance ?? null)
            // Reset for the next entry; keep the chosen auth method.
            setAlias('')
            setLabel('')
            setApiKeyEnv('')
        } catch (e) {
            toast.error(describeApiError(e))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <tc-card>
            <tc-heading slot="header" as="h3">
                Add account
            </tc-heading>
            <tc-stack gap="0.75rem" style={{ padding: '1rem' }}>
                <tc-stack direction="horizontal" gap="1rem" wrap align="flex-end">
                    <tc-input
                        ref={aliasRef}
                        label="Alias"
                        placeholder="team-bot"
                        value={alias}
                        disabled={submitting || undefined}
                    />
                    <tc-input
                        ref={labelRef}
                        label="Label (optional)"
                        placeholder="Team subscription"
                        value={label}
                        disabled={submitting || undefined}
                    />
                    <div style={{ minWidth: 220 }}>
                        <tc-select ref={authRef} label="Auth method" value={auth} disabled={submitting || undefined}>
                            {AUTH_OPTIONS.map((o) => (
                                <tc-option key={o.value} value={o.value}>
                                    {o.label}
                                </tc-option>
                            ))}
                        </tc-select>
                    </div>
                    {auth === 'apikey' && (
                        <tc-input
                            ref={envRef}
                            label="API key env var"
                            placeholder="ANTHROPIC_API_KEY_TEAM"
                            value={apiKeyEnv}
                            disabled={submitting || undefined}
                        />
                    )}
                </tc-stack>

                {trimmedAlias !== '' && !kebab && (
                    <tc-text variant="muted">Alias must be kebab-case — lowercase letters, digits, single dashes.</tc-text>
                )}
                {duplicate && <tc-text variant="muted">An account with that alias already exists.</tc-text>}

                <tc-stack direction="horizontal" gap="0.75rem" wrap align="center">
                    <tc-button
                        variant="primary"
                        loading={submitting || undefined}
                        disabled={submitting || !valid || undefined}
                        onClick={() => void submit()}
                    >
                        Add account
                    </tc-button>
                </tc-stack>

                {guidance && (
                    <tc-banner variant="info">
                        <strong>Finish authorization on the host.</strong> {guidance}
                    </tc-banner>
                )}
            </tc-stack>
        </tc-card>
    )
}
