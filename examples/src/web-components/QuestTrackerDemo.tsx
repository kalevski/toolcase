import React from 'react'
import { useTc } from '@toolcase/web-components/react'

interface QuestObjective {
    id: string
    label: string
    progress?: number
    target?: number
    completed?: boolean
    optional?: boolean
}

interface QuestEntry {
    id: string
    name: string
    objectives: QuestObjective[]
}

const BASIC_QUESTS: QuestEntry[] = [
    {
        id: 'q1',
        name: 'The Lost Heirloom',
        objectives: [
            { id: 'o1', label: 'Speak to Lady Elara', completed: true },
            { id: 'o2', label: 'Find the heirloom', progress: 1, target: 3 },
            { id: 'o3', label: 'Defeat the guardian', optional: true },
        ],
    },
    {
        id: 'q2',
        name: 'Wolves at the Gate',
        objectives: [{ id: 'o1', label: 'Slay wolves', progress: 4, target: 6 }],
    },
]

const ALL_COMPLETED: QuestEntry[] = [
    {
        id: 'q3',
        name: 'Supply Run',
        objectives: [
            { id: 'o1', label: 'Gather rations', completed: true },
            { id: 'o2', label: 'Return to camp', completed: true },
        ],
    },
]

const EMPTY_QUESTS: QuestEntry[] = []

const QuestTrackerDemo: React.FC = () => {
    const basicRef = useTc<HTMLElement>({ quests: BASIC_QUESTS })
    const completedRef = useTc<HTMLElement>({ quests: ALL_COMPLETED })
    const emptyRef = useTc<HTMLElement>({ quests: EMPTY_QUESTS })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="QuestTracker"
                            description="On-screen quest-objectives tracker with per-objective progress bars, completed/optional states, and a configurable header title."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Active quests — mixed states">
                                <div style={{ maxWidth: 360 }}>
                                    {/* @ts-ignore */}
                                    <tc-quest-tracker
                                        ref={basicRef}
                                        tracker-title="Active Quests"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="All objectives completed">
                                <div style={{ maxWidth: 360 }}>
                                    {/* @ts-ignore */}
                                    <tc-quest-tracker
                                        ref={completedRef}
                                        tracker-title="Completed"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="No active quests (empty state)">
                                <div style={{ maxWidth: 360 }}>
                                    {/* @ts-ignore */}
                                    <tc-quest-tracker
                                        ref={emptyRef}
                                        tracker-title="Active Quests"
                                    />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default QuestTrackerDemo
