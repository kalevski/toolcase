import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

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
    const pieRef = useRef<any>(null)
    const donutRef = useRef<any>(null)
    const [selected, setSelected] = useState<string | null>(null)

    useEffect(() => {
        if (pieRef.current) {
            const el = pieRef.current
            el.data = traffic
            const handler = (e: any) =>
                setSelected(`${e.detail.slice.label} (#${e.detail.index})`)
            el.addEventListener('tc-slice-select', handler)
            return () => el.removeEventListener('tc-slice-select', handler)
        }
    }, [])

    useEffect(() => {
        if (donutRef.current) donutRef.current.data = storage
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="PieChart"
                            description="Inline-SVG pie or donut chart with a percentage distribution and an interactive legend. data is set via a JS property; title/subtitle/donut/center-label/show-legend/height/loading are attributes. Hovering a slice (or its legend row) highlights both, pulls the slice out and shows a tooltip; clicking a legend entry toggles that slice's visibility and fires tc-slice-select."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Pie — legend toggle + slice select">
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
                            </SectionCard>

                            <SectionCard title="Donut — center label">
                                {/* @ts-ignore */}
                                <tc-pie-chart
                                    ref={donutRef}
                                    donut
                                    center-label="Used"
                                    title="Storage usage"
                                    subtitle="Percent of the 100 GB plan"
                                    height="280"
                                />
                            </SectionCard>

                            <SectionCard title="Legend hidden">
                                {/* @ts-ignore */}
                                <tc-pie-chart
                                    ref={(el: any) => { if (el) el.data = traffic }}
                                    show-legend="false"
                                    title="Chart only"
                                    height="240"
                                />
                            </SectionCard>

                            <SectionCard title="Loading skeleton">
                                {/* @ts-ignore */}
                                <tc-pie-chart loading title="Loading…" height="280" />
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PieChartDemo
