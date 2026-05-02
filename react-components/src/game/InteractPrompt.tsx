import React from 'react'

export interface InteractPromptProps {
    show: boolean
    keyLabel?: React.ReactNode
    text: React.ReactNode
    /** Hold progress 0..1 if interaction requires holding. */
    holdProgress?: number
    style?: React.CSSProperties
    className?: string
}

export const InteractPrompt: React.FC<InteractPromptProps> = ({ show, keyLabel = 'E', text, holdProgress, style, className }) => {
    if (!show) return null
    return (
        <div className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '6px 12px', borderRadius: 4, textShadow: '0 1px 2px rgba(0,0,0,0.8)', ...style }}>
            <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, height: 28, padding: '0 6px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 4, fontFamily: 'monospace', fontWeight: 700, overflow: 'hidden' }}>
                {holdProgress !== undefined && <span style={{ position: 'absolute', inset: 0, background: '#6aa9ff', width: `${holdProgress * 100}%`, opacity: 0.4 }} />}
                <span style={{ position: 'relative' }}>{keyLabel}</span>
            </span>
            <span>{text}</span>
        </div>
    )
}
