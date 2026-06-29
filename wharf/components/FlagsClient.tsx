'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch, describeApiError, isAuthError } from '@/lib/fetcher'
import { useTc, detailValue } from '@/lib/tc'
import type { Environment, FlagWithValues, ProjectDetail } from '@/server/domain/types'

export function FlagsClient({ projectId }: { projectId: string }) {
    const [detail, setDetail] = useState<ProjectDetail | null>(null)
    const [envs, setEnvs] = useState<Environment[]>([])
    const [flags, setFlags] = useState<FlagWithValues[] | null>(null)
    const [err, setErr] = useState<string | null>(null)
    const [pendingDelete, setPendingDelete] = useState<FlagWithValues | null>(null)

    // create-flag form (flags are always boolean)
    const [newKey, setNewKey] = useState('')
    const [newDesc, setNewDesc] = useState('')
    const newKeyRef = useRef(newKey)
    newKeyRef.current = newKey
    const newDescRef = useRef(newDesc)
    newDescRef.current = newDesc

    // developer is the lowest project role; any successfully-loaded member may edit.
    const canEdit = detail !== null

    const load = useCallback(
        async (signal?: AbortSignal) => {
            try {
                const d = await apiFetch<ProjectDetail>(`/api/projects/${projectId}`, { signal })
                const e = await apiFetch<Environment[]>(`/api/projects/${projectId}/environments`, { signal })
                const f = await apiFetch<FlagWithValues[]>(`/api/projects/${projectId}/flags`, { signal })
                if (signal?.aborted) return
                setDetail(d)
                setEnvs(e)
                setFlags(f)
            } catch (e2) {
                if (signal?.aborted) return
                setErr(isAuthError(e2) ? 'You don’t have access to this project.' : describeApiError(e2))
            }
        },
        [projectId],
    )

    useEffect(() => {
        const ctrl = new AbortController()
        void load(ctrl.signal)
        return () => ctrl.abort()
    }, [load])

    const createFlag = async () => {
        const key = newKeyRef.current.trim()
        if (!key) return
        setErr(null)
        try {
            await apiFetch(`/api/projects/${projectId}/flags`, {
                method: 'POST',
                body: JSON.stringify({
                    key,
                    type: 'boolean',
                    description: newDescRef.current.trim() || undefined,
                }),
            })
            setNewKey('')
            setNewDesc('')
            await load()
        } catch (e) {
            setErr(describeApiError(e))
        }
    }

    const deleteFlag = async (flagId: string) => {
        setErr(null)
        try {
            await apiFetch(`/api/projects/${projectId}/flags/${flagId}`, { method: 'DELETE' })
            await load()
        } catch (e) {
            setErr(describeApiError(e))
        }
    }

    const putValue = async (
        flagId: string,
        envId: string,
        enabled: boolean,
        value: unknown,
    ) => {
        setErr(null)
        try {
            await apiFetch(`/api/projects/${projectId}/flags/${flagId}/values/${envId}`, {
                method: 'PUT',
                body: JSON.stringify({ enabled, value }),
            })
            await load()
        } catch (e) {
            setErr(describeApiError(e))
        }
    }

    const keyRef = useTc<HTMLElement>(
        useMemo(() => ({ value: newKey }), [newKey]),
        { 'tc-change': (e: Event) => setNewKey(detailValue<string>(e) ?? '') },
    )
    const descRef = useTc<HTMLElement>(
        useMemo(() => ({ value: newDesc }), [newDesc]),
        { 'tc-change': (e: Event) => setNewDesc(detailValue<string>(e) ?? '') },
    )
    const confirmRef = useTc<HTMLElement>(undefined, {
        'tc-confirm': () => {
            const target = pendingDelete
            setPendingDelete(null)
            if (target) void deleteFlag(target.flag.id)
        },
        'tc-cancel': () => setPendingDelete(null),
    })

    if (err && !detail) return <tc-banner variant="error">{err}</tc-banner>
    if (!detail || flags === null) {
        return (
            <div className="wharf-status-line" role="status" aria-busy="true">
                <tc-spinner type="border" size="sm" /> Loading…
            </div>
        )
    }

    return (
        <div className="wharf-page">
            <tc-rich-page-header
                icon-name="Flag"
                icon-color="emerald"
                title-text="Feature flags"
                sub="Per-environment values"
                description="Flags are project-level; each flag carries a value per environment."
            />


            {err && <tc-banner variant="error">{err}</tc-banner>}

            {canEdit && (
                <tc-section-card title="New flag" icon="Plus">
                    <div className="wharf-section-body">
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <tc-input ref={keyRef} label="Flag key" placeholder="e.g. NEW_CHECKOUT" style={{ flex: '1 1 14rem' }} />
                            <tc-input ref={descRef} label="Description" placeholder="optional" style={{ flex: '1 1 14rem' }} />
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <tc-button variant="primary" onClick={createFlag} disabled={!newKey.trim()}>
                                Add flag
                            </tc-button>
                        </div>
                    </div>
                </tc-section-card>
            )}

            {envs.length === 0 ? (
                <tc-empty-state icon="Boxes">
                    <h2>No environments</h2>
                    <p>Create environments for this project first — flag values live per environment.</p>
                </tc-empty-state>
            ) : flags.length === 0 ? (
                <tc-empty-state icon="Flag">
                    <h2>No feature flags</h2>
                    <p>{canEdit ? 'Add a flag above to start toggling it per environment.' : 'No flags yet.'}</p>
                </tc-empty-state>
            ) : (
                <tc-section-card title="Flags" icon="Flag">
                    <div className="wharf-section-body">
                        <div style={{ overflowX: 'auto' }}>
                            <table className="table" style={{ minWidth: `${18 + envs.length * 16}rem` }}>
                                <thead>
                                    <tr>
                                        <th style={{ minWidth: '12rem' }}>Flag</th>
                                        {envs.map((env) => (
                                            <th key={env.id} style={{ minWidth: '14rem' }}>
                                                {env.name}
                                            </th>
                                        ))}
                                        {canEdit && <th style={{ textAlign: 'right' }}>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {flags.map((fw) => (
                                        <tr key={fw.flag.id}>
                                            <td>
                                                <code className="wharf-mono" style={{ fontWeight: 600 }}>{fw.flag.key}</code>
                                                {fw.flag.description && (
                                                    <div style={{ fontSize: '0.8125rem', color: 'var(--tc-text-muted)', marginTop: '0.25rem' }}>
                                                        {fw.flag.description}
                                                    </div>
                                                )}
                                            </td>
                                            {envs.map((env) => (
                                                <td key={env.id}>
                                                    <FlagCell
                                                        enabled={fw.values[env.id]?.enabled ?? false}
                                                        canEdit={canEdit}
                                                        onToggle={(enabled) =>
                                                            putValue(fw.flag.id, env.id, enabled, null)
                                                        }
                                                    />
                                                </td>
                                            ))}
                                            {canEdit && (
                                                <td style={{ textAlign: 'right' }}>
                                                    <tc-button
                                                        size="sm"
                                                        variant="danger"
                                                        outline
                                                        onClick={() => setPendingDelete(fw)}
                                                    >
                                                        Delete
                                                    </tc-button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </tc-section-card>
            )}

            <tc-confirm-dialog
                ref={confirmRef}
                open={pendingDelete !== null}
                eyebrow="Feature flags"
                dialog-title="Delete flag?"
                message={
                    pendingDelete
                        ? `Delete “${pendingDelete.flag.key}” and all of its per-environment values? This cannot be undone.`
                        : ''
                }
                confirm-label="Delete flag"
                cancel-label="Cancel"
                danger
            />
        </div>
    )
}

function FlagCell({
    enabled,
    canEdit,
    onToggle,
}: {
    enabled: boolean
    canEdit: boolean
    onToggle: (enabled: boolean) => void
}) {
    const switchRef = useTc<HTMLElement>(
        useMemo(() => ({ checked: enabled }), [enabled]),
        { 'tc-change': (e: Event) => onToggle(Boolean(detailValue<boolean>(e))) },
    )

    return (
        <tc-switch
            ref={switchRef}
            label={enabled ? 'on' : 'off'}
            disabled={!canEdit ? true : undefined}
        />
    )
}
