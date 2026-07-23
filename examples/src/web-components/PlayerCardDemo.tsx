import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const PlayerCardDemo: React.FC = () => {
    const [log, setLog] = useState<string[]>([])

    const statsRef = useTc<HTMLElement>({
        stats: [
            { label: 'KDR', value: 1.84 },
            { label: 'Wins', value: 312 },
            { label: 'Hours', value: 1470 },
            { label: 'Rank Pts', value: 4820 },
        ],
    })
    const actionsRef = useTc<HTMLElement>({
        stats: [
            { label: 'KDR', value: 2.1 },
            { label: 'Wins', value: 88 },
        ],
        actions: [
            { id: 'add-friend', label: 'Add Friend' },
            { id: 'invite', label: 'Invite to Party' },
            { id: 'block', label: 'Block', danger: true },
        ],
    })
    const eventsRef = useTc<HTMLElement>(
        {
            stats: [{ label: 'Wins', value: 42 }],
            actions: [
                { id: 'challenge', label: 'Challenge' },
                { id: 'report', label: 'Report', danger: true },
            ],
        },
        {
            'tc-action': (e: CustomEvent) => {
                setLog((l) => [`tc-action fired: id="${e.detail.id}"`, ...l].slice(0, 6))
            },
        }
    )

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="PlayerCard"
                            description="Player summary card with name, optional title, rank, level, online-status pip, a stats grid, and action buttons. Stats and actions are set via JS properties; all other data flows through attributes."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Presence statuses">
                                <div className="d-flex flex-wrap gap-3">
                                    {/* @ts-ignore */}
                                    <tc-player-card
                                        player-name="Aria"
                                        online-status="online"
                                        style={{ width: '240px' }}
                                    />
                                    {/* @ts-ignore */}
                                    <tc-player-card
                                        player-name="Kestrel"
                                        online-status="away"
                                        style={{ width: '240px' }}
                                    />
                                    {/* @ts-ignore */}
                                    <tc-player-card
                                        player-name="Vesper"
                                        online-status="busy"
                                        style={{ width: '240px' }}
                                    />
                                    {/* @ts-ignore */}
                                    <tc-player-card
                                        player-name="Onyx"
                                        online-status="in-game"
                                        style={{ width: '240px' }}
                                    />
                                    {/* @ts-ignore */}
                                    <tc-player-card
                                        player-name="Cipher"
                                        online-status="offline"
                                        style={{ width: '240px' }}
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="With card-title, rank, and level">
                                {/* @ts-ignore */}
                                <tc-player-card
                                    player-name="Aria"
                                    card-title="Fragmaster"
                                    rank="Diamond III"
                                    level="87"
                                    online-status="online"
                                    style={{ maxWidth: '320px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="With stats grid">
                                {/* @ts-ignore */}
                                <tc-player-card
                                    ref={statsRef}
                                    player-name="Kestrel"
                                    card-title="Pro Scout"
                                    rank="Platinum II"
                                    level="62"
                                    online-status="in-game"
                                    style={{ maxWidth: '400px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="With action buttons (including a danger action)">
                                {/* @ts-ignore */}
                                <tc-player-card
                                    ref={actionsRef}
                                    player-name="Vesper"
                                    rank="Gold I"
                                    level="34"
                                    online-status="online"
                                    style={{ maxWidth: '320px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="Events — tc-action">
                                {/* @ts-ignore */}
                                <tc-player-card
                                    ref={eventsRef}
                                    player-name="Onyx"
                                    online-status="away"
                                    style={{ maxWidth: '280px' }}
                                />
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">Click an action button…</span>
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

export default PlayerCardDemo
