import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const StatCardDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="StatCard"
                        description="Statistic card with label, value, optional icon, delta indicator, helper text, and footer row."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">

                        <SectionCard title="Basic — label and value">
                            <div style={{ maxWidth: 280 }}>
                                {/* @ts-ignore */}
                                <tc-stat-card label="Total Users" value="12,480" />
                            </div>
                        </SectionCard>

                        <SectionCard title="With unit">
                            <div style={{ maxWidth: 280 }}>
                                {/* @ts-ignore */}
                                <tc-stat-card label="Avg Response" value="142" unit="ms" />
                            </div>
                        </SectionCard>

                        <SectionCard title="With icon">
                            <div style={{ maxWidth: 280 }}>
                                {/* @ts-ignore */}
                                <tc-stat-card label="Revenue" value="$24,500" icon="DollarSign" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Delta kinds">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                {/* @ts-ignore */}
                                <tc-stat-card label="Active Users" value="3,240" delta="+12%" delta-kind="up" icon="Users" />
                                {/* @ts-ignore */}
                                <tc-stat-card label="Bounce Rate" value="68%" delta="-4.2%" delta-kind="down" icon="TrendingDown" />
                                {/* @ts-ignore */}
                                <tc-stat-card label="Avg Session" value="4m 12s" delta="0.0%" delta-kind="neutral" icon="Clock" />
                            </div>
                        </SectionCard>

                        <SectionCard title="With helper text">
                            <div style={{ maxWidth: 280 }}>
                                {/* @ts-ignore */}
                                <tc-stat-card label="Error Rate" value="0.4" unit="%" delta="-0.1%" delta-kind="up" helper="Down 0.1 pp from last week" />
                            </div>
                        </SectionCard>

                        <SectionCard title="With footer">
                            <div style={{ maxWidth: 280 }}>
                                {/* @ts-ignore */}
                                <tc-stat-card label="Monthly Signups" value="1,804" delta="+22%" delta-kind="up" footer="Compared to previous 30 days" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Slotted value">
                            <div style={{ maxWidth: 280 }}>
                                {/* @ts-ignore */}
                                <tc-stat-card label="Build Status">
                                    <strong style={{ color: 'var(--tc-success, #16a34a)', fontFamily: 'JetBrains Mono, monospace', fontSize: '1.75rem', fontWeight: 600 }}>Passing</strong>
                                {/* @ts-ignore */}
                                </tc-stat-card>
                            </div>
                        </SectionCard>

                        <SectionCard title="Loading skeleton">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                {/* @ts-ignore */}
                                <tc-stat-card loading label="Users" value="0" />
                                {/* @ts-ignore */}
                                <tc-stat-card loading label="Revenue" value="0" />
                                {/* @ts-ignore */}
                                <tc-stat-card loading label="Sessions" value="0" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Dashboard grid — all features">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                {/* @ts-ignore */}
                                <tc-stat-card label="MRR" value="$42,100" unit="USD" icon="DollarSign" delta="+8.3%" delta-kind="up" footer="vs last month" />
                                {/* @ts-ignore */}
                                <tc-stat-card label="Churn" value="2.1" unit="%" icon="TrendingDown" delta="+0.3%" delta-kind="down" helper="Above target threshold" />
                                {/* @ts-ignore */}
                                <tc-stat-card label="NPS" value="72" icon="Star" delta="+4" delta-kind="up" footer="Survey: 1,240 responses" />
                                {/* @ts-ignore */}
                                <tc-stat-card label="P99 Latency" value="320" unit="ms" icon="Zap" delta="0%" delta-kind="neutral" />
                            </div>
                        </SectionCard>

                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default StatCardDemo
