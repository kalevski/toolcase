'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMe } from '@/lib/me-context'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { useTc } from '@/lib/tc'
import { detailValue } from '@/lib/tc'
import type { ProjectSummary } from '@/server/domain/types'

export function DashboardClient() {
    const me = useMe()
    const router = useRouter()
    const isOwner = me.role === 'owner'
    const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
    const [err, setErr] = useState<string | null>(null)
    const [name, setName] = useState('')
    const [busy, setBusy] = useState(false)
    const nameRef = useRef(name)
    nameRef.current = name

    const load = useCallback(async (signal?: AbortSignal) => {
        try {
            setProjects(await apiFetch<ProjectSummary[]>('/api/projects', { signal }))
        } catch (e) {
            if (!signal?.aborted) setErr(describeApiError(e))
        }
    }, [])

    useEffect(() => {
        const ctrl = new AbortController()
        void load(ctrl.signal)
        return () => ctrl.abort()
    }, [load])

    const create = async () => {
        const value = nameRef.current.trim()
        if (!value || busy) return
        setBusy(true)
        setErr(null)
        try {
            await apiFetch('/api/projects', { method: 'POST', body: JSON.stringify({ name: value }) })
            setName('')
            await load()
        } catch (e) {
            setErr(describeApiError(e))
        } finally {
            setBusy(false)
        }
    }

    const inputRef = useTc<HTMLElement>(
        useMemo(() => ({ value: name }), [name]),
        { 'tc-change': (e: Event) => setName(detailValue<string>(e) ?? '') },
    )

    const metricItems = useMemo(
        () =>
            projects && projects.length
                ? [
                      { label: 'Projects', value: projects.length, icon: 'Boxes' },
                      {
                          label: 'Environments',
                          value: projects.reduce((sum, p) => sum + p.environmentCount, 0),
                          icon: 'Layers',
                      },
                      {
                          label: 'Instances',
                          value: projects.reduce((sum, p) => sum + p.instanceCount, 0),
                          icon: 'Container',
                      },
                  ]
                : [],
        [projects],
    )
    const metricRef = useTc<HTMLElement>(useMemo(() => ({ items: metricItems }), [metricItems]))

    return (
        <div className="wharf-page">
            <tc-rich-page-header
                icon-name="Boxes"
                icon-color="cyan"
                title-text="Projects"
                sub="Configuration for your Docker containers"
            />

            {isOwner && (
                <tc-section-card title="New project" icon="Plus">
                    <div className="wharf-section-body">
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <tc-input
                                ref={inputRef}
                                label="Project name"
                                placeholder="e.g. Acme API"
                                style={{ flex: '1 1 18rem' }}
                            />
                        </div>
                        <div style={{ marginTop: '0.5rem' }}>
                            <tc-button variant="primary" onClick={create} disabled={busy || !name.trim()}>
                                Create
                            </tc-button>
                        </div>
                    </div>
                </tc-section-card>
            )}

            {err && <tc-banner variant="error">{err}</tc-banner>}

            {projects === null ? (
                <div className="wharf-status-line">
                    <tc-spinner type="border" size="sm" /> Loading…
                </div>
            ) : projects.length === 0 ? (
                <tc-empty-state icon="Boxes">
                    <h2>No projects yet</h2>
                    <p>{isOwner ? 'Create your first project above.' : 'Ask an owner to grant you access.'}</p>
                </tc-empty-state>
            ) : (
                <>
                    <tc-metric-grid ref={metricRef} columns="3" />
                    <div className="wharf-card-grid">
                        {projects.map((p) => (
                            <div
                                key={p.project.id}
                                className="wharf-card"
                                role="button"
                                tabIndex={0}
                                onClick={() => router.push(`/projects/${p.project.id}`)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') router.push(`/projects/${p.project.id}`)
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start' }}>
                                    <strong style={{ fontSize: '1.0625rem' }}>{p.project.name}</strong>
                                    <tc-badge variant={p.effectiveRole === 'developer' ? 'secondary' : 'primary'}>
                                        {p.effectiveRole}
                                    </tc-badge>
                                </div>
                                <span className="wharf-mono" style={{ fontSize: '0.8125rem', color: 'var(--tc-text-muted)' }}>
                                    {p.project.slug}
                                </span>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                                    <tc-badge variant="info">{p.environmentCount} environments</tc-badge>
                                    <tc-badge variant="info">{p.instanceCount} instances</tc-badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
