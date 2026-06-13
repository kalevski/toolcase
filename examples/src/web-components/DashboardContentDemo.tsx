import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const DashboardContentDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="DashboardContent"
                        description="Scrollable main content area for dashboard layouts. A pure layout wrapper — no chrome, no elevation, just comfortable padding and overflow-y scroll for hosting cards, rows, and section headers."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Basic usage">
                            <div style={{ border: '1px solid var(--tc-border)', height: '220px' }}>
                                {/* @ts-ignore */}
                                <tc-dashboard-content style={{ height: '100%' }}>
                                    <div style={{ marginBottom: '1rem', fontWeight: 600, color: 'var(--tc-text)' }}>Overview</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                                        <div style={{ padding: '1rem', background: 'var(--tc-surface-hover)', borderRadius: 0 }}>Card A</div>
                                        <div style={{ padding: '1rem', background: 'var(--tc-surface-hover)', borderRadius: 0 }}>Card B</div>
                                        <div style={{ padding: '1rem', background: 'var(--tc-surface-hover)', borderRadius: 0 }}>Card C</div>
                                    </div>
                                {/* @ts-ignore */}
                                </tc-dashboard-content>
                            </div>
                        </SectionCard>

                        <SectionCard title="Scrollable with overflow content">
                            <div style={{ border: '1px solid var(--tc-border)', height: '160px' }}>
                                {/* @ts-ignore */}
                                <tc-dashboard-content style={{ height: '100%' }}>
                                    {Array.from({ length: 8 }, (_, i) => (
                                        <div key={i} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--tc-border)', color: 'var(--tc-text)' }}>
                                            Row {i + 1} — dashboard content item
                                        </div>
                                    ))}
                                {/* @ts-ignore */}
                                </tc-dashboard-content>
                            </div>
                        </SectionCard>

                        <SectionCard title="Custom padding via CSS property">
                            <div style={{ border: '1px solid var(--tc-border)', height: '160px' }}>
                                {/* @ts-ignore */}
                                <tc-dashboard-content style={{ height: '100%', '--bs-dashboard-content-padding': '2.5rem' } as React.CSSProperties}>
                                    <div style={{ color: 'var(--tc-text)' }}>Content with extra padding applied via <code>--bs-dashboard-content-padding</code>.</div>
                                {/* @ts-ignore */}
                                </tc-dashboard-content>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default DashboardContentDemo
