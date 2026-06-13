import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const MetricGridDemo: React.FC = () => {
    const itemsRef = useRef<any>(null)
    const threeColRef = useRef<any>(null)
    const fourColRef = useRef<any>(null)
    const twoColRef = useRef<any>(null)

    useEffect(() => {
        if (itemsRef.current) {
            itemsRef.current.items = [
                { label: 'Total Users', value: '12,480', icon: 'Users' },
                { label: 'Revenue', value: '$24,500', unit: 'USD', icon: 'DollarSign' },
                { label: 'Avg Response', value: '142', unit: 'ms', icon: 'Zap', hint: 'P50 over 24 h' },
            ]
        }
        if (threeColRef.current) {
            threeColRef.current.items = [
                { label: 'Requests', value: '3.2M', icon: 'Activity', hint: 'Last 24 hours' },
                { label: 'Uptime', value: '99.97', unit: '%', icon: 'CheckCircle' },
                { label: 'Latency P99', value: '320', unit: 'ms', icon: 'Zap' },
            ]
        }
        if (fourColRef.current) {
            fourColRef.current.items = [
                { label: 'Requests', value: '3.2M', icon: 'Activity' },
                { label: 'Uptime', value: '99.97', unit: '%', icon: 'CheckCircle' },
                { label: 'Latency P99', value: '320', unit: 'ms', icon: 'Zap' },
                { label: 'Active Sessions', value: '1,804', icon: 'Globe' },
            ]
        }
        if (twoColRef.current) {
            twoColRef.current.items = [
                { label: 'Error Rate', value: '0.4', unit: '%', hint: 'Down 0.1% from last week' },
                { label: 'Deployments', value: '18', hint: 'This month' },
            ]
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="MetricGrid"
                            description="CSS-grid container for metric tiles with configurable column count. Set tiles via the items JS property or drop tc-metric-tile markup as children."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="items property (3 columns — default)">
                                {/* @ts-ignore */}
                                <tc-metric-grid ref={itemsRef} />
                            </SectionCard>

                            <SectionCard title="3 columns (explicit)">
                                {/* @ts-ignore */}
                                <tc-metric-grid columns="3" ref={threeColRef} />
                            </SectionCard>

                            <SectionCard title="4 columns">
                                {/* @ts-ignore */}
                                <tc-metric-grid columns="4" ref={fourColRef} />
                            </SectionCard>

                            <SectionCard title="2 columns">
                                {/* @ts-ignore */}
                                <tc-metric-grid columns="2" ref={twoColRef} />
                            </SectionCard>

                            <SectionCard title="Slotted children (raw tc-metric-tile markup)">
                                {/* @ts-ignore */}
                                <tc-metric-grid columns="3">
                                    {/* @ts-ignore */}
                                    <tc-metric-tile label="Build Status" value="Passing" icon="CheckCircle" />
                                    {/* @ts-ignore */}
                                    <tc-metric-tile label="Coverage" value="94.2" unit="%" icon="Shield" />
                                    {/* @ts-ignore */}
                                    <tc-metric-tile label="Open PRs" value="7" hint="2 awaiting review" />
                                    {/* @ts-ignore */}
                                </tc-metric-grid>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MetricGridDemo
