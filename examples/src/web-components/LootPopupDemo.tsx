import React, { useEffect, useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const LootPopupDemo: React.FC = () => {
    const [basicOpen, setBasicOpen] = useState(false)
    const [autoFadeOpen, setAutoFadeOpen] = useState(false)
    const [eventsOpen, setEventsOpen] = useState(false)
    const [log, setLog] = useState<string[]>([])

    const appendLog = (msg: string) => setLog((l) => [msg, ...l].slice(0, 10))

    // Basic popup
    const basicRef = useTc<HTMLElement>(
        {
            items: [
                { item: { id: 'gold', name: 'Gold Coin', icon: '◎', rarity: 'common', qty: 12 } },
                { item: { id: 'potion', name: 'Health Potion', icon: '⊕', rarity: 'uncommon' } },
                { item: { id: 'staff', name: 'Frost Staff', icon: '✦', rarity: 'rare' }, qty: 2 },
            ],
        },
        { 'tc-close': () => setBasicOpen(false) }
    )

    useEffect(() => {
        if (!basicRef.current) return
        if (basicOpen) basicRef.current.setAttribute('open', '')
        else basicRef.current.removeAttribute('open')
    }, [basicOpen])

    // Auto-fade popup
    const autoFadeRef = useTc<HTMLElement>(
        {
            items: [
                { item: { id: 'chest-key', name: 'Chest Key', icon: '⊗', rarity: 'epic' } },
                { item: { id: 'dawn-lance', name: 'Dawn Lance', icon: '★', rarity: 'legendary' } },
            ],
        },
        { 'tc-close': () => setAutoFadeOpen(false) }
    )

    useEffect(() => {
        if (!autoFadeRef.current) return
        if (autoFadeOpen) autoFadeRef.current.setAttribute('open', '')
        else autoFadeRef.current.removeAttribute('open')
    }, [autoFadeOpen])

    // Events popup
    const eventsRef = useTc<HTMLElement>(
        {
            items: [
                { item: { id: 'scroll', name: 'Ancient Scroll', icon: '◉', rarity: 'rare' }, qty: 3 },
                { item: { id: 'gem', name: 'Sapphire Gem', icon: '◈', rarity: 'epic' } },
                { item: { id: 'void-shard', name: 'Void Shard', icon: '⬡', rarity: 'mythic' } },
            ],
        },
        {
            'tc-take': (e: CustomEvent) => appendLog(`tc-take — id: "${e.detail.id}"`),
            'tc-take-all': () => appendLog('tc-take-all fired'),
            'tc-discard': () => {
                appendLog('tc-discard fired')
                setEventsOpen(false)
            },
            'tc-close': () => {
                appendLog('tc-close fired')
                setEventsOpen(false)
            },
        }
    )

    useEffect(() => {
        if (!eventsRef.current) return
        if (eventsOpen) eventsRef.current.setAttribute('open', '')
        else eventsRef.current.removeAttribute('open')
    }, [eventsOpen])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="LootPopup"
                            description="Modal loot window with Take All / Discard and optional auto-fade. Items are set via the JS items property. Controlled — fire tc-close to dismiss."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic — eyebrow, title, and three items">
                                <button
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => setBasicOpen(true)}
                                >
                                    Open popup
                                </button>
                                {/* @ts-ignore */}
                                <tc-loot-popup
                                    ref={basicRef}
                                    popup-title="Chest Rewards"
                                    eyebrow="Acquired"
                                    discard-label="Leave it"
                                />
                            </tc-section-card>

                            <tc-section-card title="Auto-fade — closes automatically after 4 s">
                                <button
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => setAutoFadeOpen(true)}
                                >
                                    Open popup (4 s timer)
                                </button>
                                {/* @ts-ignore */}
                                <tc-loot-popup
                                    ref={autoFadeRef}
                                    popup-title="Rare Find"
                                    eyebrow="Victory Drop"
                                    auto-fade-ms="4000"
                                />
                            </tc-section-card>

                            <tc-section-card title="Events — tc-take / tc-take-all / tc-discard / tc-close">
                                <button
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => setEventsOpen(true)}
                                >
                                    Open popup
                                </button>
                                {/* @ts-ignore */}
                                <tc-loot-popup ref={eventsRef} popup-title="Event Demo" />
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">
                                            Open the popup and interact…
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

export default LootPopupDemo
