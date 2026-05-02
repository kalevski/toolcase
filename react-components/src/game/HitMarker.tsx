import React from 'react'

export interface HitMarkerProps {
    show: boolean
    crit?: boolean
    kill?: boolean
    size?: number
    duration?: number
    onDone?: () => void
    style?: React.CSSProperties
}

export const HitMarker: React.FC<HitMarkerProps> = ({ show, crit = false, kill = false, size = 16, duration = 200, onDone, style }) => {
    const [opacity, setOpacity] = React.useState(0)
    React.useEffect(() => {
        if (!show) return
        setOpacity(1)
        const id = window.setTimeout(() => { setOpacity(0); onDone?.() }, duration)
        return () => window.clearTimeout(id)
    }, [show, duration, onDone])

    const color = kill ? '#d23a3a' : crit ? '#ffd35a' : '#fff'
    const lineStyle: React.CSSProperties = { position: 'absolute', background: color, boxShadow: '0 0 4px rgba(0,0,0,0.6)' }
    return (
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', opacity, transition: `opacity ${duration}ms`, pointerEvents: 'none', ...style }}>
            {[45, -45, 135, -135].map((angle) => (
                <div key={angle} style={{ ...lineStyle, width: size * 0.5, height: 2, transform: `rotate(${angle}deg) translateX(${size * 0.5}px)`, transformOrigin: '0 0' }} />
            ))}
        </div>
    )
}
