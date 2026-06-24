import React from 'react'

const ObjectiveMarkerDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="ObjectiveMarker"
                        description="Absolutely-positioned world-space marker with a map-pin glyph, optional label, and formatted distance readout. Drop inside a position:relative container and set x/y for world coordinates. Pulse animation is gated by the [pulse] attribute."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Static markers with labels and distances">
                            <div
                                style={{
                                    position: 'relative',
                                    height: 220,
                                    background: 'var(--tc-surface-muted)',
                                    border: '1px solid var(--tc-border)',
                                }}
                            >
                                {/* @ts-ignore */}
                                <tc-objective-marker
                                    x="120"
                                    y="160"
                                    label="Capture"
                                    distance="42"
                                />
                                {/* @ts-ignore */}
                                <tc-objective-marker
                                    x="300"
                                    y="120"
                                    label="Defend"
                                    distance="185"
                                />
                                {/* @ts-ignore */}
                                <tc-objective-marker
                                    x="480"
                                    y="170"
                                    label="Regroup"
                                    distance="1420"
                                />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Custom colors">
                            <div
                                style={{
                                    position: 'relative',
                                    height: 180,
                                    background: 'var(--tc-surface-muted)',
                                    border: '1px solid var(--tc-border)',
                                }}
                            >
                                {/* @ts-ignore */}
                                <tc-objective-marker
                                    x="120"
                                    y="140"
                                    label="Threat"
                                    distance="88"
                                    color="var(--tc-danger)"
                                />
                                {/* @ts-ignore */}
                                <tc-objective-marker
                                    x="280"
                                    y="110"
                                    label="Item"
                                    distance="310"
                                    color="var(--tc-warning)"
                                />
                                {/* @ts-ignore */}
                                <tc-objective-marker
                                    x="440"
                                    y="150"
                                    label="Ally"
                                    distance="55"
                                    color="var(--tc-success)"
                                />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Pulse animation">
                            <div
                                style={{
                                    position: 'relative',
                                    height: 180,
                                    background: 'var(--tc-surface-muted)',
                                    border: '1px solid var(--tc-border)',
                                }}
                            >
                                {/* @ts-ignore */}
                                <tc-objective-marker
                                    x="150"
                                    y="130"
                                    label="Boss"
                                    distance="1240"
                                    color="var(--tc-danger)"
                                    pulse
                                />
                                {/* @ts-ignore */}
                                <tc-objective-marker
                                    x="380"
                                    y="130"
                                    label="Objective"
                                    distance="620"
                                    pulse
                                />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Label only / distance only / glyph only">
                            <div
                                style={{
                                    position: 'relative',
                                    height: 120,
                                    background: 'var(--tc-surface-muted)',
                                    border: '1px solid var(--tc-border)',
                                }}
                            >
                                {/* @ts-ignore */}
                                <tc-objective-marker x="100" y="90" label="Label only" />
                                {/* @ts-ignore */}
                                <tc-objective-marker x="280" y="90" distance="750" />
                                {/* @ts-ignore */}
                                <tc-objective-marker x="440" y="90" />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Custom size (size=28)">
                            <div
                                style={{
                                    position: 'relative',
                                    height: 140,
                                    background: 'var(--tc-surface-muted)',
                                    border: '1px solid var(--tc-border)',
                                }}
                            >
                                {/* @ts-ignore */}
                                <tc-objective-marker
                                    x="200"
                                    y="110"
                                    label="Large"
                                    distance="200"
                                    size="28"
                                />
                                {/* @ts-ignore */}
                                <tc-objective-marker
                                    x="420"
                                    y="110"
                                    label="Default"
                                    distance="200"
                                />
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default ObjectiveMarkerDemo
