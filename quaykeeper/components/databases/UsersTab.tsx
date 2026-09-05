'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AdvancedTableColumn } from '@toolcase/web-components'
import { iconBtnHtml } from '@/lib/action-icons'
import { escapeHtml, useTc } from '@/lib/tc'
import type { DbServer, DbUser } from '@/server/domain/types'
import { LoadingState, ErrorState } from '@/components/states'
import { FormModal, FormGroup } from '@/components/FormModal'
import { TextField } from '@/components/fields'
import { useToast } from '@/components/Toast'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { callApi, describeDriverError, fmtReadAt } from './shared'

// Users tab (quaykeeper_database_management.md §9): live user list, create (typed or
// generated password with a reveal-ONCE panel — quaykeeper stores no copy), password
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

// The injected <tbody> HTML — fed to tc-advanced-table via its `rows` property
// (relocation-safe; every interpolated value is escaped). Row actions are
// delegated `data-action` buttons; a user is identified by name + host (mysql
// accounts share names across hosts).
function userRowsHtml(users: DbUser[], busy: boolean): string {
    return users
        .map((u) => {
            const badges: string[] = []
            if (u.host && u.host !== '%')
                badges.push(`<span class="badge text-bg-light">${escapeHtml(`@${u.host}`)}</span>`)
            if (u.superuser) badges.push('<span class="badge text-bg-warning">superuser</span>')
            if (u.isAdminAccount)
                badges.push(
                    '<span class="badge text-bg-primary" title="The account quaykeeper uses to manage this server — edit it on the DB Servers admin page.">quaykeeper admin</span>',
                )

            const controls = u.isAdminAccount
                ? ''
                : `<span class="quaykeeper-admin-domain-controls">` +
                  iconBtnHtml({
                      icon: 'rotate',
                      label: `Reset password for ${u.name}`,
                      disabled: busy,
                      data: { action: 'reset', name: u.name, host: u.host ?? '' },
                  }) +
                  (u.superuser
                      ? ''
                      : iconBtnHtml({
                            icon: 'remove',
                            label: `Drop ${u.name}`,
                            danger: true,
                            disabled: busy,
                            data: { action: 'drop', name: u.name, host: u.host ?? '' },
                        })) +
                  `</span>`

            return (
                `<tr>` +
                `<td><span class="quaykeeper-admin-realm-id">` +
                `<span class="quaykeeper-admin-mono">${escapeHtml(u.name)}</span>` +
                `<span class="quaykeeper-admin-badges">${badges.join('')}</span>` +
                `</span></td>` +
                `<td class="text-end">${controls}</td>` +
                `</tr>`
            )
        })
        .join('')
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
                    ? `“${user.name}” is a superuser — not droppable from quaykeeper.`
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

    const users = useMemo(() => (state.phase === 'ready' ? state.users : []), [state])

    // Row-action buttons live in the injected tbody HTML — one delegated host
    // listener routes their data-action clicks back to the React handlers.
    const onDelegated = useCallback(
        (event: Event) => {
            const el = (event.target as HTMLElement)?.closest?.('[data-action]') as HTMLElement | null
            if (!el) return
            const action = el.getAttribute('data-action')
            const name = el.getAttribute('data-name')
            if (!action || !name) return
            const host = el.getAttribute('data-host') ?? ''
            const user = users.find((u) => u.name === name && (u.host ?? '') === host)
            if (!user) return
            if (action === 'reset') {
                setError(null)
                setResetPassword('')
                setResetting(user)
            } else if (action === 'drop') {
                setDropping(user)
            }
        },
        [users],
    )

    const tableProps = useMemo(
        () => ({
            columns: COLUMNS,
            total: users.length,
            limit: users.length || 10,
            offset: 0,
            rows: userRowsHtml(users, busy),
        }),
        [users, busy],
    )
    const tableRef = useTc<HTMLElement>(tableProps, { click: onDelegated })

    if (state.phase === 'loading') return <LoadingState shape="rows" count={4} />
    if (state.phase === 'error') {
        return <ErrorState title="Couldn’t read the server" message={state.message} onRetry={() => void load()} />
    }

    const { readAt } = state
    return (
        <>
            <tc-section-card title="Users" icon="users">
                <div className="quaykeeper-admin-section">
                    <div className="quaykeeper-list-actions">
                        <tc-button variant="primary" size="sm" onClick={() => { setError(null); setDraft({ name: '', password: '' }); setCreating(true) }}>
                            Create user
                        </tc-button>
                        <tc-button variant="secondary" size="sm" outline onClick={() => void load()}>
                            Refresh
                        </tc-button>
                        <span className="quaykeeper-admin-hint">{`Read from server at ${fmtReadAt(readAt)}`}</span>
                    </div>

                    {users.length === 0 ? (
                        <tc-empty-state icon="users">No users on this server.</tc-empty-state>
                    ) : (
                        <tc-advanced-table ref={tableRef} />
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
                    {error && <tc-banner variant="error">{error}</tc-banner>}
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
                            help="Shown exactly once after creation — quaykeeper keeps no copy."
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
                    {error && <tc-banner variant="error">{error}</tc-banner>}
                    <FormGroup title="Password">
                        <TextField
                            type="password"
                            label="New password"
                            placeholder="Leave blank to generate a strong one"
                            help="Shown exactly once — quaykeeper keeps no copy. Anything using the old password stops working immediately."
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
                        This password is shown once — quaykeeper keeps no copy. Store it somewhere safe before closing.
                    </tc-banner>
                    <FormGroup title={revealed.generated ? 'Generated password' : 'Password'}>
                        <div className="quaykeeper-list-actions">
                            <code className="quaykeeper-admin-mono">{revealed.password}</code>
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
