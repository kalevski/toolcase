import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const WaypointMarkerDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="WaypointMarker"
                        description="Absolutely-positioned world-space waypoint marker with a configurable Lucide icon glyph, optional label chip, and formatted distance readout. Drop inside a position:relative container and set x/y for world coordinates."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Static markers with labels and distances">
                            <div style={{ position: 'relative', height: 220, background: 'var(--tc-surface-muted)', border: '1px solid var(--tc-border)' }}>
                                {/* @ts-ignore */}
                                <tc-waypoint-marker x="120" y="160" label="Checkpoint A" distance="42" />
                                {/* @ts-ignore */}
                                <tc-waypoint-marker x="300" y="120" label="Checkpoint B" distance="185" />
                                {/* @ts-ignore */}
                                <tc-waypoint-marker x="480" y="170" label="Base Camp" distance="1420" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Custom icons">
                            <div style={{ position: 'relative', height: 180, background: 'var(--tc-surface-muted)', border: '1px solid var(--tc-border)' }}>
                                {/* @ts-ignore */}
                                <tc-waypoint-marker x="100" y="140" label="Navigation" icon="navigation" distance="120" />
                                {/* @ts-ignore */}
                                <tc-waypoint-marker x="270" y="110" label="Flag" icon="flag" distance="310" />
                                {/* @ts-ignore */}
                                <tc-waypoint-marker x="440" y="150" label="Map Pin" icon="map-pin" distance="55" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Custom colors">
                            <div style={{ position: 'relative', height: 180, background: 'var(--tc-surface-muted)', border: '1px solid var(--tc-border)' }}>
                                {/* @ts-ignore */}
                                <tc-waypoint-marker x="120" y="140" label="Danger" distance="88" color="var(--tc-danger)" />
                                {/* @ts-ignore */}
                                <tc-waypoint-marker x="280" y="110" label="Warning" distance="310" color="var(--tc-warning)" />
                                {/* @ts-ignore */}
                                <tc-waypoint-marker x="440" y="150" label="Safe" distance="55" color="var(--tc-success)" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Label only / distance only / icon only">
                            <div style={{ position: 'relative', height: 120, background: 'var(--tc-surface-muted)', border: '1px solid var(--tc-border)' }}>
                                {/* @ts-ignore */}
                                <tc-waypoint-marker x="100" y="90" label="Label only" />
                                {/* @ts-ignore */}
                                <tc-waypoint-marker x="280" y="90" distance="750" />
                                {/* @ts-ignore */}
                                <tc-waypoint-marker x="440" y="90" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Custom size (size=28)">
                            <div style={{ position: 'relative', height: 140, background: 'var(--tc-surface-muted)', border: '1px solid var(--tc-border)' }}>
                                {/* @ts-ignore */}
                                <tc-waypoint-marker x="200" y="110" label="Large" distance="200" size="28" />
                                {/* @ts-ignore */}
                                <tc-waypoint-marker x="420" y="110" label="Default" distance="200" />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default WaypointMarkerDemo
