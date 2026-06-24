import React from 'react'

const ResourceBarDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ResourceBar"
                            description="Value/max resource bar for a game HUD — an ink fill over a flat slate track, an optional label row with a mono value/max readout, an optional ghost band for recent loss, and optional even segment dividers. The variant attribute selects the fill color; tc-health-bar / tc-mana-bar / tc-stamina-bar are presets."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Variants (health / mana / stamina)">
                                <div className="d-flex flex-column gap-3">
                                    {/* @ts-ignore */}
                                    <tc-resource-bar
                                        variant="health"
                                        label="Health"
                                        value="72"
                                        max="100"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-resource-bar
                                        variant="mana"
                                        label="Mana"
                                        value="60"
                                        max="100"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-resource-bar
                                        variant="stamina"
                                        label="Stamina"
                                        value="45"
                                        max="100"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Preset alias tags">
                                <div className="d-flex flex-column gap-3">
                                    {/* @ts-ignore */}
                                    <tc-health-bar label="HP" value="640" max="1000" />
                                    {/* @ts-ignore */}
                                    <tc-mana-bar label="MP" value="480" max="800" />
                                    {/* @ts-ignore */}
                                    <tc-stamina-bar
                                        label="SP"
                                        value="3"
                                        max="5"
                                        segments="5"
                                        ghost="4"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Bare bar (value / max)">
                                {/* @ts-ignore */}
                                <tc-resource-bar value="72" max="100" />
                            </tc-section-card>

                            <tc-section-card title="Inline text (show-text, no label)">
                                {/* @ts-ignore */}
                                <tc-resource-bar value="45" max="100" show-text="" />
                            </tc-section-card>

                            <tc-section-card title="Ghost band (recent damage)">
                                {/* @ts-ignore */}
                                <tc-resource-bar
                                    variant="health"
                                    label="Health"
                                    value="40"
                                    max="100"
                                    ghost="70"
                                />
                            </tc-section-card>

                            <tc-section-card title="Segmented (4 slots)">
                                {/* @ts-ignore */}
                                <tc-resource-bar label="Shield" value="3" max="4" segments="4" />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ResourceBarDemo
