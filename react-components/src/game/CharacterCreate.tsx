import React from 'react'

export interface CharacterCreateField {
    id: string
    label: React.ReactNode
    /** Predefined options to cycle. */
    options?: Array<{ id: string, label: string, color?: string }>
    type?: 'cycle' | 'slider' | 'text'
    min?: number
    max?: number
    step?: number
}

export interface CharacterCreateProps {
    fields: CharacterCreateField[]
    values: Record<string, string | number>
    preview?: React.ReactNode
    name?: string
    onChange?: (id: string, value: string | number) => void
    onName?: (name: string) => void
    onConfirm?: (values: Record<string, string | number>, name: string) => void
    style?: React.CSSProperties
    className?: string
}

export const CharacterCreate: React.FC<CharacterCreateProps> = ({ fields, values, preview, name = '', onChange, onName, onConfirm, style, className }) => {
    return (
        <div className={className} style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, padding: 24, color: '#e6e8ec', height: '100%', ...style }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: 6, minHeight: 320 }}>{preview}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input value={name} onChange={(event) => onName?.(event.target.value)} placeholder="Character name" style={{ padding: '10px 12px', background: 'rgba(15,18,24,0.7)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: '#e6e8ec', fontSize: 16, outline: 'none' }} />
                {fields.map((field) => (
                    <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 12, opacity: 0.7 }}>{field.label}</label>
                        {field.type === 'slider' ? (
                            <input type="range" min={field.min} max={field.max} step={field.step ?? 1} value={values[field.id] as number ?? field.min ?? 0} onChange={(event) => onChange?.(field.id, Number(event.target.value))} />
                        ) : field.type === 'text' ? (
                            <input value={values[field.id] as string ?? ''} onChange={(event) => onChange?.(field.id, event.target.value)} style={{ padding: 8, background: 'rgba(15,18,24,0.7)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: '#e6e8ec', outline: 'none' }} />
                        ) : (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {field.options?.map((option) => {
                                    const selected = values[field.id] === option.id
                                    return (
                                        <button key={option.id} type="button" onClick={() => onChange?.(field.id, option.id)} style={{ padding: '6px 10px', background: selected ? '#6aa9ff' : 'rgba(15,18,24,0.7)', color: selected ? '#fff' : '#e6e8ec', border: `1px solid ${option.color ?? 'rgba(255,255,255,0.15)'}`, borderRadius: 4, cursor: 'pointer' }}>{option.label}</button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                ))}
                <button type="button" onClick={() => onConfirm?.(values, name)} style={{ marginTop: 16, padding: '10px 14px', background: '#6aa9ff', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>Create</button>
            </div>
        </div>
    )
}
