'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, describeApiError, isAuthError } from '@/lib/fetcher'
import { useTc, detailValue } from '@/lib/tc'
import type { Environment, Instance, ProjectDetail } from '@/server/domain/types'

type ConfirmTarget = { kind: 'env' | 'instance'; id: string } | null

export function ProjectClient({ projectId }: { projectId: string }) {
    const router = useRouter()
    const [detail, setDetail] = useState<ProjectDetail | null>(null)
    const [envs, setEnvs] = useState<Environment[]>([])
    const [instances, setInstances] = useState<Record<string, Instance[]>>({})
    const [err, setErr] = useState<string | null>(null)
    const [newEnv, setNewEnv] = useState('')
    const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null)
    const [deleteProjectOpen, setDeleteProjectOpen] = useState(false)
    const newEnvRef = useRef(newEnv)
    newEnvRef.current = newEnv
    const [envModalOpen, setEnvModalOpen] = useState(false)
    const [cloneOpen, setCloneOpen] = useState(false)
    const [cloneName, setCloneName] = useState('')
    const cloneNameRef = useRef(cloneName)
    cloneNameRef.current = cloneName
    const [cloneEnvTarget, setCloneEnvTarget] = useState<Environment | null>(null)
    const [cloneEnvName, setCloneEnvName] = useState('')
    const cloneEnvNameRef = useRef(cloneEnvName)
    cloneEnvNameRef.current = cloneEnvName
    const cloneEnvTargetRef = useRef(cloneEnvTarget)
    cloneEnvTargetRef.current = cloneEnvTarget

    const canManage = detail ? detail.effectiveRole !== 'developer' : false

    const load = useCallback(
        async (signal?: AbortSignal) => {
            try {
                const d = await apiFetch<ProjectDetail>(`/api/projects/${projectId}`, { signal })
                const e = await apiFetch<Environment[]>(`/api/projects/${projectId}/environments`, { signal })
                const insts = await Promise.all(
                    e.map((env) =>
                        apiFetch<Instance[]>(`/api/projects/${projectId}/environments/${env.id}/instances`, {
                            signal,
                        }).then((list) => [env.id, list] as const),
                    ),
                )
                if (signal?.aborted) return
                setDetail(d)
                setEnvs(e)
                setInstances(Object.fromEntries(insts))
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

    const addEnv = async () => {
        const name = newEnvRef.current.trim()
        if (!name) return
        setErr(null)
        try {
            await apiFetch(`/api/projects/${projectId}/environments`, {
                method: 'POST',
                body: JSON.stringify({ name }),
            })
            setNewEnv('')
            setEnvModalOpen(false)
            await load()
        } catch (e) {
            setErr(describeApiError(e))
        }
    }

    const delEnv = async (envId: string) => {
        setErr(null)
        try {
            await apiFetch(`/api/projects/${projectId}/environments/${envId}`, { method: 'DELETE' })
            await load()
        } catch (e) {
            setErr(describeApiError(e))
        }
    }

    const toggleStrict = async (env: Environment) => {
        setErr(null)
        try {
            await apiFetch(`/api/projects/${projectId}/environments/${env.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ strictRequired: !env.strictRequired }),
            })
            await load()
        } catch (e) {
            setErr(describeApiError(e))
        }
    }

    const addInstance = async (envId: string, name: string) => {
        const trimmed = name.trim()
        if (!trimmed) return
        setErr(null)
        try {
            await apiFetch(`/api/projects/${projectId}/environments/${envId}/instances`, {
                method: 'POST',
                body: JSON.stringify({ name: trimmed }),
            })
            await load()
        } catch (e) {
            setErr(describeApiError(e))
        }
    }

    const delInstance = async (instanceId: string) => {
        setErr(null)
        try {
            await apiFetch(`/api/projects/${projectId}/instances/${instanceId}`, { method: 'DELETE' })
            await load()
        } catch (e) {
            setErr(describeApiError(e))
        }
    }

    const openCloneEnv = (env: Environment) => {
        setCloneEnvName('')
        setCloneEnvTarget(env)
    }

    const cloneEnv = async () => {
        const target = cloneEnvTargetRef.current
        const newName = cloneEnvNameRef.current.trim()
        if (!target || !newName) return
        setErr(null)
        try {
            await apiFetch(`/api/projects/${projectId}/environments/${target.id}/clone`, {
                method: 'POST',
                body: JSON.stringify({ newName }),
            })
            setCloneEnvTarget(null)
            await load()
        } catch (e) {
            setErr(describeApiError(e))
        }
    }

    const openCloneProject = () => {
        setCloneName('')
        setCloneOpen(true)
    }

    const cloneProject = async () => {
        const newName = cloneNameRef.current.trim()
        if (!newName) return
        setErr(null)
        try {
            const created = await apiFetch<{ id: string }>(`/api/projects/${projectId}/clone`, {
                method: 'POST',
                body: JSON.stringify({ newName, copySecretValues: true }),
            })
            setCloneOpen(false)
            router.push(`/projects/${created.id}`)
        } catch (e) {
            setErr(describeApiError(e))
        }
    }

    // Owner-only. DELETE /api/projects/{id} cascades to every child row (FK ON DELETE
    // CASCADE); on success leave the now-gone project page for the dashboard.
    const deleteProject = async () => {
        setDeleteProjectOpen(false)
        setErr(null)
        try {
            await apiFetch(`/api/projects/${projectId}`, { method: 'DELETE' })
            router.push('/')
        } catch (e) {
            setErr(describeApiError(e))
        }
    }

    const newEnvRefTc = useTc<HTMLElement>(
        useMemo(() => ({ value: newEnv }), [newEnv]),
        { 'tc-change': (e: Event) => setNewEnv(detailValue<string>(e) ?? '') },
    )
    const openNewEnv = () => {
        setNewEnv('')
        setEnvModalOpen(true)
    }
    const envModalRef = useTc<HTMLElement>(
        useMemo(() => ({ open: envModalOpen }), [envModalOpen]),
        { 'tc-hidden': () => setEnvModalOpen(false) },
    )

    const cloneNameTc = useTc<HTMLElement>(
        useMemo(() => ({ value: cloneName }), [cloneName]),
        { 'tc-change': (e: Event) => setCloneName(detailValue<string>(e) ?? '') },
    )
    const cloneModalRef = useTc<HTMLElement>(
        useMemo(() => ({ open: cloneOpen }), [cloneOpen]),
        { 'tc-hidden': () => setCloneOpen(false) },
    )

    const cloneEnvNameTc = useTc<HTMLElement>(
        useMemo(() => ({ value: cloneEnvName }), [cloneEnvName]),
        { 'tc-change': (e: Event) => setCloneEnvName(detailValue<string>(e) ?? '') },
    )
    const cloneEnvModalRef = useTc<HTMLElement>(
        useMemo(() => ({ open: cloneEnvTarget !== null }), [cloneEnvTarget]),
        { 'tc-hidden': () => setCloneEnvTarget(null) },
    )

    const runConfirm = useCallback(() => {
        const target = confirmTarget
        setConfirmTarget(null)
        if (!target) return
        if (target.kind === 'env') void delEnv(target.id)
        else void delInstance(target.id)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [confirmTarget])

    const confirmRef = useTc<HTMLElement>(
        useMemo(() => ({ open: confirmTarget !== null }), [confirmTarget]),
        {
            'tc-confirm': () => runConfirm(),
            'tc-cancel': () => setConfirmTarget(null),
        },
    )

    const deleteProjectRef = useTc<HTMLElement>(
        useMemo(() => ({ open: deleteProjectOpen }), [deleteProjectOpen]),
        {
            'tc-confirm': () => void deleteProject(),
            'tc-cancel': () => setDeleteProjectOpen(false),
        },
    )

    if (err && !detail) return <tc-banner variant="error">{err}</tc-banner>
    if (!detail) {
        return (
            <div className="wharf-status-line" role="status" aria-busy="true">
                <tc-spinner type="border" size="sm" /> Loading…
            </div>
        )
    }

    return (
        <div className="wharf-page">
            <tc-rich-page-header
                icon-name="Boxes"
                icon-color="emerald"
                title-text={detail.project.name}
                sub={detail.project.slug}
            >
                {detail.isOwner && (
                    <>
                        <tc-button slot="actions" variant="secondary" outline size="sm" onClick={openCloneProject}>
                            Clone project
                        </tc-button>
                        <tc-button slot="actions" variant="secondary" outline size="sm" onClick={() => router.push(`/projects/${projectId}/members`)}>
                            Members
                        </tc-button>
                        <tc-button slot="actions" variant="danger" outline size="sm" onClick={() => setDeleteProjectOpen(true)}>
                            Delete project
                        </tc-button>
                    </>
                )}
            </tc-rich-page-header>


            {err && <tc-banner variant="error">{err}</tc-banner>}

            <tc-section-card title="Environments" icon="Boxes">
                {canManage && (
                    <tc-button slot="action" variant="primary" size="sm" onClick={openNewEnv}>
                        New environment
                    </tc-button>
                )}
                <div className="wharf-section-body">
                    {envs.length === 0 ? (
                        <tc-empty-state icon="Boxes">
                            <h2>No environments</h2>
                            <p>{canManage ? 'Use “New environment” to add one (e.g. development, production).' : 'No environments yet.'}</p>
                        </tc-empty-state>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {envs.map((env) => (
                                <EnvCard
                                    key={env.id}
                                    projectId={projectId}
                                    env={env}
                                    instances={instances[env.id] ?? []}
                                    canManage={canManage}
                                    onOpenEnv={() => router.push(`/projects/${projectId}/env?env=${env.id}`)}
                                    onOpenInstance={(instId) => router.push(`/projects/${projectId}/instances/${instId}`)}
                                    onDeleteEnv={() => setConfirmTarget({ kind: 'env', id: env.id })}
                                    onCloneEnv={() => openCloneEnv(env)}
                                    onToggleStrict={() => toggleStrict(env)}
                                    onAddInstance={(name) => addInstance(env.id, name)}
                                    onDeleteInstance={(instId) => setConfirmTarget({ kind: 'instance', id: instId })}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </tc-section-card>

            <tc-confirm-dialog
                ref={confirmRef}
                eyebrow="Destructive action"
                dialog-title={confirmTarget?.kind === 'env' ? 'Delete environment?' : 'Delete instance?'}
                message={
                    confirmTarget?.kind === 'env'
                        ? 'This permanently deletes the environment and all of its instances. This cannot be undone.'
                        : 'This permanently deletes the instance and its key. This cannot be undone.'
                }
                confirm-label="Delete"
                cancel-label="Cancel"
                danger
            />

            <tc-confirm-dialog
                ref={deleteProjectRef}
                eyebrow="Destructive action"
                dialog-title="Delete project?"
                message={`This permanently deletes “${detail.project.name}” and every environment, instance, variable, secret, note and flag in it. This cannot be undone.`}
                confirm-label="Delete project"
                cancel-label="Cancel"
                danger
            />

            <tc-modal ref={envModalRef} title="New environment" centered>
                <p style={{ margin: '0 0 0.75rem', color: 'var(--tc-text-muted)' }}>
                    Add an environment to <strong>{detail.project.name}</strong> (e.g. development,
                    production).
                </p>
                <tc-input ref={newEnvRefTc} label="Environment name" placeholder="e.g. production" />
                <tc-button slot="footer" variant="secondary" outline onClick={() => setEnvModalOpen(false)}>
                    Cancel
                </tc-button>
                <tc-button slot="footer" variant="primary" onClick={addEnv} disabled={!newEnv.trim()}>
                    Add environment
                </tc-button>
            </tc-modal>

            <tc-modal ref={cloneModalRef} title="Clone project" centered>
                <p style={{ margin: '0 0 0.75rem', color: 'var(--tc-text-muted)' }}>
                    Creates a copy of <strong>{detail.project.name}</strong> with its environments,
                    instances and configuration.
                </p>
                <tc-input ref={cloneNameTc} label="New project name" placeholder="e.g. Acme API (copy)" />
                <tc-button slot="footer" variant="secondary" outline onClick={() => setCloneOpen(false)}>
                    Cancel
                </tc-button>
                <tc-button slot="footer" variant="primary" onClick={cloneProject} disabled={!cloneName.trim()}>
                    Clone project
                </tc-button>
            </tc-modal>

            <tc-modal ref={cloneEnvModalRef} title="Clone environment" centered>
                <p style={{ margin: '0 0 0.75rem', color: 'var(--tc-text-muted)' }}>
                    Creates a copy of <strong>{cloneEnvTarget?.name ?? ''}</strong> with its variables
                    and instances.
                </p>
                <tc-input ref={cloneEnvNameTc} label="New environment name" placeholder="e.g. production-copy" />
                <tc-button slot="footer" variant="secondary" outline onClick={() => setCloneEnvTarget(null)}>
                    Cancel
                </tc-button>
                <tc-button slot="footer" variant="primary" onClick={cloneEnv} disabled={!cloneEnvName.trim()}>
                    Clone environment
                </tc-button>
            </tc-modal>
        </div>
    )
}

function EnvCard({
    env,
    instances,
    canManage,
    onOpenEnv,
    onOpenInstance,
    onDeleteEnv,
    onCloneEnv,
    onToggleStrict,
    onAddInstance,
    onDeleteInstance,
}: {
    projectId: string
    env: Environment
    instances: Instance[]
    canManage: boolean
    onOpenEnv: () => void
    onOpenInstance: (instanceId: string) => void
    onDeleteEnv: () => void
    onCloneEnv: () => void
    onToggleStrict: () => void
    onAddInstance: (name: string) => void
    onDeleteInstance: (instanceId: string) => void
}) {
    const [newInst, setNewInst] = useState('')
    const newInstRef = useRef(newInst)
    newInstRef.current = newInst
    const instRef = useTc<HTMLElement>(
        useMemo(() => ({ value: newInst }), [newInst]),
        { 'tc-change': (e: Event) => setNewInst(detailValue<string>(e) ?? '') },
    )

    const strictRef = useTc<HTMLElement>(
        useMemo(() => ({ checked: env.strictRequired }), [env.strictRequired]),
        { 'tc-change': () => onToggleStrict() },
    )

    return (
        <tc-section-card title={env.name} icon="Boxes">
            <div className="wharf-section-body">
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        alignItems: 'flex-start',
                        paddingBottom: '0.75rem',
                        marginBottom: '0.25rem',
                        borderBottom: '1px solid var(--tc-border-faint)',
                    }}
                >
                    {canManage && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <tc-switch ref={strictRef} label="Strict required" />
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <tc-button size="sm" variant="secondary" outline onClick={onOpenEnv}>
                            Manage config
                        </tc-button>
                        {canManage && (
                            <>
                                <tc-button size="sm" variant="secondary" outline onClick={onCloneEnv}>
                                    Clone
                                </tc-button>
                                <tc-button size="sm" variant="danger" outline onClick={onDeleteEnv}>
                                    Delete
                                </tc-button>
                            </>
                        )}
                    </div>
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
                    {instances.map((inst) => (
                        <li
                            key={inst.id}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.625rem 0',
                                borderTop: '1px solid var(--tc-border-faint)',
                                flexWrap: 'wrap',
                            }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
                                <tc-status-dot
                                    status={inst.hasKey ? 'online' : 'offline'}
                                    label={inst.hasKey ? 'key set' : 'no key'}
                                    size="small"
                                />
                                <button
                                    onClick={() => onOpenInstance(inst.id)}
                                    className="wharf-mono"
                                    style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--wharf-accent-strong)', font: 'inherit', padding: 0 }}
                                >
                                    {inst.name}
                                </button>
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--tc-text-faint)' }}>
                                    {inst.lastFetchAt ? `fetched ${new Date(inst.lastFetchAt).toLocaleString()}` : 'never fetched'}
                                </span>
                                {canManage && (
                                    <tc-button size="sm" variant="danger" outline onClick={() => onDeleteInstance(inst.id)}>
                                        Delete
                                    </tc-button>
                                )}
                            </span>
                        </li>
                    ))}
                    {instances.length === 0 && (
                        <li style={{ color: 'var(--tc-text-faint)', fontSize: '0.8125rem', padding: '0.5rem 0' }}>No instances yet.</li>
                    )}
                </ul>

                {canManage && (
                    <div style={{ marginTop: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <tc-input ref={instRef} label="New instance" placeholder="e.g. web-1" style={{ flex: '1 1 14rem' }} />
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <tc-button size="sm" variant="primary" onClick={() => { onAddInstance(newInstRef.current); setNewInst('') }} disabled={!newInst.trim()}>
                                Add instance
                            </tc-button>
                        </div>
                    </div>
                )}
            </div>
        </tc-section-card>
    )
}
