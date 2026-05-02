import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const ITEMS = [
    { item: { id: 'sword', name: 'Iron Sword', icon: '⚔', rarity: 'uncommon' }, price: 250 },
    { item: { id: 'shield', name: 'Tower Shield', icon: '🛡', rarity: 'rare' }, price: 600, discount: 0.2 },
    { item: { id: 'potion', name: 'Healing Potion', icon: '⚕' }, price: 50 },
    { item: { id: 'cloak', name: 'Shadow Cloak', icon: '◆', rarity: 'epic' }, price: 1500, soldOut: true }
]

const ShopPanelDemo: React.FC = () => {
    const buyRef = useRef<HTMLElement>(null)
    const sellRef = useRef<HTMLElement>(null)
    const [last, setLast] = useState('—')

    useEffect(() => {
        const buy = buyRef.current as any
        if (buy) buy.items = ITEMS
        const sell = sellRef.current as any
        if (sell) sell.items = ITEMS.slice(0, 2)
    }, [])

    useEffect(() => {
        const a = buyRef.current
        const b = sellRef.current
        if (!a || !b) return
        const onBuy = (e: any) => setLast(`buy ${e.detail.id}`)
        const onSell = (e: any) => setLast(`sell ${e.detail.id}`)
        a.addEventListener('buy', onBuy)
        b.addEventListener('sell', onSell)
        return () => {
            a.removeEventListener('buy', onBuy)
            b.removeEventListener('sell', onSell)
        }
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="ShopPanel"
                        description="Vendor panel with buy/sell mode, currency, discounts, sold-out state, and per-row action."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Buy — ${last}`} />
                            <div style={{ maxWidth: 600 }}>
                                {/* @ts-ignore */}
                                <gc-shop-panel ref={buyRef} currency="800" currency-icon="◆" />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Sell mode" />
                            <div style={{ maxWidth: 600 }}>
                                {/* @ts-ignore */}
                                <gc-shop-panel ref={sellRef} sell-mode currency="800" currency-icon="◆" />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ShopPanelDemo
