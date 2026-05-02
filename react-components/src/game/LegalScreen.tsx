import React from 'react'

export interface LegalSection {
    id: string
    title: React.ReactNode
    body: React.ReactNode
}

export interface LegalScreenProps {
    sections: LegalSection[]
    initialSectionId?: string
    title?: React.ReactNode
    onAccept?: () => void
    onClose?: () => void
    showAccept?: boolean
    style?: React.CSSProperties
    className?: string
}

export const LegalScreen: React.FC<LegalScreenProps> = ({ sections, initialSectionId, title = 'Legal', onAccept, onClose, showAccept = false, style, className }) => {
    const [current, setCurrent] = React.useState(initialSectionId ?? sections[0]?.id)
    const active = sections.find((section) => section.id === current)
    return (
        <div className={className} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gridTemplateRows: 'auto 1fr auto', gap: 16, padding: 16, height: '100%', color: '#e6e8ec', ...style }}>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0 }}>{title}</h2>
                {onClose && <button type="button" onClick={onClose} style={{ background: 'transparent', color: '#e6e8ec', border: 'none', cursor: 'pointer', fontSize: 20 }}>✕</button>}
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {sections.map((section) => {
                    const selected = section.id === current
                    return (
                        <li key={section.id}><button type="button" onClick={() => setCurrent(section.id)} style={{ width: '100%', textAlign: 'left', padding: '8px 10px', background: selected ? 'rgba(255,255,255,0.08)' : 'transparent', color: '#e6e8ec', border: 'none', borderLeft: `2px solid ${selected ? '#6aa9ff' : 'transparent'}`, cursor: 'pointer' }}>{section.title}</button></li>
                    )
                })}
            </ul>
            <div style={{ overflowY: 'auto', padding: 16, background: 'rgba(15,18,24,0.5)', borderRadius: 4, fontSize: 13, lineHeight: 1.6 }}>{active?.body}</div>
            {showAccept && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" onClick={onAccept} style={{ padding: '8px 14px', background: '#6aa9ff', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>Accept</button>
                </div>
            )}
        </div>
    )
}
