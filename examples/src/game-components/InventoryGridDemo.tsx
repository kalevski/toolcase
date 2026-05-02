import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const
const ICONS = ['⚔', '🛡', '✦', '◈', '❖', '☩', '🔥', '❄', '⚜', '⚷']

const ITEMS = Array.from({ length: 36 }, (_, i) => {
    if (i % 7 === 6) return null
    return {
        id: `item-${i}`,
        name: `Item ${i + 1}`,
        icon: ICONS[i % ICONS.length],
        rarity: RARITIES[i % RARITIES.length],
        qty: i % 3 === 0 ? (i % 11) + 1 : undefined
    }
})

const InventoryGridDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [last, setLast] = useState('—')
    const [selectedId, setSelectedId] = useState('item-0')

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.items = ITEMS
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (event: any) => {
            setLast(`select ${event.detail.item?.id ?? '∅'} @${event.detail.index}`)
            if (event.detail.item?.id) setSelectedId(event.detail.item.id)
        }
        el.addEventListener('select', handler)
        return () => el.removeEventListener('select', handler)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Inventory Grid"
                        description="Uniform grid of gc-item-slot — empty cells, rarity ladder, qty stacks, selectable."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Selected: ${selectedId} — ${last}`} />
                            {/* @ts-ignore */}
                            <gc-inventory-grid ref={ref} columns="6" slot-size="56" selected-id={selectedId} />
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default InventoryGridDemo
