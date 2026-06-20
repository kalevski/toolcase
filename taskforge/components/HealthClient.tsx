'use client'

// D4 — admin health/diagnostics page + E3 backup actions.

import React, { useCallback, useEffect, useState } from 'react'
import { useTcEvents } from '@/lib/tc'
import type { HealthDetails } from '@/server/domain/types'
import { helpTexts } from './helpTexts'

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
            const d = await fetch('/api/health/details').then((r) => (r.ok ? r.json() : null))
            if (d) setDetails(d)
        } catch {
            /* transient */
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    if (!details) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <tc-spinner />
            </div>
        )
    }

    const check = (ok: boolean, okText: string, failText: string) => (
        <span className="tf-inline">
            <tc-status-dot status={ok ? 'online' : 'offline'} />
            {ok ? okText : failText}
        </span>
    )

    return (
        <div className="tf-stack">
            <tc-helper-text text={helpTexts.health.intro} />

            <div className="tf-grid-2">
                <tc-card>
                    <tc-heading slot="header" as="h3">
                        Environment
                    </tc-heading>
                    <div className="tf-card-body tf-stack-sm">
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
                    </div>
                </tc-card>

                <tc-card>
                    <tc-heading slot="header" as="h3">
                        Database
                    </tc-heading>
                    <div className="tf-card-body tf-stack-sm">
                        <div className="tf-kv">
                            <span>Path</span>
                            <code>{details.db.path}</code>
                        </div>
                        <div className="tf-kv">
                            <span>Size</span>
                            <tc-text>{bytes(details.db.sizeBytes)}</tc-text>
                        </div>
                        <div className="tf-kv">
                            <span>Migration version</span>
                            <tc-badge variant="secondary">v{details.db.migrationVersion}</tc-badge>
                        </div>
                    </div>
                </tc-card>
            </div>

            <tc-card>
                <tc-heading slot="header" as="h3">
                    Engines
                </tc-heading>
                <div className="tf-card-body tf-stack-sm">
                    {details.engines.length === 0 && <tc-text variant="muted">No engine state tracked this process.</tc-text>}
                    {details.engines.map((e) => (
                        <div className="tf-kv" key={e.project}>
                            <span>{e.project}</span>
                            <tc-badge variant={e.state === 'IDLE' ? 'secondary' : 'info'}>{e.state}</tc-badge>
                        </div>
                    ))}
                </div>
            </tc-card>

            <tc-card>
                <tc-heading slot="header" as="h3">
                    Config (env-derived)
                </tc-heading>
                <div className="tf-card-body tf-stack-sm">
                    {Object.entries(details.config).map(([k, v]) => (
                        <div className="tf-kv" key={k}>
                            <span>{k}</span>
                            <code>{String(v)}</code>
                        </div>
                    ))}
                </div>
            </tc-card>

            <tc-card>
                <tc-heading slot="header" as="h3">
                    Backups
                </tc-heading>
                <div className="tf-card-body tf-stack-sm">
                    <tc-helper-text text={helpTexts.health.backup} />
                    <div className="tf-actions" style={{ flexWrap: 'wrap' }}>
                        <tc-button variant="primary" outline onClick={() => window.open('/api/admin/backup/db', '_blank')}>
                            ⬇ Download DB backup
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
                                    ⬇ Export tasks/knowledge/notes
                                </tc-button>
                            </span>
                        )}
                    </div>
                </div>
            </tc-card>
        </div>
    )
}
