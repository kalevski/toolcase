import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const StaminaBarDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="StaminaBar"
                            description="Value/max resource bar for stamina (SP) — a green success fill over a flat slate track. Supports an optional label row with a mono value/max readout, a ghost band for recent drain, inline mono text inside the track, and evenly-spaced segment dividers."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Bare bar (value / max)">
                                {/* @ts-ignore */}
                                <tc-stamina-bar value="72" max="100" />
                            </SectionCard>

                            <SectionCard title="With label and readout">
                                {/* @ts-ignore */}
                                <tc-stamina-bar label="Stamina" value="640" max="1000" />
                            </SectionCard>

                            <SectionCard title="Inline text (show-text, no label)">
                                {/* @ts-ignore */}
                                <tc-stamina-bar value="45" max="100" show-text="" />
                            </SectionCard>

                            <SectionCard title="Ghost band (recent drain)">
                                {/* @ts-ignore */}
                                <tc-stamina-bar label="Stamina" value="40" max="100" ghost="70" />
                            </SectionCard>

                            <SectionCard title="Segmented (5 slots)">
                                {/* @ts-ignore */}
                                <tc-stamina-bar label="Endurance" value="3" max="5" segments="5" />
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default StaminaBarDemo
