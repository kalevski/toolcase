import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const DifferenceCardDemo: React.FC = () => {
    const formattedRef = useTc<HTMLElement>({
        formatValue: (v: number) =>
            new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0,
            }).format(v),
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="DifferenceCard"
                            description="Dashboard card showing a metric value with a directional delta chip (percentage change vs the previous period)."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Up — positive delta (revenue growth)">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-difference-card
                                        title="Monthly Revenue"
                                        value="12500"
                                        previous-value="10000"
                                        period="vs last month"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Down — negative delta (user churn)">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-difference-card
                                        title="Active Users"
                                        value="8200"
                                        previous-value="10000"
                                        period="vs last week"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Flat — zero delta (stable metric)">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-difference-card
                                        title="Error Rate"
                                        value="10000"
                                        previous-value="10000"
                                        period="vs yesterday"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom formatValue (USD currency — set via ref)">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-difference-card
                                        ref={formattedRef}
                                        title="Total Sales"
                                        value="1250000"
                                        previous-value="1000000"
                                        period="vs Q1"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Loading state">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-difference-card
                                        title="Placeholder"
                                        value="0"
                                        previous-value="0"
                                        loading
                                    />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DifferenceCardDemo
