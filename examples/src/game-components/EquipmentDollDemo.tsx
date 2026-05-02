import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const SLOTS = [
    { id: 'head', label: 'Head', x: 50, y: 12, item: { id: 'helm', name: 'Helm', icon: '☩', rarity: 'rare' } },
    { id: 'chest', label: 'Chest', x: 50, y: 35, item: { id: 'plate', name: 'Plate', icon: '⚜', rarity: 'epic', equipped: true } },
    { id: 'legs', label: 'Legs', x: 50, y: 60, item: { id: 'greaves', name: 'Greaves', icon: '⚒', rarity: 'uncommon' } },
    { id: 'feet', label: 'Feet', x: 50, y: 85, item: null },
    { id: 'main', label: 'Main', x: 18, y: 45, item: { id: 'sword', name: 'Sword', icon: '⚔', rarity: 'legendary' } },
    { id: 'offhand', label: 'Off', x: 82, y: 45, item: { id: 'shield', name: 'Shield', icon: '🛡', rarity: 'rare' } },
    { id: 'ring1', label: 'Ring', x: 18, y: 70, item: { id: 'r1', name: 'Ring', icon: '◈', rarity: 'mythic' } },
    { id: 'ring2', label: 'Ring', x: 82, y: 70, item: null },
]

const EquipmentDollDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [selectedId, setSelectedId] = useState('chest')

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.slots = SLOTS
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (event: any) => setSelectedId(event.detail.id)
        el.addEventListener('select', handler)
        return () => el.removeEventListener('select', handler)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Equipment Doll"
                        description="Character paper-doll with absolute-positioned gc-item-slot anchors at percent coords."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Selected: ${selectedId}`} />
                            {/* @ts-ignore */}
                            <gc-equipment-doll ref={ref} width="280" height="400" slot-size="56" selected-id={selectedId} silhouette="🛡" />
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default EquipmentDollDemo
