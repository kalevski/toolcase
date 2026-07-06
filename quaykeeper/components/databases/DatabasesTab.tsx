'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AdvancedTableColumn } from '@toolcase/web-components'
import { iconBtnHtml } from '@/lib/action-icons'
import { escapeHtml, useTc } from '@/lib/tc'
import type { DbDatabase, DbServer } from '@/server/domain/types'
import { formatBytes } from '@/server/domain/site-dashboard'
import { LoadingState, ErrorState } from '@/components/states'
import { FormModal, FormGroup } from '@/components/FormModal'
import { TextField } from '@/components/fields'
import { useToast } from '@/components/Toast'
import { callApi, describeDriverError, fmtReadAt, TypeToConfirmModal } from './shared'

// Databases tab (quaykeeper_database_management.md §9): live table (name, owner,
// size), create, and drop behind a type-the-name confirmation. Every render is
// a fresh catalog read — the visible "read at hh:mm" + refresh keep that honest.

const COLUMNS: AdvancedTableColumn[] = [
    { key: 'name', label: 'Database' },
    { key: 'owner', label: 'Owner' },
    { key: 'size', label: 'Size', align: 'right' },
    { key: 'actions', label: '', align: 'right' },
]

type LoadState =
    | { phase: 'loading' }
    | { phase: 'error'; message: string }
    | { phase: 'ready'; databases: DbDatabase[]; readAt: Date }

// The injected <tbody> HTML — fed to tc-advanced-table via its `rows` property
// (relocation-safe; every interpolated value is escaped). The drop button is a
// delegated `data-action` control caught by the host click listener.
function databaseRowsHtml(databases: DbDatabase[], busy: boolean): string {
    return databases
        .map((db) => {
            const drop = iconBtnHtml({
                icon: 'remove',
                label: `Drop ${db.name}`,
                danger: true,
                disabled: busy,
                data: { action: 'drop', name: db.name },
            })
            return (
                `<tr>` +
                `<td><span class="quaykeeper-admin-mono">${escapeHtml(db.name)}</span></td>` +
                `<td><span class="quaykeeper-admin-hint">${db.owner ? escapeHtml(db.owner) : '—'}</span></td>` +
                `<td class="text-end"><span class="quaykeeper-admin-hint">${db.sizeBytes === null ? '—' : escapeHtml(formatBytes(db.sizeBytes))}</span></td>` +
                `<td class="text-end">${drop}</td>` +
                `</tr>`
            )
        })
        .join('')
}

export function DatabasesTab({ server }: { server: DbServer }) {
    const toast = useToast()
    const [state, setState] = useState<LoadState>({ phase: 'loading' })
    const [creating, setCreating] = useState(false)
    const [draftName, setDraftName] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [dropping, setDropping] = useState<DbDatabase | null>(null)

    const load = useCallback(async () => {
        setState({ phase: 'loading' })
        const res = await callApi<DbDatabase[]>(`/api/db-servers/${encodeURIComponent(server.id)}/databases`, 'GET')
        if (!res.ok || !res.body) {
            setState({ phase: 'error', message: describeDriverError(res) })
            return
        }
        setState({ phase: 'ready', databases: res.body, readAt: new Date() })
    }, [server.id])

    useEffect(() => {
        void load()
    }, [load])

    const create = useCallback(async () => {
        const name = draftName.trim()
        if (!name) {
            setError('A database needs a name.')
            return
        }
        setBusy(true)
        setError(null)
        const res = await callApi(`/api/db-servers/${encodeURIComponent(server.id)}/databases`, 'POST', { name })
        setBusy(false)
        if (!res.ok) {
            setError(
                res.message === 'invalid_database_name'
                    ? 'Database names are lowercase snake_case: a letter first, then letters, digits, underscores.'
                    : `Couldn’t create database — ${describeDriverError(res)}`,
            )
            return
        }
        toast.show(`Database “${name}” created.`, { variant: 'success' })
        setCreating(false)
        setDraftName('')
        void load()
    }, [draftName, server.id, toast, load])

    const drop = useCallback(async () => {
        const db = dropping
        if (!db) return
        setBusy(true)
        const res = await callApi(
            `/api/db-servers/${encodeURIComponent(server.id)}/databases/${encodeURIComponent(db.name)}`,
            'DELETE',
        )
        setBusy(false)
        setDropping(null)
        if (!res.ok) {
            toast.show(`Couldn’t drop “${db.name}”: ${describeDriverError(res)}`, { variant: 'error' })
            return
        }
        toast.show(`Database “${db.name}” dropped.`, { variant: 'success' })
        void load()
    }, [dropping, server.id, toast, load])

    const databases = useMemo(() => (state.phase === 'ready' ? state.databases : []), [state])

    // The drop button lives in the injected tbody HTML — one delegated host
    // listener routes its data-action click back to the React handler.
    const onDelegated = useCallback(
        (event: Event) => {
            const el = (event.target as HTMLElement)?.closest?.('[data-action]') as HTMLElement | null
            if (!el) return
            const action = el.getAttribute('data-action')
            const name = el.getAttribute('data-name')
            if (!action || !name) return
            if (action === 'drop') {
                const db = databases.find((d) => d.name === name)
                if (db) setDropping(db)
            }
        },
        [databases],
    )

    const tableProps = useMemo(
        () => ({
            columns: COLUMNS,
            total: databases.length,
            limit: databases.length || 10,
            offset: 0,
            rows: databaseRowsHtml(databases, busy),
        }),
        [databases, busy],
    )
    const tableRef = useTc<HTMLElement>(tableProps, { click: onDelegated })

    if (state.phase === 'loading') return <LoadingState shape="rows" count={4} />
    if (state.phase === 'error') {
        return <ErrorState title="Couldn’t read the server" message={state.message} onRetry={() => void load()} />
    }

    const { readAt } = state
    return (
        <>
            <tc-section-card title="Databases" icon="database">
                <div className="quaykeeper-admin-section">
                    <div className="quaykeeper-list-actions">
                        <tc-button variant="primary" size="sm" onClick={() => { setError(null); setDraftName(''); setCreating(true) }}>
                            Create database
                        </tc-button>
                        <tc-button variant="secondary" size="sm" outline onClick={() => void load()}>
                            Refresh
                        </tc-button>
                        <span className="quaykeeper-admin-hint">{`Read from server at ${fmtReadAt(readAt)}`}</span>
                    </div>

                    {databases.length === 0 ? (
                        <tc-empty-state icon="database">No databases on this server yet.</tc-empty-state>
                    ) : (
                        <tc-advanced-table ref={tableRef} />
                    )}
                </div>
            </tc-section-card>

            {creating && (
                <FormModal
                    key="create-db"
                    title="Create database"
                    busy={busy}
                    submitLabel="Create"
                    onSubmit={() => void create()}
                    onClose={() => setCreating(false)}
                >
                    {error && <tc-banner variant="danger">{error}</tc-banner>}
                    <FormGroup title="Database">
                        <TextField
                            label="Name"
                            placeholder="app_db"
                            help="Lowercase snake_case — a letter first, then letters, digits, underscores."
                            value={draftName}
                            onValue={setDraftName}
                        />
                    </FormGroup>
                </FormModal>
            )}

            {dropping && (
                <TypeToConfirmModal
                    title="Drop database?"
                    verb="Drop database"
                    name={dropping.name}
                    message={`This permanently deletes “${dropping.name}” and ALL data in it on ${server.name}. There is no undo — active connections are terminated.`}
                    busy={busy}
                    onConfirm={() => void drop()}
                    onClose={() => setDropping(null)}
                />
            )}
        </>
    )
}
