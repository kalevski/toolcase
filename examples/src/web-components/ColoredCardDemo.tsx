import React from 'react'

const ColoredCardDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ColoredCard"
                            description="Dashboard card with a caller-supplied color tinting the icon chip and a metric display."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Revenue (green accent)">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-colored-card
                                        icon="TrendingUp"
                                        value="$48,200"
                                        text="Total revenue"
                                        color="#22c55e"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Active users (blue accent)">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-colored-card
                                        icon="Users"
                                        value="3,821"
                                        text="Active users this week"
                                        color="#3b82f6"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Alerts (orange accent)">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-colored-card
                                        icon="AlertTriangle"
                                        value="14"
                                        text="Open alerts"
                                        color="#f97316"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Loading state">
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-colored-card
                                        loading
                                        icon="BarChart2"
                                        value="—"
                                        text="placeholder"
                                        color="#6366f1"
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

export default ColoredCardDemo
