import React from 'react'

export interface ObjectiveMarkerProps {
    x: number
    y: number
    label?: React.ReactNode
    distance?: string
    pulse?: boolean
    color?: string
    size?: number
    style?: React.CSSProperties
    className?: string
}

export const ObjectiveMarker: React.FC<ObjectiveMarkerProps> = ({ x, y, label, distance, pulse = true, color = '#ffd35a', size = 32, style, className }) => {
    return (
        <div className={className} style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', ...style }}>
            <div style={{ fontSize: size, color, lineHeight: 1, animation: pulse ? 'objMarkerPulse 1.6s infinite' : undefined, textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>◆</div>
            {label && <div style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '2px 6px', borderRadius: 3, fontSize: 11, marginTop: 2 }}>{label}</div>}
            {distance && <div style={{ fontSize: 10, color: '#fff', marginTop: 2, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{distance}</div>}
            <style>{`@keyframes objMarkerPulse { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }`}</style>
        </div>
    )
}
