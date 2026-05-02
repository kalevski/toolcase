import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const RECIPES = [
    {
        id: 'sword',
        name: 'Iron Sword',
        icon: '⚔',
        inputs: [
            { item: { id: 'iron', name: 'Iron Ingot', icon: '◆' }, qty: 3, available: 5 },
            { item: { id: 'leather', name: 'Leather Strip', icon: '◇' }, qty: 1, available: 1 }
        ],
        output: { item: { id: 'sword', name: 'Iron Sword', icon: '⚔', rarity: 'uncommon' }, qty: 1 }
    },
    {
        id: 'potion',
        name: 'Healing Potion',
        icon: '⚕',
        inputs: [
            { item: { id: 'herb', name: 'Sunpetal', icon: '✦' }, qty: 2, available: 1 },
            { item: { id: 'flask', name: 'Glass Flask', icon: '◇' }, qty: 1, available: 3 }
        ],
        output: { item: { id: 'potion', name: 'Healing Potion', icon: '⚕' }, qty: 1 }
    }
]

const CraftingPanelDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [last, setLast] = useState('—')

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.recipes = RECIPES
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const onSelect = (e: any) => setLast(`select ${e.detail.id}`)
        const onCraft = (e: any) => setLast(`craft ${e.detail.id}`)
        el.addEventListener('select', onSelect)
        el.addEventListener('craft', onCraft)
        return () => {
            el.removeEventListener('select', onSelect)
            el.removeEventListener('craft', onCraft)
        }
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="CraftingPanel"
                        description="Recipe list with selected detail showing inputs (insufficient highlighted) and craft button."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`Last — ${last}`}>
                            <div style={{ maxWidth: 720 }}>
                                {/* @ts-ignore */}
                                <gc-crafting-panel ref={ref} selected-id="sword" />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CraftingPanelDemo
