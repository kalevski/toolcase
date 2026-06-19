import React, { useEffect, useRef, useState } from 'react'

const HUMANOID_SLOTS = [
    { id: 'head', label: 'Head', x: 50, y: 8, item: { id: 'helm', name: 'Iron Helm', icon: 'H' } },
    { id: 'cape', label: 'Cape', x: 82, y: 18, item: null },
    {
        id: 'amulet',
        label: 'Amulet',
        x: 18,
        y: 18,
        item: { id: 'amulet', name: 'Amulet', icon: 'A' },
    },
    {
        id: 'chest',
        label: 'Chest',
        x: 50,
        y: 34,
        item: { id: 'plate', name: 'Plate Armor', icon: 'C' },
    },
    {
        id: 'main-hand',
        label: 'Main',
        x: 14,
        y: 46,
        item: { id: 'sword', name: 'Longsword', icon: 'S' },
    },
    {
        id: 'off-hand',
        label: 'Off',
        x: 86,
        y: 46,
        item: { id: 'shield', name: 'Shield', icon: 'D' },
    },
    {
        id: 'gloves',
        label: 'Gloves',
        x: 18,
        y: 64,
        item: { id: 'gloves', name: 'Gauntlets', icon: 'G' },
    },
    { id: 'belt', label: 'Belt', x: 50, y: 60, item: null },
    {
        id: 'ring',
        label: 'Ring',
        x: 82,
        y: 64,
        item: { id: 'ring', name: 'Signet Ring', icon: 'R' },
    },
    {
        id: 'legs',
        label: 'Legs',
        x: 50,
        y: 78,
        item: { id: 'greaves', name: 'Greaves', icon: 'L' },
    },
    {
        id: 'feet',
        label: 'Feet',
        x: 50,
        y: 94,
        item: { id: 'boots', name: 'Boots', icon: 'B', qty: 2 },
    },
]

const COMPACT_SLOTS = [
    {
        id: 'weapon',
        label: 'Weapon',
        x: 22,
        y: 28,
        item: { id: 'blaster', name: 'Blaster', icon: 'W' },
    },
    { id: 'armor', label: 'Armor', x: 50, y: 50, item: { id: 'vest', name: 'Vest', icon: 'V' } },
    { id: 'mod', label: 'Mod', x: 78, y: 28, item: null },
    {
        id: 'boost',
        label: 'Boost',
        x: 50,
        y: 82,
        item: { id: 'boost', name: 'Jetpack', icon: 'J' },
    },
]

const EquipmentDollDemo: React.FC = () => {
    const mainRef = useRef<any>(null)
    const compactRef = useRef<any>(null)
    const customRef = useRef<any>(null)
    const [selected, setSelected] = useState<string>('chest')

    useEffect(() => {
        const el = mainRef.current
        if (!el) return
        el.slots = HUMANOID_SLOTS
        const onSelect = (e: CustomEvent<{ id: string }>) => setSelected(e.detail.id)
        el.addEventListener('tc-select', onSelect as EventListener)
        return () => el.removeEventListener('tc-select', onSelect as EventListener)
    }, [])

    useEffect(() => {
        if (compactRef.current) compactRef.current.slots = COMPACT_SLOTS
    }, [])

    useEffect(() => {
        if (customRef.current) customRef.current.slots = HUMANOID_SLOTS
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="EquipmentDoll"
                            description="A paper-doll of equipment slots arranged around a neutral character figure. Each slot is a sharp hairline tile positioned by x/y percentage; selecting one fires tc-select. Set slots via the JS slots property. Re-skinned from the game-components gc-equipment-doll to the toolcase design system — no gilded frame, no glow."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Full humanoid loadout">
                                {/* @ts-ignore */}
                                <tc-equipment-doll
                                    ref={mainRef}
                                    selected-id={selected}
                                    width="280"
                                    height="400"
                                />
                                <p className="mt-3 mb-0 text-secondary">
                                    Selected slot: <code>{selected || '—'}</code>
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Compact loadout (4 slots)">
                                {/* @ts-ignore */}
                                <tc-equipment-doll
                                    ref={compactRef}
                                    width="220"
                                    height="260"
                                    slot-size="48"
                                />
                            </tc-section-card>

                            <tc-section-card title="Custom text silhouette">
                                {/* @ts-ignore */}
                                <tc-equipment-doll
                                    ref={customRef}
                                    silhouette="PC"
                                    width="280"
                                    height="360"
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default EquipmentDollDemo
