'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Realm } from '@/server/domain/types'
import { AdminPage, json, useOwnerData } from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
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
                    <ul className="perch-admin-list">
                        {realms.map((r) => {
                            const test = tests[r.id]
                            return (
                                <li key={r.id} className="perch-admin-realm">
                                    <div className="perch-admin-realm-main">
                                        <span className="perch-admin-realm-id">
                                            <HealthDot test={test} />
                                            <span className="perch-admin-realm-name">{r.name}</span>
                                            <span className="perch-admin-mono perch-admin-hint">
                                                {r.adminUrl}
                                            </span>
                                            <span className="perch-admin-badges">
                                                {r.isDefault && (
                                                    <tc-badge variant="primary">default</tc-badge>
                                                )}
                                                <tc-badge
                                                    variant={r.hasToken ? 'light' : 'secondary'}
                                                >
                                                    {r.hasToken ? 'token set' : 'no token'}
                                                </tc-badge>
                                                {test && test !== 'loading' && test.managed && (
                                                    <tc-badge variant="info">managed</tc-badge>
                                                )}
                                                {test && test !== 'loading' && !test.ok && (
                                                    <tc-badge variant="danger">
                                                        {test.error ?? 'unreachable'}
                                                    </tc-badge>
                                                )}
                                            </span>
                                        </span>
                                        <span className="perch-admin-domain-controls">
                                            <tc-button
                                                size="sm"
                                                outline
                                                onClick={() => void runTest(r.id)}
                                            >
                                                Test
                                            </tc-button>
                                            {!r.isDefault && (
                                                <tc-button
                                                    size="sm"
                                                    outline
                                                    onClick={() =>
                                                        void patch(
                                                            r,
                                                            { default: true },
                                                            `“${r.name}” is now the default realm.`,
                                                        )
                                                    }
                                                >
                                                    Set default
                                                </tc-button>
                                            )}
                                            <tc-button
                                                size="sm"
                                                outline
                                                onClick={() =>
                                                    setRotating((id) => (id === r.id ? null : r.id))
                                                }
                                            >
                                                {rotating === r.id ? 'Close' : 'Rotate token'}
                                            </tc-button>
                                            <tc-button
                                                variant="danger"
                                                size="sm"
                                                outline
                                                disabled={busy || undefined}
                                                onClick={() => setPending(r)}
                                            >
                                                Remove
                                            </tc-button>
                                        </span>
                                    </div>
                                    {rotating === r.id && (
                                        <RotateTokenRow
                                            realm={r}
                                            onDone={async (value) => {
                                                const ok = await patch(
                                                    r,
                                                    { token: value },
                                                    value
                                                        ? `Token rotated for “${r.name}”.`
                                                        : `Token cleared for “${r.name}”.`,
                                                )
                                                if (ok) setRotating(null)
                                            }}
                                        />
                                    )}
                                </li>
                            )
                        })}
                    </ul>
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

/** A small status dot: green = ok, amber = reachable-but-status-failed, red = unreachable, grey = unknown/loading. */
function HealthDot({ test }: { test?: RealmTest | 'loading' }) {
    let cls = 'perch-realm-dot perch-realm-dot--unknown'
    let title = 'Health unknown'
    if (test === 'loading') {
        title = 'Checking…'
    } else if (test) {
        if (test.ok) {
            cls = 'perch-realm-dot perch-realm-dot--ok'
            title = test.managed ? 'Healthy (managed mode)' : 'Healthy'
        } else if (test.healthz) {
            cls = 'perch-realm-dot perch-realm-dot--warn'
            title = `Reachable but ${test.error ?? 'status failed'}`
        } else {
            cls = 'perch-realm-dot perch-realm-dot--down'
            title = test.error ?? 'Unreachable'
        }
    }
    return <span className={cls} title={title} aria-label={title} />
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
