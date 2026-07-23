import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const ALL_STATES_ITEMS = [
    { id: '1', label: 'API Gateway', status: 'ok' as const, detail: 'Healthy' },
    { id: '2', label: 'Database Cluster', status: 'warning' as const, detail: 'High CPU' },
    { id: '3', label: 'Email Service', status: 'error' as const, detail: 'Unreachable' },
    { id: '4', label: 'Analytics Worker', status: 'inactive' as const, detail: 'Paused' },
]

const MIXED_ITEMS = [
    { id: '1', label: 'Auth Service', status: 'ok' as const },
    { id: '2', label: 'Cache Layer', status: 'ok' as const },
    { id: '3', label: 'Job Queue', status: 'warning' as const, detail: 'Backlog growing' },
    { id: '4', label: 'CDN Edge', status: 'ok' as const },
    { id: '5', label: 'Search Index', status: 'error' as const, detail: 'Rebuild needed' },
]

const StatusCardDemo: React.FC = () => {
    const allStatesRef = useTc<HTMLElement>({ items: ALL_STATES_ITEMS })
    const mixedRef = useTc<HTMLElement>({ items: MIXED_ITEMS })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="StatusCard"
                            description="Dashboard card showing a list of status indicator rows — ok, warning, error, and inactive states with icons and optional detail text."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="All four states — with title (JS property)">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-status-card ref={allStatesRef} title="System Health" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Mixed — no title, optional detail (JS property)">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-status-card ref={mixedRef} />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Loading state — default count (4 rows)">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-status-card title="System Health" loading />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Loading state — 6 rows (loading-count attribute)">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-status-card title="Services" loading loading-count="6" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Loading — no title">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-status-card loading />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default StatusCardDemo
