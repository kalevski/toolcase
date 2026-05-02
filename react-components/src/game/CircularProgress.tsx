import React from 'react'

export interface CircularProgressProps {
    value: number
    max?: number
    size?: number
    thickness?: number
    color?: string
    background?: string
    showText?: boolean
    /** Counter-clockwise; true is good for cooldowns running out. */
    reverse?: boolean
    children?: React.ReactNode
    style?: React.CSSProperties
    className?: string
}

export const CircularProgress: React.FC<CircularProgressProps> = ({ value, max = 1, size = 48, thickness = 4, color = '#6aa9ff', background = 'rgba(255,255,255,0.1)', showText = false, reverse = false, children, style, className }) => {
    const pct = Math.max(0, Math.min(1, value / max))
    const radius = (size - thickness) / 2
    const circumference = 2 * Math.PI * radius
    const offset = reverse ? circumference * pct : circumference * (1 - pct)
    return (
        <div className={className} style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}>
            <svg width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={background} strokeWidth={thickness} />
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={thickness} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 150ms' }} />
            </svg>
            <div style={{ position: 'relative', color: '#e6e8ec', fontSize: size * 0.28, fontWeight: 600 }}>
                {children ?? (showText ? `${Math.round(pct * 100)}%` : null)}
            </div>
        </div>
    )
}

export const RadialBar = CircularProgress
