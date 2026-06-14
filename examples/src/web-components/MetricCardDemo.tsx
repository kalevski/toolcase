import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const MetricCardDemo: React.FC = () => {
    const trendRef = useRef<any>(null)
    const customColorRef = useRef<any>(null)

    useEffect(() => {
        if (trendRef.current) {
            trendRef.current.trend = [12, 28, 20, 45, 35, 60, 50, 72, 65, 88]
        }
    }, [])

    useEffect(() => {
        if (customColorRef.current) {
            customColorRef.current.trend = [80, 65, 70, 55, 60, 45, 50, 35]
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="MetricCard"
                            description="Dashboard card showing a metric label, prominent value, optional subtitle, optional icon chip, and an inline SVG sparkline trend."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Basic — title and value">
                                <div style={{ maxWidth: 280 }}>
                                    {/* @ts-ignore */}
                                    <tc-metric-card title="Monthly Revenue" value="$42,100" />
                                </div>
                            </SectionCard>

                            <SectionCard title="With icon">
                                <div style={{ maxWidth: 280 }}>
                                    {/* @ts-ignore */}
                                    <tc-metric-card title="Active Users" value="8,340" icon="Users" />
                                </div>
                            </SectionCard>

                            <SectionCard title="With subtitle">
                                <div style={{ maxWidth: 280 }}>
                                    {/* @ts-ignore */}
                                    <tc-metric-card title="Page Views" value="124,800" subtitle="Last 30 days" icon="Eye" />
                                </div>
                            </SectionCard>

                            <SectionCard title="With sparkline trend (JS property)">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-metric-card ref={trendRef} title="Weekly Sessions" value="3,640" subtitle="+18% vs last week" icon="TrendingUp" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Custom trend-color">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-metric-card ref={customColorRef} title="Error Rate" value="2.4%" subtitle="Trending down" trend-color="var(--tc-danger, #ef4444)" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Loading skeleton">
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                    {/* @ts-ignore */}
                                    <tc-metric-card loading title="Revenue" value="0" />
                                    {/* @ts-ignore */}
                                    <tc-metric-card loading title="Users" value="0" />
                                    {/* @ts-ignore */}
                                    <tc-metric-card loading title="Sessions" value="0" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Dashboard grid — various configurations">
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                    {/* @ts-ignore */}
                                    <tc-metric-card title="MRR" value="$42,100" subtitle="vs $38,900 last month" icon="DollarSign" />
                                    {/* @ts-ignore */}
                                    <tc-metric-card title="Churn Rate" value="2.1%" subtitle="Target: &lt; 3%" icon="TrendingDown" />
                                    {/* @ts-ignore */}
                                    <tc-metric-card title="NPS Score" value="72" subtitle="1,240 responses" icon="Star" />
                                    {/* @ts-ignore */}
                                    <tc-metric-card title="P99 Latency" value="320ms" subtitle="Stable this week" icon="Zap" />
                                </div>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MetricCardDemo
