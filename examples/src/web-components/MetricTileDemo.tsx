import React from 'react'

const MetricTileDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="MetricTile"
                        description="Compact presentational card showing a single metric with a label, value, optional unit, icon, and hint line."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Label and value">
                            <div style={{ maxWidth: 280 }}>
                                {/* @ts-ignore */}
                                <tc-metric-tile label="Total Users" value="12,480" />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Value with unit">
                            <div style={{ maxWidth: 280 }}>
                                {/* @ts-ignore */}
                                <tc-metric-tile label="Avg Response" value="142" unit="ms" />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="With icon">
                            <div style={{ maxWidth: 280 }}>
                                {/* @ts-ignore */}
                                <tc-metric-tile label="Revenue" value="$24,500" icon="DollarSign" />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="With hint">
                            <div style={{ maxWidth: 280 }}>
                                {/* @ts-ignore */}
                                <tc-metric-tile
                                    label="Error Rate"
                                    value="0.4"
                                    unit="%"
                                    hint="Down 0.1% from last week"
                                />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Grid — four tiles">
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                    gap: '1rem',
                                }}
                            >
                                {/* @ts-ignore */}
                                <tc-metric-tile
                                    label="Requests"
                                    value="3.2M"
                                    icon="Activity"
                                    hint="Last 24 hours"
                                />
                                {/* @ts-ignore */}
                                <tc-metric-tile
                                    label="Uptime"
                                    value="99.97"
                                    unit="%"
                                    icon="CheckCircle"
                                />
                                {/* @ts-ignore */}
                                <tc-metric-tile
                                    label="Latency P99"
                                    value="320"
                                    unit="ms"
                                    icon="Zap"
                                />
                                {/* @ts-ignore */}
                                <tc-metric-tile label="Active Sessions" value="1,804" />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Slotted value">
                            <div style={{ maxWidth: 280 }}>
                                {/* @ts-ignore */}
                                <tc-metric-tile label="Build Status">
                                    <strong
                                        style={{
                                            color: 'var(--tc-success, #16a34a)',
                                            fontFamily: 'JetBrains Mono, monospace',
                                            fontSize: '1.5rem',
                                        }}
                                    >
                                        Passing
                                    </strong>
                                    {/* @ts-ignore */}
                                </tc-metric-tile>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Slotted hint">
                            <div style={{ maxWidth: 320 }}>
                                {/* @ts-ignore */}
                                <tc-metric-tile label="Open Tickets" value="42">
                                    <span
                                        slot="hint"
                                        style={{
                                            color: 'var(--tc-danger, #dc2626)',
                                            fontSize: '0.75rem',
                                        }}
                                    >
                                        3 critical
                                    </span>
                                    {/* @ts-ignore */}
                                </tc-metric-tile>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default MetricTileDemo
