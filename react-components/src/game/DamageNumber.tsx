import React from 'react'

export interface DamageNumberProps {
    value: number | string
    crit?: boolean
    heal?: boolean
    miss?: boolean
    /** Spawn position relative to parent (px). */
    x?: number
    y?: number
    /** Lifetime in ms. */
    duration?: number
    onDone?: () => void
    style?: React.CSSProperties
    className?: string
}

export const DamageNumber: React.FC<DamageNumberProps> = ({ value, crit = false, heal = false, miss = false, x = 0, y = 0, duration = 900, onDone, style, className }) => {
    const [phase, setPhase] = React.useState(0)
    React.useEffect(() => {
        const start = performance.now()
        let raf = 0
        const tick = (now: number) => {
            const elapsed = now - start
            const t = Math.min(1, elapsed / duration)
            setPhase(t)
            if (t < 1) raf = requestAnimationFrame(tick)
            else onDone?.()
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [duration, onDone])

    const color = miss ? '#a0a4ad' : crit ? '#ffd35a' : heal ? '#3aa256' : '#ff5a5a'
    const fontSize = crit ? 28 : 20
    const ty = -60 * phase
    const opacity = phase < 0.7 ? 1 : 1 - (phase - 0.7) / 0.3

    return (
        <div className={className} style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, calc(-100% + ${ty}px))`, color, fontSize, fontWeight: 700, opacity, textShadow: '0 2px 4px rgba(0,0,0,0.8)', pointerEvents: 'none', fontFamily: 'system-ui, sans-serif', ...style }}>
            {miss ? 'Miss' : value}
        </div>
    )
}
