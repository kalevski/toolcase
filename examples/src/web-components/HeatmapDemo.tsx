import React, { useMemo } from 'react'
import { useTc } from '@toolcase/web-components/react'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = ['00', '04', '08', '12', '16', '20']

// Deterministic pseudo-activity matrix so the demo renders stable data.
const buildData = () => {
    const data: { row: string; col: string; value: number; label?: string }[] = []
    DAYS.forEach((day, di) => {
        HOURS.forEach((hour, hi) => {
            const value = Math.round((Math.sin(di + 1) * Math.cos(hi + 1) + 1) * 45 + hi * 3)
            data.push({ row: day, col: hour, value, label: `${value} events` })
        })
    })
    return data
}

const HeatmapDemo: React.FC = () => {
    const data = useMemo(() => buildData(), [])

    const defaultRef = useTc<HTMLElement>({ rows: DAYS, cols: HOURS, data })
    // Custom warm→hot colour scale.
    const colorRef = useTc<HTMLElement>({
        rows: DAYS,
        cols: HOURS,
        data,
        colorScale: ['#f1f5f9', '#fde68a', '#fb923c', '#ef4444', '#991b1b'],
    })
    const sizeRef = useTc<HTMLElement>({ rows: DAYS, cols: HOURS, data })
    const loadingRef = useTc<HTMLElement>({ rows: DAYS, cols: HOURS })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Heatmap"
                            description="Heatmap grid with colour-interpolated cells, axis labels, a min→max legend, and hover tooltips. Cell colour is the sanctioned data encoding; the default scale is slate→ink neutrals."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default scale — slate→ink neutrals">
                                {/* @ts-ignore */}
                                <tc-heatmap
                                    ref={defaultRef}
                                    title="Weekly activity"
                                    subtitle="Events by day and hour"
                                />
                            </tc-section-card>

                            <tc-section-card title="Custom colorScale — warm → hot">
                                {/* @ts-ignore */}
                                <tc-heatmap
                                    ref={colorRef}
                                    title="Traffic intensity"
                                    subtitle="Explicit colour scale carries the encoding"
                                />
                            </tc-section-card>

                            <tc-section-card title="Larger cells — cell-size=44">
                                {/* @ts-ignore */}
                                <tc-heatmap ref={sizeRef} cell-size="44" title="Roomier grid" />
                            </tc-section-card>

                            <tc-section-card title="Loading skeleton">
                                {/* @ts-ignore */}
                                <tc-heatmap ref={loadingRef} loading title="Loading" />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default HeatmapDemo
