import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

// tc-icon-badge is purely attribute-driven (no JS-property arrays, no events),
// so the demo authors the raw element directly — no ref bookkeeping needed.
const IconBadgeDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="IconBadge"
                            description="A single icon badge: a square slate chip with a centred lucide glyph. Ported from the game-components gc-icon-badge and restyled to the toolcase design system — flat surface, hairline border, sharp corners. The tile fill (bg) and glyph color (color) are caller-supplied; the chip and glyph size scale off the size attribute."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default (slate chip)">
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
                            </SectionCard>

                            <SectionCard title="Sizes (size attribute)">
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
                            </SectionCard>

                            <SectionCard title="Custom glyph color (color attribute)">
                                <div className="d-flex flex-wrap align-items-center gap-3">
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="Check" color="var(--tc-success)" />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="AlertTriangle" color="var(--tc-warning)" />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="X" color="var(--tc-danger)" />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="Info" color="#a855f7" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Filled badge (bg + color attributes)">
                                <div className="d-flex flex-wrap align-items-center gap-3">
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="Zap" bg="var(--tc-app-accent)" color="#fff" />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="Trophy" bg="var(--tc-success)" color="#fff" />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="Flame" bg="var(--tc-danger)" color="#fff" />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="Sparkles" bg="#0ea5e9" color="#fff" size="56" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Text fallback for unknown glyphs (single-letter / numeric badges)">
                                <div className="d-flex flex-wrap align-items-center gap-3">
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="A" />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="9" bg="var(--tc-app-accent)" color="#fff" />
                                    {/* @ts-ignore */}
                                    <tc-icon-badge glyph="+2" />
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default IconBadgeDemo
