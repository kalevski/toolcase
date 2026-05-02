import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const PingDisplayDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="PingDisplay"
                    description="Network latency readout. Color tiers: <60 success, <200 warning, else danger. Null shows em-dash."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Tiers">
                        <div className="d-flex flex-column gap-2">
                            {/* @ts-ignore */}
                            <gc-ping-display ping="22" />
                            {/* @ts-ignore */}
                            <gc-ping-display ping="59" />
                            {/* @ts-ignore */}
                            <gc-ping-display ping="120" />
                            {/* @ts-ignore */}
                            <gc-ping-display ping="199" />
                            {/* @ts-ignore */}
                            <gc-ping-display ping="350" />
                            {/* @ts-ignore */}
                            <gc-ping-display ping="999" />
                        </div>
                    </SectionCard>

                    <SectionCard title="Unknown (no ping attribute)">
                        {/* @ts-ignore */}
                        <gc-ping-display />
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default PingDisplayDemo
