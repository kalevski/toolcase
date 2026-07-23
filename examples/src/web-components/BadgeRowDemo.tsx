import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const BadgeRowDemo: React.FC = () => {
    const labelOnlyRef = useTc<HTMLElement>({
        badges: [{ label: 'Region' }, { label: 'Production' }, { label: 'v2' }],
    })
    const mdRef = useTc<HTMLElement>({
        badges: [
            { label: 'env', value: 'production' },
            { label: 'region', value: 'eu-west-1' },
            { label: 'replicas', value: 3 },
            { label: 'uptime', value: '99.97%' },
        ],
    })
    const smRef = useTc<HTMLElement>({
        badges: [
            { label: 'env', value: 'staging' },
            { label: 'region', value: 'us-east-1' },
            { label: 'replicas', value: 2 },
        ],
    })
    const variantRef = useTc<HTMLElement>({
        badges: [
            { label: 'status', value: 'healthy', variant: 'success' },
            { label: 'status', value: 'degraded', variant: 'warning' },
            { label: 'status', value: 'down', variant: 'danger' },
            { label: 'tier', value: 'info', variant: 'info' },
            { label: 'type', value: 'primary', variant: 'primary' },
        ],
    })
    const colorRef = useTc<HTMLElement>({
        badges: [
            { label: 'team', value: 'frontend', color: '#6366f1' },
            { label: 'team', value: 'backend', color: '#0ea5e9' },
            { label: 'team', value: 'infra', color: '#f59e0b' },
        ],
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="BadgeRow"
                            description="Horizontal row of paired key/value chips with sharp corners, slate neutrals, and monospaced values. Set badges via the JS badges property."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Label only">
                                {/* @ts-ignore */}
                                <tc-badge-row ref={labelOnlyRef} />
                            </tc-section-card>

                            <tc-section-card title="Label + value (md — default)">
                                {/* @ts-ignore */}
                                <tc-badge-row ref={mdRef} />
                            </tc-section-card>

                            <tc-section-card title="Label + value (sm)">
                                {/* @ts-ignore */}
                                <tc-badge-row ref={smRef} size="sm" />
                            </tc-section-card>

                            <tc-section-card title="Status variants">
                                {/* @ts-ignore */}
                                <tc-badge-row ref={variantRef} />
                            </tc-section-card>

                            <tc-section-card title="Custom color per item">
                                {/* @ts-ignore */}
                                <tc-badge-row ref={colorRef} />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BadgeRowDemo
