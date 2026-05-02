import React from 'react'

export interface QuestObjective {
    id: string
    text: React.ReactNode
    progress?: number
    target?: number
    completed?: boolean
    optional?: boolean
}

export interface QuestEntry {
    id: string
    name: React.ReactNode
    objectives: QuestObjective[]
    pinned?: boolean
}

export interface QuestTrackerProps {
    quests: QuestEntry[]
    title?: React.ReactNode
    style?: React.CSSProperties
    className?: string
}

export const QuestTracker: React.FC<QuestTrackerProps> = ({ quests, title, style, className }) => {
    return (
        <div className={className} style={{ color: '#e6e8ec', maxWidth: 280, fontSize: 12, textShadow: '0 2px 4px rgba(0,0,0,0.8)', ...style }}>
            {title && <div style={{ fontWeight: 700, marginBottom: 6, opacity: 0.8 }}>{title}</div>}
            {quests.map((quest) => (
                <div key={quest.id} style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, color: '#ffd35a' }}>{quest.name}</div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {quest.objectives.map((objective) => (
                            <li key={objective.id} style={{ display: 'flex', gap: 6, alignItems: 'center', textDecoration: objective.completed ? 'line-through' : undefined, opacity: objective.completed ? 0.5 : 1 }}>
                                <span style={{ width: 10, height: 10, border: `1px solid ${objective.completed ? '#3aa256' : 'rgba(255,255,255,0.5)'}`, background: objective.completed ? '#3aa256' : 'transparent', display: 'inline-block', borderRadius: 2 }} />
                                <span style={{ flex: 1 }}>{objective.text}{objective.optional && <em style={{ opacity: 0.5 }}> (optional)</em>}</span>
                                {objective.target !== undefined && objective.progress !== undefined && (
                                    <span style={{ opacity: 0.7 }}>{objective.progress}/{objective.target}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    )
}
