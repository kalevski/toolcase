import React from 'react'

export interface MinimapMarker {
    id: string
    x: number
    y: number
    color?: string
    icon?: React.ReactNode
    rotation?: number
    size?: number
}

export interface MinimapProps {
    /** World extents (x, y, width, height). Markers map into this rect. */
    worldX?: number
    worldY?: number
    worldWidth: number
    worldHeight: number
    markers?: MinimapMarker[]
    background?: string
    backgroundImage?: string
    /** Optional fog-of-war overlay; values 0..1 in row-major. */
    fog?: { width: number, height: number, data: number[] | Uint8Array }
    size?: number
    rotation?: number
    style?: React.CSSProperties
    className?: string
}

export const Minimap: React.FC<MinimapProps> = ({ worldX = 0, worldY = 0, worldWidth, worldHeight, markers = [], background = '#0d1014', backgroundImage, fog, size = 200, rotation = 0, style, className }) => {
    return (
        <div className={className} style={{ position: 'relative', width: size, height: size, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.2)', background, ...style }}>
            <div style={{ position: 'absolute', inset: 0, transform: `rotate(${rotation}deg)`, transformOrigin: 'center', backgroundImage: backgroundImage ? `url("${backgroundImage}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                {fog && (
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${fog.width}, 1fr)`, gridTemplateRows: `repeat(${fog.height}, 1fr)` }}>
                        {Array.from(fog.data).map((value, i) => (
                            <div key={i} style={{ background: `rgba(0,0,0,${1 - value})` }} />
                        ))}
                    </div>
                )}
                {markers.map((marker) => {
                    const px = ((marker.x - worldX) / worldWidth) * size
                    const py = ((marker.y - worldY) / worldHeight) * size
                    const ms = marker.size ?? 6
                    return (
                        <div key={marker.id} style={{ position: 'absolute', left: px - ms / 2, top: py - ms / 2, width: ms, height: ms, borderRadius: '50%', background: marker.color ?? '#fff', transform: marker.rotation !== undefined ? `rotate(${marker.rotation}deg)` : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: ms }}>
                            {marker.icon}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
