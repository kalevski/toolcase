import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const SWORD = {
    id: 'sword',
    name: 'Sunblade of Aelar',
    icon: '⚔',
    rarity: 'legendary',
    typeLabel: 'Two-Handed Sword',
    flavor: 'Forged in the breath of the dying sun, its edge remembers every dawn.',
    stats: [
        { label: 'Damage', value: 184 },
        { label: 'Crit', value: '24%' },
        { label: 'Speed', value: '1.6/s' }
    ],
    requirements: [
        { label: 'Level', value: 42, met: true },
        { label: 'Strength', value: 28, met: false }
    ]
}

const POTION = {
    id: 'potion',
    name: 'Mana Draught',
    icon: '✦',
    rarity: 'rare',
    typeLabel: 'Consumable',
    flavor: 'Tastes of cold rain on copper.',
    stats: [{ label: 'Restore', value: '320 MP' }]
}

const ItemTooltipDemo: React.FC = () => {
    const refs = {
        legendary: useRef<HTMLElement>(null),
        rare: useRef<HTMLElement>(null),
        common: useRef<HTMLElement>(null),
        empty: useRef<HTMLElement>(null),
    }

    useEffect(() => {
        ;(refs.legendary.current as any).item = SWORD
        ;(refs.rare.current as any).item = POTION
        ;(refs.common.current as any).item = {
            id: 'rag',
            name: 'Tattered Rag',
            icon: '✄',
            rarity: 'common',
            typeLabel: 'Junk',
            stats: [{ label: 'Sells for', value: '2 g' }]
        }
        ;(refs.empty.current as any).item = null
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Item Tooltip"
                        description="Rarity-tinted gilded panel — header (type, name, rarity chip), stat rows, requirements, italic flavor."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Legendary" />
                            {/* @ts-ignore */}
                            <gc-item-tooltip ref={refs.legendary} />
                        {/* @ts-ignore */}
                        </gc-panel>
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Rare" />
                            {/* @ts-ignore */}
                            <gc-item-tooltip ref={refs.rare} />
                        {/* @ts-ignore */}
                        </gc-panel>
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Common" />
                            {/* @ts-ignore */}
                            <gc-item-tooltip ref={refs.common} />
                        {/* @ts-ignore */}
                        </gc-panel>
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Empty (hidden)" />
                            {/* @ts-ignore */}
                            <gc-item-tooltip ref={refs.empty} />
                            <div className="text-muted small mt-2">Element renders display:none when item is null.</div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ItemTooltipDemo
