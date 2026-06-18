import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ResourceBarDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ResourceBar"
                            description="Value/max resource bar for a game HUD — an ink fill over a flat slate track, an optional label row with a mono value/max readout, an optional ghost band for recent loss, and optional even segment dividers. The variant attribute selects the fill color; tc-health-bar / tc-mana-bar / tc-stamina-bar are presets."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Variants (health / mana / stamina)">
                                <div className="d-flex flex-column gap-3">
                                    {/* @ts-ignore */}
                                    <tc-resource-bar variant="health" label="Health" value="72" max="100" />
                                    {/* @ts-ignore */}
                                    <tc-resource-bar variant="mana" label="Mana" value="60" max="100" />
                                    {/* @ts-ignore */}
                                    <tc-resource-bar variant="stamina" label="Stamina" value="45" max="100" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Preset alias tags">
                                <div className="d-flex flex-column gap-3">
                                    {/* @ts-ignore */}
                                    <tc-health-bar label="HP" value="640" max="1000" />
                                    {/* @ts-ignore */}
                                    <tc-mana-bar label="MP" value="480" max="800" />
                                    {/* @ts-ignore */}
                                    <tc-stamina-bar label="SP" value="3" max="5" segments="5" ghost="4" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Bare bar (value / max)">
                                {/* @ts-ignore */}
                                <tc-resource-bar value="72" max="100" />
                            </SectionCard>

                            <SectionCard title="Inline text (show-text, no label)">
                                {/* @ts-ignore */}
                                <tc-resource-bar value="45" max="100" show-text="" />
                            </SectionCard>

                            <SectionCard title="Ghost band (recent damage)">
                                {/* @ts-ignore */}
                                <tc-resource-bar variant="health" label="Health" value="40" max="100" ghost="70" />
                            </SectionCard>

                            <SectionCard title="Segmented (4 slots)">
                                {/* @ts-ignore */}
                                <tc-resource-bar label="Shield" value="3" max="4" segments="4" />
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ResourceBarDemo
