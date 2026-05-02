import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const AbilityCardDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="Ability Card"
                    description="Rarity-tinted card showing ability icon, name, description, cooldown/cost/range, keybind."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Common">
                        {/* @ts-ignore */}
                        <gc-ability-card
                            ability-name="Slash"
                            icon="⚔"
                            description="Strike with your weapon for moderate physical damage."
                            cooldown="1.5s"
                            cost="—"
                            range="Melee"
                            keybind="1"
                            rarity="common"
                        />
                    </SectionCard>
                    <SectionCard title="Rare">
                        {/* @ts-ignore */}
                        <gc-ability-card
                            ability-name="Fireball"
                            icon="🔥"
                            description="Hurl a roaring fireball that detonates on impact."
                            cooldown="8s"
                            cost="40 MP"
                            range="32m"
                            keybind="Q"
                            rarity="rare"
                        />
                    </SectionCard>
                    <SectionCard title="Epic">
                        {/* @ts-ignore */}
                        <gc-ability-card
                            ability-name="Frost Nova"
                            icon="❄"
                            description="Freeze every foe within reach for three seconds."
                            cooldown="20s"
                            cost="80 MP"
                            range="6m"
                            keybind="E"
                            rarity="epic"
                        />
                    </SectionCard>
                    <SectionCard title="Legendary">
                        {/* @ts-ignore */}
                        <gc-ability-card
                            ability-name="Wrath of the Sun"
                            icon="☩"
                            description="Channel sunlight into a pillar of judgement."
                            cooldown="120s"
                            cost="150 MP"
                            range="Self"
                            keybind="R"
                            rarity="legendary"
                        />
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default AbilityCardDemo
