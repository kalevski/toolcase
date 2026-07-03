'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AdvancedTableColumn } from '@toolcase/web-components'
import { IconBtn } from '@/lib/action-icons'
import { DB_SERVER_DEFAULT_PORT, isDbServerKind, type DbServer } from '@/server/domain/types'
import { AdminPage, json, useOwnerData } from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormModal, FormGroup } from '@/components/FormModal'
import { SelectField, TextField } from '@/components/fields'
import { useToast } from '@/components/Toast'

// Owner-only database-server registry (perch_database_management.md §9). A row is
// one owner-connected postgres/mysql server: endpoint + admin credential
// (encrypted at rest, WRITE-ONLY — rows never show it). Maintainers manage the
// databases/users/grants on these servers from /databases; this page only
// registers/edits/removes the connections themselves. The admin credential is,
// by nature, full control of that server — prefer a dedicated admin role over
// the engine superuser.

interface ServerTest {
    ok: boolean
    error?: string
}

type ServerTestState = ServerTest | 'loading' | undefined

function healthDotMeta(server: DbServer, test: ServerTestState): { cls: string; title: string } {
    if (test === 'loading') return { cls: 'perch-realm-dot--unknown', title: 'Checking…' }
    if (test) {
        if (test.ok) return { cls: 'perch-realm-dot--ok', title: 'Healthy' }
        return { cls: 'perch-realm-dot--down', title: test.error ?? 'Unreachable' }
    }
    if (server.lastError) return { cls: 'perch-realm-dot--down', title: server.lastError }
    if (server.lastOkAt) return { cls: 'perch-realm-dot--ok', title: `Last ok ${server.lastOkAt}` }
    return { cls: 'perch-realm-dot--unknown', title: 'Health unknown' }
}

const SERVER_COLUMNS: AdvancedTableColumn[] = [
    { key: 'identity', label: 'Server' },
    { key: 'actions', label: '', align: 'right' },
]

export function AdminDbServers() {
    const fetcher = useCallback(async (): Promise<DbServer[] | null> => {
        try {
            return await fetch('/api/admin/db-servers', { cache: 'no-store' }).then((r) =>
                json<DbServer[]>(r),
            )
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useOwnerData(fetcher)

    return (
        <AdminPage
            title="DB Servers"
            subtitle="The database servers maintainers manage from the Databases section. Connect, edit, health-check, and disconnect. Owner-only."
            icon="database"
            iconColor="cyan"
            state={state}
            onRetry={() => void reload()}
        >
            {(servers) => <DbServersForm servers={servers} onChanged={() => void reload()} />}
        </AdminPage>
    )
}

/** The add/edit form draft — one object; the modal resets by remount. */
interface ServerDraft {
    name: string
    kind: string
    host: string
    port: string
    tls: string
    adminUser: string
    adminPassword: string
}

const emptyDraft = (): ServerDraft => ({
    name: '',
    kind: 'postgres',
    host: '',
    port: '',
    tls: 'off',
    adminUser: '',
    adminPassword: '',
})

const draftOf = (s: DbServer): ServerDraft => ({
    name: s.name,
    kind: s.kind,
    host: s.host,
    port: String(s.port),
    tls: s.tls,
    adminUser: s.adminUser,
    adminPassword: '',
})

function DbServersForm({ servers, onChanged }: { servers: DbServer[]; onChanged: () => void }) {
    const toast = useToast()
    // null = closed; { id: null } = create; { id } = edit that server.
    const [form, setForm] = useState<{ id: string | null; draft: ServerDraft } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [pending, setPending] = useState<DbServer | null>(null)
    const [tests, setTests] = useState<Record<string, ServerTest | 'loading'>>({})

    const patchDraft = (p: Partial<ServerDraft>) =>
        setForm((prev) => (prev ? { ...prev, draft: { ...prev.draft, ...p } } : prev))

    const close = useCallback(() => {
        setForm(null)
        setError(null)
    }, [])

    const runTest = useCallback(async (id: string) => {
        setTests((t) => ({ ...t, [id]: 'loading' }))
        try {
            const res = await fetch(`/api/admin/db-servers/${encodeURIComponent(id)}/test`, {
                method: 'POST',
            })
            const body = (await res.json().catch(() => null)) as ServerTest | null
            setTests((t) => ({ ...t, [id]: body ?? { ok: false, error: 'error' } }))
        } catch {
            setTests((t) => ({ ...t, [id]: { ok: false, error: 'network' } }))
        }
    }, [])

    // Auto health-check every server once on mount / when the set changes.
    useEffect(() => {
        for (const s of servers) void runTest(s.id)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [servers.map((s) => s.id).join(','), runTest])

    const submit = useCallback(async () => {
        if (!form || busy) return
        const d = form.draft
        if (!d.name.trim()) {
            setError('A server needs a name.')
            return
        }
        if (!d.host.trim()) {
            setError('A server needs a host.')
            return
        }
        if (!d.adminUser.trim()) {
            setError('An admin user is required.')
            return
        }
        if (form.id === null && !d.adminPassword) {
            setError('An admin password is required.')
            return
        }
        setBusy(true)
        setError(null)
        try {
            const payload: Record<string, unknown> = {
                name: d.name.trim(),
                host: d.host.trim(),
                port: d.port.trim() === '' ? undefined : Number(d.port),
                tls: d.tls,
                adminUser: d.adminUser.trim(),
            }
            if (form.id === null) {
                payload.kind = d.kind
                payload.adminPassword = d.adminPassword
            } else if (d.adminPassword) {
                payload.adminPassword = d.adminPassword
            }
            const res = await fetch(
                form.id === null
                    ? '/api/admin/db-servers'
                    : `/api/admin/db-servers/${encodeURIComponent(form.id)}`,
                {
                    method: form.id === null ? 'POST' : 'PATCH',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(payload),
                },
            )
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null
                setError(
                    body?.error === 'name_taken'
                        ? `A server named “${d.name.trim()}” already exists.`
                        : body?.error
                          ? `Couldn’t save server: ${body.error}.`
                          : `Couldn’t save server (error ${res.status}).`,
                )
                return
            }
            toast.show(
                form.id === null ? `Server “${d.name.trim()}” connected.` : `Server “${d.name.trim()}” updated.`,
                { variant: 'success' },
            )
            setForm(null)
            onChanged()
        } catch {
            setError('Couldn’t save server — network error.')
        } finally {
            setBusy(false)
        }
    }, [form, busy, onChanged, toast])

    const doRemove = useCallback(async () => {
        const server = pending
        if (!server || busy) return
        setPending(null)
        setBusy(true)
        setError(null)
        try {
            const res = await fetch(`/api/admin/db-servers/${encodeURIComponent(server.id)}`, {
                method: 'DELETE',
            })
            if (!res.ok && res.status !== 204) {
                setError(`Couldn’t disconnect ${server.name} (error ${res.status}).`)
                return
            }
            toast.show(`Server “${server.name}” disconnected.`, { variant: 'success' })
            onChanged()
        } catch {
            setError(`Couldn’t disconnect ${server.name} — network error.`)
        } finally {
            setBusy(false)
        }
    }, [pending, busy, onChanged, toast])

    const setTableColumns = useCallback((el: any) => {
        if (el) el.columns = SERVER_COLUMNS
    }, [])

    const rows = useMemo(() => servers.map((s) => ({ server: s, test: tests[s.id] })), [servers, tests])
    const editing = form?.id ? servers.find((s) => s.id === form.id) : undefined

    return (
        <>
            <tc-section-card title="Database servers" icon="database">
                <div className="perch-admin-section">
                    <p className="perch-home-lead perch-admin-hint">
                        Each row is one postgres or mysql/mariadb server perch can manage. The admin
                        credential grants full control of that server — prefer a dedicated admin role
                        over the engine superuser. It is encrypted at rest and never shown again.
                        Disconnecting only removes the registry entry; the server itself is untouched.
                    </p>
                    {error && !form && <tc-banner variant="danger">{error}</tc-banner>}

                    <div className="perch-list-actions">
                        <tc-button variant="primary" size="sm" onClick={() => setForm({ id: null, draft: emptyDraft() })}>
                            Connect server
                        </tc-button>
                    </div>

                    {servers.length === 0 ? (
                        <tc-empty-state icon="database">No database servers connected.</tc-empty-state>
                    ) : (
                        <tc-advanced-table
                            ref={setTableColumns}
                            limit={String(rows.length || 10)}
                            offset="0"
                            total={String(rows.length)}
                        >
                            {rows.map(({ server: s, test }) => {
                                const { cls, title } = healthDotMeta(s, test)
                                return (
                                    <tr key={s.id}>
                                        <td>
                                            <span className="perch-admin-realm-id">
                                                <span className={`perch-realm-dot ${cls}`} title={title} aria-label={title} />
                                                <span className="perch-admin-realm-name">{s.name}</span>
                                                <span className="perch-admin-mono perch-admin-hint">{`${s.host}:${s.port}`}</span>
                                                <span className="perch-admin-badges">
                                                    <span className="badge text-bg-info">{s.kind}</span>
                                                    {s.tls === 'require' && <span className="badge text-bg-light">tls</span>}
                                                    <span className="badge text-bg-secondary">{`admin: ${s.adminUser}`}</span>
                                                    {test && test !== 'loading' && !test.ok && (
                                                        <span className="badge text-bg-danger">{test.error ?? 'unreachable'}</span>
                                                    )}
                                                </span>
                                            </span>
                                        </td>
                                        <td className="text-end">
                                            <span className="perch-admin-domain-controls">
                                                <IconBtn icon="test" label={`Test ${s.name}`} onClick={() => void runTest(s.id)} />
                                                <IconBtn icon="edit" label={`Edit ${s.name}`} onClick={() => { setError(null); setForm({ id: s.id, draft: draftOf(s) }) }} />
                                                <IconBtn icon="remove" label={`Disconnect ${s.name}`} danger disabled={busy} onClick={() => setPending(s)} />
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tc-advanced-table>
                    )}
                </div>
            </tc-section-card>

            {form && (
                <FormModal
                    key={form.id ?? 'new'}
                    title={form.id === null ? 'Connect database server' : `Edit — ${editing?.name ?? ''}`}
                    busy={busy}
                    submitLabel={form.id === null ? 'Connect' : 'Save'}
                    onSubmit={() => void submit()}
                    onClose={close}
                >
                    {error && <tc-banner variant="danger">{error}</tc-banner>}
                    <FormGroup title="Identity">
                        <TextField
                            label="Name"
                            placeholder="prod-pg"
                            help="A short handle for this server."
                            value={form.draft.name}
                            onValue={(v) => patchDraft({ name: v })}
                        />
                        {form.id === null ? (
                            <SelectField
                                label="Engine"
                                value={form.draft.kind}
                                options={[
                                    { value: 'postgres', label: 'PostgreSQL' },
                                    { value: 'mysql', label: 'MySQL / MariaDB' },
                                ]}
                                onValue={(v) => {
                                    if (!isDbServerKind(v)) return
                                    // Follow the engine's default port unless the owner typed one.
                                    setForm((prev) => {
                                        if (!prev) return prev
                                        const usingDefault =
                                            prev.draft.port === '' ||
                                            (isDbServerKind(prev.draft.kind) &&
                                                prev.draft.port === String(DB_SERVER_DEFAULT_PORT[prev.draft.kind]))
                                        return {
                                            ...prev,
                                            draft: {
                                                ...prev.draft,
                                                kind: v,
                                                port: usingDefault ? String(DB_SERVER_DEFAULT_PORT[v]) : prev.draft.port,
                                            },
                                        }
                                    })
                                }}
                            />
                        ) : (
                            <p className="perch-admin-hint">
                                Engine: <span className="perch-admin-mono">{editing?.kind}</span> (immutable — re-register
                                for a different engine).
                            </p>
                        )}
                    </FormGroup>
                    <FormGroup title="Connection">
                        <TextField
                            label="Host"
                            placeholder="db.internal"
                            help="Hostname or IP address — no scheme."
                            value={form.draft.host}
                            onValue={(v) => patchDraft({ host: v })}
                        />
                        <TextField
                            label="Port"
                            type="number"
                            placeholder={
                                isDbServerKind(form.draft.kind)
                                    ? String(DB_SERVER_DEFAULT_PORT[form.draft.kind])
                                    : '5432'
                            }
                            help="Blank uses the engine default."
                            value={form.draft.port}
                            onValue={(v) => patchDraft({ port: v })}
                        />
                        <SelectField
                            label="TLS"
                            value={form.draft.tls}
                            options={[
                                { value: 'off', label: 'Off' },
                                { value: 'require', label: 'Require (verify system CAs)' },
                            ]}
                            onValue={(v) => patchDraft({ tls: v })}
                        />
                    </FormGroup>
                    <FormGroup title="Admin credential">
                        <TextField
                            label="Admin user"
                            placeholder="perch_admin"
                            help="An account allowed to create databases, roles, and grants."
                            value={form.draft.adminUser}
                            onValue={(v) => patchDraft({ adminUser: v })}
                        />
                        <TextField
                            type="password"
                            label="Admin password"
                            placeholder={form.id === null ? 'Password' : 'Leave blank to keep the current password'}
                            help="Write-only — encrypted at rest and never shown again."
                            value={form.draft.adminPassword}
                            onValue={(v) => patchDraft({ adminPassword: v })}
                        />
                    </FormGroup>
                </FormModal>
            )}

            <ConfirmDialog
                open={!!pending}
                title="Disconnect server?"
                message={
                    pending
                        ? `Disconnect ${pending.name} (${pending.host}:${pending.port}). Only the registry entry is removed — the database server itself is untouched.`
                        : undefined
                }
                confirmLabel="Disconnect"
                danger
                onConfirm={() => void doRemove()}
                onCancel={() => setPending(null)}
            />
        </>
    )
}
