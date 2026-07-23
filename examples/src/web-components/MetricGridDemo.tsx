import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const MetricGridDemo: React.FC = () => {
    const itemsRef = useTc<HTMLElement>({
        items: [
            { label: 'Total Users', value: '12,480', icon: 'Users' },
            { label: 'Revenue', value: '$24,500', unit: 'USD', icon: 'DollarSign' },
            {
                label: 'Avg Response',
                value: '142',
                unit: 'ms',
                icon: 'Zap',
                hint: 'P50 over 24 h',
            },
        ],
    })
    const threeColRef = useTc<HTMLElement>({
        items: [
            { label: 'Requests', value: '3.2M', icon: 'Activity', hint: 'Last 24 hours' },
            { label: 'Uptime', value: '99.97', unit: '%', icon: 'CheckCircle' },
            { label: 'Latency P99', value: '320', unit: 'ms', icon: 'Zap' },
        ],
    })
    const fourColRef = useTc<HTMLElement>({
        items: [
            { label: 'Requests', value: '3.2M', icon: 'Activity' },
            { label: 'Uptime', value: '99.97', unit: '%', icon: 'CheckCircle' },
            { label: 'Latency P99', value: '320', unit: 'ms', icon: 'Zap' },
            { label: 'Active Sessions', value: '1,804', icon: 'Globe' },
        ],
    })
    const twoColRef = useTc<HTMLElement>({
        items: [
            { label: 'Error Rate', value: '0.4', unit: '%', hint: 'Down 0.1% from last week' },
            { label: 'Deployments', value: '18', hint: 'This month' },
        ],
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="MetricGrid"
                            description="CSS-grid container for metric tiles with configurable column count. Set tiles via the items JS property or drop tc-metric-tile markup as children."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="items property (3 columns — default)">
                                {/* @ts-ignore */}
                                <tc-metric-grid ref={itemsRef} />
                            </tc-section-card>

                            <tc-section-card title="3 columns (explicit)">
                                {/* @ts-ignore */}
                                <tc-metric-grid columns="3" ref={threeColRef} />
                            </tc-section-card>

                            <tc-section-card title="4 columns">
                                {/* @ts-ignore */}
                                <tc-metric-grid columns="4" ref={fourColRef} />
                            </tc-section-card>

                            <tc-section-card title="2 columns">
                                {/* @ts-ignore */}
                                <tc-metric-grid columns="2" ref={twoColRef} />
                            </tc-section-card>

                            <tc-section-card title="Slotted children (raw tc-metric-tile markup)">
                                {/* @ts-ignore */}
                                <tc-metric-grid columns="3">
                                    {/* @ts-ignore */}
                                    <tc-metric-tile
                                        label="Build Status"
                                        value="Passing"
                                        icon="CheckCircle"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-metric-tile
                                        label="Coverage"
                                        value="94.2"
                                        unit="%"
                                        icon="Shield"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-metric-tile
                                        label="Open PRs"
                                        value="7"
                                        hint="2 awaiting review"
                                    />
                                    {/* @ts-ignore */}
                                </tc-metric-grid>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MetricGridDemo
