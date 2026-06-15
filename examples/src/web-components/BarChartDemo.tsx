import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const traffic = [
    { label: 'Jan', value: 1200 },
    { label: 'Feb', value: 1900 },
    { label: 'Mar', value: 1700 },
    { label: 'Apr', value: 2400 },
    { label: 'May', value: 2200 },
    { label: 'Jun', value: 3100 },
    { label: 'Jul', value: 3600 },
    { label: 'Aug', value: 4200 },
]

const languages = [
    { label: 'TypeScript', value: 48200 },
    { label: 'Rust', value: 31400 },
    { label: 'Go', value: 22800 },
    { label: 'Python', value: 18600 },
    { label: 'Shell', value: 5400 },
]

const status = [
    { label: 'Passing', value: 142, color: 'var(--tc-success)' },
    { label: 'Flaky', value: 18, color: 'var(--tc-warning)' },
    { label: 'Failing', value: 6, color: 'var(--tc-danger)' },
]

const yCompact = (v: number): string => {
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`
    return String(Math.round(v))
}
const yPlain = (v: number): string => String(Math.round(v))

const BarChartDemo: React.FC = () => {
    const verticalRef = useRef<any>(null)
    const horizontalRef = useRef<any>(null)
    const statusRef = useRef<any>(null)
    const [clicked, setClicked] = useState<string | null>(null)

    useEffect(() => {
        if (verticalRef.current) {
            verticalRef.current.data = traffic
            verticalRef.current.yFormatter = yCompact
        }
        if (horizontalRef.current) {
            horizontalRef.current.data = languages
            horizontalRef.current.yFormatter = yCompact
        }
        if (statusRef.current) {
            statusRef.current.data = status
            statusRef.current.yFormatter = yPlain
        }

        const el = verticalRef.current
        if (el) {
            const handler = (e: any) =>
                setClicked(`${e.detail.item.label} = ${e.detail.item.value} (index ${e.detail.index})`)
            el.addEventListener('tc-bar-click', handler)
            return () => el.removeEventListener('tc-bar-click', handler)
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="BarChart"
                            description="SVG bar chart in vertical (columns) or horizontal (rows) orientation, with category/value axis labels, an interactive tooltip, and optional per-bar value labels. data and yFormatter are set via JS properties; title/subtitle/orientation/height/show-values/loading are attributes. Clicking a bar fires tc-bar-click."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Vertical — with value labels + click">
                                {/* @ts-ignore */}
                                <tc-bar-chart
                                    ref={verticalRef}
                                    title="Site traffic"
                                    subtitle="Visitors per month, last 8 months"
                                    height="280"
                                    show-values
                                />
                                <p className="text-muted small mt-2 mb-0">
                                    Last clicked bar: <strong>{clicked ?? 'none'}</strong>
                                </p>
                            </SectionCard>

                            <SectionCard title="Horizontal — ranked rows">
                                {/* @ts-ignore */}
                                <tc-bar-chart
                                    ref={horizontalRef}
                                    orientation="horizontal"
                                    title="Lines of code by language"
                                    height="240"
                                    show-values
                                />
                            </SectionCard>

                            <SectionCard title="Per-item colors">
                                {/* @ts-ignore */}
                                <tc-bar-chart
                                    ref={statusRef}
                                    title="Test suite status"
                                    subtitle="Explicit status colors per bar"
                                    height="220"
                                    show-values
                                />
                            </SectionCard>

                            <SectionCard title="Loading skeleton">
                                {/* @ts-ignore */}
                                <tc-bar-chart loading title="Loading…" height="240" />
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BarChartDemo
