import React from 'react'

export interface KillFeedEntry {
    id: string
    killer: { name: React.ReactNode, color?: string }
    victim: { name: React.ReactNode, color?: string }
    weapon?: React.ReactNode
    headshot?: boolean
    timestamp?: number
}

export interface KillFeedProps {
    entries: KillFeedEntry[]
    maxVisible?: number
    fadeAfter?: number
    style?: React.CSSProperties
    className?: string
}

export const KillFeed: React.FC<KillFeedProps> = ({ entries, maxVisible = 5, fadeAfter, style, className }) => {
    const now = Date.now()
    const visible = entries.slice(-maxVisible)
    return (
        <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', ...style }}>
            {visible.map((entry) => {
                const age = entry.timestamp ? now - entry.timestamp : 0
                const opacity = fadeAfter && age > fadeAfter ? Math.max(0, 1 - (age - fadeAfter) / 1000) : 1
                return (
                    <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#e6e8ec', background: 'rgba(0,0,0,0.45)', padding: '4px 8px', borderRadius: 3, opacity, transition: 'opacity 200ms' }}>
                        <span style={{ color: entry.killer.color ?? '#6aa9ff', fontWeight: 600 }}>{entry.killer.name}</span>
                        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>{entry.weapon}</span>
                        {entry.headshot && <span title="Headshot" style={{ color: '#ffd35a' }}>★</span>}
                        <span style={{ color: entry.victim.color ?? '#d23a3a', fontWeight: 600 }}>{entry.victim.name}</span>
                    </div>
                )
            })}
        </div>
    )
}
