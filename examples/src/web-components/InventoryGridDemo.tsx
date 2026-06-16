import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const BACKPACK = [
    { id: 'sword', name: 'Longsword', icon: 'S' },
    { id: 'shield', name: 'Tower Shield', icon: 'D' },
    { id: 'potion', name: 'Health Potion', icon: 'P', qty: 5 },
    { id: 'bomb', name: 'Bomb', icon: 'O', qty: 12 },
    null,
    { id: 'bow', name: 'Short Bow', icon: 'B' },
    { id: 'arrow', name: 'Arrows', icon: 'A', qty: 240 },
    null,
    { id: 'gem', name: 'Ruby', icon: 'R', qty: 3 },
    null,
    null,
    { id: 'key', name: 'Brass Key', icon: 'K' },
]

const STASH = [
    { id: 'helm', name: 'Iron Helm', icon: 'H' },
    { id: 'ring', name: 'Signet Ring', icon: 'G' },
    null,
    { id: 'scroll', name: 'Scroll', icon: 'L', qty: 8 },
    { id: 'coin', name: 'Gold', icon: 'C', qty: 1280 },
    null,
]

const InventoryGridDemo: React.FC = () => {
    const backpackRef = useRef<any>(null)
    const stashRef = useRef<any>(null)
    const [selected, setSelected] = useState<string>('potion')

    useEffect(() => {
        const el = backpackRef.current
        if (!el) return
        el.items = BACKPACK
        const onSelect = (e: CustomEvent<{ item: { id: string } | null, index: number }>) =>
            setSelected(e.detail.item?.id ?? '')
        el.addEventListener('tc-select', onSelect as EventListener)
        return () => el.removeEventListener('tc-select', onSelect as EventListener)
    }, [])

    useEffect(() => {
        if (stashRef.current) stashRef.current.items = STASH
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Inventory Grid"
                            description="A grid of inventory item slots with a configurable column count and a selected item id. Each cell composes a tc-item-slot for the item visuals; the grid owns the sharp hairline frame, the 1px-gap grid layout and the selection ring. Selecting a cell fires tc-select and reflects the chosen item id via selected-id. Set cells via the JS items property (entries may be null for empty sockets). Re-skinned from the game-components gc-inventory-grid — no gilded frame, no glow, no dark fills."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Backpack (6 columns)">
                                {/* @ts-ignore */}
                                <tc-inventory-grid ref={backpackRef} columns="6" selected-id={selected} aria-label="Backpack" />
                                <p className="mt-3 mb-0 text-secondary">
                                    Selected item: <code>{selected || '—'}</code>
                                </p>
                            </SectionCard>

                            <SectionCard title="Stash (3 columns, compact slot-size 44)">
                                {/* @ts-ignore */}
                                <tc-inventory-grid ref={stashRef} columns="3" slot-size="44" aria-label="Stash" />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default InventoryGridDemo
