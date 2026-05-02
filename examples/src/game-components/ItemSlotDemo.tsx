import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const ItemSlotDemo: React.FC = () => {
    const refs = {
        sword: useRef<HTMLElement>(null),
        shield: useRef<HTMLElement>(null),
        potion: useRef<HTMLElement>(null),
        rare: useRef<HTMLElement>(null),
        epic: useRef<HTMLElement>(null),
        legendary: useRef<HTMLElement>(null),
        mythic: useRef<HTMLElement>(null),
        cooldown: useRef<HTMLElement>(null),
        equipped: useRef<HTMLElement>(null),
        locked: useRef<HTMLElement>(null),
        empty: useRef<HTMLElement>(null),
    }
    const [last, setLast] = useState('—')

    useEffect(() => {
        ;(refs.sword.current as any).item = { id: 'sword', name: 'Iron Sword', icon: '⚔', rarity: 'common' }
        ;(refs.shield.current as any).item = { id: 'shield', name: 'Oak Buckler', icon: '🛡', rarity: 'uncommon', qty: 1 }
        ;(refs.potion.current as any).item = { id: 'potion', name: 'Mana Potion', icon: '✦', rarity: 'common', qty: 12 }
        ;(refs.rare.current as any).item = { id: 'r', name: 'Rare', icon: '◈', rarity: 'rare' }
        ;(refs.epic.current as any).item = { id: 'e', name: 'Epic', icon: '❖', rarity: 'epic' }
        ;(refs.legendary.current as any).item = { id: 'l', name: 'Legendary', icon: '☩', rarity: 'legendary' }
        ;(refs.mythic.current as any).item = { id: 'm', name: 'Mythic', icon: '☠', rarity: 'mythic' }
        ;(refs.cooldown.current as any).item = { id: 'cd', name: 'Fireball', icon: '🔥', rarity: 'rare', cooldown: 4, cooldownMax: 8 }
        ;(refs.equipped.current as any).item = { id: 'eq', name: 'Cloak', icon: '⚜', rarity: 'epic', equipped: true }
        ;(refs.locked.current as any).item = { id: 'lk', name: 'Vault', icon: '⚷', rarity: 'legendary', locked: true }
        ;(refs.empty.current as any).item = null
    }, [])

    useEffect(() => {
        const handler = (event: any) => setLast(`click ${event.detail.item?.id ?? '∅'}`)
        Object.values(refs).forEach(r => r.current?.addEventListener('click', handler))
        return () => Object.values(refs).forEach(r => r.current?.removeEventListener('click', handler))
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Item Slot"
                        description="Square framed slot — rarity ring, hotkey, qty, equipped marker, cooldown overlay, locked state."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`Last click — ${last}`}>
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <gc-item-slot ref={refs.sword} hotkey="1" />
                                {/* @ts-ignore */}
                                <gc-item-slot ref={refs.shield} hotkey="2" />
                                {/* @ts-ignore */}
                                <gc-item-slot ref={refs.potion} hotkey="3" />
                            </div>
                        </SectionCard>
                        <SectionCard title="Rarity ladder">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <gc-item-slot ref={refs.rare} />
                                {/* @ts-ignore */}
                                <gc-item-slot ref={refs.epic} />
                                {/* @ts-ignore */}
                                <gc-item-slot ref={refs.legendary} />
                                {/* @ts-ignore */}
                                <gc-item-slot ref={refs.mythic} />
                            </div>
                        </SectionCard>
                        <SectionCard title="Cooldown / equipped / locked / empty / selected">
                            <div className="d-flex flex-wrap gap-2 align-items-center">
                                {/* @ts-ignore */}
                                <gc-item-slot ref={refs.cooldown} />
                                {/* @ts-ignore */}
                                <gc-item-slot ref={refs.equipped} />
                                {/* @ts-ignore */}
                                <gc-item-slot ref={refs.locked} />
                                {/* @ts-ignore */}
                                <gc-item-slot ref={refs.empty} />
                                {/* @ts-ignore */}
                                <gc-item-slot selected size="72" />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ItemSlotDemo
