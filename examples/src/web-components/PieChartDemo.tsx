import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const traffic = [
    { label: 'Direct', value: 4200 },
    { label: 'Organic search', value: 3100 },
    { label: 'Referral', value: 1800 },
    { label: 'Social', value: 1200 },
    { label: 'Email', value: 640 },
]

const storage = [
    { label: 'Documents', value: 48 },
    { label: 'Media', value: 32 },
    { label: 'Backups', value: 14, color: 'var(--tc-warning)' },
    { label: 'Free', value: 6 },
]

const PieChartDemo: React.FC = () => {
    const [selected, setSelected] = useState<string | null>(null)

    const pieRef = useTc<HTMLElement>(
        { data: traffic },
        {
            'tc-slice-select': (e: any) =>
                setSelected(`${e.detail.slice.label} (#${e.detail.index})`),
        }
    )
    const donutRef = useTc<HTMLElement>({ data: storage })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="PieChart"
                            description="Inline-SVG pie or donut chart with a percentage distribution and an interactive legend. data is set via a JS property; title/subtitle/donut/center-label/show-legend/height/loading are attributes. Hovering a slice (or its legend row) highlights both, pulls the slice out and shows a tooltip; clicking a legend entry toggles that slice's visibility and fires tc-slice-select."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Pie — legend toggle + slice select">
                                {/* @ts-ignore */}
                                <tc-pie-chart
                                    ref={pieRef}
                                    title="Traffic sources"
                                    subtitle="Sessions in the last 30 days"
                                    height="280"
                                />
                                <p className="text-muted small mt-2 mb-0">
                                    Last selected slice: <strong>{selected ?? 'none'}</strong>
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Donut — center label">
                                {/* @ts-ignore */}
                                <tc-pie-chart
                                    ref={donutRef}
                                    donut
                                    center-label="Used"
                                    title="Storage usage"
                                    subtitle="Percent of the 100 GB plan"
                                    height="280"
                                />
                            </tc-section-card>

                            <tc-section-card title="Legend hidden">
                                {/* @ts-ignore */}
                                <tc-pie-chart
                                    ref={(el: any) => {
                                        if (el) el.data = traffic
                                    }}
                                    show-legend="false"
                                    title="Chart only"
                                    height="240"
                                />
                            </tc-section-card>

                            <tc-section-card title="Loading skeleton">
                                {/* @ts-ignore */}
                                <tc-pie-chart loading title="Loading…" height="280" />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PieChartDemo
