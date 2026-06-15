import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

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
    const defaultRef = useRef<any>(null)
    const colorRef = useRef<any>(null)
    const sizeRef = useRef<any>(null)
    const loadingRef = useRef<any>(null)

    useEffect(() => {
        const data = buildData()
        for (const ref of [defaultRef, colorRef, sizeRef]) {
            if (!ref.current) continue
            ref.current.rows = DAYS
            ref.current.cols = HOURS
            ref.current.data = data
        }
        // Custom warm→hot colour scale.
        if (colorRef.current) {
            colorRef.current.colorScale = ['#f1f5f9', '#fde68a', '#fb923c', '#ef4444', '#991b1b']
        }
        if (loadingRef.current) {
            loadingRef.current.rows = DAYS
            loadingRef.current.cols = HOURS
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Heatmap"
                            description="Heatmap grid with colour-interpolated cells, axis labels, a min→max legend, and hover tooltips. Cell colour is the sanctioned data encoding; the default scale is slate→ink neutrals."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default scale — slate→ink neutrals">
                                {/* @ts-ignore */}
                                <tc-heatmap
                                    ref={defaultRef}
                                    title="Weekly activity"
                                    subtitle="Events by day and hour"
                                />
                            </SectionCard>

                            <SectionCard title="Custom colorScale — warm → hot">
                                {/* @ts-ignore */}
                                <tc-heatmap
                                    ref={colorRef}
                                    title="Traffic intensity"
                                    subtitle="Explicit colour scale carries the encoding"
                                />
                            </SectionCard>

                            <SectionCard title="Larger cells — cell-size=44">
                                {/* @ts-ignore */}
                                <tc-heatmap ref={sizeRef} cell-size="44" title="Roomier grid" />
                            </SectionCard>

                            <SectionCard title="Loading skeleton">
                                {/* @ts-ignore */}
                                <tc-heatmap ref={loadingRef} loading title="Loading" />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default HeatmapDemo
