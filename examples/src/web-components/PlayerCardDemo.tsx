import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const PlayerCardDemo: React.FC = () => {
    const statsRef = useRef<any>(null)
    const actionsRef = useRef<any>(null)
    const eventsRef = useRef<any>(null)

    const [log, setLog] = useState<string[]>([])

    useEffect(() => {
        if (!statsRef.current) return
        statsRef.current.stats = [
            { label: 'KDR', value: 1.84 },
            { label: 'Wins', value: 312 },
            { label: 'Hours', value: 1470 },
            { label: 'Rank Pts', value: 4820 },
        ]
    }, [])

    useEffect(() => {
        if (!actionsRef.current) return
        actionsRef.current.stats = [
            { label: 'KDR', value: 2.1 },
            { label: 'Wins', value: 88 },
        ]
        actionsRef.current.actions = [
            { id: 'add-friend', label: 'Add Friend' },
            { id: 'invite', label: 'Invite to Party' },
            { id: 'block', label: 'Block', danger: true },
        ]
    }, [])

    useEffect(() => {
        const el = eventsRef.current
        if (!el) return
        el.stats = [{ label: 'Wins', value: 42 }]
        el.actions = [
            { id: 'challenge', label: 'Challenge' },
            { id: 'report', label: 'Report', danger: true },
        ]
        const onAction = (e: CustomEvent<{ id: string }>) => {
            setLog(l => [`tc-action fired: id="${e.detail.id}"`, ...l].slice(0, 6))
        }
        el.addEventListener('tc-action', onAction)
        return () => el.removeEventListener('tc-action', onAction)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="PlayerCard"
                            description="Player summary card with name, optional title, rank, level, online-status pip, a stats grid, and action buttons. Stats and actions are set via JS properties; all other data flows through attributes."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Presence statuses">
                                <div className="d-flex flex-wrap gap-3">
                                    {/* @ts-ignore */}
                                    <tc-player-card player-name="Aria" online-status="online" style={{ width: '240px' }} />
                                    {/* @ts-ignore */}
                                    <tc-player-card player-name="Kestrel" online-status="away" style={{ width: '240px' }} />
                                    {/* @ts-ignore */}
                                    <tc-player-card player-name="Vesper" online-status="busy" style={{ width: '240px' }} />
                                    {/* @ts-ignore */}
                                    <tc-player-card player-name="Onyx" online-status="in-game" style={{ width: '240px' }} />
                                    {/* @ts-ignore */}
                                    <tc-player-card player-name="Cipher" online-status="offline" style={{ width: '240px' }} />
                                </div>
                            </SectionCard>

                            <SectionCard title="With card-title, rank, and level">
                                {/* @ts-ignore */}
                                <tc-player-card
                                    player-name="Aria"
                                    card-title="Fragmaster"
                                    rank="Diamond III"
                                    level="87"
                                    online-status="online"
                                    style={{ maxWidth: '320px' }}
                                />
                            </SectionCard>

                            <SectionCard title="With stats grid">
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
                            </SectionCard>

                            <SectionCard title="With action buttons (including a danger action)">
                                {/* @ts-ignore */}
                                <tc-player-card
                                    ref={actionsRef}
                                    player-name="Vesper"
                                    rank="Gold I"
                                    level="34"
                                    online-status="online"
                                    style={{ maxWidth: '320px' }}
                                />
                            </SectionCard>

                            <SectionCard title="Events — tc-action">
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

export default PlayerCardDemo
