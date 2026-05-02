import React from 'react'

export interface AmmoCounterProps {
    mag: number
    magMax?: number
    reserve?: number
    /** Optional alternate fire / launcher ammo. */
    secondary?: { value: number, max?: number, label?: string }
    weaponName?: React.ReactNode
    icon?: React.ReactNode
    reloading?: boolean
    style?: React.CSSProperties
    className?: string
}

export const AmmoCounter: React.FC<AmmoCounterProps> = ({ mag, magMax, reserve, secondary, weaponName, icon, reloading = false, style, className }) => {
    return (
        <div className={className} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', color: '#e6e8ec', textShadow: '0 2px 6px rgba(0,0,0,0.8)', fontFamily: 'system-ui, sans-serif', ...style }}>
            {weaponName && <div style={{ fontSize: 12, opacity: 0.7 }}>{weaponName}</div>}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                {icon}
                <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'monospace', color: reloading ? '#d2b73a' : (magMax !== undefined && mag <= magMax * 0.2 ? '#d23a3a' : '#fff') }}>
                    {reloading ? '...' : mag}
                </div>
                {magMax !== undefined && <div style={{ fontSize: 14, opacity: 0.5 }}>/ {magMax}</div>}
                {reserve !== undefined && <div style={{ fontSize: 18, opacity: 0.7, marginLeft: 4, fontFamily: 'monospace' }}>{reserve}</div>}
            </div>
            {secondary && <div style={{ fontSize: 11, opacity: 0.7 }}>{secondary.label ?? 'Alt'}: {secondary.value}{secondary.max !== undefined ? ` / ${secondary.max}` : ''}</div>}
        </div>
    )
}
