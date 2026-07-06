'use client'

// D4 — admin health/diagnostics page + E3 backup actions.

import React, { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/fetcher'
import { useTcEvents } from '@/lib/tc'
import { tcIcon } from '@/lib/icons'
import { toast } from '@/lib/toast'
import type { HealthDetails } from '@/server/domain/types'
import { helpTexts } from './helpTexts'
import { LoadingState } from './states'

function bytes(n: number): string {
    if (n >= 1 << 30) return `${(n / (1 << 30)).toFixed(1)} GiB`
    if (n >= 1 << 20) return `${(n / (1 << 20)).toFixed(1)} MiB`
    if (n >= 1 << 10) return `${(n / (1 << 10)).toFixed(1)} KiB`
    return `${n} B`
}

export function HealthClient({ projects }: { projects: string[] }) {
    const [details, setDetails] = useState<HealthDetails | null>(null)
    const [exportProject, setExportProject] = useState(projects[0] ?? '')

    const exportRef = useTcEvents<HTMLElement>({
        change: (e) => setExportProject((e.target as HTMLSelectElement).value),
    })

    const load = useCallback(async () => {
        try {
            const d = await apiFetch<HealthDetails>('/api/health/details')
            if (d) setDetails(d)
        } catch {
            /* transient */
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    if (!details) return <LoadingState />

    const check = (ok: boolean, okText: string, failText: string) => (
        <tc-stack inline direction="horizontal" gap="0.4rem" align="center">
            <tc-status-dot status={ok ? 'online' : 'offline'} />
            {ok ? okText : failText}
        </tc-stack>
    )

    return (
        <div className="taskforge-page">
            <tc-rich-page-header
                title-text="Health"
                icon-name="HeartPulse"
                icon-color="emerald"
                description={helpTexts.health.intro}
            />

            <tc-grid columns="2" gap="1.25rem">
                <tc-card>
                    <tc-heading slot="header" as="h3">
                        Environment
                    </tc-heading>
                    <tc-stack gap="0.75rem" style={{ padding: '1rem' }}>
                        <div className="tf-kv">
                            <span>Agent CLI ({details.agentBin})</span>
                            {check(details.agentVersion !== null, details.agentVersion ?? '', 'not found / not executable')}
                        </div>
                        <div className="tf-kv">
                            <span>git</span>
                            {check(details.gitVersion !== null, details.gitVersion ?? '', 'not found')}
                        </div>
                        <div className="tf-kv">
                            <span>Workspace disk</span>
                            {details.diskFree ? (
                                <tc-text>
                                    {bytes(details.diskFree.freeBytes)} free of {bytes(details.diskFree.totalBytes)}
                                </tc-text>
                            ) : (
                                <tc-text variant="muted">unavailable</tc-text>
                            )}
                        </div>
                        <div className="tf-kv">
                            <span>Workspace search (FTS5)</span>
                            {check(details.searchAvailable, 'available', 'unavailable on this runtime')}
                        </div>
                    </tc-stack>
                </tc-card>

                <tc-card>
                    <tc-heading slot="header" as="h3">
                        Database
                    </tc-heading>
                    <tc-stack gap="0.75rem" style={{ padding: '1rem' }}>
                        <div className="tf-kv">
                            <span>Path</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                                <code style={{ wordBreak: 'break-all', textAlign: 'right' }}>{details.db.path}</code>
                                <tc-icon-button
                                    icon={tcIcon('Copy')}
                                    label="Copy path"
                                    variant="secondary"
                                    outline
                                    onClick={() => {
                                        void navigator.clipboard?.writeText(details.db.path)
                                        toast.success('Path copied')
                                    }}
                                />
                            </span>
                        </div>
                        <div className="tf-kv">
                            <span>Size</span>
                            <tc-text>{bytes(details.db.sizeBytes)}</tc-text>
                        </div>
                        <div className="tf-kv">
                            <span>Migration version</span>
                            <tc-badge variant="secondary">v{details.db.migrationVersion}</tc-badge>
                        </div>
                    </tc-stack>
                </tc-card>
            </tc-grid>

            <tc-card>
                <tc-heading slot="header" as="h3">
                    Engines
                </tc-heading>
                <tc-stack gap="0.75rem" style={{ padding: '1rem' }}>
                    {details.engines.length === 0 && <tc-text variant="muted">No engine state tracked this process.</tc-text>}
                    {details.engines.map((e) => (
                        <div className="tf-kv" key={e.project}>
                            <span>{e.project}</span>
                            <tc-badge variant={e.state === 'IDLE' ? 'secondary' : 'info'}>{e.state}</tc-badge>
                        </div>
                    ))}
                </tc-stack>
            </tc-card>

            <tc-card>
                <tc-heading slot="header" as="h3">
                    Config (env-derived)
                </tc-heading>
                <tc-stack gap="0.75rem" style={{ padding: '1rem' }}>
                    {Object.entries(details.config).map(([k, v]) => (
                        <div className="tf-kv" key={k}>
                            <span>{k}</span>
                            <code>{String(v)}</code>
                        </div>
                    ))}
                </tc-stack>
            </tc-card>

            <tc-card>
                <tc-heading slot="header" as="h3">
                    Backups
                </tc-heading>
                <tc-stack gap="0.75rem" style={{ padding: '1rem' }}>
                    <tc-helper-text text={helpTexts.health.backup} />
                    <tc-stack direction="horizontal" gap="0.75rem" wrap align="center">
                        <tc-button variant="primary" outline onClick={() => window.open('/api/admin/backup/db', '_blank')}>
                            <tc-icon name={tcIcon('Download')} /> Download DB backup
                        </tc-button>
                        {projects.length > 0 && (
                            <span style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                                <div style={{ minWidth: 200 }}>
                                    <tc-select ref={exportRef} label="Project export" value={exportProject}>
                                        {projects.map((p) => (
                                            <tc-option key={p} value={p}>
                                                {p}
                                            </tc-option>
                                        ))}
                                    </tc-select>
                                </div>
                                <tc-button
                                    variant="secondary"
                                    outline
                                    disabled={!exportProject || undefined}
                                    onClick={() => window.open(`/api/admin/backup/project/${exportProject}`, '_blank')}
                                >
                                    <tc-icon name={tcIcon('Download')} /> Export tasks/knowledge/notes
                                </tc-button>
                            </span>
                        )}
                    </tc-stack>
                </tc-stack>
            </tc-card>
        </div>
    )
}
