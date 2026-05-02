import React from 'react'

export interface CompassRoseProps {
    heading: number
    size?: number
    style?: React.CSSProperties
    className?: string
}

export const CompassRose: React.FC<CompassRoseProps> = ({ heading, size = 64, style, className }) => {
    return (
        <div className={className} style={{ position: 'relative', width: size, height: size, color: '#e6e8ec', ...style }}>
            <svg viewBox="0 0 100 100" width={size} height={size}>
                <circle cx="50" cy="50" r="46" fill="rgba(15,18,24,0.7)" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
                <g style={{ transform: `rotate(${-heading}deg)`, transformOrigin: 'center', transition: 'transform 150ms' }}>
                    <polygon points="50,12 56,50 50,46 44,50" fill="#d23a3a" />
                    <polygon points="50,88 56,50 50,54 44,50" fill="#fff" />
                    <text x="50" y="22" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">N</text>
                    <text x="50" y="84" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.6)">S</text>
                    <text x="84" y="53" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.6)">E</text>
                    <text x="16" y="53" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.6)">W</text>
                </g>
            </svg>
        </div>
    )
}
