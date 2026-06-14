import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import type { LeaderboardEntry } from '@toolcase/web-components'

const FULL_ENTRIES: LeaderboardEntry[] = [
    {
        id: 'u1',
        rank: 1,
        name: 'Alice Chen',
        avatarUrl: 'https://i.pravatar.cc/64?u=alice',
        tier: 'Diamond',
        sprints: 24,
        trend: { value: '+240', direction: 'up' },
        points: 9420,
    },
    {
        id: 'u2',
        rank: 2,
        name: 'Bob Müller',
        avatarUrl: 'https://i.pravatar.cc/64?u=bob',
        tier: 'Platinum',
        sprints: 21,
        trend: { value: '-130', direction: 'down' },
        points: 8870,
    },
    {
        id: 'u3',
        rank: 3,
        name: 'Carol Diaz',
        avatarUrl: 'https://i.pravatar.cc/64?u=carol',
        tier: 'Platinum',
        sprints: 19,
        trend: { value: '0', direction: 'flat' },
        points: 8450,
    },
    {
        id: 'u4',
        rank: 4,
        name: 'Dave Kim',
        tier: 'Gold',
        sprints: 17,
        trend: { value: '+85', direction: 'up' },
        points: 7310,
    },
    {
        id: 'u5',
        rank: 5,
        name: 'Eve Okafor',
        tier: 'Gold',
        sprints: 15,
        trend: { value: '-60', direction: 'down' },
        points: 6980,
    },
    {
        rank: 6,
        name: 'Frank Russo',
        tier: 'Silver',
        sprints: 12,
        trend: { value: '+15', direction: 'up' },
        points: 5240,
    },
]

const LeaderboardDemo: React.FC = () => {
    const fullRef = useRef<any>(null)
    const compactRef = useRef<any>(null)
    const [selected, setSelected] = useState<string | null>(null)

    useEffect(() => {
        if (fullRef.current) {
            fullRef.current.entries = FULL_ENTRIES
            fullRef.current.addEventListener('tc-select', (e: CustomEvent) => {
                setSelected(e.detail.entry.name)
            })
        }
    }, [])

    useEffect(() => {
        if (compactRef.current) {
            compactRef.current.entries = FULL_ENTRIES
            compactRef.current.columns = {
                tier: false,
                sprints: false,
                trend: 'Δ 7d',
            }
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Leaderboard"
                            description="Table-based leaderboard with avatar, tier, sprints, trend, and points columns. Entries are set via the JS property. Interactive rows (with an id) dispatch a tc-select event on click or Enter/Space."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Full leaderboard (all columns, interactive rows)">
                                {selected && (
                                    <p className="mb-3" style={{ fontSize: '0.875rem', color: 'var(--tc-text-muted)' }}>
                                        Selected: <strong>{selected}</strong>
                                    </p>
                                )}
                                {/* @ts-ignore */}
                                <tc-leaderboard ref={fullRef}></tc-leaderboard>
                            </SectionCard>

                            <SectionCard title="Column-config variant (no Tier/Sprints, custom Trend header)">
                                {/* @ts-ignore */}
                                <tc-leaderboard ref={compactRef}></tc-leaderboard>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LeaderboardDemo
