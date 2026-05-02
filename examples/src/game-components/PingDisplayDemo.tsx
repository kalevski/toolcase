import React from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
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
                    {/* @ts-ignore */}
                    <gc-panel bordered>
                        {/* @ts-ignore */}
                        <gc-panel-header header-title="Tiers" />
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
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Unknown (no ping attribute)" />
                        {/* @ts-ignore */}
                        <gc-ping-display />
                    {/* @ts-ignore */}
                    </gc-panel>
                </div>
            </div>
        </div>
    </div>
)

export default PingDisplayDemo
