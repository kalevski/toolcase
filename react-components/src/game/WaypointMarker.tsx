import React from 'react'

export interface WaypointMarkerProps {
    /** Screen-space position in CSS pixels relative to parent. */
    x: number
    y: number
    /** Optional distance label, e.g. "120m". */
    distance?: string
    label?: React.ReactNode
    color?: string
    icon?: React.ReactNode
    /** When true, marker is rendered at edge with arrow if off-screen. */
    clamp?: boolean
    bounds?: { width: number, height: number }
    size?: number
    style?: React.CSSProperties
    className?: string
}

export const WaypointMarker: React.FC<WaypointMarkerProps> = ({ x, y, distance, label, color = '#6aa9ff', icon = '◆', clamp = false, bounds, size = 28, style, className }) => {
    let cx = x, cy = y, atEdge = false, edgeAngle = 0
    if (clamp && bounds) {
        const margin = size
        if (x < margin || x > bounds.width - margin || y < margin || y > bounds.height - margin) {
            atEdge = true
            const cxC = bounds.width / 2
            const cyC = bounds.height / 2
            const dx = x - cxC, dy = y - cyC
            edgeAngle = Math.atan2(dy, dx) * 180 / Math.PI
            const halfW = bounds.width / 2 - margin
            const halfH = bounds.height / 2 - margin
            const scaleX = halfW / Math.abs(dx)
            const scaleY = halfH / Math.abs(dy)
            const scale = Math.min(scaleX, scaleY)
            cx = cxC + dx * scale
            cy = cyC + dy * scale
        }
    }
    return (
        <div className={className} style={{ position: 'absolute', left: cx, top: cy, transform: 'translate(-50%, -50%)', color, display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', ...style }}>
            <div style={{ fontSize: size, transform: atEdge ? `rotate(${edgeAngle + 90}deg)` : undefined, lineHeight: 1, textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}>{atEdge ? '▲' : icon}</div>
            {label && <div style={{ fontSize: 11, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{label}</div>}
            {distance && <div style={{ fontSize: 10, opacity: 0.8 }}>{distance}</div>}
        </div>
    )
}
