'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AdvancedTableColumn } from '@toolcase/web-components'
import { IconBtn } from '@/lib/action-icons'
import type { DbServer, DbUser } from '@/server/domain/types'
import { LoadingState, ErrorState } from '@/components/states'
import { FormModal, FormGroup } from '@/components/FormModal'
import { TextField } from '@/components/fields'
import { useToast } from '@/components/Toast'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { callApi, describeDriverError, fmtReadAt } from './shared'

// Users tab (perch_database_management.md §9): live user list, create (typed or
// generated password with a reveal-ONCE panel — perch stores no copy), password
// reset (same reveal rule), drop. The registry's admin account is locked; other
// superusers are visible but not droppable (§10).

const COLUMNS: AdvancedTableColumn[] = [
    { key: 'user', label: 'User' },
    { key: 'actions', label: '', align: 'right' },
]

type LoadState =
    | { phase: 'loading' }
    | { phase: 'error'; message: string }
    | { phase: 'ready'; users: DbUser[]; readAt: Date }

/** A create/reset response: the one moment the plaintext exists client-side. */
interface RevealedPassword {
    name: string
    password: string
    generated: boolean
    action: 'created' | 'reset'
}

export function UsersTab({ server }: { server: DbServer }) {
    const toast = useToast()
    const [state, setState] = useState<LoadState>({ phase: 'loading' })
    const [creating, setCreating] = useState(false)
    const [draft, setDraft] = useState({ name: '', password: '' })
    const [resetting, setResetting] = useState<DbUser | null>(null)
    const [resetPassword, setResetPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [dropping, setDropping] = useState<DbUser | null>(null)
    const [revealed, setRevealed] = useState<RevealedPassword | null>(null)
    const [copied, setCopied] = useState(false)

    const load = useCallback(async () => {
        setState({ phase: 'loading' })
        const res = await callApi<DbUser[]>(`/api/db-servers/${encodeURIComponent(server.id)}/users`, 'GET')
        if (!res.ok || !res.body) {
            setState({ phase: 'error', message: describeDriverError(res) })
            return
        }
        setState({ phase: 'ready', users: res.body, readAt: new Date() })
    }, [server.id])

    useEffect(() => {
        void load()
    }, [load])

    const describeUserError = (res: { message?: string; body?: unknown }): string => {
        switch (res.message) {
            case 'invalid_user_name':
                return 'User names are lowercase snake_case: a letter first, then letters, digits, underscores.'
            case 'invalid_password':
                return 'Passwords are 8–128 printable ASCII characters without spaces (or leave blank to generate one).'
            case 'admin_account_locked':
                return 'That is the registry admin account — edit it on the DB Servers admin page.'
            default:
                return `Operation failed — ${describeDriverError(res)}`
        }
    }

    const create = useCallback(async () => {
        const name = draft.name.trim()
        if (!name) {
            setError('A user needs a name.')
            return
        }
        setBusy(true)
        setError(null)
        const res = await callApi<RevealedPassword>(`/api/db-servers/${encodeURIComponent(server.id)}/users`, 'POST', {
            name,
            password: draft.password || undefined,
        })
        setBusy(false)
        if (!res.ok || !res.body) {
            setError(describeUserError(res))
            return
        }
        setCreating(false)
        setDraft({ name: '', password: '' })
        setCopied(false)
        setRevealed({ ...res.body, action: 'created' })
        void load()
    }, [draft, server.id, load])

    const doReset = useCallback(async () => {
        const user = resetting
        if (!user) return
        setBusy(true)
        setError(null)
        const res = await callApi<RevealedPassword>(
            `/api/db-servers/${encodeURIComponent(server.id)}/users/${encodeURIComponent(user.name)}/password`,
            'POST',
            { password: resetPassword || undefined },
        )
        setBusy(false)
        if (!res.ok || !res.body) {
            setError(describeUserError(res))
            return
        }
        setResetting(null)
        setResetPassword('')
        setCopied(false)
        setRevealed({ ...res.body, action: 'reset' })
    }, [resetting, resetPassword, server.id])

    const drop = useCallback(async () => {
        const user = dropping
        if (!user) return
        setDropping(null)
        setBusy(true)
        const res = await callApi(
            `/api/db-servers/${encodeURIComponent(server.id)}/users/${encodeURIComponent(user.name)}`,
            'DELETE',
        )
        setBusy(false)
        if (!res.ok) {
            toast.show(
                res.message === 'superuser_locked'
                    ? `“${user.name}” is a superuser — not droppable from perch.`
                    : `Couldn’t drop “${user.name}”: ${describeDriverError(res)}`,
                { variant: 'error' },
            )
            return
        }
        toast.show(`User “${user.name}” dropped — their grants and owned objects were cleaned up.`, {
            variant: 'success',
        })
        void load()
    }, [dropping, server.id, toast, load])

    const copyPassword = useCallback(async () => {
        if (!revealed) return
        try {
            await navigator.clipboard.writeText(revealed.password)
            setCopied(true)
        } catch {
            setCopied(false)
        }
    }, [revealed])

    const setTableColumns = useCallback((el: any) => {
        if (el) el.columns = COLUMNS
    }, [])

    if (state.phase === 'loading') return <LoadingState shape="rows" count={4} />
    if (state.phase === 'error') {
        return <ErrorState title="Couldn’t read the server" message={state.message} onRetry={() => void load()} />
    }

    const { users, readAt } = state
    return (
        <>
            <tc-section-card title="Users" icon="users">
                <div className="perch-admin-section">
                    <div className="perch-list-actions">
                        <tc-button variant="primary" size="sm" onClick={() => { setError(null); setDraft({ name: '', password: '' }); setCreating(true) }}>
                            Create user
                        </tc-button>
                        <tc-button variant="secondary" size="sm" outline onClick={() => void load()}>
                            Refresh
                        </tc-button>
                        <span className="perch-admin-hint">{`Read from server at ${fmtReadAt(readAt)}`}</span>
                    </div>

                    {users.length === 0 ? (
                        <tc-empty-state icon="users">No users on this server.</tc-empty-state>
                    ) : (
                        <tc-advanced-table
                            ref={setTableColumns}
                            limit={String(users.length || 10)}
                            offset="0"
                            total={String(users.length)}
                        >
                            {users.map((u) => (
                                <tr key={`${u.name}@${u.host ?? ''}`}>
                                    <td>
                                        <span className="perch-admin-realm-id">
                                            <span className="perch-admin-mono">{u.name}</span>
                                            <span className="perch-admin-badges">
                                                {u.host && u.host !== '%' && <span className="badge text-bg-light">{`@${u.host}`}</span>}
                                                {u.superuser && <span className="badge text-bg-warning">superuser</span>}
                                                {u.isAdminAccount && (
                                                    <span className="badge text-bg-primary" title="The account perch uses to manage this server — edit it on the DB Servers admin page.">
                                                        perch admin
                                                    </span>
                                                )}
                                            </span>
                                        </span>
                                    </td>
                                    <td className="text-end">
                                        {!u.isAdminAccount && (
                                            <span className="perch-admin-domain-controls">
                                                <IconBtn icon="rotate" label={`Reset password for ${u.name}`} disabled={busy} onClick={() => { setError(null); setResetPassword(''); setResetting(u) }} />
                                                {!u.superuser && (
                                                    <IconBtn icon="remove" label={`Drop ${u.name}`} danger disabled={busy} onClick={() => setDropping(u)} />
                                                )}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tc-advanced-table>
                    )}
                </div>
            </tc-section-card>

            {creating && (
                <FormModal
                    key="create-user"
                    title="Create user"
                    busy={busy}
                    submitLabel="Create"
                    onSubmit={() => void create()}
                    onClose={() => setCreating(false)}
                >
                    {error && <tc-banner variant="danger">{error}</tc-banner>}
                    <FormGroup title="User">
                        <TextField
                            label="Name"
                            placeholder="app_service"
                            help="Lowercase snake_case — a letter first, then letters, digits, underscores."
                            value={draft.name}
                            onValue={(v) => setDraft((d) => ({ ...d, name: v }))}
                        />
                        <TextField
                            type="password"
                            label="Password"
                            placeholder="Leave blank to generate a strong one"
                            help="Shown exactly once after creation — perch keeps no copy."
                            value={draft.password}
                            onValue={(v) => setDraft((d) => ({ ...d, password: v }))}
                        />
                    </FormGroup>
                </FormModal>
            )}

            {resetting && (
                <FormModal
                    key={`reset-${resetting.name}`}
                    title={`Reset password — ${resetting.name}`}
                    busy={busy}
                    submitLabel="Reset password"
                    onSubmit={() => void doReset()}
                    onClose={() => setResetting(null)}
                >
                    {error && <tc-banner variant="danger">{error}</tc-banner>}
                    <FormGroup title="Password">
                        <TextField
                            type="password"
                            label="New password"
                            placeholder="Leave blank to generate a strong one"
                            help="Shown exactly once — perch keeps no copy. Anything using the old password stops working immediately."
                            value={resetPassword}
                            onValue={setResetPassword}
                        />
                    </FormGroup>
                </FormModal>
            )}

            {/* Reveal-once: the single moment the plaintext exists client-side. Closing
                discards it for good, so the copy affordance is front and center. */}
            {revealed && (
                <FormModal
                    key={`revealed-${revealed.name}`}
                    title={revealed.action === 'created' ? `User created — ${revealed.name}` : `Password reset — ${revealed.name}`}
                    busy={false}
                    submitLabel="Done"
                    onSubmit={() => setRevealed(null)}
                    onClose={() => setRevealed(null)}
                >
                    <tc-banner variant="warning">
                        This password is shown once — perch keeps no copy. Store it somewhere safe before closing.
                    </tc-banner>
                    <FormGroup title={revealed.generated ? 'Generated password' : 'Password'}>
                        <div className="perch-list-actions">
                            <code className="perch-admin-mono">{revealed.password}</code>
                            <tc-button variant="secondary" size="sm" outline onClick={() => void copyPassword()}>
                                {copied ? 'Copied ✓' : 'Copy'}
                            </tc-button>
                        </div>
                    </FormGroup>
                </FormModal>
            )}

            <ConfirmDialog
                open={!!dropping}
                title="Drop user?"
                message={
                    dropping
                        ? `Drop “${dropping.name}” from ${server.name}. Their privileges are revoked and objects they own are reassigned to the admin account. Anything authenticating as this user stops working immediately.`
                        : undefined
                }
                confirmLabel="Drop user"
                danger
                onConfirm={() => void drop()}
                onCancel={() => setDropping(null)}
            />
        </>
    )
}
