import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const WaypointMarkerDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="WaypointMarker"
                    description="Static waypoint marker with custom icon, label, and distance readout."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Variants">
                        <div style={{ position: 'relative', height: 220, background: 'rgba(0,0,0,0.4)', border: '1px solid var(--fg-gold-deep)' }}>
                            {/* @ts-ignore */}
                            <gc-waypoint-marker x="100" y="160" label="Camp" distance="64" icon="🏕" />
                            {/* @ts-ignore */}
                            <gc-waypoint-marker x="260" y="180" label="Vendor" distance="320" icon="⚖" color="#f0d27a" />
                            {/* @ts-ignore */}
                            <gc-waypoint-marker x="420" y="150" label="Quest" distance="2400" icon="❖" />
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default WaypointMarkerDemo
