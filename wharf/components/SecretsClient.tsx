'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, describeApiError, ApiError, isAuthError } from '@/lib/fetcher'
import { useTc, detailValue } from '@/lib/tc'
import type { ProjectDetail, SecretMeta, SecretGenKind } from '@/server/domain/types'

const KIND_OPTIONS: { value: SecretGenKind; label: string }[] = [
    { value: 'password', label: 'password' },
    { value: 'token', label: 'token' },
    { value: 'hex', label: 'hex' },
    { value: 'base64', label: 'base64' },
]

export function SecretsClient({ projectId }: { projectId: string }) {
    const router = useRouter()
    const [detail, setDetail] = useState<ProjectDetail | null>(null)
    const [secrets, setSecrets] = useState<SecretMeta[] | null>(null)
    const [err, setErr] = useState<string | null>(null)

    const canManage = detail ? detail.effectiveRole !== 'developer' : false

    const load = useCallback(
        async (signal?: AbortSignal) => {
            try {
                const d = await apiFetch<ProjectDetail>(`/api/projects/${projectId}`, { signal })
                const s = await apiFetch<SecretMeta[]>(`/api/projects/${projectId}/secrets`, { signal })
                if (signal?.aborted) return
                setDetail(d)
                setSecrets(s)
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
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Key</th>
                                    <th>Description</th>
                                    {canManage && <th>Value</th>}
                                    {canManage && <th style={{ textAlign: 'right' }}>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {secrets.map((s) => (
                                    <SecretRow
                                        key={s.id}
                                        projectId={projectId}
                                        secret={s}
                                        canManage={canManage}
                                        onChanged={load}
                                        onError={setErr}
                                        onDelete={() => setPendingDelete(s)}
                                    />
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </tc-section-card>

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

function SecretRow({
    projectId,
    secret,
    canManage,
    onChanged,
    onError,
    onDelete,
}: {
    projectId: string
    secret: SecretMeta
    canManage: boolean
    onChanged: () => Promise<void>
    onError: (msg: string | null) => void
    onDelete: () => void
}) {
    const [revealed, setRevealed] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [editing, setEditing] = useState(false)
    const [eValue, setEValue] = useState('')
    const [eDesc, setEDesc] = useState(secret.description ?? '')
    const eValueRef = useRef(eValue)
    eValueRef.current = eValue
    const eDescRef = useRef(eDesc)
    eDescRef.current = eDesc

    const eValueTc = useTc<HTMLElement>(
        useMemo(() => ({ value: eValue }), [eValue]),
        { 'tc-change': (e: Event) => setEValue(detailValue<string>(e) ?? '') },
    )
    const eDescTc = useTc<HTMLElement>(
        useMemo(() => ({ value: eDesc }), [eDesc]),
        { 'tc-change': (e: Event) => setEDesc(detailValue<string>(e) ?? '') },
    )

    const reveal = async () => {
        setBusy(true)
        onError(null)
        try {
            const { value } = await apiFetch<{ value: string }>(
                `/api/projects/${projectId}/secrets/${secret.id}/reveal`,
            )
            setRevealed(value)
        } catch (e) {
            onError(describeApiError(e))
        } finally {
            setBusy(false)
        }
    }

    const saveEdit = async () => {
        onError(null)
        const body: { value?: string; description?: string } = { description: eDescRef.current }
        if (eValueRef.current.length > 0) body.value = eValueRef.current
        try {
            await apiFetch(`/api/projects/${projectId}/secrets/${secret.id}`, {
                method: 'PATCH',
                body: JSON.stringify(body),
            })
            setEditing(false)
            setEValue('')
            setRevealed(null)
            await onChanged()
        } catch (e) {
            onError(describeApiError(e))
        }
    }

    return (
        <>
            <tr>
                <td>
                    <code className="wharf-mono">{secret.key}</code>
                </td>
                <td style={{ color: 'var(--tc-text-muted)' }}>{secret.description ?? '—'}</td>
                {canManage && (
                    <td>
                        {revealed === null ? (
                            <span style={{ color: 'var(--tc-text-faint)' }}>••••••••</span>
                        ) : (
                            <code className="wharf-mono" style={{ wordBreak: 'break-all' }}>{revealed}</code>
                        )}
                    </td>
                )}
                {canManage && (
                    <td
                        style={{
                            textAlign: 'right',
                            display: 'flex',
                            gap: '0.5rem',
                            justifyContent: 'flex-end',
                            flexWrap: 'wrap',
                        }}
                    >
                        {revealed === null ? (
                            <tc-button size="sm" variant="secondary" outline disabled={busy} onClick={reveal}>
                                {busy ? 'Revealing…' : 'Reveal'}
                            </tc-button>
                        ) : (
                            <tc-button size="sm" variant="secondary" outline onClick={() => setRevealed(null)}>
                                Hide
                            </tc-button>
                        )}
                        <tc-button
                            size="sm"
                            variant="secondary"
                            outline
                            onClick={() => {
                                setEditing((v) => !v)
                                setEValue('')
                                setEDesc(secret.description ?? '')
                            }}
                        >
                            {editing ? 'Cancel' : 'Edit'}
                        </tc-button>
                        <tc-button size="sm" variant="danger" outline onClick={onDelete}>
                            Delete
                        </tc-button>
                    </td>
                )}
            </tr>
            {canManage && editing && (
                <tr>
                    <td colSpan={4}>
                        <div style={{ padding: '0.5rem 0' }}>
                            <div
                                style={{
                                    display: 'flex',
                                    gap: '0.5rem',
                                    alignItems: 'flex-end',
                                    flexWrap: 'wrap',
                                }}
                            >
                                <tc-input
                                    ref={eValueTc}
                                    label="New value"
                                    placeholder="leave blank to keep current"
                                    style={{ flex: '1 1 16rem' }}
                                />
                                <tc-input ref={eDescTc} label="Description" placeholder="optional" style={{ flex: '1 1 12rem' }} />
                            </div>
                            <div style={{ marginTop: '0.5rem' }}>
                                <tc-button size="sm" variant="primary" onClick={saveEdit}>
                                    Save
                                </tc-button>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    )
}
