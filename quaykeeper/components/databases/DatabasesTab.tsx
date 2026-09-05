'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AdvancedTableColumn } from '@toolcase/web-components'
import { iconBtnHtml } from '@/lib/action-icons'
import { escapeHtml, useTc } from '@/lib/tc'
import type { DbDatabase, DbServer, DbServerKind } from '@/server/domain/types'
import { databaseNameFromDumpFileName } from '@/server/domain/db-dump'
import { formatBytes } from '@/server/domain/site-dashboard'
import { LoadingState, ErrorState } from '@/components/states'
import { FormModal, FormGroup } from '@/components/FormModal'
import { CheckField, TextField } from '@/components/fields'
import { useToast } from '@/components/Toast'
import { callApi, describeDriverError, fmtReadAt, TypeToConfirmModal } from './shared'

// Databases tab (quaykeeper_database_management.md §9): live table (name, owner,
// size), create, and drop behind a type-the-name confirmation. Every render is
// a fresh catalog read — the visible "read at hh:mm" + refresh keep that honest.
//
// Export/import move a database BETWEEN servers: the row's export button
// downloads a `pg_dump`/`mysqldump` SQL script, and "Import database" streams one
// back into a target database on another registered server. The dump carries
// schema + data only — access is re-applied from the Access tab, since roles are
// per-server (see `server/domain/db-dump.ts`).

const COLUMNS: AdvancedTableColumn[] = [
    { key: 'name', label: 'Database' },
    { key: 'owner', label: 'Owner' },
    { key: 'size', label: 'Size', align: 'right' },
    { key: 'actions', label: '', align: 'right' },
]

/** The dump/restore binaries an engine needs on the quaykeeper host, for the
 *  `dump_tool_missing` message (the API returns the code, not the path). */
const DUMP_TOOLS: Record<DbServerKind, string> = {
    postgres: 'pg_dump / psql (postgresql-client)',
    mysql: 'mysqldump / mysql (a MySQL client)',
}

type LoadState =
    | { phase: 'loading' }
    | { phase: 'error'; message: string }
    | { phase: 'ready'; databases: DbDatabase[]; readAt: Date }

/** Human message for a failed export/import — the codes only these two flows
 *  raise, falling through to the shared driver mapping for everything else. */
function describeDumpError(kind: DbServerKind, code: string | undefined, detail: string | undefined): string {
    switch (code) {
        case 'dump_tool_missing':
            return `The quaykeeper host has no ${DUMP_TOOLS[kind]} installed. Install it in the quaykeeper image, or point QUAYKEEPER_*_BIN at an existing one.`
        case 'import_too_large':
            return 'The dump is larger than the import limit (QUAYKEEPER_DB_IMPORT_MAX_BYTES).'
        case 'db_database_not_found':
            return 'That database no longer exists on this server — refresh the list.'
        case 'invalid_database_name':
            return 'Database names are lowercase snake_case: a letter first, then letters, digits, underscores.'
        default:
            return describeDriverError({ message: code, body: { detail } })
    }
}

/** `attachment; filename="…"` → the name, so the saved file keeps the server +
 *  timestamp the API chose. */
function fileNameFromDisposition(header: string | null): string | null {
    const m = header ? /filename="([^"]+)"/.exec(header) : null
    return m ? m[1] : null
}

function saveBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
}

// The injected <tbody> HTML — fed to tc-advanced-table via its `rows` property
// (relocation-safe; every interpolated value is escaped). The export and drop
// buttons are delegated `data-action` controls caught by the host click listener.
function databaseRowsHtml(databases: DbDatabase[], busy: boolean): string {
    return databases
        .map((db) => {
            const exportBtn = iconBtnHtml({
                icon: 'export',
                label: `Export ${db.name}`,
                disabled: busy,
                data: { action: 'export', name: db.name },
            })
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
                `<td class="text-end">${exportBtn}${drop}</td>` +
                `</tr>`
            )
        })
        .join('')
}

/** The .sql picker inside the import modal. `tc-file-dropzone` reports its pick
 *  through the `tc-files` CustomEvent, which JSX can't bind — hence `useTc`. */
function DumpPicker({ onFile, disabled }: { onFile: (file: File) => void; disabled: boolean }) {
    const ref = useTc<HTMLElement>(
        useMemo(() => ({ supported: [{ label: 'SQL dump (.sql)', extension: '.sql' }] }), []),
        useMemo(
            () => ({
                'tc-files': (event: Event) => {
                    if (disabled) return
                    const files = (event as CustomEvent<{ files: File[] }>).detail?.files
                    if (files?.length) onFile(files[0])
                },
            }),
            [onFile, disabled],
        ),
    )
    return <tc-file-dropzone ref={ref} />
}

export function DatabasesTab({ server }: { server: DbServer }) {
    const toast = useToast()
    const [state, setState] = useState<LoadState>({ phase: 'loading' })
    const [creating, setCreating] = useState(false)
    const [draftName, setDraftName] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [dropping, setDropping] = useState<DbDatabase | null>(null)
    const [exporting, setExporting] = useState<DbDatabase | null>(null)
    const [includeData, setIncludeData] = useState(true)
    const [importing, setImporting] = useState(false)
    const [dumpFile, setDumpFile] = useState<File | null>(null)
    const [targetName, setTargetName] = useState('')
    const [createTarget, setCreateTarget] = useState(true)

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

    // Export goes through `fetch` + a blob rather than a plain link so a refusal
    // arrives as a toast instead of replacing the page with raw JSON. The cost is
    // that the dump passes through browser memory — fine for a control plane, and
    // the server side still streams (nothing is buffered on the quaykeeper host).
    const runExport = useCallback(async () => {
        const db = exporting
        if (!db) return
        setBusy(true)
        setError(null)
        try {
            const res = await fetch(
                `/api/db-servers/${encodeURIComponent(server.id)}/databases/${encodeURIComponent(db.name)}/export` +
                    (includeData ? '' : '?data=0'),
                { cache: 'no-store' },
            )
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as
                    | { error?: string; detail?: string }
                    | null
                setError(`Couldn’t export “${db.name}” — ${describeDumpError(server.kind, body?.error, body?.detail)}`)
                return
            }
            const blob = await res.blob()
            saveBlob(blob, fileNameFromDisposition(res.headers.get('content-disposition')) ?? `${db.name}.sql`)
            toast.show(`Exported “${db.name}” (${formatBytes(blob.size)}).`, { variant: 'success' })
            setExporting(null)
        } catch {
            setError('The download failed before it finished — check the quaykeeper server log.')
        } finally {
            setBusy(false)
        }
    }, [exporting, includeData, server.id, server.kind, toast])

    // The uploaded file IS the request body (no multipart wrapper) — the route
    // pipes it straight into psql/mysql stdin.
    const runImport = useCallback(async () => {
        const name = targetName.trim()
        if (!dumpFile) {
            setError('Choose an exported .sql file first.')
            return
        }
        if (!name) {
            setError('Name the database this dump should be restored into.')
            return
        }
        setBusy(true)
        setError(null)
        try {
            const res = await fetch(
                `/api/db-servers/${encodeURIComponent(server.id)}/databases/${encodeURIComponent(name)}/import` +
                    (createTarget ? '?create=1' : ''),
                { method: 'POST', body: dumpFile, headers: { 'content-type': 'application/sql' } },
            )
            const body = (await res.json().catch(() => null)) as
                | { error?: string; detail?: string; created?: boolean }
                | null
            if (!res.ok) {
                setError(`Couldn’t import into “${name}” — ${describeDumpError(server.kind, body?.error, body?.detail)}`)
                return
            }
            toast.show(
                body?.created
                    ? `Created “${name}” and restored the dump into it.`
                    : `Restored the dump into “${name}”.`,
                { variant: 'success' },
            )
            setImporting(false)
            setDumpFile(null)
            setTargetName('')
            void load()
        } catch {
            setError('The upload failed before it finished — the restore was aborted.')
        } finally {
            setBusy(false)
        }
    }, [dumpFile, targetName, createTarget, server.id, server.kind, toast, load])

    /** Picking a file prefills the target from the dump's own filename — only
     *  when it is one quaykeeper produced, since a wrong guess here picks which
     *  database gets written to. */
    const pickDump = useCallback((file: File) => {
        setDumpFile(file)
        setError(null)
        setTargetName((current) => current || (databaseNameFromDumpFileName(file.name) ?? ''))
    }, [])

    const databases = useMemo(() => (state.phase === 'ready' ? state.databases : []), [state])

    // The row buttons live in the injected tbody HTML — one delegated host
    // listener routes their data-action clicks back to the React handlers.
    const onDelegated = useCallback(
        (event: Event) => {
            const el = (event.target as HTMLElement)?.closest?.('[data-action]') as HTMLElement | null
            if (!el) return
            const action = el.getAttribute('data-action')
            const name = el.getAttribute('data-name')
            if (!action || !name) return
            const db = databases.find((d) => d.name === name)
            if (!db) return
            if (action === 'drop') setDropping(db)
            if (action === 'export') {
                setError(null)
                setIncludeData(true)
                setExporting(db)
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
                        <tc-button
                            variant="secondary"
                            size="sm"
                            outline
                            onClick={() => {
                                setError(null)
                                setDumpFile(null)
                                setTargetName('')
                                setCreateTarget(true)
                                setImporting(true)
                            }}
                        >
                            Import database
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
                    {error && <tc-banner variant="error">{error}</tc-banner>}
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

            {exporting && (
                <FormModal
                    key={`export-${exporting.name}`}
                    title={`Export ${exporting.name}`}
                    busy={busy}
                    submitLabel="Download dump"
                    onSubmit={() => void runExport()}
                    onClose={() => setExporting(null)}
                >
                    {error && <tc-banner variant="error">{error}</tc-banner>}
                    <tc-banner variant="info">
                        {`Downloads a plain SQL script you can import into another registered ${server.kind === 'postgres' ? 'PostgreSQL' : 'MySQL'} server. Users, ownership, and grants are NOT included — re-apply access from the Access tab after importing.`}
                    </tc-banner>
                    <FormGroup title="Contents">
                        <CheckField
                            checked={includeData}
                            onChecked={setIncludeData}
                            disabled={busy}
                            label="Include table data (uncheck for structure only)"
                        />
                    </FormGroup>
                    {exporting.sizeBytes !== null && (
                        <span className="quaykeeper-admin-hint">
                            {`On-disk size on ${server.name}: ${formatBytes(exporting.sizeBytes)}. A large database can take minutes — keep this tab open.`}
                        </span>
                    )}
                </FormModal>
            )}

            {importing && (
                <FormModal
                    key="import-db"
                    title="Import database"
                    busy={busy}
                    submitLabel="Restore dump"
                    onSubmit={() => void runImport()}
                    onClose={() => setImporting(false)}
                >
                    {error && <tc-banner variant="error">{error}</tc-banner>}
                    <tc-banner variant="warning">
                        {`Restores a .sql dump exported from a ${server.kind === 'postgres' ? 'PostgreSQL' : 'MySQL'} server into ${server.name}. Restoring into a database that already holds these objects fails — import into an empty or new one. Grants are not part of a dump; re-apply them from the Access tab.`}
                    </tc-banner>
                    <FormGroup title="Dump file">
                        <DumpPicker onFile={pickDump} disabled={busy} />
                        {dumpFile && (
                            <span className="quaykeeper-admin-hint">
                                {`${dumpFile.name} — ${formatBytes(dumpFile.size)}`}
                            </span>
                        )}
                    </FormGroup>
                    <FormGroup title="Target">
                        <TextField
                            label="Database name"
                            placeholder="app_db"
                            help="Lowercase snake_case. It does not have to match the name on the source server."
                            value={targetName}
                            onValue={setTargetName}
                        />
                        <CheckField
                            checked={createTarget}
                            onChecked={setCreateTarget}
                            disabled={busy}
                            label="Create the database if it doesn’t exist yet"
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
