import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const ITEMS = [
    { item: { id: 'gold', name: 'Gold', icon: '◆' }, qty: 320 },
    { item: { id: 'potion', name: 'Healing Potion', icon: '⚕', rarity: 'common' }, qty: 3 },
    { item: { id: 'sword', name: 'Iron Sword', icon: '⚔', rarity: 'uncommon' } },
    { item: { id: 'gem', name: 'Soul Gem', icon: '✦', rarity: 'epic' }, qty: 1 }
]

const LootPopupDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [open, setOpen] = useState(false)
    const [autoFade, setAutoFade] = useState(false)
    const [last, setLast] = useState('—')

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.items = ITEMS
    }, [])

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.open = open
        el.autoFadeMs = autoFade ? 4000 : 0
    }, [open, autoFade])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const onTake = (e: any) => setLast(`take ${e.detail.id}`)
        const onAll = () => { setLast('take-all'); setOpen(false) }
        const onDiscard = () => { setLast('discard'); setOpen(false) }
        const onClose = () => { setLast('close'); setOpen(false) }
        el.addEventListener('take', onTake)
        el.addEventListener('take-all', onAll)
        el.addEventListener('discard', onDiscard)
        el.addEventListener('close', onClose)
        return () => {
            el.removeEventListener('take', onTake)
            el.removeEventListener('take-all', onAll)
            el.removeEventListener('discard', onDiscard)
            el.removeEventListener('close', onClose)
        }
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="LootPopup"
                        description="Modal overlay around gc-loot-list with Take-All and Discard buttons plus optional auto-fade timer."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`Last event — ${last}`}>
                            <div className="d-flex gap-2 align-items-center">
                                <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>Open Popup</button>
                                <label className="d-inline-flex align-items-center gap-2 ms-2">
                                    <input type="checkbox" checked={autoFade} onChange={(e) => setAutoFade(e.target.checked)} />
                                    <span>auto-fade after 4s</span>
                                </label>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
            {/* @ts-ignore */}
            <gc-loot-popup ref={ref} popup-title="Treasure Found" eyebrow="Acquired" />
        </div>
    )
}

export default LootPopupDemo
