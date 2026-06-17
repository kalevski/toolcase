import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ManaBarDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ManaBar"
                            description="Value/max resource bar for mana (MP) — a cyan-accent fill over a flat slate track. Supports an optional label row with a mono value/max readout, a ghost band for recent loss, inline mono text, and evenly-spaced segment dividers."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Bare bar (value / max)">
                                {/* @ts-ignore */}
                                <tc-mana-bar value="60" max="100" />
                            </SectionCard>

                            <SectionCard title="With label and readout">
                                {/* @ts-ignore */}
                                <tc-mana-bar label="Mana" value="480" max="800" />
                            </SectionCard>

                            <SectionCard title="Inline text (show-text, no label)">
                                {/* @ts-ignore */}
                                <tc-mana-bar value="30" max="100" show-text="" />
                            </SectionCard>

                            <SectionCard title="Ghost band (recent drain)">
                                {/* @ts-ignore */}
                                <tc-mana-bar label="MP" value="25" max="100" ghost="55" />
                            </SectionCard>

                            <SectionCard title="Segmented (5 slots)">
                                {/* @ts-ignore */}
                                <tc-mana-bar label="Charges" value="3" max="5" segments="5" />
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ManaBarDemo
