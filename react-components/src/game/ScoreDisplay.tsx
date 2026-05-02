import React from 'react'

export interface ScoreDisplayProps {
    score: number
    multiplier?: number
    label?: React.ReactNode
    align?: 'left' | 'right' | 'center'
    fontSize?: number
    style?: React.CSSProperties
    className?: string
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({ score, multiplier, label, align = 'right', fontSize = 28, style, className }) => {
    return (
        <div className={className} style={{ color: '#fff', textShadow: '0 2px 6px rgba(0,0,0,0.8)', textAlign: align, fontFamily: 'monospace', ...style }}>
            {label && <div style={{ fontSize: fontSize * 0.4, opacity: 0.7 }}>{label}</div>}
            <div style={{ fontSize, fontWeight: 700, lineHeight: 1 }}>{score.toLocaleString()}</div>
            {multiplier !== undefined && multiplier !== 1 && (
                <div style={{ fontSize: fontSize * 0.5, color: '#ffd35a', fontWeight: 600 }}>x{multiplier}</div>
            )}
        </div>
    )
}
