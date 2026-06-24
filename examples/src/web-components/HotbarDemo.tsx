import React, { useEffect, useRef, useState } from 'react'

const ACTION_SLOTS = [
    { hotkey: '1', item: { id: 'sword', name: 'Longsword', icon: 'S' } },
    { hotkey: '2', item: { id: 'bow', name: 'Short Bow', icon: 'B' } },
    { hotkey: '3', item: { id: 'potion', name: 'Health Potion', icon: 'P', qty: 5 } },
    { hotkey: '4', item: { id: 'bomb', name: 'Bomb', icon: 'O', qty: 12 } },
    { hotkey: '5', item: null },
    { hotkey: '6', item: { id: 'shield', name: 'Tower Shield', icon: 'D' } },
]

const ABILITY_SLOTS = [
    { hotkey: 'Q', item: { id: 'fireball', name: 'Fireball', icon: 'F' } },
    { hotkey: 'W', item: { id: 'frost', name: 'Frost Nova', icon: 'N' } },
    { hotkey: 'E', item: { id: 'dash', name: 'Dash', icon: 'D' } },
    { hotkey: 'R', item: { id: 'ult', name: 'Ultimate', icon: 'U' } },
]

const HotbarDemo: React.FC = () => {
    const actionRef = useRef<any>(null)
    const abilityRef = useRef<any>(null)
    const compactRef = useRef<any>(null)
    const [selected, setSelected] = useState<string>('sword')

    useEffect(() => {
        const el = actionRef.current
        if (!el) return
        el.slots = ACTION_SLOTS
        const onSelect = (e: CustomEvent<{ item: { id: string } | null; index: number }>) =>
            setSelected(e.detail.item?.id ?? '')
        el.addEventListener('tc-select', onSelect as EventListener)
        return () => el.removeEventListener('tc-select', onSelect as EventListener)
    }, [])

    useEffect(() => {
        if (abilityRef.current) abilityRef.current.slots = ABILITY_SLOTS
    }, [])

    useEffect(() => {
        if (compactRef.current) compactRef.current.slots = ACTION_SLOTS
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Hotbar"
                            description="A horizontal action bar of item/ability slots with hotkeys and a selected index. Each slot composes a tc-item-slot for the item visuals; the bar owns the sharp hairline frame, the row layout, the hotkey badge and the selection ring. Selecting a slot fires tc-select and reflects the chosen item id via selected-id. Set slots via the JS slots property. Built in the toolcase idiom — no gilded frame, no glow."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Item hotbar (number keys)">
                                {/* @ts-ignore */}
                                <tc-hotbar
                                    ref={actionRef}
                                    selected-id={selected}
                                    aria-label="Item hotbar"
                                />
                                <p className="mt-3 mb-0 text-secondary">
                                    Selected item: <code>{selected || '—'}</code>
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Ability bar (letter keys)">
                                {/* @ts-ignore */}
                                <tc-hotbar ref={abilityRef} aria-label="Ability bar" />
                            </tc-section-card>

                            <tc-section-card title="Compact slots (slot-size 44)">
                                {/* @ts-ignore */}
                                <tc-hotbar
                                    ref={compactRef}
                                    slot-size="44"
                                    aria-label="Compact hotbar"
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default HotbarDemo
