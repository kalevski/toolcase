'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AdvancedTableColumn } from '@toolcase/web-components'
import { iconBtnHtml } from '@/lib/action-icons'
import { escapeHtml, useTc } from '@/lib/tc'
import type { Realm } from '@/server/domain/types'
import { AdminPage, json, useOwnerData } from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormModal, FormGroup } from '@/components/FormModal'
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
    /** Managed-mode resources the reconcile loop flags as at risk (A7). */
    atRisk?: number
    /** Managed-mode resources quarantined by nginx -t. */
    disabled?: number
    /** Daemon's self-reported API version (impl §6); absent on daemons without /schema. */
    apiVersion?: string
    error?: string
}

// ── table model (P1/P3) ────────────────────────────────────────────────────────
// One row per realm. Body rows are fed to tc-advanced-table via its `rows` HTML
// string property (relocation-safe — every interpolated value escaped); actions are
// delegated `data-action` buttons. The write-only token-rotate editor lives in its
// own FormModal (keyed off `rotating`), so no React subtree lives inside the table.

type RealmTestState = RealmTest | 'loading' | undefined

interface RealmRow extends Record<string, unknown> {
    realm: Realm
    test: RealmTestState
}

/** Health-dot class + title: green = ok, amber = reachable-but-status-failed OR
 *  resources at risk / quarantined (A7), red = unreachable, grey = unknown/loading. */
function healthDotMeta(test: RealmTestState): { cls: string; title: string } {
    if (test === 'loading') return { cls: 'quaykeeper-realm-dot--unknown', title: 'Checking…' }
    if (test) {
        if (test.ok) {
            // Amber before anything breaks: at_risk resources are still serving but
            // would fail the next apply; disabled ones are already quarantined.
            const atRisk = test.atRisk ?? 0
            const disabled = test.disabled ?? 0
            if (atRisk > 0 || disabled > 0) {
                const parts: string[] = []
                if (disabled > 0) parts.push(`${disabled} quarantined`)
                if (atRisk > 0) parts.push(`${atRisk} at risk`)
                return { cls: 'quaykeeper-realm-dot--warn', title: `Healthy, but ${parts.join(', ')}` }
            }
            return {
                cls: 'quaykeeper-realm-dot--ok',
                title: test.managed ? 'Healthy (managed mode)' : 'Healthy',
            }
        }
        if (test.healthz)
            return {
                cls: 'quaykeeper-realm-dot--warn',
                title: `Reachable but ${test.error ?? 'status failed'}`,
            }
        return { cls: 'quaykeeper-realm-dot--down', title: test.error ?? 'Unreachable' }
    }
    return { cls: 'quaykeeper-realm-dot--unknown', title: 'Health unknown' }
}

const REALM_COLUMNS: AdvancedTableColumn[] = [
    { key: 'identity', label: 'NGINX server' },
    { key: 'actions', label: '', align: 'right' },
]

/** The injected `<tbody>` HTML — every interpolated value is escaped. */
function realmRowsHtml(rows: RealmRow[], busy: boolean): string {
    return rows
        .map(({ realm: r, test }) => {
            const { cls, title } = healthDotMeta(test)

            const badges: string[] = []
            if (r.isDefault) badges.push('<span class="badge text-bg-primary">default</span>')
            badges.push(
                `<span class="badge text-bg-${r.hasToken ? 'light' : 'secondary'}">${r.hasToken ? 'token set' : 'no token'}</span>`,
            )
            if (test && test !== 'loading') {
                if (test.managed) badges.push('<span class="badge text-bg-info">managed</span>')
                if (test.apiVersion)
                    badges.push(`<span class="badge text-bg-light">api v${escapeHtml(test.apiVersion)}</span>`)
                if (test.ok && (test.disabled ?? 0) > 0)
                    badges.push(`<span class="badge text-bg-danger">${test.disabled} quarantined</span>`)
                if (test.ok && (test.atRisk ?? 0) > 0)
                    badges.push(`<span class="badge text-bg-warning">${test.atRisk} at risk</span>`)
                if (!test.ok)
                    badges.push(`<span class="badge text-bg-danger">${escapeHtml(test.error ?? 'unreachable')}</span>`)
            }

            const controls = [
                iconBtnHtml({ icon: 'test', label: `Test ${r.name}`, data: { action: 'test', id: r.id } }),
                ...(r.isDefault
                    ? []
                    : [
                          iconBtnHtml({
                              icon: 'default',
                              label: `Set ${r.name} as default`,
                              data: { action: 'default', id: r.id },
                          }),
                      ]),
                iconBtnHtml({ icon: 'rotate', label: `Rotate token for ${r.name}`, data: { action: 'rotate', id: r.id } }),
                iconBtnHtml({
                    icon: 'remove',
                    label: `Remove ${r.name}`,
                    danger: true,
                    disabled: busy,
                    data: { action: 'remove', id: r.id },
                }),
            ].join('')

            return (
                `<tr>` +
                `<td><span class="quaykeeper-admin-realm-id">` +
                `<span class="quaykeeper-realm-dot ${cls}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"></span>` +
                `<span class="quaykeeper-admin-realm-name">${escapeHtml(r.name)}</span>` +
                `<span class="quaykeeper-admin-mono quaykeeper-admin-hint">${escapeHtml(r.adminUrl)}</span>` +
                `<span class="quaykeeper-admin-badges">${badges.join('')}</span>` +
                `</span></td>` +
                `<td class="text-end"><span class="quaykeeper-admin-domain-controls">${controls}</span></td>` +
                `</tr>`
            )
        })
        .join('')
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
            title="NGINX Servers"
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

/** Everything the add-realm form holds — one draft object; the modal resets by remount. */
interface RealmDraft {
    name: string
    adminUrl: string
    token: string
}

const emptyDraft = (): RealmDraft => ({ name: '', adminUrl: '', token: '' })

function RealmsForm({ realms, onChanged }: { realms: Realm[]; onChanged: () => void }) {
    const toast = useToast()
    // The add-realm form: null = closed; a draft = the modal is open (create-only —
    // realms have no edit flow; rename/rotate/default go through PATCH row actions).
    const [form, setForm] = useState<RealmDraft | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    // The realm awaiting remove confirmation, and the realm whose token is being rotated.
    const [pending, setPending] = useState<Realm | null>(null)
    const [rotating, setRotating] = useState<string | null>(null)
    // Live health results, keyed by realm id (lazily filled by the test effect / button).
    const [tests, setTests] = useState<Record<string, RealmTest | 'loading'>>({})

    const patchDraft = (p: Partial<RealmDraft>) => setForm((prev) => (prev ? { ...prev, ...p } : prev))

    const openCreate = () => {
        setError(null)
        setForm(emptyDraft())
    }

    const close = useCallback(() => {
        setForm(null)
        setError(null)
    }, [])

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
        if (!form || busy) return
        const n = form.name.trim()
        const u = form.adminUrl.trim()
        if (!n) {
            setError('An NGINX server needs a name.')
            return
        }
        if (!u) {
            setError('An NGINX server needs an admin URL.')
            return
        }
        setBusy(true)
        setError(null)
        try {
            const res = await fetch('/api/admin/realms', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: n, adminUrl: u, token: form.token.trim() }),
            })
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null
                setError(
                    body?.error
                        ? `Couldn’t add NGINX server: ${body.error}.`
                        : `Couldn’t add NGINX server (error ${res.status}).`,
                )
                return
            }
            toast.show(`NGINX server “${n}” registered.`, { variant: 'success' })
            setForm(null)
            onChanged()
        } catch {
            setError('Couldn’t add NGINX server — network error.')
        } finally {
            setBusy(false)
        }
    }, [form, busy, onChanged, toast])

    // Shared PATCH runner. Returns null on success (toast + reload fired) or the
    // error message — the caller decides where it surfaces (page banner vs modal).
    const patch = useCallback(
        async (realm: Realm, body: Record<string, unknown>, okMsg: string): Promise<string | null> => {
            try {
                const res = await fetch(`/api/admin/realms/${encodeURIComponent(realm.id)}`, {
                    method: 'PATCH',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(body),
                })
                if (!res.ok) {
                    const b = (await res.json().catch(() => null)) as { error?: string } | null
                    return b?.error
                        ? `Couldn’t update ${realm.name}: ${b.error}.`
                        : `Couldn’t update ${realm.name} (error ${res.status}).`
                }
                toast.show(okMsg, { variant: 'success' })
                onChanged()
                return null
            } catch {
                return `Couldn’t update ${realm.name} — network error.`
            }
        },
        [onChanged, toast],
    )

    const setDefault = useCallback(
        async (realm: Realm) => {
            setError(null)
            const msg = await patch(realm, { default: true }, `“${realm.name}” is now the default NGINX server.`)
            if (msg) setError(msg)
        },
        [patch],
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
                          ? `Set another NGINX server as default before removing ${realm.name}.`
                          : `Couldn’t remove ${realm.name} (error ${res.status}).`,
                )
                return
            }
            toast.show(`NGINX server “${realm.name}” removed.`, { variant: 'success' })
            onChanged()
        } catch {
            setError(`Couldn’t remove ${realm.name} — network error.`)
        } finally {
            setBusy(false)
        }
    }, [pending, busy, onChanged, toast])

    const rows = useMemo<RealmRow[]>(
        () => realms.map((r) => ({ realm: r, test: tests[r.id] })),
        [realms, tests],
    )
    const rotatingRealm = rotating ? realms.find((r) => r.id === rotating) : undefined

    // Row-action buttons live in the injected tbody HTML — one delegated host
    // listener routes their data-action clicks back to the React handlers.
    const onDelegated = useCallback(
        (event: Event) => {
            const el = (event.target as HTMLElement)?.closest?.('[data-action]') as HTMLElement | null
            if (!el) return
            const action = el.getAttribute('data-action')
            const id = el.getAttribute('data-id')
            if (!action || !id) return
            const realm = realms.find((r) => r.id === id)
            if (!realm) return
            if (action === 'test') void runTest(id)
            else if (action === 'default') void setDefault(realm)
            else if (action === 'rotate') setRotating(id)
            else if (action === 'remove') setPending(realm)
        },
        [realms, runTest, setDefault],
    )

    const tableProps = useMemo(
        () => ({
            columns: REALM_COLUMNS,
            total: rows.length,
            limit: Math.max(rows.length, 1),
            offset: 0,
            rows: realmRowsHtml(rows, busy),
        }),
        [rows, busy],
    )
    const tableRef = useTc<HTMLElement>(tableProps, { click: onDelegated })

    return (
        <>
            <tc-section-card title="NGINX Servers" icon="server">
                <div className="quaykeeper-admin-section">
                    <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                        Each NGINX server is one nginxpilot instance. Sites, routing, and base domains are
                        scoped to an NGINX server; the default server is where new users land. The admin token is
                        encrypted at rest and never shown again.
                    </p>
                    {error && !form && <tc-banner variant="danger">{error}</tc-banner>}

                    <div className="quaykeeper-list-actions">
                        <tc-button variant="primary" size="sm" onClick={openCreate}>
                            Add NGINX server
                        </tc-button>
                    </div>

                    {realms.length === 0 ? (
                        <tc-empty-state icon="server">No NGINX servers registered.</tc-empty-state>
                    ) : (
                        <tc-advanced-table ref={tableRef} />
                    )}
                </div>
            </tc-section-card>

            {form && (
                <FormModal
                    key="new"
                    title="Add NGINX server"
                    busy={busy}
                    submitLabel="Add NGINX server"
                    onSubmit={() => void add()}
                    onClose={close}
                >
                    {error && <tc-banner variant="danger">{error}</tc-banner>}
                    <FormGroup title="Identity">
                        <TextField
                            label="Name"
                            placeholder="prod-eu"
                            help="A short handle for this nginxpilot instance."
                            value={form.name}
                            onValue={(v) => patchDraft({ name: v })}
                        />
                    </FormGroup>
                    <FormGroup title="Connection">
                        <TextField
                            label="Admin URL"
                            placeholder="https://nginxpilot.internal:9090"
                            help="Base URL of the instance’s admin API."
                            value={form.adminUrl}
                            onValue={(v) => patchDraft({ adminUrl: v })}
                        />
                        <TextField
                            type="password"
                            label="Admin token"
                            placeholder="Bearer token (optional)"
                            help="Write-only — encrypted at rest and never shown again. Blank if the instance runs unauthenticated."
                            value={form.token}
                            onValue={(v) => patchDraft({ token: v })}
                        />
                    </FormGroup>
                </FormModal>
            )}

            {/* The write-only token-rotate editor is its own small modal (keyed per realm),
                so no React subtree is captured by tc-table. */}
            {rotatingRealm && (
                <RotateTokenModal
                    key={rotatingRealm.id}
                    realm={rotatingRealm}
                    onSave={(value) =>
                        patch(
                            rotatingRealm,
                            { token: value },
                            value
                                ? `Token rotated for “${rotatingRealm.name}”.`
                                : `Token cleared for “${rotatingRealm.name}”.`,
                        )
                    }
                    onClose={() => setRotating(null)}
                />
            )}

            <ConfirmDialog
                open={!!pending}
                title="Remove NGINX server?"
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
        </>
    )
}

/** Write-only token rotation for one realm, in a modal. An empty value clears the
 *  token (→ the instance runs unauthenticated). `onSave` resolves to null on
 *  success or an error message shown inside the modal (pilot error pattern). */
function RotateTokenModal({
    realm,
    onSave,
    onClose,
}: {
    realm: Realm
    onSave: (value: string) => Promise<string | null>
    onClose: () => void
}) {
    const [value, setValue] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const submit = async () => {
        if (busy) return
        setBusy(true)
        setError(null)
        const msg = await onSave(value.trim())
        setBusy(false)
        if (msg) {
            setError(msg)
            return
        }
        onClose()
    }

    return (
        <FormModal
            title={`Rotate token — ${realm.name}`}
            busy={busy}
            submitLabel="Save token"
            onSubmit={() => void submit()}
            onClose={onClose}
        >
            {error && <tc-banner variant="danger">{error}</tc-banner>}
            <FormGroup title="Credentials">
                <TextField
                    type="password"
                    label="New token"
                    placeholder="New token (blank = clear)"
                    help={`Leave blank to clear the token — ${realm.name} then runs unauthenticated. The current token is never shown.`}
                    value={value}
                    onValue={setValue}
                />
            </FormGroup>
        </FormModal>
    )
}
