import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const ACHIEVEMENTS = [
    { id: 'a1', name: 'First Blood', description: 'Defeat your first enemy.', unlocked: true, points: 10, icon: '⚔' },
    { id: 'a2', name: 'Slayer', description: 'Defeat 100 enemies.', progress: 47, target: 100, points: 50, icon: '☩' },
    { id: 'a3', name: 'Untouchable', description: 'Win a duel without losing HP.', points: 100, icon: '🛡' },
    { id: 'a4', name: '???', secret: true, points: 250 }
]

const AchievementListDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.achievements = ACHIEVEMENTS
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="AchievementList"
                        description="Achievement list with unlocked, in-progress (with bar), locked, and secret rows."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Default">
                            <div style={{ maxWidth: 540, background: 'rgba(0,0,0,0.3)' }}>
                                {/* @ts-ignore */}
                                <gc-achievement-list ref={ref} />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AchievementListDemo
