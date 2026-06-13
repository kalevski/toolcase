import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const TrendIndicatorDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="TrendIndicator"
                            description="Trend badge with a directional arrow icon and formatted value. Explicit direction overrides sign inference. Three sizes scale the icon and text proportionally. Purely presentational — no interaction."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Directions (explicit attribute)">
                                <div className="d-flex gap-3 align-items-center flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-trend-indicator value="+12%" direction="up"></tc-trend-indicator>
                                    {/* @ts-ignore */}
                                    <tc-trend-indicator value="-8%" direction="down"></tc-trend-indicator>
                                    {/* @ts-ignore */}
                                    <tc-trend-indicator value="0%" direction="neutral"></tc-trend-indicator>
                                </div>
                            </SectionCard>

                            <SectionCard title="Sign-inferred direction (no direction attribute)">
                                <p className="mb-2" style={{ fontSize: '0.85rem', color: 'var(--tc-text-muted)' }}>
                                    When <code>direction</code> is omitted and <code>value</code> parses to a number, direction is inferred from the sign.
                                </p>
                                <div className="d-flex gap-3 align-items-center flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-trend-indicator value="42"></tc-trend-indicator>
                                    {/* @ts-ignore */}
                                    <tc-trend-indicator value="-17"></tc-trend-indicator>
                                    {/* @ts-ignore */}
                                    <tc-trend-indicator value="0"></tc-trend-indicator>
                                </div>
                            </SectionCard>

                            <SectionCard title="Sizes">
                                <div className="d-flex gap-4 align-items-center flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-trend-indicator value="+5%" direction="up" size="small"></tc-trend-indicator>
                                    {/* @ts-ignore */}
                                    <tc-trend-indicator value="+5%" direction="up" size="default"></tc-trend-indicator>
                                    {/* @ts-ignore */}
                                    <tc-trend-indicator value="+5%" direction="up" size="large"></tc-trend-indicator>
                                </div>
                            </SectionCard>

                            <SectionCard title="Inline within a metric row">
                                <p className="mb-0" style={{ fontSize: '1rem', lineHeight: '2' }}>
                                    Revenue <strong>$42,180</strong>{' '}
                                    {/* @ts-ignore */}
                                    <tc-trend-indicator value="+12.4%" direction="up" size="small"></tc-trend-indicator>
                                </p>
                                <p className="mb-0 mt-1" style={{ fontSize: '1rem', lineHeight: '2' }}>
                                    Active users <strong>8,340</strong>{' '}
                                    {/* @ts-ignore */}
                                    <tc-trend-indicator value="-7.1%" direction="down" size="small"></tc-trend-indicator>
                                </p>
                                <p className="mb-0 mt-1" style={{ fontSize: '1rem', lineHeight: '2' }}>
                                    Bounce rate <strong>42%</strong>{' '}
                                    {/* @ts-ignore */}
                                    <tc-trend-indicator value="0%" direction="neutral" size="small"></tc-trend-indicator>
                                </p>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TrendIndicatorDemo
