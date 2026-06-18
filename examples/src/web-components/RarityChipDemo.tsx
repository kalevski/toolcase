import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const RarityChipDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="RarityChip"
                        description="Mono uppercase rarity label chip: Common through Mythic. Port of game-components gc-rarity-chip, restyled to the design system with sharp corners, a 1px hairline border, and rarity-tinted text/border. Purely presentational — no events, no slots."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="All rarities">
                            <div className="d-flex flex-wrap gap-2 align-items-center">
                                {/* @ts-ignore */}
                                <tc-rarity-chip rarity="common"></tc-rarity-chip>
                                {/* @ts-ignore */}
                                <tc-rarity-chip rarity="uncommon"></tc-rarity-chip>
                                {/* @ts-ignore */}
                                <tc-rarity-chip rarity="rare"></tc-rarity-chip>
                                {/* @ts-ignore */}
                                <tc-rarity-chip rarity="epic"></tc-rarity-chip>
                                {/* @ts-ignore */}
                                <tc-rarity-chip rarity="legendary"></tc-rarity-chip>
                                {/* @ts-ignore */}
                                <tc-rarity-chip rarity="mythic"></tc-rarity-chip>
                            </div>
                        </SectionCard>

                        <SectionCard title="Default (no attribute)">
                            <div className="d-flex flex-wrap gap-2 align-items-center">
                                {/* @ts-ignore */}
                                <tc-rarity-chip></tc-rarity-chip>
                                <span className="text-muted" style={{ fontSize: '0.8125rem' }}>Defaults to common when rarity is absent or invalid.</span>
                            </div>
                        </SectionCard>

                        <SectionCard title="Inline with text">
                            <p className="mb-0" style={{ fontSize: '0.925rem', lineHeight: 1.6 }}>
                                The Sword of Eternity is a{' '}
                                {/* @ts-ignore */}
                                <tc-rarity-chip rarity="legendary"></tc-rarity-chip>
                                {' '}weapon, while the Iron Dagger is only{' '}
                                {/* @ts-ignore */}
                                <tc-rarity-chip rarity="common"></tc-rarity-chip>
                                {' '}quality.
                            </p>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default RarityChipDemo
