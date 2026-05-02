import React from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const ObjectiveMarkerDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="ObjectiveMarker"
                    description="Pulsing diamond marker with label and distance, anchored to absolute world-space coordinates."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    {/* @ts-ignore */}
                    <gc-panel bordered>
                        {/* @ts-ignore */}
                        <gc-panel-header header-title="Static + pulsing" />
                        <div style={{ position: 'relative', height: 220, background: 'rgba(0,0,0,0.4)', border: '1px solid var(--fg-gold-deep)' }}>
                            {/* @ts-ignore */}
                            <gc-objective-marker x="120" y="180" label="Capture" distance="42" pulse />
                            {/* @ts-ignore */}
                            <gc-objective-marker x="280" y="160" label="Defend" distance="180" color="#5a8cf0" />
                            {/* @ts-ignore */}
                            <gc-objective-marker x="440" y="200" label="Boss" distance="1240" color="#d44a3a" pulse />
                        </div>
                    {/* @ts-ignore */}
                    </gc-panel>
                </div>
            </div>
        </div>
    </div>
)

export default ObjectiveMarkerDemo
