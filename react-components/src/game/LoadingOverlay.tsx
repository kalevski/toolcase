import React from 'react'

export interface LoadingOverlayProps {
    open: boolean
    progress?: number
    label?: React.ReactNode
    tip?: React.ReactNode
    backdrop?: React.ReactNode
    style?: React.CSSProperties
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ open, progress, label = 'Loading...', tip, backdrop, style }) => {
    if (!open) return null
    const pct = progress === undefined ? null : Math.max(0, Math.min(1, progress))
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9200, color: '#e6e8ec', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0c10', ...style }}>
            {backdrop && <div style={{ position: 'absolute', inset: 0 }}>{backdrop}</div>}
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, minWidth: 320 }}>
                <div style={{ fontSize: 18, opacity: 0.8 }}>{label}</div>
                {pct !== null && (
                    <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${pct * 100}%`, height: '100%', background: '#6aa9ff', transition: 'width 200ms' }} />
                    </div>
                )}
                {tip && <div style={{ fontSize: 12, opacity: 0.5, marginTop: 12, textAlign: 'center' }}>{tip}</div>}
            </div>
        </div>
    )
}
