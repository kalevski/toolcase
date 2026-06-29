'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, describeApiError, ApiError, isAuthError } from '@/lib/fetcher'
import { useTc, detailValue } from '@/lib/tc'
import type { ProjectDetail, SecretMeta, SecretGenKind } from '@/server/domain/types'
import type { AdvancedTableColumn, AdvancedTableSort } from '@toolcase/web-components'

const KIND_OPTIONS: { value: SecretGenKind; label: string }[] = [
    { value: 'password', label: 'password' },
    { value: 'token', label: 'token' },
    { value: 'hex', label: 'hex' },
    { value: 'base64', label: 'base64' },
]

const PAGE_SIZE = 10

function buildColumns(canManage: boolean): AdvancedTableColumn[] {
    const cols: AdvancedTableColumn[] = [
        { key: 'key', label: 'Key' },
        { key: 'description', label: 'Description' },
    ]
    if (canManage) {
        cols.push({ key: 'value', label: 'Value' })
        cols.push({ key: 'actions', label: 'Actions', align: 'right' })
    }
    return cols
}

export function SecretsClient({ projectId }: { projectId: string }) {
    const router = useRouter()
    const [detail, setDetail] = useState<ProjectDetail | null>(null)
    const [secrets, setSecrets] = useState<SecretMeta[] | null>(null)
    const [err, setErr] = useState<string | null>(null)
    const [offset, setOffset] = useState(0)
    const [sort, setSort] = useState<AdvancedTableSort | null>({ column: 'key', direction: 'asc' })
    // Revealed plaintext keyed by secret id (cleared on reload).
    const [revealed, setRevealed] = useState<Record<string, string>>({})
    const [busyReveal, setBusyReveal] = useState<string | null>(null)

    const canManage = detail ? detail.effectiveRole !== 'developer' : false

    const load = useCallback(
        async (signal?: AbortSignal) => {
            try {
                const d = await apiFetch<ProjectDetail>(`/api/projects/${projectId}`, { signal })
                const s = await apiFetch<SecretMeta[]>(`/api/projects/${projectId}/secrets`, { signal })
                if (signal?.aborted) return
                setDetail(d)
                setSecrets(s)
                setRevealed({})
            } catch (e) {
                if (signal?.aborted) return
                setErr(isAuthError(e) ? 'You don’t have access to this project.' : describeApiError(e))
            }
        },
        [projectId],
    )

    useEffect(() => {
        const ctrl = new AbortController()
        void load(ctrl.signal)
        return () => ctrl.abort()
    }, [load])

    // ── create (key + value + description) ────────────────────────────────────
    const [cKey, setCKey] = useState('')
    const [cValue, setCValue] = useState('')
    const [cDesc, setCDesc] = useState('')
    const cKeyRef = useRef(cKey)
    cKeyRef.current = cKey
    const cValueRef = useRef(cValue)
    cValueRef.current = cValue
    const cDescRef = useRef(cDesc)
    cDescRef.current = cDesc

    const cKeyTc = useTc<HTMLElement>(
        useMemo(() => ({ value: cKey }), [cKey]),
        { 'tc-change': (e: Event) => setCKey(detailValue<string>(e) ?? '') },
    )
    const cValueTc = useTc<HTMLElement>(
        useMemo(() => ({ value: cValue }), [cValue]),
        { 'tc-change': (e: Event) => setCValue(detailValue<string>(e) ?? '') },
    )
    const cDescTc = useTc<HTMLElement>(
        useMemo(() => ({ value: cDesc }), [cDesc]),
        { 'tc-change': (e: Event) => setCDesc(detailValue<string>(e) ?? '') },
    )

    const create = async () => {
        const key = cKeyRef.current.trim()
        if (!key || !cValueRef.current) return
        setErr(null)
        try {
            await apiFetch(`/api/projects/${projectId}/secrets`, {
                method: 'POST',
                body: JSON.stringify({
                    key,
                    value: cValueRef.current,
                    description: cDescRef.current.trim() || undefined,
                }),
            })
            setCKey('')
            setCValue('')
            setCDesc('')
            await load()
        } catch (e) {
            setErr(createError(e))
        }
    }

    // ── generate (key + kind + length) ────────────────────────────────────────
    const [gKey, setGKey] = useState('')
    const [gKind, setGKind] = useState<SecretGenKind>('password')
    const [gLen, setGLen] = useState('32')
    const gKeyRef = useRef(gKey)
    gKeyRef.current = gKey
    const gKindRef = useRef(gKind)
    gKindRef.current = gKind
    const gLenRef = useRef(gLen)
    gLenRef.current = gLen

    const gKeyTc = useTc<HTMLElement>(
        useMemo(() => ({ value: gKey }), [gKey]),
        { 'tc-change': (e: Event) => setGKey(detailValue<string>(e) ?? '') },
    )
    const gKindTc = useTc<HTMLElement>(
        useMemo(() => ({ items: KIND_OPTIONS.map((o) => ({ key: o.value, label: o.label })), value: gKind }), [gKind]),
        { 'tc-change': (e: Event) => setGKind((detailValue<string>(e) as SecretGenKind) ?? 'password') },
    )
    const gLenTc = useTc<HTMLElement>(
        useMemo(() => ({ value: gLen }), [gLen]),
        { 'tc-change': (e: Event) => setGLen(detailValue<string>(e) ?? '') },
    )

    const generate = async () => {
        const key = gKeyRef.current.trim()
        const length = Number(gLenRef.current)
        if (!key || !Number.isInteger(length) || length <= 0) return
        setErr(null)
        try {
            await apiFetch(`/api/projects/${projectId}/secrets/generate`, {
                method: 'POST',
                body: JSON.stringify({ key, kind: gKindRef.current, length }),
            })
            setGKey('')
            setGLen('32')
            await load()
        } catch (e) {
            setErr(createError(e))
        }
    }

    const remove = async (id: string) => {
        setErr(null)
        try {
            await apiFetch(`/api/projects/${projectId}/secrets/${id}`, { method: 'DELETE' })
            await load()
        } catch (e) {
            setErr(
                e instanceof ApiError && e.status === 409
                    ? 'This secret is referenced by env vars and cannot be deleted.'
                    : describeApiError(e),
            )
        }
    }

    const reveal = async (secret: SecretMeta) => {
        setBusyReveal(secret.id)
        setErr(null)
        try {
            const { value } = await apiFetch<{ value: string }>(
                `/api/projects/${projectId}/secrets/${secret.id}/reveal`,
            )
            setRevealed((prev) => ({ ...prev, [secret.id]: value }))
        } catch (e) {
            setErr(describeApiError(e))
        } finally {
            setBusyReveal(null)
        }
    }

    const hide = (id: string) =>
        setRevealed((prev) => {
            const next = { ...prev }
            delete next[id]
            return next
        })

    // ── edit (modal) ──────────────────────────────────────────────────────────
    const [editTarget, setEditTarget] = useState<SecretMeta | null>(null)
    const [eValue, setEValue] = useState('')
    const [eDesc, setEDesc] = useState('')
    const eValueRef = useRef(eValue)
    eValueRef.current = eValue
    const eDescRef = useRef(eDesc)
    eDescRef.current = eDesc

    const openEdit = (secret: SecretMeta) => {
        setEValue('')
        setEDesc(secret.description ?? '')
        setEditTarget(secret)
    }

    const eValueTc = useTc<HTMLElement>(
        useMemo(() => ({ value: eValue }), [eValue]),
        { 'tc-change': (e: Event) => setEValue(detailValue<string>(e) ?? '') },
    )
    const eDescTc = useTc<HTMLElement>(
        useMemo(() => ({ value: eDesc }), [eDesc]),
        { 'tc-change': (e: Event) => setEDesc(detailValue<string>(e) ?? '') },
    )
    const editModalRef = useTc<HTMLElement>(
        useMemo(() => ({ open: editTarget !== null }), [editTarget]),
        { 'tc-hidden': () => setEditTarget(null) },
    )

    const saveEdit = async () => {
        const target = editTarget
        if (!target) return
        setErr(null)
        const body: { value?: string; description?: string } = { description: eDescRef.current }
        if (eValueRef.current.length > 0) body.value = eValueRef.current
        try {
            await apiFetch(`/api/projects/${projectId}/secrets/${target.id}`, {
                method: 'PATCH',
                body: JSON.stringify(body),
            })
            setEditTarget(null)
            await load()
        } catch (e) {
            setErr(describeApiError(e))
        }
    }

    // ── delete confirmation ───────────────────────────────────────────────────
    const [pendingDelete, setPendingDelete] = useState<SecretMeta | null>(null)
    const confirmTc = useTc<HTMLElement>(
        useMemo(() => ({ open: pendingDelete !== null }), [pendingDelete]),
        {
            'tc-confirm': () => {
                const target = pendingDelete
                setPendingDelete(null)
                if (target) void remove(target.id)
            },
            'tc-cancel': () => setPendingDelete(null),
        },
    )

    // ── table: client-side sort + page ────────────────────────────────────────
    const columns = useMemo(() => buildColumns(canManage), [canManage])
    const sortable = useMemo(() => ['key', 'description'], [])

    const sorted = useMemo(() => {
        const list = [...(secrets ?? [])]
        if (sort) {
            const dir = sort.direction === 'asc' ? 1 : -1
            list.sort((a, b) => {
                const av = (sort.column === 'description' ? a.description ?? '' : a.key).toLowerCase()
                const bv = (sort.column === 'description' ? b.description ?? '' : b.key).toLowerCase()
                return av < bv ? -dir : av > bv ? dir : 0
            })
        }
        return list
    }, [secrets, sort])

    const total = sorted.length
    const safeOffset = Math.min(offset, Math.max(0, total - 1))
    const pageRows = useMemo(() => sorted.slice(safeOffset, safeOffset + PAGE_SIZE), [sorted, safeOffset])

    const tableRef = useTc<HTMLElement>(
        useMemo(
            () => ({ columns, sortableColumns: sortable, sort, limit: PAGE_SIZE, offset: safeOffset, total }),
            [columns, sortable, sort, safeOffset, total],
        ),
        {
            'tc-page-change': (e: Event) => setOffset((e as CustomEvent).detail?.offset ?? 0),
            'tc-sort-change': (e: Event) => {
                const d = (e as CustomEvent).detail
                setSort(d?.column ? { column: d.column, direction: d.direction } : null)
                setOffset(0)
            },
        },
    )

    // Remount when the visible rows / reveal state change so the captured <tr>
    // set is always rebuilt cleanly.
    const tableKey = `${canManage}_${sort?.column ?? ''}_${sort?.direction ?? ''}_${safeOffset}_${pageRows
        .map((s) => `${s.id}:${revealed[s.id] != null ? 1 : 0}`)
        .join('-')}`

    if (err && !detail) return <tc-banner variant="error">{err}</tc-banner>
    if (!detail || secrets === null) {
        return (
            <div className="wharf-status-line">
                <tc-spinner type="border" size="sm" /> Loading…
            </div>
        )
    }

    return (
        <div className="wharf-page">
            <tc-rich-page-header
                icon-name="KeyRound"
                icon-color="amber"
                title-text="Secrets"
                sub="Opaque values — devops only; developers reference by key"
                description="Project-level encrypted values. devops can create, reveal and rotate them; developers may see the key names only and reference them from env vars — they can never view the values."
            >
                <tc-button
                    slot="actions"
                    variant="secondary"
                    outline
                    size="sm"
                    onClick={() => router.push(`/projects/${projectId}`)}
                >
                    ← Project
                </tc-button>
            </tc-rich-page-header>


            {err && <tc-banner variant="error">{err}</tc-banner>}

            {!canManage && (
                <tc-banner variant="warning">
                    You can see secret names so you can reference them, but only devops can view or change
                    their values.
                </tc-banner>
            )}

            {canManage && (
                <>
                    <tc-section-card title="New secret" icon="KeyRound">
                        <div className="wharf-section-body">
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <tc-input ref={cKeyTc} label="Key" placeholder="e.g. DATABASE_PASSWORD" style={{ flex: '1 1 14rem' }} />
                                <tc-input ref={cValueTc} label="Value" placeholder="secret value" style={{ flex: '1 1 14rem' }} />
                                <tc-input ref={cDescTc} label="Description" placeholder="optional" style={{ flex: '1 1 12rem' }} />
                            </div>
                            <div style={{ marginTop: '0.5rem' }}>
                                <tc-button variant="primary" onClick={create} disabled={!cKey.trim() || !cValue}>
                                    Add
                                </tc-button>
                            </div>
                        </div>
                    </tc-section-card>

                    <tc-section-card title="Generate secret" icon="Variable">
                        <div className="wharf-section-body">
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <tc-input ref={gKeyTc} label="Key" placeholder="e.g. API_TOKEN" style={{ flex: '1 1 14rem' }} />
                                <tc-extended-select ref={gKindTc} label="Kind" style={{ flex: '0 1 10rem' }} />
                                <tc-input ref={gLenTc} label="Length" placeholder="32" style={{ flex: '0 1 8rem' }} />
                            </div>
                            <div style={{ marginTop: '0.5rem' }}>
                                <tc-button variant="secondary" onClick={generate} disabled={!gKey.trim()}>
                                    Generate
                                </tc-button>
                            </div>
                        </div>
                    </tc-section-card>
                </>
            )}

            <tc-section-card title="Secrets" icon="KeyRound">
                <div className="wharf-section-body">
                    {secrets.length === 0 ? (
                        <tc-empty-state icon="KeyRound">
                            <h2>No secrets</h2>
                            <p>{canManage ? 'Add or generate a secret above.' : 'No secrets yet.'}</p>
                        </tc-empty-state>
                    ) : (
                        <tc-advanced-table key={tableKey} ref={tableRef}>
                            {pageRows.map((s) => {
                                const shown = revealed[s.id]
                                return (
                                    <tr key={s.id}>
                                        <td>
                                            <code className="wharf-mono">{s.key}</code>
                                        </td>
                                        <td style={{ color: 'var(--tc-text-muted)' }}>{s.description ?? '—'}</td>
                                        {canManage && (
                                            <td>
                                                {shown == null ? (
                                                    <span style={{ color: 'var(--tc-text-faint)' }}>••••••••</span>
                                                ) : (
                                                    <code className="wharf-mono" style={{ wordBreak: 'break-all' }}>{shown}</code>
                                                )}
                                            </td>
                                        )}
                                        {canManage && (
                                            <td style={{ textAlign: 'right' }}>
                                                <span style={{ display: 'inline-flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                                    {shown == null ? (
                                                        <tc-button size="sm" variant="secondary" outline disabled={busyReveal === s.id} onClick={() => reveal(s)}>
                                                            {busyReveal === s.id ? 'Revealing…' : 'Reveal'}
                                                        </tc-button>
                                                    ) : (
                                                        <tc-button size="sm" variant="secondary" outline onClick={() => hide(s.id)}>
                                                            Hide
                                                        </tc-button>
                                                    )}
                                                    <tc-button size="sm" variant="secondary" outline onClick={() => openEdit(s)}>
                                                        Edit
                                                    </tc-button>
                                                    <tc-button size="sm" variant="danger" outline onClick={() => setPendingDelete(s)}>
                                                        Delete
                                                    </tc-button>
                                                </span>
                                            </td>
                                        )}
                                    </tr>
                                )
                            })}
                        </tc-advanced-table>
                    )}
                </div>
            </tc-section-card>

            <tc-modal ref={editModalRef} title="Edit secret" centered>
                <p style={{ margin: '0 0 0.75rem', color: 'var(--tc-text-muted)' }}>
                    Update <code className="wharf-mono">{editTarget?.key ?? ''}</code>. Leave the value blank to keep
                    the current secret.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <tc-input ref={eValueTc} label="New value" placeholder="leave blank to keep current" />
                    <tc-input ref={eDescTc} label="Description" placeholder="optional" />
                </div>
                <tc-button slot="footer" variant="secondary" outline onClick={() => setEditTarget(null)}>
                    Cancel
                </tc-button>
                <tc-button slot="footer" variant="primary" onClick={saveEdit}>
                    Save
                </tc-button>
            </tc-modal>

            <tc-confirm-dialog
                ref={confirmTc}
                eyebrow="Delete secret"
                dialog-title="Delete this secret?"
                message={
                    pendingDelete
                        ? `“${pendingDelete.key}” will be permanently removed. This cannot be undone.`
                        : ''
                }
                confirm-label="Delete"
                cancel-label="Cancel"
                danger
            />
        </div>
    )
}

function createError(e: unknown): string {
    if (e instanceof ApiError) {
        if (e.status === 409) return 'A secret with that key already exists.'
        if (e.status === 400) return 'Invalid key. Use letters, digits and underscores; must not start with a digit.'
    }
    return describeApiError(e)
}
