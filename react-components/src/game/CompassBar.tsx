import React from 'react'

export interface CompassMarker {
    id: string
    /** Heading in degrees, 0..360 (0 = North). */
    heading: number
    icon?: React.ReactNode
    color?: string
    label?: string
}

export interface CompassBarProps {
    /** Camera/player heading in degrees. */
    heading: number
    /** Field of view shown by the bar in degrees. */
    fov?: number
    markers?: CompassMarker[]
    width?: number | string
    height?: number
    style?: React.CSSProperties
    className?: string
    showCardinals?: boolean
}

const cardinals: { heading: number, label: string }[] = [
    { heading: 0, label: 'N' },
    { heading: 45, label: 'NE' },
    { heading: 90, label: 'E' },
    { heading: 135, label: 'SE' },
    { heading: 180, label: 'S' },
    { heading: 225, label: 'SW' },
    { heading: 270, label: 'W' },
    { heading: 315, label: 'NW' },
]

function relativeAngle(target: number, source: number): number {
    let diff = ((target - source + 540) % 360) - 180
    return diff
}

export const CompassBar: React.FC<CompassBarProps> = ({ heading, fov = 120, markers = [], width = 360, height = 28, style, className, showCardinals = true }) => {
    const halfFov = fov / 2
    return (
        <div className={className} style={{ position: 'relative', width, height, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden', color: '#e6e8ec', fontSize: 12, ...style }}>
            {showCardinals && cardinals.map((cardinal) => {
                const rel = relativeAngle(cardinal.heading, heading)
                if (Math.abs(rel) > halfFov) return null
                const left = ((rel + halfFov) / fov) * 100
                return <div key={cardinal.label} style={{ position: 'absolute', left: `${left}%`, top: 0, bottom: 0, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.85, fontWeight: 600 }}>{cardinal.label}</div>
            })}
            {markers.map((marker) => {
                const rel = relativeAngle(marker.heading, heading)
                if (Math.abs(rel) > halfFov) return null
                const left = ((rel + halfFov) / fov) * 100
                return <div key={marker.id} title={marker.label} style={{ position: 'absolute', left: `${left}%`, top: 0, bottom: 0, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', color: marker.color ?? '#6aa9ff' }}>{marker.icon ?? '▼'}</div>
            })}
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,0.6)', transform: 'translateX(-50%)' }} />
        </div>
    )
}
