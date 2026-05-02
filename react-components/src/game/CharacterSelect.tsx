import React from 'react'

export interface CharacterEntry {
    id: string
    name: React.ReactNode
    portrait?: React.ReactNode
    role?: React.ReactNode
    locked?: boolean
    stats?: Array<{ label: string, value: number, max?: number }>
    description?: React.ReactNode
}

export interface CharacterSelectProps {
    characters: CharacterEntry[]
    selectedId?: string
    onSelect?: (id: string) => void
    onConfirm?: (id: string) => void
    portraitSize?: number
    style?: React.CSSProperties
    className?: string
}

export const CharacterSelect: React.FC<CharacterSelectProps> = ({ characters, selectedId, onSelect, onConfirm, portraitSize = 96, style, className }) => {
    const [internalId, setInternalId] = React.useState<string | null>(null)
    const activeId = selectedId ?? internalId ?? characters[0]?.id
    const active = characters.find((character) => character.id === activeId)

    const select = (id: string) => {
        if (selectedId === undefined) setInternalId(id)
        onSelect?.(id)
    }

    return (
        <div className={className} style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, padding: 24, color: '#e6e8ec', height: '100%', ...style }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${portraitSize + 16}px, 1fr))`, gap: 8, alignContent: 'flex-start' }}>
                {characters.map((character) => {
                    const selected = character.id === activeId
                    return (
                        <button
                            key={character.id}
                            type="button"
                            disabled={character.locked}
                            onClick={() => !character.locked && select(character.id)}
                            onDoubleClick={() => !character.locked && onConfirm?.(character.id)}
                            style={{
                                position: 'relative',
                                width: portraitSize,
                                height: portraitSize,
                                background: 'rgba(15,18,24,0.7)',
                                border: `2px solid ${selected ? '#6aa9ff' : 'rgba(255,255,255,0.15)'}`,
                                borderRadius: 4,
                                padding: 0,
                                cursor: character.locked ? 'not-allowed' : 'pointer',
                                opacity: character.locked ? 0.4 : 1,
                                color: 'inherit',
                                overflow: 'hidden',
                            }}
                        >
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: portraitSize * 0.5 }}>{character.portrait}</div>
                            {character.locked && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔒</div>}
                        </button>
                    )
                })}
            </div>
            {active && (
                <aside style={{ background: 'rgba(15,18,24,0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: 16 }}>
                    <h2 style={{ margin: '0 0 4px', fontSize: 24 }}>{active.name}</h2>
                    {active.role && <div style={{ opacity: 0.7, marginBottom: 12 }}>{active.role}</div>}
                    {active.description && <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 16, lineHeight: 1.5 }}>{active.description}</div>}
                    {active.stats && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {active.stats.map((stat) => (
                                <div key={stat.label}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span>{stat.label}</span><span>{stat.value}{stat.max ? ` / ${stat.max}` : ''}</span></div>
                                    <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                                        <div style={{ width: `${(stat.value / (stat.max ?? 100)) * 100}%`, height: '100%', background: '#6aa9ff', borderRadius: 2 }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <button type="button" onClick={() => onConfirm?.(active.id)} style={{ marginTop: 18, width: '100%', padding: '10px 14px', background: '#6aa9ff', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>Select</button>
                </aside>
            )}
        </div>
    )
}
