import React from 'react'

export interface ResourceBarProps {
    value: number
    max: number
    /** Optional ghost value for damage delay effect. */
    ghost?: number
    color?: string
    ghostColor?: string
    background?: string
    height?: number
    width?: number | string
    segments?: number
    showText?: boolean
    label?: React.ReactNode
    style?: React.CSSProperties
    className?: string
}

const renderBar = ({ value, max, ghost, color, ghostColor, background, height, width, segments, showText, label, style, className }: ResourceBarProps) => {
    const pct = Math.max(0, Math.min(1, value / max))
    const ghostPct = ghost === undefined ? null : Math.max(0, Math.min(1, ghost / max))
    return (
        <div className={className} style={{ width, ...style }}>
            {label && <div style={{ marginBottom: 4, fontSize: 11, color: '#e6e8ec', display: 'flex', justifyContent: 'space-between' }}>
                <span>{label}</span>{showText && <span>{Math.round(value)} / {max}</span>}
            </div>}
            <div style={{ position: 'relative', width: '100%', height, background, borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.4)' }}>
                {ghostPct !== null && ghostPct > pct && (
                    <div style={{ position: 'absolute', left: `${pct * 100}%`, top: 0, bottom: 0, width: `${(ghostPct - pct) * 100}%`, background: ghostColor, transition: 'left 400ms ease-out, width 400ms ease-out' }} />
                )}
                <div style={{ width: `${pct * 100}%`, height: '100%', background: color, transition: 'width 150ms ease-out' }} />
                {segments && segments > 1 && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
                        {Array.from({ length: segments - 1 }).map((_, i) => (
                            <div key={i} style={{ flex: 1, borderRight: '1px solid rgba(0,0,0,0.4)' }} />
                        ))}
                        <div style={{ flex: 1 }} />
                    </div>
                )}
            </div>
        </div>
    )
}

export const HealthBar: React.FC<ResourceBarProps> = (props) => renderBar({
    color: '#3aa256',
    ghostColor: '#d23a3a',
    background: '#1a1c20',
    height: 10,
    width: 200,
    ...props,
})

export const ManaBar: React.FC<ResourceBarProps> = (props) => renderBar({
    color: '#3a72d2',
    ghostColor: '#88a4d8',
    background: '#1a1c20',
    height: 8,
    width: 200,
    ...props,
})

export const StaminaBar: React.FC<ResourceBarProps> = (props) => renderBar({
    color: '#d2b73a',
    ghostColor: '#88a4d8',
    background: '#1a1c20',
    height: 6,
    width: 200,
    ...props,
})
