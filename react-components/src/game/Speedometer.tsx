import React from 'react'

export interface SpeedometerProps {
    value: number
    max: number
    /** Optional RPM gauge value (0..1). */
    rpm?: number
    unit?: string
    gear?: React.ReactNode
    size?: number
    color?: string
    danger?: number
    style?: React.CSSProperties
    className?: string
}

export const Speedometer: React.FC<SpeedometerProps> = ({ value, max, rpm, unit = 'mph', gear, size = 180, color = '#6aa9ff', danger = 0.85, style, className }) => {
    const pct = Math.max(0, Math.min(1, value / max))
    const rpmPct = rpm !== undefined ? Math.max(0, Math.min(1, rpm)) : null
    const angle = -135 + pct * 270
    const dangerHit = pct >= danger
    return (
        <div className={className} style={{ position: 'relative', width: size, height: size, color: '#e6e8ec', ...style }}>
            <svg viewBox="0 0 100 100" width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" strokeDasharray="212 360" transform="rotate(135 50 50)" />
                <circle cx="50" cy="50" r="45" fill="none" stroke={dangerHit ? '#d23a3a' : color} strokeWidth="6" strokeDasharray={`${pct * 212} 360`} transform="rotate(135 50 50)" strokeLinecap="round" style={{ transition: 'stroke-dasharray 100ms' }} />
                {rpmPct !== null && <circle cx="50" cy="50" r="36" fill="none" stroke="#ffd35a" strokeWidth="2" strokeDasharray={`${rpmPct * 169} 360`} transform="rotate(135 50 50)" />}
                <line x1="50" y1="50" x2="50" y2="20" stroke="#fff" strokeWidth="2" strokeLinecap="round" transform={`rotate(${angle} 50 50)`} style={{ transition: 'transform 150ms' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ fontSize: size * 0.22, fontWeight: 700, fontFamily: 'monospace' }}>{Math.round(value)}</div>
                <div style={{ fontSize: size * 0.07, opacity: 0.7 }}>{unit}</div>
                {gear && <div style={{ fontSize: size * 0.16, fontWeight: 700, color: '#ffd35a', marginTop: 4 }}>{gear}</div>}
            </div>
        </div>
    )
}

export const Tachometer = Speedometer
