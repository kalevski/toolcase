import React from 'react'

export interface DialogueChoice {
    id: string
    label: React.ReactNode
    disabled?: boolean
    icon?: React.ReactNode
}

export interface DialogueBoxProps {
    speaker?: React.ReactNode
    portrait?: React.ReactNode
    text: React.ReactNode
    choices?: DialogueChoice[]
    onChoice?: (id: string) => void
    onAdvance?: () => void
    /** Reveal characters per second; 0 = instant. */
    typingSpeed?: number
    style?: React.CSSProperties
    className?: string
}

export const DialogueBox: React.FC<DialogueBoxProps> = ({ speaker, portrait, text, choices, onChoice, onAdvance, typingSpeed = 60, style, className }) => {
    const [shown, setShown] = React.useState('')
    const fullText = typeof text === 'string' ? text : ''
    const isString = typeof text === 'string'
    const done = !isString || shown.length >= fullText.length

    React.useEffect(() => {
        if (!isString || typingSpeed <= 0) {
            setShown(fullText)
            return
        }
        setShown('')
        let index = 0
        const interval = window.setInterval(() => {
            index++
            setShown(fullText.slice(0, index))
            if (index >= fullText.length) window.clearInterval(interval)
        }, 1000 / typingSpeed)
        return () => window.clearInterval(interval)
    }, [fullText, isString, typingSpeed])

    return (
        <div className={className} style={{ display: 'flex', gap: 12, background: 'rgba(8,10,14,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: 14, color: '#e6e8ec', maxWidth: 720, ...style }}>
            {portrait && <div style={{ width: 80, height: 80, flexShrink: 0, borderRadius: 4, overflow: 'hidden', background: 'rgba(0,0,0,0.4)' }}>{portrait}</div>}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {speaker && <div style={{ color: '#ffd35a', fontWeight: 600, marginBottom: 4 }}>{speaker}</div>}
                <div onClick={() => { if (!done) setShown(fullText); else onAdvance?.() }} style={{ flex: 1, fontSize: 15, lineHeight: 1.5, cursor: 'pointer' }}>
                    {isString ? shown : text}
                </div>
                {done && choices && choices.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
                        {choices.map((choice) => (
                            <button key={choice.id} type="button" disabled={choice.disabled} onClick={() => onChoice?.(choice.id)} style={{ textAlign: 'left', padding: '6px 10px', background: 'transparent', color: '#6aa9ff', border: 'none', cursor: choice.disabled ? 'not-allowed' : 'pointer', borderLeft: '2px solid transparent', opacity: choice.disabled ? 0.5 : 1 }} onMouseEnter={(event) => { event.currentTarget.style.borderLeftColor = '#6aa9ff' }} onMouseLeave={(event) => { event.currentTarget.style.borderLeftColor = 'transparent' }}>
                                {choice.icon}{choice.icon ? ' ' : ''}{choice.label}
                            </button>
                        ))}
                    </div>
                )}
                {done && onAdvance && !choices?.length && <div style={{ alignSelf: 'flex-end', fontSize: 12, opacity: 0.5, marginTop: 6 }}>▼ Continue</div>}
            </div>
        </div>
    )
}
