import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const SLOTS = [
    { hotkey: '1', item: { id: 'sword', name: 'Iron Sword', icon: '⚔', rarity: 'common' } },
    { hotkey: '2', item: { id: 'shield', name: 'Buckler', icon: '🛡', rarity: 'uncommon' } },
    { hotkey: '3', item: { id: 'potion', name: 'HP Potion', icon: '✦', rarity: 'common', qty: 5 } },
    { hotkey: '4', item: { id: 'fire', name: 'Fireball', icon: '🔥', rarity: 'rare', cooldown: 3, cooldownMax: 8 } },
    { hotkey: '5', item: { id: 'frost', name: 'Frost Bolt', icon: '❄', rarity: 'epic' } },
    { hotkey: '6', item: null },
    { hotkey: '7', item: { id: 'tome', name: 'Tome', icon: '◈', rarity: 'legendary', equipped: true } },
    { hotkey: '8', item: null },
]

const HotbarDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [last, setLast] = useState('—')
    const [selectedId, setSelectedId] = useState('shield')

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.slots = SLOTS
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
                        title="Hotbar"
                        description="Inline strip of gc-item-slot. Selected slot highlighted via selected-id."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`Selected: ${selectedId} — ${last}`}>
                            {/* @ts-ignore */}
                            <gc-hotbar ref={ref} slot-size="56" selected-id={selectedId} />
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default HotbarDemo
