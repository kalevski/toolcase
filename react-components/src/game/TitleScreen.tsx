import React from 'react'

export interface TitleScreenProps {
    title: React.ReactNode
    subtitle?: React.ReactNode
    backdrop?: React.ReactNode
    children?: React.ReactNode
    footer?: React.ReactNode
    style?: React.CSSProperties
    className?: string
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ title, subtitle, backdrop, children, footer, style, className }) => {
    return (
        <div className={className} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0c10', color: '#fff', overflow: 'hidden', ...style }}>
            {backdrop && <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>{backdrop}</div>}
            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <h1 style={{ fontSize: 80, margin: 0, letterSpacing: 6, textShadow: '0 6px 30px rgba(0,0,0,0.8)' }}>{title}</h1>
                {subtitle && <div style={{ fontSize: 18, opacity: 0.8, letterSpacing: 2 }}>{subtitle}</div>}
                {children}
            </div>
            {footer && <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, fontSize: 11, opacity: 0.5, display: 'flex', justifyContent: 'space-between', zIndex: 1 }}>{footer}</div>}
        </div>
    )
}
