import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const LootListDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const rarityRef = useRef<any>(null)
    const eventsRef = useRef<any>(null)

    const [log, setLog] = useState<string[]>([])

    useEffect(() => {
        if (!basicRef.current) return
        basicRef.current.items = [
            { item: { id: 'gold-coin', name: 'Gold Coin', icon: '◎', qty: 3 } },
            { item: { id: 'health-potion', name: 'Health Potion', icon: '⊕' } },
            { item: { id: 'leather-armor', name: 'Leather Armor', icon: '◈' }, qty: 1 },
        ]
    }, [])

    useEffect(() => {
        if (!rarityRef.current) return
        rarityRef.current.items = [
            { item: { id: 'pebble', name: 'Pebble', icon: '○', rarity: 'common' } },
            { item: { id: 'iron-sword', name: 'Iron Sword', icon: '◆', rarity: 'uncommon' } },
            { item: { id: 'frost-staff', name: 'Frost Staff', icon: '✦', rarity: 'rare' } },
            { item: { id: 'shadow-blade', name: 'Shadow Blade', icon: '◇', rarity: 'epic' } },
            { item: { id: 'dawn-lance', name: 'Dawn Lance', icon: '★', rarity: 'legendary' } },
            { item: { id: 'void-shard', name: 'Void Shard', icon: '⬡', rarity: 'mythic' } },
        ]
    }, [])

    useEffect(() => {
        const el = eventsRef.current
        if (!el) return
        el.items = [
            { item: { id: 'scroll', name: 'Ancient Scroll', icon: '◉', rarity: 'rare' }, qty: 2 },
            { item: { id: 'gem', name: 'Sapphire Gem', icon: '◈', rarity: 'epic' } },
        ]
        const onTake = (e: CustomEvent) => setLog(l => [`tc-take — id: "${e.detail.id}"`, ...l].slice(0, 8))
        const onTakeAll = () => setLog(l => ['tc-take-all fired', ...l].slice(0, 8))
        el.addEventListener('tc-take', onTake as EventListener)
        el.addEventListener('tc-take-all', onTakeAll)
        return () => {
            el.removeEventListener('tc-take', onTake as EventListener)
            el.removeEventListener('tc-take-all', onTakeAll)
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="LootList"
                            description="A list of loot / drop entries with rarity tiers. Items are set via the JS items property. Each item fires tc-take; the Take All button fires tc-take-all."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Basic — title and items (no rarity)">
                                {/* @ts-ignore */}
                                <tc-loot-list ref={basicRef} list-title="Chest Loot" style={{ maxWidth: '400px' }} />
                            </SectionCard>

                            <SectionCard title="All rarity tiers — left-stripe accent per row">
                                {/* @ts-ignore */}
                                <tc-loot-list ref={rarityRef} list-title="Rare Drops" style={{ maxWidth: '400px' }} />
                            </SectionCard>

                            <SectionCard title="Empty state — Take All disabled">
                                {/* @ts-ignore */}
                                <tc-loot-list list-title="Empty Chest" style={{ maxWidth: '400px' }} />
                            </SectionCard>

                            <SectionCard title="Events — tc-take / tc-take-all">
                                {/* @ts-ignore */}
                                <tc-loot-list ref={eventsRef} list-title="Event Demo" style={{ maxWidth: '400px' }} />
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">Click Take or Take All…</span>
                                    ) : (
                                        <ul className="mb-0">
                                            {log.map((line, i) => (
                                                <li key={i}><code>{line}</code></li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LootListDemo
