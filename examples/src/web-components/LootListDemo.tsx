import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const LootListDemo: React.FC = () => {
    const [log, setLog] = useState<string[]>([])

    const basicRef = useTc<HTMLElement>({
        items: [
            { item: { id: 'gold-coin', name: 'Gold Coin', icon: '◎', qty: 3 } },
            { item: { id: 'health-potion', name: 'Health Potion', icon: '⊕' } },
            { item: { id: 'leather-armor', name: 'Leather Armor', icon: '◈' }, qty: 1 },
        ],
    })

    const rarityRef = useTc<HTMLElement>({
        items: [
            { item: { id: 'pebble', name: 'Pebble', icon: '○', rarity: 'common' } },
            { item: { id: 'iron-sword', name: 'Iron Sword', icon: '◆', rarity: 'uncommon' } },
            { item: { id: 'frost-staff', name: 'Frost Staff', icon: '✦', rarity: 'rare' } },
            { item: { id: 'shadow-blade', name: 'Shadow Blade', icon: '◇', rarity: 'epic' } },
            { item: { id: 'dawn-lance', name: 'Dawn Lance', icon: '★', rarity: 'legendary' } },
            { item: { id: 'void-shard', name: 'Void Shard', icon: '⬡', rarity: 'mythic' } },
        ],
    })

    const eventsRef = useTc<HTMLElement>(
        {
            items: [
                { item: { id: 'scroll', name: 'Ancient Scroll', icon: '◉', rarity: 'rare' }, qty: 2 },
                { item: { id: 'gem', name: 'Sapphire Gem', icon: '◈', rarity: 'epic' } },
            ],
        },
        {
            'tc-take': (e: CustomEvent) =>
                setLog((l) => [`tc-take — id: "${e.detail.id}"`, ...l].slice(0, 8)),
            'tc-take-all': () => setLog((l) => ['tc-take-all fired', ...l].slice(0, 8)),
        }
    )

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="LootList"
                            description="A list of loot / drop entries with rarity tiers. Items are set via the JS items property. Each item fires tc-take; the Take All button fires tc-take-all."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic — title and items (no rarity)">
                                {/* @ts-ignore */}
                                <tc-loot-list
                                    ref={basicRef}
                                    list-title="Chest Loot"
                                    style={{ maxWidth: '400px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="All rarity tiers — left-stripe accent per row">
                                {/* @ts-ignore */}
                                <tc-loot-list
                                    ref={rarityRef}
                                    list-title="Rare Drops"
                                    style={{ maxWidth: '400px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="Empty state — Take All disabled">
                                {/* @ts-ignore */}
                                <tc-loot-list
                                    list-title="Empty Chest"
                                    style={{ maxWidth: '400px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="Events — tc-take / tc-take-all">
                                {/* @ts-ignore */}
                                <tc-loot-list
                                    ref={eventsRef}
                                    list-title="Event Demo"
                                    style={{ maxWidth: '400px' }}
                                />
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">Click Take or Take All…</span>
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

export default LootListDemo
