import React from 'react'

export interface ComboCounterProps {
    combo: number
    maxRecent?: number
    label?: React.ReactNode
    /** 0..1 — remaining time. */
    timer?: number
    fontSize?: number
    style?: React.CSSProperties
    className?: string
}

export const ComboCounter: React.FC<ComboCounterProps> = ({ combo, label = 'Combo', timer, fontSize = 36, style, className }) => {
    const [pulse, setPulse] = React.useState(0)
    React.useEffect(() => {
        setPulse((value) => value + 1)
    }, [combo])
    if (combo <= 1) return null
    return (
        <div className={className} style={{ color: '#ffd35a', textShadow: '0 2px 8px rgba(0,0,0,0.8)', fontFamily: 'system-ui, sans-serif', textAlign: 'right', ...style }}>
            <div style={{ fontSize: fontSize * 0.4, opacity: 0.8 }}>{label}</div>
            <div key={pulse} style={{ fontSize, fontWeight: 800, lineHeight: 1, animation: 'comboPop 240ms ease-out' }}>{combo}<span style={{ fontSize: fontSize * 0.6 }}>x</span></div>
            {timer !== undefined && (
                <div style={{ width: 80, height: 3, background: 'rgba(0,0,0,0.4)', marginLeft: 'auto', marginTop: 4 }}>
                    <div style={{ width: `${Math.max(0, Math.min(1, timer)) * 100}%`, height: '100%', background: '#ffd35a', transition: 'width 100ms linear' }} />
                </div>
            )}
            <style>{`@keyframes comboPop { 0% { transform: scale(1.4); } 100% { transform: scale(1); } }`}</style>
        </div>
    )
}
