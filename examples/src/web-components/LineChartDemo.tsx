import React, { useEffect, useRef, useState } from 'react'

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']

const revenue = [
    {
        name: 'Revenue',
        data: months.map((m, i) => ({ x: m, y: 4200 + i * 1300 + (i % 2 ? 600 : -300) })),
    },
    {
        name: 'Costs',
        data: months.map((m, i) => ({ x: m, y: 2800 + i * 700 + (i % 3 ? 200 : -150) })),
    },
    {
        name: 'Profit',
        data: months.map((m, i) => ({ x: m, y: 1400 + i * 600 })),
        color: 'var(--tc-success)',
    },
]

const traffic = [
    { name: 'Desktop', data: months.map((m, i) => ({ x: m, y: 30 + i * 4 })) },
    { name: 'Mobile', data: months.map((m, i) => ({ x: m, y: 18 + i * 6 })) },
]

const LineChartDemo: React.FC = () => {
    const mainRef = useRef<any>(null)
    const trafficRef = useRef<any>(null)
    const noGridRef = useRef<any>(null)
    const [hovered, setHovered] = useState<string | null>(null)

    useEffect(() => {
        if (mainRef.current) {
            const el = mainRef.current
            el.series = revenue
            // currency formatting via JS property
            el.yFormatter = (v: number) => `$${(v / 1000).toFixed(1)}k`
            el.xFormatter = (v: string | number) => `${v} '24`
            const handler = (e: any) =>
                setHovered(`${e.detail.series.name} @ ${e.detail.point.x} = ${e.detail.point.y}`)
            el.addEventListener('tc-point-hover', handler)
            return () => el.removeEventListener('tc-point-hover', handler)
        }
    }, [])

    useEffect(() => {
        if (trafficRef.current) {
            trafficRef.current.series = traffic
            trafficRef.current.yFormatter = (v: number) => `${v}%`
        }
    }, [])

    useEffect(() => {
        if (noGridRef.current) noGridRef.current.series = revenue
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="LineChart"
                            description="Inline-SVG line chart with multiple series sharing axes, grid hairlines, point markers and an optional toggle legend. series is set via a JS property; xFormatter/yFormatter are function properties; title/subtitle/height/show-grid/show-legend/loading are attributes. Hovering near a point shows a tooltip and fires tc-point-hover; clicking a legend entry toggles that series."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Multi-series — formatters, legend toggle, hover">
                                {/* @ts-ignore */}
                                <tc-line-chart
                                    ref={mainRef}
                                    title="Quarterly performance"
                                    subtitle="Revenue, costs and profit by month"
                                    height="320"
                                />
                                <p className="text-muted small mt-2 mb-0">
                                    Last hovered point: <strong>{hovered ?? 'none'}</strong>
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Percent y-axis">
                                {/* @ts-ignore */}
                                <tc-line-chart
                                    ref={trafficRef}
                                    title="Traffic share"
                                    subtitle="Desktop vs mobile, % of sessions"
                                    height="280"
                                />
                            </tc-section-card>

                            <tc-section-card title="Grid + legend hidden">
                                {/* @ts-ignore */}
                                <tc-line-chart
                                    ref={noGridRef}
                                    title="Minimal"
                                    subtitle="show-grid=false, show-legend=false"
                                    height="240"
                                    show-grid="false"
                                    show-legend="false"
                                />
                            </tc-section-card>

                            <tc-section-card title="Loading skeleton">
                                {/* @ts-ignore */}
                                <tc-line-chart loading title="Loading…" height="280" />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LineChartDemo
