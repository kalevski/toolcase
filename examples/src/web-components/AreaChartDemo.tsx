import React, { useEffect, useRef, useState } from 'react'

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']

const traffic = [
    {
        name: 'Visitors',
        points: months.map((m, i) => ({
            x: m,
            y: [1200, 1900, 1700, 2400, 2200, 3100, 3600, 4200][i],
        })),
    },
    {
        name: 'Signups',
        points: months.map((m, i) => ({ x: m, y: [180, 240, 210, 360, 340, 520, 610, 740][i] })),
    },
]

const revenue = [
    {
        name: 'Pro',
        points: months.map((m, i) => ({ x: m, y: [4, 6, 7, 9, 11, 13, 15, 18][i] * 1000 })),
    },
    {
        name: 'Team',
        points: months.map((m, i) => ({ x: m, y: [2, 3, 3, 5, 6, 8, 9, 11][i] * 1000 })),
    },
    {
        name: 'Enterprise',
        points: months.map((m, i) => ({ x: m, y: [1, 1, 2, 2, 3, 4, 5, 7][i] * 1000 })),
    },
]

const yMoney = (v: number): string => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`
    return `$${Math.round(v)}`
}
const yCompact = (v: number): string => {
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`
    return String(Math.round(v))
}

const AreaChartDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const stackedRef = useRef<any>(null)
    const noGridRef = useRef<any>(null)
    const [hover, setHover] = useState<string | null>(null)

    useEffect(() => {
        if (basicRef.current) {
            basicRef.current.series = traffic
            basicRef.current.yFormatter = yCompact
            basicRef.current.xFormatter = (v: string | number) => String(v)
        }
        if (stackedRef.current) {
            stackedRef.current.series = revenue
            stackedRef.current.yFormatter = yMoney
        }
        if (noGridRef.current) {
            noGridRef.current.series = traffic
            noGridRef.current.yFormatter = yCompact
        }

        const el = basicRef.current
        if (el) {
            const handler = (e: any) =>
                setHover(`${e.detail.series.name}: ${e.detail.point.x} = ${e.detail.point.y}`)
            el.addEventListener('tc-point-hover', handler)
            return () => el.removeEventListener('tc-point-hover', handler)
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="AreaChart"
                            description="SVG area chart with filled regions, gridlines, an interactive tooltip, and an optional legend. Series, xFormatter and yFormatter are set via JS properties; title/subtitle/height/stacked/show-grid/show-legend/loading are attributes."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Unstacked — multiple overlaid series">
                                {/* @ts-ignore */}
                                <tc-area-chart
                                    ref={basicRef}
                                    title="Site traffic"
                                    subtitle="Visitors vs signups, last 8 months"
                                    height="280"
                                />
                                <p className="text-muted small mt-2 mb-0">
                                    Hover a point — last: <strong>{hover ?? 'none'}</strong>
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Stacked — cumulative areas">
                                {/* @ts-ignore */}
                                <tc-area-chart
                                    ref={stackedRef}
                                    stacked
                                    title="Revenue by plan"
                                    subtitle="Stacked, monthly recurring revenue"
                                    height="280"
                                />
                            </tc-section-card>

                            <tc-section-card title="Grid off, legend off">
                                {/* @ts-ignore */}
                                <tc-area-chart
                                    ref={noGridRef}
                                    show-grid="false"
                                    show-legend="false"
                                    title="Minimal"
                                    height="220"
                                />
                            </tc-section-card>

                            <tc-section-card title="Loading skeleton">
                                {/* @ts-ignore */}
                                <tc-area-chart loading title="Loading…" height="260" />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AreaChartDemo
