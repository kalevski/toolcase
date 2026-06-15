import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const AbilityCardDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="AbilityCard"
                            description="An ability portrait tile: an icon chip, rarity micro-label, ability name, optional hotkey, description, and a meta grid of cooldown / cost / range. Ported from the game-components gc-ability-card and restyled to the toolcase design system — flat slate surface, hairline borders, sharp corners, mono machine-text."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Full card — icon, hotkey, description, and meta">
                                <div className="d-flex flex-wrap gap-3">
                                    <div style={{ width: 280 }}>
                                        {/* @ts-ignore */}
                                        <tc-ability-card
                                            ability-name="Arc Lightning"
                                            icon="Zap"
                                            rarity="rare"
                                            keybind="Q"
                                            description="Chains a bolt between nearby enemies, dealing damage that falls off with each jump."
                                            cooldown="8s"
                                            cost="40 mana"
                                            range="600"
                                        />
                                    </div>
                                    <div style={{ width: 280 }}>
                                        {/* @ts-ignore */}
                                        <tc-ability-card
                                            ability-name="Aegis Ward"
                                            icon="Shield"
                                            rarity="epic"
                                            keybind="E"
                                            description="Raises a barrier that absorbs incoming damage for a short duration."
                                            cooldown="14s"
                                            cost="60 mana"
                                        />
                                    </div>
                                </div>
                            </SectionCard>

                            <SectionCard title="Rarity ramp — common → legendary">
                                <div className="d-flex flex-wrap gap-3">
                                    {/* @ts-ignore */}
                                    <tc-ability-card
                                        style={{ width: 220 }}
                                        ability-name="Quick Step"
                                        icon="Footprints"
                                        rarity="common"
                                        keybind="1"
                                        cooldown="4s"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-ability-card
                                        style={{ width: 220 }}
                                        ability-name="Venom Dart"
                                        icon="Crosshair"
                                        rarity="uncommon"
                                        keybind="2"
                                        cooldown="6s"
                                        range="450"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-ability-card
                                        style={{ width: 220 }}
                                        ability-name="Frost Nova"
                                        icon="Snowflake"
                                        rarity="rare"
                                        keybind="3"
                                        cooldown="10s"
                                        cost="50 mana"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-ability-card
                                        style={{ width: 220 }}
                                        ability-name="Soul Rend"
                                        icon="Flame"
                                        rarity="epic"
                                        keybind="4"
                                        cooldown="18s"
                                        cost="80 mana"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-ability-card
                                        style={{ width: 220 }}
                                        ability-name="Meteor"
                                        icon="Sparkles"
                                        rarity="legendary"
                                        keybind="R"
                                        cooldown="120s"
                                        cost="200 mana"
                                        range="1000"
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Minimal — name only">
                                <div style={{ width: 240 }}>
                                    {/* @ts-ignore */}
                                    <tc-ability-card ability-name="Basic Attack" rarity="common" />
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AbilityCardDemo
