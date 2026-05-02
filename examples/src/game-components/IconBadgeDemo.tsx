import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const IconBadgeDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="IconBadge"
                    description="Square gilded badge holding a single glyph. Props: glyph, size, color, bg."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Default">
                        {/* @ts-ignore */}
                        <gc-icon-badge glyph="✦" />
                    </SectionCard>

                    <SectionCard title="Sizes">
                        <div className="d-flex align-items-center gap-3">
                            {/* @ts-ignore */}
                            <gc-icon-badge glyph="⚔" size="20" />
                            {/* @ts-ignore */}
                            <gc-icon-badge glyph="⚔" size="28" />
                            {/* @ts-ignore */}
                            <gc-icon-badge glyph="⚔" size="40" />
                            {/* @ts-ignore */}
                            <gc-icon-badge glyph="⚔" size="56" />
                        </div>
                    </SectionCard>

                    <SectionCard title="Custom color">
                        <div className="d-flex gap-3">
                            {/* @ts-ignore */}
                            <gc-icon-badge glyph="🔥" color="var(--fg-fire)" />
                            {/* @ts-ignore */}
                            <gc-icon-badge glyph="❄" color="var(--fg-frost)" />
                            {/* @ts-ignore */}
                            <gc-icon-badge glyph="☠" color="var(--fg-poison)" />
                            {/* @ts-ignore */}
                            <gc-icon-badge glyph="⚡" color="var(--fg-arcane-bright)" />
                        </div>
                    </SectionCard>

                    <SectionCard title="Custom bg + color">
                        {/* @ts-ignore */}
                        <gc-icon-badge
                            glyph="◆"
                            size="40"
                            color="var(--fg-gold-bright)"
                            bg="linear-gradient(180deg, #5a3a18, #2a1a0a)"
                        />
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default IconBadgeDemo
