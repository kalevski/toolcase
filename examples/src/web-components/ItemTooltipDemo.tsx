import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const LEGENDARY = {
    id: 'dawnbreaker',
    name: 'Dawnbreaker',
    typeLabel: 'Two-Handed Greatsword',
    rarity: 'legendary',
    stats: [
        { label: 'Damage', value: 124 },
        { label: 'Attack Speed', value: 0.9 },
        { label: 'Weight', value: 14 },
        { label: 'Quality', value: 'Pristine' },
    ],
    requirements: [
        { label: 'Level', value: 40, met: true },
        { label: 'Strength', value: 28, met: false },
    ],
    flavor: 'Forged in the first light, it remembers every dawn it has seen.',
}

const COMMON = {
    id: 'wooden-club',
    name: 'Wooden Club',
    typeLabel: 'One-Handed Blunt',
    rarity: 'common',
    stats: [
        { label: 'Damage', value: 8 },
        { label: 'Attack Speed', value: 1.3 },
    ],
}

const RARE = {
    id: 'frost-charm',
    name: 'Frostbite Charm',
    typeLabel: 'Trinket',
    rarity: 'rare',
    stats: [
        { label: 'Frost Resist', value: 35 },
        { label: 'Mana', value: 60 },
    ],
    requirements: [
        { label: 'Level', value: 12, met: true },
    ],
    flavor: 'Cold to the touch, even in summer.',
}

const ItemTooltipDemo: React.FC = () => {
    const legendaryRef = useRef<any>(null)
    const commonRef = useRef<any>(null)
    const rareRef = useRef<any>(null)

    useEffect(() => {
        if (legendaryRef.current) legendaryRef.current.item = LEGENDARY
    }, [])

    useEffect(() => {
        if (commonRef.current) commonRef.current.item = COMMON
    }, [])

    useEffect(() => {
        if (rareRef.current) rareRef.current.item = RARE
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ItemTooltip"
                            description="A hover card describing an item: an optional mono type micro-label, the item name, a rarity chip, a stat list, an optional requirements block (met / unmet), and optional flavor text. Set the item via the JS `item` property. Re-skinned from the game-components gc-item-tooltip to the toolcase design system — no gilded frame, no glow, no parchment fill: a sharp hairline surface at the overlay tier, mono machine-facing figures, and status colour spent only on rarity and requirement markers."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Legendary — stats, requirements, flavor">
                                {/* @ts-ignore */}
                                <tc-item-tooltip ref={legendaryRef} />
                            </SectionCard>

                            <SectionCard title="Rare — a smaller trinket">
                                {/* @ts-ignore */}
                                <tc-item-tooltip ref={rareRef} />
                            </SectionCard>

                            <SectionCard title="Common — stats only">
                                {/* @ts-ignore */}
                                <tc-item-tooltip ref={commonRef} />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ItemTooltipDemo
