'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DbAccessLevel, DbGrant, DbOperation, DbServer } from '@/server/domain/types'
import { DB_ACCESS_LEVELS, DB_OPERATIONS, DB_OPERATION_META } from '@/server/domain/types'
import { levelForOperations, levelOperations } from '@/server/domain/db-access'
import { LoadingState, ErrorState } from '@/components/states'
import { useToast } from '@/components/Toast'
import { FormModal, FormGroup } from '@/components/FormModal'
import { CheckField } from '@/components/fields'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { callApi, describeDriverError, fmtReadAt } from './shared'

// Access tab (quaykeeper_database_management.md §9): the user × database matrix.
// Users are rows, databases columns; each cell is a level selector plus a
// detailed per-operation editor (select/insert/update/… — the privilege surface
// common to postgres and mysql). `custom` (a live grant set matching no level)
// renders as a badge-y disabled option with its operation detail underneath —
// quaykeeper reports it but only overwrites it when a level or operation set is
// explicitly applied (§3). One PUT per change, optimistic with rollback for the
// quick selector. The matrix omits the registry admin account and superusers —
// their access is implicit, a cell would lie (§10).

interface Matrix {
    databases: string[]
    users: string[]
    grants: DbGrant[]
}

type LoadState =
    | { phase: 'loading' }
    | { phase: 'error'; message: string }
    | { phase: 'ready'; matrix: Matrix; readAt: Date }

const LEVEL_LABEL: Record<DbAccessLevel | 'custom', string> = {
    none: 'None',
    read: 'Read',
    readwrite: 'Read + write',
    owner: 'Owner',
    custom: 'Custom',
}

const LEVEL_HINT: Record<DbAccessLevel, string> = {
    none: 'No access — every privilege revoked.',
    read: 'Query data: select only.',
    readwrite: 'Work with data: select, insert, update, delete (+ temp tables).',
    owner: 'Everything the engine can grant on this database (ALL).',
}

const OP_GROUPS: { key: 'data' | 'structure' | 'routines'; title: string }[] = [
    { key: 'data', title: 'Data' },
    { key: 'structure', title: 'Structure' },
    { key: 'routines', title: 'Routines' },
]

/** Composite cell key; NUL can appear in neither name. */
const KEY_SEP = String.fromCharCode(0)
const cellKey = (user: string, db: string) => user + KEY_SEP + db

/** Short human summary of a grant's operation detail for the matrix cell. */
function opSummary(grant: DbGrant): string {
    const parts = grant.operations.map((op) => DB_OPERATION_META[op].label.toLowerCase())
    if (grant.extras.length > 0) parts.push(`+${grant.extras.join(', ')}`)
    return parts.length > 0 ? parts.join(', ') : 'no operations'
}

// ── detailed per-cell editor ──────────────────────────────────────────────────

function AccessEditor({
    server,
    grant,
    onApplied,
    onClose,
}: {
    server: DbServer
    grant: DbGrant
    /** Called with the server's returned grant after a successful PUT. */
    onApplied: (grant: DbGrant) => void
    onClose: () => void
}) {
    const toast = useToast()
    const [busy, setBusy] = useState(false)
    // `owner` is a mode, not a checkbox set: its real grant is engine ALL, a
    // strict superset of the nine operations.
    const [owner, setOwner] = useState(grant.level === 'owner')
    const [checked, setChecked] = useState<Set<DbOperation>>(
        () => new Set(grant.level === 'owner' ? DB_OPERATIONS : grant.operations),
    )
    const [confirmingOwnership, setConfirmingOwnership] = useState(false)
    const [takingOwnership, setTakingOwnership] = useState(false)

    const selection = useMemo(() => DB_OPERATIONS.filter((op) => checked.has(op)), [checked])
    /** The preset the current selection reads back as (drives the active pill). */
    const activePreset: DbAccessLevel | 'custom' = owner
        ? 'owner'
        : levelForOperations(server.kind, selection)

    const pickPreset = (level: DbAccessLevel) => {
        setOwner(level === 'owner')
        setChecked(new Set(level === 'owner' ? DB_OPERATIONS : levelOperations(server.kind, level)))
    }

    const toggle = (op: DbOperation, on: boolean) => {
        setOwner(false)
        setChecked((prev) => {
            const next = new Set(prev)
            if (on) next.add(op)
            else next.delete(op)
            return next
        })
    }

    const apply = async () => {
        if (busy) return
        setBusy(true)
        // Presets travel as levels (canonical, engine-aware); anything else as
        // the explicit operation set.
        const body =
            activePreset !== 'custom'
                ? { user: grant.user, database: grant.database, level: activePreset }
                : { user: grant.user, database: grant.database, operations: selection }
        const res = await callApi<DbGrant>(
            `/api/db-servers/${encodeURIComponent(server.id)}/grants`,
            'PUT',
            body,
        )
        setBusy(false)
        if (!res.ok || !res.body) {
            toast.show(
                `Couldn’t set ${grant.user} on ${grant.database}: ${describeDriverError(res)}`,
                { variant: 'error' },
            )
            return
        }
        const summary =
            activePreset !== 'custom' ? LEVEL_LABEL[activePreset].toLowerCase() : opSummary(res.body)
        toast.show(`${grant.user} on ${grant.database}: ${summary}.`, { variant: 'success' })
        onApplied(res.body)
    }

    const takeOwnership = async () => {
        setConfirmingOwnership(false)
        setTakingOwnership(true)
        const res = await callApi<DbGrant>(
            `/api/db-servers/${encodeURIComponent(server.id)}/grants/own`,
            'POST',
            { user: grant.user, database: grant.database },
        )
        setTakingOwnership(false)
        if (!res.ok || !res.body) {
            toast.show(
                `Couldn’t reassign ownership to ${grant.user} on ${grant.database}: ${describeDriverError(res)}`,
                { variant: 'error' },
            )
            return
        }
        toast.show(`${grant.user} now owns every object in ${grant.database}.`, { variant: 'success' })
        onApplied(res.body)
    }

    return (
        <FormModal
            title={`${grant.user} @ ${grant.database}`}
            busy={busy}
            submitLabel="Apply access"
            onSubmit={() => void apply()}
            onClose={onClose}
        >
            {grant.extras.length > 0 && (
                <tc-banner variant="warning">
                    {`This grant carries privileges quaykeeper can’t express as operations: ${grant.extras.join(
                        ', ',
                    )}. Applying is a full reset — they will be revoked.`}
                </tc-banner>
            )}

            <FormGroup title="Presets">
                <div className="quaykeeper-access-presets">
                    {DB_ACCESS_LEVELS.map((level) => (
                        <tc-button
                            key={level}
                            size="sm"
                            variant={activePreset === level ? 'primary' : 'secondary'}
                            outline={activePreset !== level || undefined}
                            disabled={busy || undefined}
                            onClick={() => pickPreset(level)}
                        >
                            {LEVEL_LABEL[level]}
                        </tc-button>
                    ))}
                </div>
                <p className="quaykeeper-admin-hint">
                    {activePreset !== 'custom'
                        ? LEVEL_HINT[activePreset as DbAccessLevel]
                        : 'Custom operation set — applied exactly as checked below.'}
                </p>
            </FormGroup>

            {OP_GROUPS.map((group) => (
                <FormGroup key={group.key} title={group.title}>
                    <div className="quaykeeper-access-ops">
                        {DB_OPERATIONS.filter((op) => DB_OPERATION_META[op].group === group.key).map(
                            (op) => {
                                const meta = DB_OPERATION_META[op]
                                return (
                                    <div key={op} className="quaykeeper-access-op">
                                        <CheckField
                                            label={meta.label}
                                            checked={checked.has(op)}
                                            disabled={busy || owner}
                                            inline
                                            onChecked={(on) => toggle(op, on)}
                                        />
                                        <div className="quaykeeper-admin-hint">
                                            {meta.description}{' '}
                                            <span className="quaykeeper-admin-mono">
                                                {server.kind === 'postgres' ? meta.postgres : meta.mysql}
                                            </span>
                                        </div>
                                    </div>
                                )
                            },
                        )}
                    </div>
                </FormGroup>
            ))}

            <p className="quaykeeper-admin-hint">
                {owner
                    ? 'Owner grants the engine’s ALL on this database — more than the checkboxes can express; they are shown checked and locked.'
                    : 'Applying replaces the user’s entire grant on this database (full reset), so re-applying repairs drift.'}
                {server.kind === 'postgres' &&
                    ' Postgres: tables created later by other roles may need a re-apply (default privileges follow their creator).'}
            </p>

            {server.kind === 'postgres' && (
                <FormGroup title="Full ownership (optional)">
                    <p className="quaykeeper-admin-hint">
                        Beyond Owner access: reassign real catalog ownership of every table, sequence,
                        view, function, schema and type in {grant.database} — plus the database itself —
                        to {grant.user}. Whoever owns them now loses that ownership immediately.
                    </p>
                    <tc-button
                        variant="danger"
                        size="sm"
                        outline
                        disabled={busy || takingOwnership}
                        onClick={() => setConfirmingOwnership(true)}
                    >
                        {takingOwnership ? 'Reassigning…' : `Make ${grant.user} own everything`}
                    </tc-button>
                </FormGroup>
            )}

            <ConfirmDialog
                open={confirmingOwnership}
                title="Reassign all ownership?"
                message={`Every table, sequence, view, function, schema and type in “${grant.database}” — plus the database itself — moves to “${grant.user}”. Whoever owns them now loses that ownership immediately. This can't be undone with a re-apply the way grants can.`}
                confirmLabel="Reassign ownership"
                danger
                onConfirm={() => void takeOwnership()}
                onCancel={() => setConfirmingOwnership(false)}
            />
        </FormModal>
    )
}

// ── the matrix ────────────────────────────────────────────────────────────────

export function AccessTab({ server }: { server: DbServer }) {
    const toast = useToast()
    const [state, setState] = useState<LoadState>({ phase: 'loading' })
    /** Cells with a PUT in flight — their selects lock until it lands. */
    const [saving, setSaving] = useState<Set<string>>(new Set())
    /** Cell being edited in the detailed editor (keyed remount per open). */
    const [editing, setEditing] = useState<DbGrant | null>(null)

    const load = useCallback(async () => {
        setState({ phase: 'loading' })
        const res = await callApi<Matrix>(`/api/db-servers/${encodeURIComponent(server.id)}/grants`, 'GET')
        if (!res.ok || !res.body) {
            setState({ phase: 'error', message: describeDriverError(res) })
            return
        }
        setState({ phase: 'ready', matrix: res.body, readAt: new Date() })
    }, [server.id])

    useEffect(() => {
        void load()
    }, [load])

    /** Swap one cell's grant in place (server response or optimistic paint). */
    const paintCell = useCallback((user: string, database: string, grant: DbGrant) => {
        setState((s) =>
            s.phase === 'ready'
                ? {
                      ...s,
                      matrix: {
                          ...s.matrix,
                          grants: s.matrix.grants.map((g) =>
                              g.user === user && g.database === database ? grant : g,
                          ),
                      },
                  }
                : s,
        )
    }, [])

    const setCell = useCallback(
        async (previous: DbGrant, level: DbAccessLevel) => {
            const { user, database } = previous
            const key = cellKey(user, database)
            // Optimistic: paint the new level, lock the cell, roll back on failure.
            paintCell(user, database, {
                user,
                database,
                level,
                operations: levelOperations(server.kind, level),
                extras: [],
            })
            setSaving((prev) => new Set(prev).add(key))
            const res = await callApi<DbGrant>(
                `/api/db-servers/${encodeURIComponent(server.id)}/grants`,
                'PUT',
                { user, database, level },
            )
            setSaving((prev) => {
                const next = new Set(prev)
                next.delete(key)
                return next
            })
            if (!res.ok || !res.body) {
                paintCell(user, database, previous)
                toast.show(`Couldn’t set ${user} on ${database}: ${describeDriverError(res)}`, {
                    variant: 'error',
                })
                return
            }
            paintCell(user, database, res.body)
            toast.show(`${user} on ${database}: ${LEVEL_LABEL[level].toLowerCase()}.`, {
                variant: 'success',
            })
        },
        [server.id, server.kind, toast, paintCell],
    )

    if (state.phase === 'loading') return <LoadingState shape="rows" count={4} />
    if (state.phase === 'error') {
        return <ErrorState title="Couldn’t read the server" message={state.message} onRetry={() => void load()} />
    }

    const { matrix, readAt } = state
    const grantOf = new Map(matrix.grants.map((g) => [cellKey(g.user, g.database), g]))
    const emptyGrant = (user: string, database: string): DbGrant => ({
        user,
        database,
        level: 'none',
        operations: [],
        extras: [],
    })

    return (
        <tc-section-card title="Access" icon="lock">
            <div className="quaykeeper-admin-section">
                <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                    Levels are applied as a full reset + grant, so re-selecting a level repairs drift.
                    “Detailed…” opens the per-operation editor (select, insert, update, delete, DDL, …).
                    “Custom” marks grants made outside quaykeeper — they are only overwritten when you
                    apply a level or operation set explicitly.
                    {server.kind === 'postgres' &&
                        ' Postgres note: tables created later by other roles may need the access re-applied (default privileges follow their creator).'}
                </p>
                <div className="quaykeeper-list-actions">
                    <tc-button variant="secondary" size="sm" outline onClick={() => void load()}>
                        Refresh
                    </tc-button>
                    <span className="quaykeeper-admin-hint">{`Read from server at ${fmtReadAt(readAt)}`}</span>
                </div>

                {matrix.users.length === 0 || matrix.databases.length === 0 ? (
                    <tc-empty-state icon="lock">
                        {matrix.users.length === 0
                            ? 'No manageable users — create one on the Users tab (the admin account and superusers are not listed here).'
                            : 'No databases — create one on the Databases tab.'}
                    </tc-empty-state>
                ) : (
                    <div className="table-responsive">
                        <table className="table align-middle">
                            <thead>
                                <tr>
                                    <th scope="col">User</th>
                                    {matrix.databases.map((db) => (
                                        <th scope="col" key={db} className="quaykeeper-admin-mono">
                                            {db}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {matrix.users.map((user) => (
                                    <tr key={user}>
                                        <th scope="row" className="quaykeeper-admin-mono">
                                            {user}
                                        </th>
                                        {matrix.databases.map((db) => {
                                            const key = cellKey(user, db)
                                            const grant = grantOf.get(key) ?? emptyGrant(user, db)
                                            const isSaving = saving.has(key)
                                            return (
                                                <td key={db} title={opSummary(grant)}>
                                                    <select
                                                        className="form-select form-select-sm"
                                                        value={grant.level}
                                                        disabled={isSaving}
                                                        aria-label={`${user} access on ${db}`}
                                                        onChange={(e) => {
                                                            const value = e.target.value
                                                            if (value === '__detailed') {
                                                                // No state change — the controlled
                                                                // value snaps back on re-render.
                                                                setEditing(grant)
                                                                return
                                                            }
                                                            void setCell(grant, value as DbAccessLevel)
                                                        }}
                                                    >
                                                        {grant.level === 'custom' && (
                                                            <option value="custom" disabled>
                                                                Custom (outside quaykeeper)
                                                            </option>
                                                        )}
                                                        {DB_ACCESS_LEVELS.map((l) => (
                                                            <option key={l} value={l}>
                                                                {LEVEL_LABEL[l]}
                                                            </option>
                                                        ))}
                                                        <option value="__detailed">Detailed…</option>
                                                    </select>
                                                    {grant.level === 'custom' && (
                                                        <div className="quaykeeper-admin-hint quaykeeper-access-cell-detail">
                                                            {opSummary(grant)}
                                                        </div>
                                                    )}
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {editing && (
                <AccessEditor
                    key={cellKey(editing.user, editing.database)}
                    server={server}
                    grant={editing}
                    onApplied={(next) => {
                        paintCell(next.user, next.database, next)
                        setEditing(null)
                    }}
                    onClose={() => setEditing(null)}
                />
            )}
        </tc-section-card>
    )
}
