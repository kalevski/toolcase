import React from 'react'

export interface SaveSlot {
    id: string
    name?: React.ReactNode
    thumbnail?: React.ReactNode
    timestamp?: React.ReactNode
    location?: React.ReactNode
    playtime?: React.ReactNode
    level?: React.ReactNode
    empty?: boolean
    autosave?: boolean
}

export interface SaveSlotListProps {
    slots: SaveSlot[]
    selectedId?: string
    onSelect?: (id: string) => void
    onLoad?: (id: string) => void
    onDelete?: (id: string) => void
    onSave?: (id: string) => void
    mode?: 'load' | 'save'
    style?: React.CSSProperties
    className?: string
}

export const SaveSlotList: React.FC<SaveSlotListProps> = ({ slots, selectedId, onSelect, onLoad, onDelete, onSave, mode = 'load', style, className }) => {
    return (
        <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 6, color: '#e6e8ec', ...style }}>
            {slots.map((slot) => {
                const selected = slot.id === selectedId
                return (
                    <div key={slot.id} onClick={() => onSelect?.(slot.id)} style={{ display: 'flex', gap: 12, padding: 12, background: 'rgba(15,18,24,0.7)', border: `1px solid ${selected ? '#6aa9ff' : 'rgba(255,255,255,0.08)'}`, borderRadius: 6, cursor: 'pointer' }}>
                        <div style={{ width: 96, height: 64, background: '#0a0c10', borderRadius: 3, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, opacity: slot.empty ? 0.4 : 1 }}>
                            {slot.empty ? 'Empty' : slot.thumbnail}
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                                {slot.name ?? `Slot ${slot.id}`}
                                {slot.autosave && <span style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(106,169,255,0.2)', color: '#6aa9ff', borderRadius: 2 }}>AUTO</span>}
                            </div>
                            {!slot.empty && (
                                <div style={{ display: 'flex', gap: 12, fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                                    {slot.location && <span>📍 {slot.location}</span>}
                                    {slot.level && <span>Lv {slot.level}</span>}
                                    {slot.playtime && <span>⏱ {slot.playtime}</span>}
                                </div>
                            )}
                            {slot.timestamp && <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>{slot.timestamp}</div>}
                        </div>
                        {selected && (
                            <div style={{ display: 'flex', gap: 6, alignSelf: 'center' }}>
                                {mode === 'save' && onSave && <button type="button" onClick={(event) => { event.stopPropagation(); onSave(slot.id) }} style={{ padding: '6px 10px', background: '#6aa9ff', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12 }}>Save</button>}
                                {mode === 'load' && !slot.empty && onLoad && <button type="button" onClick={(event) => { event.stopPropagation(); onLoad(slot.id) }} style={{ padding: '6px 10px', background: '#6aa9ff', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12 }}>Load</button>}
                                {!slot.empty && !slot.autosave && onDelete && <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(slot.id) }} style={{ padding: '6px 10px', background: 'transparent', color: '#d23a3a', border: '1px solid #d23a3a', borderRadius: 3, cursor: 'pointer', fontSize: 12 }}>Delete</button>}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
