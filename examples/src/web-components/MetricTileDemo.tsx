import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const MetricTileDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="MetricTile"
                        description="Compact presentational card showing a single metric with a label, value, optional unit, icon, and hint line."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">

                        <SectionCard title="Label and value">
                            <div style={{ maxWidth: 280 }}>
                                {/* @ts-ignore */}
                                <tc-metric-tile label="Total Users" value="12,480" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Value with unit">
                            <div style={{ maxWidth: 280 }}>
                                {/* @ts-ignore */}
                                <tc-metric-tile label="Avg Response" value="142" unit="ms" />
                            </div>
                        </SectionCard>

                        <SectionCard title="With icon">
                            <div style={{ maxWidth: 280 }}>
                                {/* @ts-ignore */}
                                <tc-metric-tile label="Revenue" value="$24,500" icon="DollarSign" />
                            </div>
                        </SectionCard>

                        <SectionCard title="With hint">
                            <div style={{ maxWidth: 280 }}>
                                {/* @ts-ignore */}
                                <tc-metric-tile label="Error Rate" value="0.4" unit="%" hint="Down 0.1% from last week" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Grid — four tiles">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                {/* @ts-ignore */}
                                <tc-metric-tile label="Requests" value="3.2M" icon="Activity" hint="Last 24 hours" />
                                {/* @ts-ignore */}
                                <tc-metric-tile label="Uptime" value="99.97" unit="%" icon="CheckCircle" />
                                {/* @ts-ignore */}
                                <tc-metric-tile label="Latency P99" value="320" unit="ms" icon="Zap" />
                                {/* @ts-ignore */}
                                <tc-metric-tile label="Active Sessions" value="1,804" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Slotted value">
                            <div style={{ maxWidth: 280 }}>
                                {/* @ts-ignore */}
                                <tc-metric-tile label="Build Status">
                                    <strong style={{ color: 'var(--tc-success, #16a34a)', fontFamily: 'JetBrains Mono, monospace', fontSize: '1.5rem' }}>Passing</strong>
                                {/* @ts-ignore */}
                                </tc-metric-tile>
                            </div>
                        </SectionCard>

                        <SectionCard title="Slotted hint">
                            <div style={{ maxWidth: 320 }}>
                                {/* @ts-ignore */}
                                <tc-metric-tile label="Open Tickets" value="42">
                                    <span slot="hint" style={{ color: 'var(--tc-danger, #dc2626)', fontSize: '0.75rem' }}>3 critical</span>
                                {/* @ts-ignore */}
                                </tc-metric-tile>
                            </div>
                        </SectionCard>

                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default MetricTileDemo
