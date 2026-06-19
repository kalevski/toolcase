import React from 'react'

// tc-buff-icon is purely attribute-driven (no JS-property arrays, no events),
// so the demo authors the raw element directly — no ref bookkeeping needed.
const BuffIconDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="BuffIcon"
                            description="A single buff / debuff status icon: a square slate tile with a centred lucide glyph and an optional mono duration caption pinned to the bottom edge. Ported from the game-components gc-buff-icon and restyled to the toolcase design system — flat surface, hairline border, sharp corners, mono machine-text, and a single 2px status accent stripe for buff vs debuff. The building block composed by tc-buff-bar, usable standalone."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Buffs (success accent stripe)">
                                <div className="d-flex flex-wrap align-items-end gap-3">
                                    {/* @ts-ignore */}
                                    <tc-buff-icon kind="buff" glyph="Zap" time="12s" />
                                    {/* @ts-ignore */}
                                    <tc-buff-icon kind="buff" glyph="Shield" time="30s" />
                                    {/* @ts-ignore */}
                                    <tc-buff-icon kind="buff" glyph="Heart" time="1m" />
                                    {/* @ts-ignore */}
                                    <tc-buff-icon kind="buff" glyph="Sparkles" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Debuffs (danger accent stripe)">
                                <div className="d-flex flex-wrap align-items-end gap-3">
                                    {/* @ts-ignore */}
                                    <tc-buff-icon kind="debuff" glyph="Skull" time="6s" />
                                    {/* @ts-ignore */}
                                    <tc-buff-icon kind="debuff" glyph="Flame" time="3s" />
                                    {/* @ts-ignore */}
                                    <tc-buff-icon kind="debuff" glyph="Snowflake" time="2s" />
                                    {/* @ts-ignore */}
                                    <tc-buff-icon kind="debuff" glyph="Ghost" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Sizes (size attribute)">
                                <div className="d-flex flex-wrap align-items-end gap-3">
                                    {/* @ts-ignore */}
                                    <tc-buff-icon kind="buff" glyph="Swords" time="8s" size="28" />
                                    {/* @ts-ignore */}
                                    <tc-buff-icon kind="buff" glyph="Swords" time="8s" size="36" />
                                    {/* @ts-ignore */}
                                    <tc-buff-icon kind="buff" glyph="Swords" time="8s" size="48" />
                                    {/* @ts-ignore */}
                                    <tc-buff-icon kind="buff" glyph="Swords" time="8s" size="64" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom glyph color (color attribute)">
                                <div className="d-flex flex-wrap align-items-end gap-3">
                                    {/* @ts-ignore */}
                                    <tc-buff-icon
                                        kind="buff"
                                        glyph="Wind"
                                        time="9s"
                                        color="#0ea5e9"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-buff-icon
                                        kind="buff"
                                        glyph="Target"
                                        time="20s"
                                        color="#a855f7"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-buff-icon
                                        kind="debuff"
                                        glyph="Snail"
                                        time="4s"
                                        color="#f59e0b"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Text fallback for unknown glyphs (single-letter / numeric buffs)">
                                <div className="d-flex flex-wrap align-items-end gap-3">
                                    {/* @ts-ignore */}
                                    <tc-buff-icon kind="buff" glyph="A" time="5s" />
                                    {/* @ts-ignore */}
                                    <tc-buff-icon kind="buff" glyph="+2" />
                                    {/* @ts-ignore */}
                                    <tc-buff-icon kind="debuff" glyph="-1" time="3s" />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BuffIconDemo
