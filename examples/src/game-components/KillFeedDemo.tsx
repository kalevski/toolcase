import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const ENTRIES = [
    { id: '1', killerName: 'Aldric', victimName: 'Goblin', killerColor: '#9fc55a', victimColor: '#d44a3a', weapon: '⚔' },
    { id: '2', killerName: 'Brina', victimName: 'Wraith', killerColor: '#5a8cf0', victimColor: '#a44dd0', weapon: '✦', headshot: true },
    { id: '3', killerName: 'Caelum', victimName: 'Bandit', killerColor: '#f0d27a', victimColor: '#d44a3a', weapon: '🏹' }
]

const KillFeedDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.entries = ENTRIES
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="KillFeed"
                        description="Stack of recent kill notifications with optional headshot indicator."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Default">
                            <div style={{ minHeight: 140, padding: 12, background: 'rgba(0,0,0,0.3)' }}>
                                {/* @ts-ignore */}
                                <gc-kill-feed ref={ref} max-visible="5" />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default KillFeedDemo
