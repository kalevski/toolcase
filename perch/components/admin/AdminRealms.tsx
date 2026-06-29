'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TableColumn } from '@toolcase/web-components'
import { escapeHtml } from '@/lib/tc'
import type { Realm } from '@/server/domain/types'
import { AdminPage, json, useOwnerData } from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable } from '@/components/DataTable'
import { TextField } from '@/components/fields'
import { useToast } from '@/components/Toast'

// Owner-only realm registry (multiple_realms.md §C). A realm is one registered nginxpilot
// instance the control plane drives. The owner adds them (name + admin URL + optional
// bearer token), marks one default, rotates a token, runs a live health check, and removes
// an empty one. The token is WRITE-ONLY: rows show "token set", never the value. Add via
// POST, mutate via PATCH ({ name } | { token } | { default: true }), remove via DELETE —
// all audited server-side. Backs the owner realm switcher (Phase E).

interface RealmTest {
    ok: boolean
    healthz: boolean
    managed: boolean
    error?: string
}

// ── tc-table model (P1/P3) ─────────────────────────────────────────────────────
// One row per realm. The identity cell (health dot + name + mono URL + badges) and
// the action cell (Test / Set default / Rotate / Remove) are rendered as HTML
// strings; the write-only token-rotate editor stays a React panel BELOW the table
// (keyed off `rotating`), so no React subtree is captured into a table cell.

type RealmTestState = RealmTest | 'loading' | undefined

interface RealmRow extends Record<string, unknown> {
    realm: Realm
    test: RealmTestState
}

/** Health-dot class + title: green = ok, amber = reachable-but-status-failed,
 *  red = unreachable, grey = unknown/loading. */
function healthDotMeta(test: RealmTestState): { cls: string; title: string } {
    if (test === 'loading') return { cls: 'perch-realm-dot--unknown', title: 'Checking…' }
    if (test) {
        if (test.ok)
            return {
                cls: 'perch-realm-dot--ok',
                title: test.managed ? 'Healthy (managed mode)' : 'Healthy',
            }
        if (test.healthz)
            return {
                cls: 'perch-realm-dot--warn',
                title: `Reachable but ${test.error ?? 'status failed'}`,
            }
        return { cls: 'perch-realm-dot--down', title: test.error ?? 'Unreachable' }
    }
    return { cls: 'perch-realm-dot--unknown', title: 'Health unknown' }
}

function badge(variant: string, text: string): string {
    return `<span class="badge text-bg-${variant}">${escapeHtml(text)}</span>`
}

function realmIdentityHtml(row: RealmRow): string {
    const { realm: r, test } = row
    const { cls, title } = healthDotMeta(test)
    const badges: string[] = []
    if (r.isDefault) badges.push(badge('primary', 'default'))
    badges.push(badge(r.hasToken ? 'light' : 'secondary', r.hasToken ? 'token set' : 'no token'))
    if (test && test !== 'loading' && test.managed) badges.push(badge('info', 'managed'))
    if (test && test !== 'loading' && !test.ok) badges.push(badge('danger', test.error ?? 'unreachable'))
    return (
        `<span class="perch-admin-realm-id">` +
        `<span class="perch-realm-dot ${cls}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"></span>` +
        `<span class="perch-admin-realm-name">${escapeHtml(r.name)}</span>` +
        `<span class="perch-admin-mono perch-admin-hint">${escapeHtml(r.adminUrl)}</span>` +
        `<span class="perch-admin-badges">${badges.join('')}</span>` +
        `</span>`
    )
}

function realmActionsHtml(row: RealmRow, busy: boolean, rotatingId: string | null): string {
    const { realm: r } = row
    const id = escapeHtml(r.id)
    const btn = (action: string, label: string, danger = false) =>
        `<button type="button" class="btn btn-sm btn-outline-${danger ? 'danger' : 'secondary'}" ` +
        `data-action="${action}" data-id="${id}"${busy && danger ? ' disabled' : ''}>${escapeHtml(label)}</button>`
    const parts = [btn('test', 'Test')]
    if (!r.isDefault) parts.push(btn('default', 'Set default'))
    parts.push(btn('rotate', rotatingId === r.id ? 'Close' : 'Rotate token'))
    parts.push(btn('remove', 'Remove', true))
    return `<span class="perch-admin-domain-controls">${parts.join('')}</span>`
}

const REALM_COLUMNS = (busy: boolean, rotatingId: string | null): TableColumn[] => [
    { key: 'identity', header: 'Realm', render: (row: RealmRow) => realmIdentityHtml(row) },
    {
        key: 'actions',
        header: '',
        align: 'right',
        render: (row: RealmRow) => realmActionsHtml(row, busy, rotatingId),
    },
]

export function AdminRealms() {
    const fetcher = useCallback(async (): Promise<Realm[] | null> => {
        try {
            return await fetch('/api/admin/realms', { cache: 'no-store' }).then((r) =>
                json<Realm[]>(r),
            )
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useOwnerData(fetcher)

    return (
        <AdminPage
            title="Realms"
            subtitle="The nginxpilot instances this control plane drives. Add, set a default, rotate credentials, and check health. Owner-only."
            icon="server"
            iconColor="amber"
            state={state}
            onRetry={() => void reload()}
        >
            {(realms) => <RealmsForm realms={realms} onChanged={() => void reload()} />}
        </AdminPage>
    )
}

function RealmsForm({ realms, onChanged }: { realms: Realm[]; onChanged: () => void }) {
    const toast = useToast()
    const [name, setName] = useState('')
    const [adminUrl, setAdminUrl] = useState('')
    const [token, setToken] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    // The realm awaiting remove confirmation, and the realm whose token is being rotated.
    const [pending, setPending] = useState<Realm | null>(null)
    const [rotating, setRotating] = useState<string | null>(null)
    // Live health results, keyed by realm id (lazily filled by the test effect / button).
    const [tests, setTests] = useState<Record<string, RealmTest | 'loading'>>({})

    const runTest = useCallback(async (id: string) => {
        setTests((t) => ({ ...t, [id]: 'loading' }))
        try {
            const res = await fetch(`/api/admin/realms/${encodeURIComponent(id)}/test`, {
                method: 'POST',
            })
            const body = (await res.json().catch(() => null)) as RealmTest | null
            setTests((t) => ({
                ...t,
                [id]: body ?? { ok: false, healthz: false, managed: false, error: 'error' },
            }))
        } catch {
            setTests((t) => ({
                ...t,
                [id]: { ok: false, healthz: false, managed: false, error: 'network' },
            }))
        }
    }, [])

    // Auto health-check every realm once on mount / when the set changes.
    useEffect(() => {
        for (const r of realms) void runTest(r.id)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [realms.map((r) => r.id).join(','), runTest])

    const add = useCallback(async () => {
        const n = name.trim()
        const u = adminUrl.trim()
        if (!n || !u || busy) return
        setBusy(true)
        setError(null)
        try {
            const res = await fetch('/api/admin/realms', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: n, adminUrl: u, token: token.trim() }),
            })
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null
                setError(
                    body?.error
                        ? `Couldn’t add realm: ${body.error}.`
                        : `Couldn’t add realm (error ${res.status}).`,
                )
                return
            }
            setName('')
            setAdminUrl('')
            setToken('')
            toast.show(`Realm “${n}” registered.`, { variant: 'success' })
            onChanged()
        } catch {
            setError('Couldn’t add realm — network error.')
        } finally {
            setBusy(false)
        }
    }, [name, adminUrl, token, busy, onChanged, toast])

    const patch = useCallback(
        async (realm: Realm, body: Record<string, unknown>, okMsg: string) => {
            setError(null)
            try {
                const res = await fetch(`/api/admin/realms/${encodeURIComponent(realm.id)}`, {
                    method: 'PATCH',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(body),
                })
                if (!res.ok) {
                    const b = (await res.json().catch(() => null)) as { error?: string } | null
                    setError(
                        b?.error
                            ? `Couldn’t update ${realm.name}: ${b.error}.`
                            : `Couldn’t update ${realm.name} (error ${res.status}).`,
                    )
                    return false
                }
                toast.show(okMsg, { variant: 'success' })
                onChanged()
                return true
            } catch {
                setError(`Couldn’t update ${realm.name} — network error.`)
                return false
            }
        },
        [onChanged, toast],
    )

    const doRemove = useCallback(async () => {
        const realm = pending
        if (!realm || busy) return
        setPending(null)
        setBusy(true)
        setError(null)
        try {
            const res = await fetch(`/api/admin/realms/${encodeURIComponent(realm.id)}`, {
                method: 'DELETE',
            })
            if (!res.ok && res.status !== 204) {
                const b = (await res.json().catch(() => null)) as { error?: string } | null
                setError(
                    b?.error === 'realm_has_sites' || b?.error === 'realm_has_base_domains'
                        ? `Can’t remove ${realm.name} — it still has sites or base domains.`
                        : b?.error === 'realm_is_default'
                          ? `Set another realm as default before removing ${realm.name}.`
                          : `Couldn’t remove ${realm.name} (error ${res.status}).`,
                )
                return
            }
            toast.show(`Realm “${realm.name}” removed.`, { variant: 'success' })
            onChanged()
        } catch {
            setError(`Couldn’t remove ${realm.name} — network error.`)
        } finally {
            setBusy(false)
        }
    }, [pending, busy, onChanged, toast])

    // One delegated handler for every realm-row control: Test / Set default /
    // Rotate (toggle the below-table editor) / Remove (open the confirm dialog).
    const onRowAction = useCallback(
        (action: string, dataset: DOMStringMap) => {
            const id = dataset.id
            if (!id) return
            const realm = realms.find((r) => r.id === id)
            if (!realm) return
            if (action === 'test') void runTest(id)
            else if (action === 'default')
                void patch(realm, { default: true }, `“${realm.name}” is now the default realm.`)
            else if (action === 'rotate') setRotating((cur) => (cur === id ? null : id))
            else if (action === 'remove') setPending(realm)
        },
        [realms, runTest, patch],
    )

    const columns = useMemo(() => REALM_COLUMNS(busy, rotating), [busy, rotating])
    const rows = useMemo<RealmRow[]>(
        () => realms.map((r) => ({ realm: r, test: tests[r.id] })),
        [realms, tests],
    )
    const rotatingRealm = rotating ? realms.find((r) => r.id === rotating) : undefined

    return (
        <tc-section-card title="Realms" icon="server">
            <div className="perch-admin-section">
                <p className="perch-home-lead perch-admin-hint">
                    Each realm is one nginxpilot instance. Sites, routing, and base domains are
                    scoped to a realm; the default realm is where new users land. The admin token is
                    encrypted at rest and never shown again.
                </p>
                {error && <tc-banner variant="danger">{error}</tc-banner>}

                {realms.length === 0 ? (
                    <tc-empty-state icon="server">No realms registered.</tc-empty-state>
                ) : (
                    <DataTable<RealmRow>
                        columns={columns}
                        rows={rows}
                        rowKey={(row) => row.realm.id}
                        onAction={onRowAction}
                    />
                )}

                {/* The write-only token-rotate editor renders below the table (not
                    inside a cell) so no React subtree is captured by tc-table. */}
                {rotatingRealm && (
                    <RotateTokenRow
                        realm={rotatingRealm}
                        onDone={async (value) => {
                            const ok = await patch(
                                rotatingRealm,
                                { token: value },
                                value
                                    ? `Token rotated for “${rotatingRealm.name}”.`
                                    : `Token cleared for “${rotatingRealm.name}”.`,
                            )
                            if (ok) setRotating(null)
                        }}
                    />
                )}

                <form
                    className="perch-admin-add-row"
                    onSubmit={(e) => {
                        e.preventDefault()
                        void add()
                    }}
                >
                    <TextField
                        value={name}
                        onValue={setName}
                        placeholder="prod-eu"
                        ariaLabel="Realm name"
                    />
                    <TextField
                        value={adminUrl}
                        onValue={setAdminUrl}
                        placeholder="https://nginxpilot.internal:9090"
                        ariaLabel="Admin URL"
                    />
                    <TextField
                        value={token}
                        onValue={setToken}
                        type="password"
                        placeholder="Bearer token (optional)"
                        ariaLabel="Admin token"
                    />
                    <tc-button
                        type="submit"
                        variant="primary"
                        disabled={!name.trim() || !adminUrl.trim() || busy || undefined}
                    >
                        Add realm
                    </tc-button>
                </form>
            </div>
            <ConfirmDialog
                open={!!pending}
                title="Remove realm?"
                message={
                    pending
                        ? `Remove ${pending.name} (${pending.adminUrl}). Blocked if it still has sites or base domains.`
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

/** Inline write-only token rotation for one realm. Empty value clears the token (→ unauthenticated). */
function RotateTokenRow({ realm, onDone }: { realm: Realm; onDone: (value: string) => void }) {
    const [value, setValue] = useState('')
    return (
        <div className="perch-admin-limits">
            <p className="perch-admin-hint">
                Set a new bearer token for {realm.name}. Leave blank to clear it (the instance then
                runs unauthenticated). The current token is never shown.
            </p>
            <div className="perch-admin-add-row">
                <TextField
                    value={value}
                    onValue={setValue}
                    type="password"
                    placeholder="New token (blank = clear)"
                    ariaLabel={`New token for ${realm.name}`}
                />
                <tc-button variant="primary" size="sm" onClick={() => onDone(value.trim())}>
                    Save token
                </tc-button>
            </div>
        </div>
    )
}
