import React from 'react'

export interface RadialOption {
    id: string
    icon?: React.ReactNode
    label?: string
    color?: string
    disabled?: boolean
}

export interface RadialWheelProps {
    options: RadialOption[]
    open: boolean
    onSelect?: (id: string) => void
    onClose?: () => void
    radius?: number
    centerLabel?: React.ReactNode
    /** Pixel size of each option button. */
    optionSize?: number
    style?: React.CSSProperties
    className?: string
}

export const RadialWheel: React.FC<RadialWheelProps> = ({ options, open, onSelect, onClose, radius = 110, centerLabel, optionSize = 56, style, className }) => {
    const [hoverIndex, setHoverIndex] = React.useState<number | null>(null)
    React.useEffect(() => {
        if (!open) return
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose?.()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    if (!open) return null
    const diameter = (radius + optionSize) * 2
    return (
        <div className={className} style={{ position: 'fixed', inset: 0, zIndex: 9300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', ...style }} onClick={onClose}>
            <div style={{ position: 'relative', width: diameter, height: diameter }} onClick={(event) => event.stopPropagation()}>
                <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', color: '#e6e8ec', fontSize: 14, opacity: 0.7, textAlign: 'center' }}>
                    {hoverIndex !== null ? options[hoverIndex].label : centerLabel}
                </div>
                {options.map((option, i) => {
                    const angle = (i / options.length) * Math.PI * 2 - Math.PI / 2
                    const x = Math.cos(angle) * radius
                    const y = Math.sin(angle) * radius
                    const hovered = hoverIndex === i
                    return (
                        <button
                            key={option.id}
                            type="button"
                            disabled={option.disabled}
                            onMouseEnter={() => setHoverIndex(i)}
                            onMouseLeave={() => setHoverIndex(null)}
                            onClick={() => { if (!option.disabled) { onSelect?.(option.id); onClose?.() } }}
                            style={{
                                position: 'absolute',
                                left: `calc(50% + ${x}px - ${optionSize / 2}px)`,
                                top: `calc(50% + ${y}px - ${optionSize / 2}px)`,
                                width: optionSize,
                                height: optionSize,
                                borderRadius: '50%',
                                background: hovered ? (option.color ?? '#6aa9ff') : 'rgba(15,18,24,0.85)',
                                color: hovered ? '#fff' : (option.color ?? '#e6e8ec'),
                                border: `2px solid ${option.color ?? 'rgba(255,255,255,0.2)'}`,
                                cursor: option.disabled ? 'not-allowed' : 'pointer',
                                fontSize: optionSize * 0.4,
                                opacity: option.disabled ? 0.4 : 1,
                                transition: 'background 100ms, color 100ms',
                            }}
                        >
                            {option.icon}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

export const EmoteWheel = RadialWheel
export const PingWheel = RadialWheel
export const CommandWheel = RadialWheel
