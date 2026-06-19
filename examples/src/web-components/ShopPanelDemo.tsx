import React, { useEffect, useRef, useState } from 'react'

const ShopPanelDemo: React.FC = () => {
    const buyRef = useRef<any>(null)
    const sellRef = useRef<any>(null)
    const discountRef = useRef<any>(null)
    const eventsRef = useRef<any>(null)

    const [log, setLog] = useState<string[]>([])

    useEffect(() => {
        if (!buyRef.current) return
        buyRef.current.currency = 500
        buyRef.current.items = [
            { item: { id: 'health-potion', name: 'Health Potion', icon: '⊕' }, price: 50 },
            { item: { id: 'mana-potion', name: 'Mana Potion', icon: '◉' }, price: 75 },
            { item: { id: 'iron-sword', name: 'Iron Sword', icon: '◆' }, price: 250 },
            {
                item: { id: 'dragon-shield', name: 'Dragon Shield', icon: '◈' },
                price: 999,
                soldOut: true,
            },
        ]
    }, [])

    useEffect(() => {
        if (!sellRef.current) return
        sellRef.current.items = [
            { item: { id: 'old-dagger', name: 'Old Dagger', icon: '◇' }, price: 30 },
            { item: { id: 'leather-boots', name: 'Leather Boots', icon: '◎' }, price: 20 },
        ]
    }, [])

    useEffect(() => {
        if (!discountRef.current) return
        discountRef.current.currency = 200
        discountRef.current.items = [
            {
                item: { id: 'elixir', name: 'Elixir of Power', icon: '✦' },
                price: 100,
                discount: 0.3,
            },
            {
                item: { id: 'cloak', name: 'Cloak of Shadows', icon: '◆' },
                price: 400,
                discount: 0.5,
            },
            { item: { id: 'rare-gem', name: 'Rare Gem', icon: '◈' }, price: 600, discount: 0.2 },
        ]
    }, [])

    useEffect(() => {
        const el = eventsRef.current
        if (!el) return
        el.currency = 300
        el.items = [
            { item: { id: 'scroll', name: 'Scroll of Recall', icon: '◉' }, price: 80 },
            { item: { id: 'boots', name: 'Speed Boots', icon: '★' }, price: 150 },
        ]
        const onBuy = (e: CustomEvent) =>
            setLog((l) => [`tc-buy — id: "${e.detail.id}"`, ...l].slice(0, 8))
        el.addEventListener('tc-buy', onBuy as EventListener)
        return () => {
            el.removeEventListener('tc-buy', onBuy as EventListener)
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ShopPanel"
                            description="A shop UI with an item grid, prices, optional discounts, and buy/sell actions. Items are set via the JS items property. Fires tc-buy or tc-sell when an action button is clicked."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Buy mode — currency balance and affordability states">
                                {/* @ts-ignore */}
                                <tc-shop-panel
                                    ref={buyRef}
                                    currency-icon="◆"
                                    style={{ maxWidth: '440px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="Sell mode — sell-mode attribute">
                                {/* @ts-ignore */}
                                <tc-shop-panel
                                    ref={sellRef}
                                    sell-mode
                                    style={{ maxWidth: '440px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="Discounted items — strikethrough old price and discount badge">
                                {/* @ts-ignore */}
                                <tc-shop-panel
                                    ref={discountRef}
                                    currency-icon="$"
                                    style={{ maxWidth: '440px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="Empty state — no items">
                                {/* @ts-ignore */}
                                <tc-shop-panel style={{ maxWidth: '440px' }} />
                            </tc-section-card>

                            <tc-section-card title="Events — tc-buy">
                                {/* @ts-ignore */}
                                <tc-shop-panel
                                    ref={eventsRef}
                                    currency-icon="◆"
                                    style={{ maxWidth: '440px' }}
                                />
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">
                                            Click Buy to fire tc-buy…
                                        </span>
                                    ) : (
                                        <ul className="mb-0">
                                            {log.map((line, i) => (
                                                <li key={i}>
                                                    <code>{line}</code>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ShopPanelDemo
