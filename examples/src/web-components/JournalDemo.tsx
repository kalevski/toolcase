import React, { useEffect, useRef, useState } from 'react'

const DEMO_ENTRIES = [
    {
        id: 'q1',
        title: 'The Ashen Crown',
        state: 'active',
        description: 'Recover the shattered crown of the old kings from the Ashfall Catacombs.',
        body: 'The catacombs run deep beneath the ruined keep. Locals speak of a guardian that still walks the lowest hall, and of a light that burns where the crown was last seen.',
        objectives: [
            { id: 'o1', label: 'Enter the Ashfall Catacombs', completed: true },
            { id: 'o2', label: 'Recover the three crown shards' },
            { id: 'o3', label: 'Defeat the Hollow Warden' },
            { id: 'o4', label: 'Light the four braziers', optional: true },
        ],
        rewards: [
            { label: 'Gold', value: 1500, icon: '◆' },
            { label: 'Reputation', value: '+250 Vale' },
            { label: 'Crown Fragment', value: 'x3' },
        ],
    },
    {
        id: 'q2',
        title: 'Whispers in the Mist',
        state: 'completed',
        description: 'Investigate the disappearances near the Vale of Mist.',
        body: 'The trail led to a coven hidden in the marsh. They will trouble the village no longer.',
        objectives: [
            { id: 'o1', label: 'Speak with the village elder', completed: true },
            { id: 'o2', label: 'Track the missing villagers', completed: true },
            { id: 'o3', label: 'Disband the coven', completed: true },
        ],
        rewards: [
            { label: 'Gold', value: 800, icon: '◆' },
            { label: 'Marsh Charm', value: 'x1' },
        ],
    },
    {
        id: 'q3',
        title: 'A Debt Unpaid',
        state: 'failed',
        description: 'Escort the merchant caravan to Ember Keep before nightfall.',
        body: 'The caravan was lost on the high road. The merchant did not survive.',
        objectives: [
            { id: 'o1', label: 'Meet the caravan at the crossroads', completed: true },
            { id: 'o2', label: 'Escort it to Ember Keep' },
        ],
    },
    {
        id: 'q4',
        title: 'The Cartographer',
        state: 'inactive',
        description: 'Locked until you reach the Northern Reaches.',
    },
]

const JournalDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const completedRef = useRef<any>(null)
    const emptyRef = useRef<any>(null)
    const eventsRef = useRef<any>(null)

    const [log, setLog] = useState<string[]>([])

    useEffect(() => {
        if (basicRef.current) basicRef.current.entries = DEMO_ENTRIES
        if (completedRef.current) completedRef.current.entries = DEMO_ENTRIES
        if (emptyRef.current) emptyRef.current.entries = []
    }, [])

    useEffect(() => {
        const el = eventsRef.current
        if (!el) return
        el.entries = DEMO_ENTRIES

        const onSelect = (e: CustomEvent) =>
            setLog((l) => [`tc-select  id="${e.detail.id}"`, ...l].slice(0, 8))
        el.addEventListener('tc-select', onSelect as EventListener)
        return () => el.removeEventListener('tc-select', onSelect as EventListener)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Journal"
                            description="Quest / lore journal pairing an entry list with a detail view. Each entry carries a state, an optional description and body, objectives with checkboxes, and rewards. Selecting a row updates the detail pane and fires tc-select."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Active quest selected — objectives and rewards">
                                {/* @ts-ignore */}
                                <tc-journal
                                    ref={basicRef}
                                    selected-id="q1"
                                    style={{ maxWidth: '760px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="Completed quest — struck-through objectives">
                                {/* @ts-ignore */}
                                <tc-journal
                                    ref={completedRef}
                                    selected-id="q2"
                                    style={{ maxWidth: '760px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="Empty state — no entries provided">
                                {/* @ts-ignore */}
                                <tc-journal ref={emptyRef} style={{ maxWidth: '760px' }} />
                            </tc-section-card>

                            <tc-section-card title="Events — tc-select">
                                {/* @ts-ignore */}
                                <tc-journal ref={eventsRef} style={{ maxWidth: '760px' }} />
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">
                                            Click an entry to see events…
                                        </span>
                                    ) : (
                                        <ul className="mb-0 ps-0 list-unstyled">
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

export default JournalDemo
