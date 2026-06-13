import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ChartContainerDemo: React.FC = () => {
    const withLegendRef = useRef<any>(null)
    const withActionsRef = useRef<any>(null)
    const fullRef = useRef<any>(null)
    const emptyCustomRef = useRef<any>(null)

    useEffect(() => {
        // Legend-only example
        const legendEl = withLegendRef.current
        if (legendEl) {
            legendEl.legend = '<span style="display:inline-flex;align-items:center;gap:0.5rem;font-size:0.75rem;color:var(--tc-text-muted)"><span style="display:inline-block;width:10px;height:10px;background:var(--tc-app-accent);border-radius:50%"></span>Monthly Revenue</span>'
        }

        // Actions-only example
        const actionsEl = withActionsRef.current
        if (actionsEl) {
            actionsEl.actions = '<button type="button" style="font:inherit;font-size:0.75rem;padding:0.25rem 0.625rem;background:none;border:1px solid var(--tc-border);cursor:pointer;color:var(--tc-text-muted)">Export</button>'
        }

        // Full example: legend + actions
        const fullEl = fullRef.current
        if (fullEl) {
            fullEl.legend = '<span style="display:inline-flex;gap:1.25rem;font-size:0.75rem;color:var(--tc-text-muted)"><span>&#9679; Series A</span><span>&#9675; Series B</span></span>'
            fullEl.actions = '<button type="button" style="font:inherit;font-size:0.75rem;padding:0.25rem 0.625rem;background:none;border:1px solid var(--tc-border);cursor:pointer;color:var(--tc-text-muted)">1M</button><button type="button" style="font:inherit;font-size:0.75rem;padding:0.25rem 0.625rem;background:none;border:1px solid var(--tc-border);cursor:pointer;color:var(--tc-text-muted)">3M</button><button type="button" style="font:inherit;font-size:0.75rem;padding:0.25rem 0.625rem;background:none;border:1px solid var(--tc-border);cursor:pointer;color:var(--tc-text-muted)">1Y</button>'
        }

        // Empty with custom emptySlot
        const emptyCustomEl = emptyCustomRef.current
        if (emptyCustomEl) {
            emptyCustomEl.emptySlot = '<span style="font-size:0.875rem;color:var(--tc-text-muted)">No records found for the selected date range.</span>'
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ChartContainer"
                            description="Chart wrapper with header (title + subtitle + actions), slotted body, legend footer, and loading/empty states."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Basic — title and subtitle with slotted body">
                                <div style={{ maxWidth: 560 }}>
                                    {/* @ts-ignore */}
                                    <tc-chart-container title="Monthly Revenue" subtitle="Jan – Jun 2025">
                                        <div style={{ height: 160, background: 'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(99,102,241,0.03))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tc-text-faint)', fontSize: '0.8rem' }}>
                                            Chart body goes here
                                        </div>
                                    {/* @ts-ignore */}
                                    </tc-chart-container>
                                </div>
                            </SectionCard>

                            <SectionCard title="With legend (JS property)">
                                <div style={{ maxWidth: 560 }}>
                                    {/* @ts-ignore */}
                                    <tc-chart-container ref={withLegendRef} title="Revenue Breakdown" subtitle="Q2 2025">
                                        <div style={{ height: 140, background: 'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(99,102,241,0.03))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tc-text-faint)', fontSize: '0.8rem' }}>
                                            Chart body goes here
                                        </div>
                                    {/* @ts-ignore */}
                                    </tc-chart-container>
                                </div>
                            </SectionCard>

                            <SectionCard title="With actions (JS property)">
                                <div style={{ maxWidth: 560 }}>
                                    {/* @ts-ignore */}
                                    <tc-chart-container ref={withActionsRef} title="User Signups">
                                        <div style={{ height: 140, background: 'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(99,102,241,0.03))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tc-text-faint)', fontSize: '0.8rem' }}>
                                            Chart body goes here
                                        </div>
                                    {/* @ts-ignore */}
                                    </tc-chart-container>
                                </div>
                            </SectionCard>

                            <SectionCard title="Full — title, subtitle, actions and legend">
                                <div style={{ maxWidth: 560 }}>
                                    {/* @ts-ignore */}
                                    <tc-chart-container ref={fullRef} title="Portfolio Performance" subtitle="Last 12 months">
                                        <div style={{ height: 160, background: 'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(99,102,241,0.03))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tc-text-faint)', fontSize: '0.8rem' }}>
                                            Chart body goes here
                                        </div>
                                    {/* @ts-ignore */}
                                    </tc-chart-container>
                                </div>
                            </SectionCard>

                            <SectionCard title="No header — no title, subtitle or actions">
                                <div style={{ maxWidth: 560 }}>
                                    {/* @ts-ignore */}
                                    <tc-chart-container>
                                        <div style={{ height: 140, background: 'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(99,102,241,0.03))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tc-text-faint)', fontSize: '0.8rem' }}>
                                            No header, chart only
                                        </div>
                                    {/* @ts-ignore */}
                                    </tc-chart-container>
                                </div>
                            </SectionCard>

                            <SectionCard title="Loading state (loading attribute)">
                                <div style={{ maxWidth: 560 }}>
                                    {/* @ts-ignore */}
                                    <tc-chart-container title="Loading Chart" subtitle="Fetching data…" loading>
                                    {/* @ts-ignore */}
                                    </tc-chart-container>
                                </div>
                            </SectionCard>

                            <SectionCard title="Empty state — default placeholder">
                                <div style={{ maxWidth: 560 }}>
                                    {/* @ts-ignore */}
                                    <tc-chart-container title="No Data" empty>
                                    {/* @ts-ignore */}
                                    </tc-chart-container>
                                </div>
                            </SectionCard>

                            <SectionCard title="Empty state — custom emptySlot (JS property)">
                                <div style={{ maxWidth: 560 }}>
                                    {/* @ts-ignore */}
                                    <tc-chart-container ref={emptyCustomRef} title="Custom Empty" subtitle="Date range: last 90 days" empty>
                                    {/* @ts-ignore */}
                                    </tc-chart-container>
                                </div>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ChartContainerDemo
