import React from 'react'

export interface ScreenFlashProps {
    color?: string
    opacity?: number
    duration?: number
    /** Set true once to trigger; reset to false after onDone. */
    trigger?: boolean
    onDone?: () => void
    style?: React.CSSProperties
}

export const ScreenFlash: React.FC<ScreenFlashProps> = ({ color = '#ff5a5a', opacity = 0.4, duration = 250, trigger, onDone, style }) => {
    const [active, setActive] = React.useState(false)
    React.useEffect(() => {
        if (!trigger) return
        setActive(true)
        const id = window.setTimeout(() => { setActive(false); onDone?.() }, duration)
        return () => window.clearTimeout(id)
    }, [trigger, duration, onDone])
    return <div aria-hidden style={{ position: 'fixed', inset: 0, background: color, pointerEvents: 'none', opacity: active ? opacity : 0, transition: `opacity ${duration}ms ease-out`, zIndex: 9500, ...style }} />
}

export interface VignetteOverlayProps {
    intensity?: number
    color?: string
    /** Modulates intensity by a factor based on health, e.g. 1 - health/maxHealth. */
    style?: React.CSSProperties
}

export const VignetteOverlay: React.FC<VignetteOverlayProps> = ({ intensity = 0.4, color = '#d23a3a', style }) => (
    <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse at center, transparent 30%, ${color} 120%)`, opacity: Math.max(0, Math.min(1, intensity)), zIndex: 9400, transition: 'opacity 200ms', ...style }} />
)

export interface BlurOverlayProps {
    blur?: number
    background?: string
    children?: React.ReactNode
    style?: React.CSSProperties
}

export const BlurOverlay: React.FC<BlurOverlayProps> = ({ blur = 8, background = 'rgba(0,0,0,0.3)', children, style }) => (
    <div style={{ position: 'fixed', inset: 0, background, backdropFilter: `blur(${blur}px)`, WebkitBackdropFilter: `blur(${blur}px)`, zIndex: 9300, ...style }}>{children}</div>
)

export interface LetterboxBarsProps {
    show: boolean
    barHeight?: string | number
    color?: string
    duration?: number
}

export const LetterboxBars: React.FC<LetterboxBarsProps> = ({ show, barHeight = '12%', color = '#000', duration = 600 }) => (
    <>
        <div aria-hidden style={{ position: 'fixed', top: 0, left: 0, right: 0, height: barHeight, background: color, transform: show ? 'translateY(0)' : 'translateY(-100%)', transition: `transform ${duration}ms ease-in-out`, zIndex: 9500, pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: barHeight, background: color, transform: show ? 'translateY(0)' : 'translateY(100%)', transition: `transform ${duration}ms ease-in-out`, zIndex: 9500, pointerEvents: 'none' }} />
    </>
)

export interface ShakeContainerProps {
    children?: React.ReactNode
    /** When trigger increments, container shakes once. */
    trigger?: number
    intensity?: number
    duration?: number
    style?: React.CSSProperties
    className?: string
}

export const ShakeContainer: React.FC<ShakeContainerProps> = ({ children, trigger = 0, intensity = 6, duration = 250, style, className }) => {
    const ref = React.useRef<HTMLDivElement>(null)
    React.useEffect(() => {
        if (trigger === 0) return
        const node = ref.current
        if (!node) return
        const start = performance.now()
        let raf = 0
        const tick = (now: number) => {
            const elapsed = now - start
            const t = Math.min(1, elapsed / duration)
            if (t >= 1) { node.style.transform = 'translate(0,0)'; return }
            const fall = 1 - t
            const dx = (Math.random() - 0.5) * 2 * intensity * fall
            const dy = (Math.random() - 0.5) * 2 * intensity * fall
            node.style.transform = `translate(${dx}px, ${dy}px)`
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [trigger, intensity, duration])
    return <div ref={ref} className={className} style={{ display: 'inline-block', ...style }}>{children}</div>
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string }

export interface ParticleEmitterProps {
    /** Increment to spawn a burst. */
    burst?: number
    count?: number
    color?: string | string[]
    size?: number
    speed?: number
    lifetime?: number
    gravity?: number
    width?: number
    height?: number
    style?: React.CSSProperties
    className?: string
}

export const ParticleEmitter: React.FC<ParticleEmitterProps> = ({ burst = 0, count = 24, color = '#ffd35a', size = 4, speed = 120, lifetime = 800, gravity = 200, width = 200, height = 200, style, className }) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null)
    const particlesRef = React.useRef<Particle[]>([])
    const colors = Array.isArray(color) ? color : [color]

    React.useEffect(() => {
        if (burst === 0) return
        const cx = width / 2, cy = height / 2
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2
            const v = speed * (0.6 + Math.random() * 0.4)
            particlesRef.current.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * v,
                vy: Math.sin(angle) * v,
                life: 0,
                max: lifetime / 1000,
                size: size * (0.6 + Math.random() * 0.8),
                color: colors[Math.floor(Math.random() * colors.length)],
            })
        }
    }, [burst, count, speed, lifetime, size, width, height, colors])

    React.useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        let raf = 0
        let last = performance.now()
        const tick = (now: number) => {
            const delta = (now - last) / 1000
            last = now
            ctx.clearRect(0, 0, width, height)
            const next: Particle[] = []
            for (const p of particlesRef.current) {
                p.life += delta
                if (p.life >= p.max) continue
                p.vy += gravity * delta
                p.x += p.vx * delta
                p.y += p.vy * delta
                const alpha = 1 - p.life / p.max
                ctx.fillStyle = p.color
                ctx.globalAlpha = alpha
                ctx.beginPath()
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
                ctx.fill()
                next.push(p)
            }
            ctx.globalAlpha = 1
            particlesRef.current = next
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [width, height, gravity])

    return <canvas ref={canvasRef} width={width} height={height} className={className} style={{ pointerEvents: 'none', ...style }} />
}

export interface TransitionWipeProps {
    show: boolean
    direction?: 'fade' | 'left' | 'right' | 'up' | 'down' | 'iris'
    duration?: number
    color?: string
    onComplete?: () => void
}

export const TransitionWipe: React.FC<TransitionWipeProps> = ({ show, direction = 'fade', duration = 600, color = '#000', onComplete }) => {
    React.useEffect(() => {
        if (!show) return
        const id = window.setTimeout(() => onComplete?.(), duration)
        return () => window.clearTimeout(id)
    }, [show, duration, onComplete])

    const transforms: Record<string, React.CSSProperties> = {
        fade: { opacity: show ? 1 : 0, transition: `opacity ${duration}ms` },
        left: { transform: `translateX(${show ? '0' : '-100%'})`, transition: `transform ${duration}ms ease-in-out` },
        right: { transform: `translateX(${show ? '0' : '100%'})`, transition: `transform ${duration}ms ease-in-out` },
        up: { transform: `translateY(${show ? '0' : '-100%'})`, transition: `transform ${duration}ms ease-in-out` },
        down: { transform: `translateY(${show ? '0' : '100%'})`, transition: `transform ${duration}ms ease-in-out` },
        iris: { clipPath: `circle(${show ? '0%' : '150%'} at 50% 50%)`, transition: `clip-path ${duration}ms ease-in-out` },
    }
    return <div aria-hidden style={{ position: 'fixed', inset: 0, background: color, zIndex: 9600, pointerEvents: show ? 'auto' : 'none', ...transforms[direction] }} />
}

export const Fade: React.FC<Omit<TransitionWipeProps, 'direction'>> = (props) => <TransitionWipe {...props} direction="fade" />
