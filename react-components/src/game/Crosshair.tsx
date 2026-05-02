import React from 'react'

export type CrosshairStyle = 'cross' | 'dot' | 'circle' | 'tShape' | 'classic'

export interface CrosshairProps {
    variant?: CrosshairStyle
    size?: number
    thickness?: number
    gap?: number
    color?: string
    outline?: string
    /** Spread (recoil) opens up the crosshair. */
    spread?: number
    style?: React.CSSProperties
    className?: string
}

export const Crosshair: React.FC<CrosshairProps> = ({ variant = 'classic', size = 16, thickness = 2, gap = 4, color = '#fff', outline = 'rgba(0,0,0,0.6)', spread = 0, style, className }) => {
    const arm = size
    const off = gap + spread
    const lineStyle: React.CSSProperties = { position: 'absolute', background: color, boxShadow: `0 0 0 1px ${outline}` }
    return (
        <div className={className} style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, pointerEvents: 'none', ...style }}>
            {variant === 'dot' && <div style={{ ...lineStyle, width: thickness * 2, height: thickness * 2, borderRadius: '50%', transform: 'translate(-50%, -50%)' }} />}
            {(variant === 'cross' || variant === 'classic' || variant === 'tShape') && <>
                <div style={{ ...lineStyle, width: thickness, height: arm, transform: `translate(-50%, calc(-100% - ${off}px))` }} />
                <div style={{ ...lineStyle, width: thickness, height: arm, transform: `translate(-50%, ${off}px)`, display: variant === 'tShape' ? 'none' : 'block' }} />
                <div style={{ ...lineStyle, width: arm, height: thickness, transform: `translate(calc(-100% - ${off}px), -50%)` }} />
                <div style={{ ...lineStyle, width: arm, height: thickness, transform: `translate(${off}px, -50%)` }} />
                {variant === 'classic' && <div style={{ ...lineStyle, width: thickness, height: thickness, borderRadius: '50%', transform: 'translate(-50%, -50%)' }} />}
            </>}
            {variant === 'circle' && <div style={{ position: 'absolute', width: size * 2, height: size * 2, borderRadius: '50%', border: `${thickness}px solid ${color}`, boxShadow: `0 0 0 1px ${outline}`, transform: 'translate(-50%, -50%)' }} />}
        </div>
    )
}
