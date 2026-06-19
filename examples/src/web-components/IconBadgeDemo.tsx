import React from 'react'

// tc-icon-badge is purely attribute-driven (no JS-property arrays, no events),
// so the demo authors the raw element directly — no ref bookkeeping needed.
const IconBadgeDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="IconBadge"
                            description="A single icon badge: a square slate chip with a centred lucide glyph. Ported from the game-components gc-icon-badge and restyled to the toolcase design system — flat surface, hairline border, sharp corners. The tile fill (bg) and glyph color (color) are caller-supplied; the chip and glyph size scale off the size attribute."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default (slate chip)">
                                <div className="d-flex flex-wrap align-items-center gap-3">
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="Star" />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="Bell" />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="Heart" />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="Bookmark" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Sizes (size attribute)">
                                <div className="d-flex flex-wrap align-items-center gap-3">
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="Settings" size="28" />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="Settings" size="40" />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="Settings" size="56" />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="Settings" size="72" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom glyph color (color attribute)">
                                <div className="d-flex flex-wrap align-items-center gap-3">
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="Check" color="var(--tc-success)" />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge
                                        glyph="AlertTriangle"
                                        color="var(--tc-warning)"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="X" color="var(--tc-danger)" />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="Info" color="#a855f7" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Filled badge (bg + color attributes)">
                                <div className="d-flex flex-wrap align-items-center gap-3">
                                    {/* @ts-ignore */}
                                    <tc-icon-badge
                                        glyph="Zap"
                                        bg="var(--tc-app-accent)"
                                        color="#fff"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge
                                        glyph="Trophy"
                                        bg="var(--tc-success)"
                                        color="#fff"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge
                                        glyph="Flame"
                                        bg="var(--tc-danger)"
                                        color="#fff"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge
                                        glyph="Sparkles"
                                        bg="#0ea5e9"
                                        color="#fff"
                                        size="56"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Text fallback for unknown glyphs (single-letter / numeric badges)">
                                <div className="d-flex flex-wrap align-items-center gap-3">
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="A" />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge
                                        glyph="9"
                                        bg="var(--tc-app-accent)"
                                        color="#fff"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="+2" />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default IconBadgeDemo
