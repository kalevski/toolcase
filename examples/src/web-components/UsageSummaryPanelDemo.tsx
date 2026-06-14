import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const UsageSummaryPanelDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const warnRef = useRef<any>(null)
    const loadingRef = useRef<any>(null)
    const fullRef = useRef<any>(null)

    useEffect(() => {
        if (basicRef.current) {
            basicRef.current.usage = [
                { label: 'Storage', used: 12.4, total: 50, measurementUnit: 'GB' },
                { label: 'Bandwidth', used: 320, total: 1000, measurementUnit: 'MB' },
                { label: 'API Calls', used: 4800, total: 10000, measurementUnit: 'req/day' },
            ]
        }
        if (warnRef.current) {
            warnRef.current.usage = [
                { label: 'Storage', used: 45.2, total: 50, measurementUnit: 'GB', warn: true },
                { label: 'Bandwidth', used: 320, total: 1000, measurementUnit: 'MB' },
                { label: 'Seats', used: 10, total: 10, measurementUnit: 'users' },
            ]
        }
        if (fullRef.current) {
            fullRef.current.usage = [
                { label: 'Compute', used: 3.6, total: 8, measurementUnit: 'vCPU' },
                { label: 'Memory', used: 6.2, total: 16, measurementUnit: 'GB' },
                { label: 'Storage', used: 180, total: 200, measurementUnit: 'GB', warn: true },
                { label: 'Egress', used: 95, total: 100, measurementUnit: 'GB', warn: true },
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
                            title="UsageSummaryPanel"
                            description="Usage-metrics panel with progress bars for resource consumption. Set items via the usage JS property."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Basic usage — multiple resources">
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-usage-summary-panel title="Resource Usage" ref={basicRef} />
                                </div>
                            </SectionCard>

                            <SectionCard title="Near-limit and over-limit (warn) rows">
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-usage-summary-panel title="Plan Limits" ref={warnRef} />
                                </div>
                            </SectionCard>

                            <SectionCard title="Loading skeleton (default 3 rows)">
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-usage-summary-panel title="Usage" loading />
                                </div>
                            </SectionCard>

                            <SectionCard title="Loading skeleton — custom count">
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-usage-summary-panel loading loading-count="4" ref={loadingRef} />
                                </div>
                            </SectionCard>

                            <SectionCard title="No title — inline panel">
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-usage-summary-panel ref={fullRef} />
                                </div>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default UsageSummaryPanelDemo
