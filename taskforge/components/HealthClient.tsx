'use client'

// D4 — admin health/diagnostics page + E3 backup actions.

import React, { useCallback, useEffect, useState } from 'react'
import {
    Card,
    Heading,
    Text,
    Badge,
    Button,
    Select,
    StatusDot,
    Spinner,
    HelperText,
} from '@/components/ui'
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
                <Spinner />
            </div>
        )
    }

    const check = (ok: boolean, okText: string, failText: string) => (
        <span className="tf-inline">
            <StatusDot status={ok ? 'online' : 'offline'} />
            {ok ? okText : failText}
        </span>
    )

    return (
        <div className="tf-stack">
            <HelperText text={helpTexts.health.intro} />

            <div className="tf-grid-2">
                <Card header={<Heading as="h3">Environment</Heading>}>
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
                                <Text>
                                    {bytes(details.diskFree.freeBytes)} free of {bytes(details.diskFree.totalBytes)}
                                </Text>
                            ) : (
                                <Text variant="muted">unavailable</Text>
                            )}
                        </div>
                        <div className="tf-kv">
                            <span>Workspace search (FTS5)</span>
                            {check(details.searchAvailable, 'available', 'unavailable on this runtime')}
                        </div>
                    </div>
                </Card>

                <Card header={<Heading as="h3">Database</Heading>}>
                    <div className="tf-card-body tf-stack-sm">
                        <div className="tf-kv">
                            <span>Path</span>
                            <code>{details.db.path}</code>
                        </div>
                        <div className="tf-kv">
                            <span>Size</span>
                            <Text>{bytes(details.db.sizeBytes)}</Text>
                        </div>
                        <div className="tf-kv">
                            <span>Migration version</span>
                            <Badge variant="secondary">v{details.db.migrationVersion}</Badge>
                        </div>
                    </div>
                </Card>
            </div>

            <Card header={<Heading as="h3">Engines</Heading>}>
                <div className="tf-card-body tf-stack-sm">
                    {details.engines.length === 0 && <Text variant="muted">No engine state tracked this process.</Text>}
                    {details.engines.map((e) => (
                        <div className="tf-kv" key={e.project}>
                            <span>{e.project}</span>
                            <Badge variant={e.state === 'IDLE' ? 'secondary' : 'info'}>{e.state}</Badge>
                        </div>
                    ))}
                </div>
            </Card>

            <Card header={<Heading as="h3">Config (env-derived)</Heading>}>
                <div className="tf-card-body tf-stack-sm">
                    {Object.entries(details.config).map(([k, v]) => (
                        <div className="tf-kv" key={k}>
                            <span>{k}</span>
                            <code>{String(v)}</code>
                        </div>
                    ))}
                </div>
            </Card>

            <Card header={<Heading as="h3">Backups</Heading>}>
                <div className="tf-card-body tf-stack-sm">
                    <HelperText text={helpTexts.health.backup} />
                    <div className="tf-actions" style={{ flexWrap: 'wrap' }}>
                        <Button variant="primary" outline onClick={() => window.open('/api/admin/backup/db', '_blank')}>
                            ⬇ Download DB backup
                        </Button>
                        {projects.length > 0 && (
                            <span style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                                <div style={{ minWidth: 200 }}>
                                    <Select
                                        label="Project export"
                                        options={projects.map((p) => ({ value: p, label: p }))}
                                        value={exportProject}
                                        onChange={(e) => setExportProject(e.target.value)}
                                    />
                                </div>
                                <Button
                                    variant="secondary"
                                    outline
                                    disabled={!exportProject}
                                    onClick={() => window.open(`/api/admin/backup/project/${exportProject}`, '_blank')}
                                >
                                    ⬇ Export tasks/knowledge/notes
                                </Button>
                            </span>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    )
}
