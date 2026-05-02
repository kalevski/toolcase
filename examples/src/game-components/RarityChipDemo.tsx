import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const RarityChipDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="RarityChip"
                    description="Mono uppercase chip colored by item rarity. Prop: rarity (common|uncommon|rare|epic|legendary|mythic)."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="All rarities">
                        <div className="d-flex flex-wrap gap-2">
                            {/* @ts-ignore */}
                            <gc-rarity-chip rarity="common" />
                            {/* @ts-ignore */}
                            <gc-rarity-chip rarity="uncommon" />
                            {/* @ts-ignore */}
                            <gc-rarity-chip rarity="rare" />
                            {/* @ts-ignore */}
                            <gc-rarity-chip rarity="epic" />
                            {/* @ts-ignore */}
                            <gc-rarity-chip rarity="legendary" />
                            {/* @ts-ignore */}
                            <gc-rarity-chip rarity="mythic" />
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default RarityChipDemo
