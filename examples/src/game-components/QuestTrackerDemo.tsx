import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const QUESTS = [
    {
        id: 'q1',
        name: 'The Lost Heirloom',
        objectives: [
            { id: 'o1', label: 'Speak to Lady Elara', completed: true },
            { id: 'o2', label: 'Find the heirloom', progress: 1, target: 3 },
            { id: 'o3', label: 'Defeat the guardian', optional: true }
        ]
    },
    {
        id: 'q2',
        name: 'Wolves at the Gate',
        objectives: [
            { id: 'o1', label: 'Slay wolves', progress: 4, target: 6 }
        ]
    }
]

const QuestTrackerDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.quests = QUESTS
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="QuestTracker"
                        description="HUD-side quest tracker showing active quests and per-objective progress."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Active quests">
                            <div style={{ maxWidth: 360 }}>
                                {/* @ts-ignore */}
                                <gc-quest-tracker ref={ref} tracker-title="Active Quests" />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default QuestTrackerDemo
