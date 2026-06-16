import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const HealthBarDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="HealthBar"
                            description="Value/max resource bar (HP, mana, stamina) — an ink fill over a flat slate track, an optional label row with a mono value/max readout, an optional ghost band for recent loss, and optional even segment dividers."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Bare bar (value / max)">
                                {/* @ts-ignore */}
                                <tc-health-bar value="72" max="100" />
                            </SectionCard>

                            <SectionCard title="With label and readout">
                                {/* @ts-ignore */}
                                <tc-health-bar label="Health" value="640" max="1000" />
                            </SectionCard>

                            <SectionCard title="Inline text (show-text, no label)">
                                {/* @ts-ignore */}
                                <tc-health-bar value="45" max="100" show-text="" />
                            </SectionCard>

                            <SectionCard title="Ghost band (recent damage)">
                                {/* @ts-ignore */}
                                <tc-health-bar label="Stamina" value="40" max="100" ghost="70" />
                            </SectionCard>

                            <SectionCard title="Segmented (4 slots)">
                                {/* @ts-ignore */}
                                <tc-health-bar label="Shield" value="3" max="4" segments="4" />
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default HealthBarDemo
