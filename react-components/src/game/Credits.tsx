import React from 'react'

export interface CreditsSection {
    role: React.ReactNode
    names: React.ReactNode[]
}

export interface CreditsScrollProps {
    sections: CreditsSection[]
    /** Pixels per second. */
    speed?: number
    autoStart?: boolean
    onComplete?: () => void
    title?: React.ReactNode
    style?: React.CSSProperties
    className?: string
}

export const CreditsScroll: React.FC<CreditsScrollProps> = ({ sections, speed = 60, autoStart = true, onComplete, title, style, className }) => {
    const containerRef = React.useRef<HTMLDivElement>(null)
    const contentRef = React.useRef<HTMLDivElement>(null)
    const [running, setRunning] = React.useState(autoStart)
    const yRef = React.useRef(0)

    React.useEffect(() => {
        if (!running) return
        let raf = 0
        let last = performance.now()
        const tick = (now: number) => {
            const delta = (now - last) / 1000
            last = now
            yRef.current += speed * delta
            const container = containerRef.current
            const content = contentRef.current
            if (container && content) {
                const max = content.scrollHeight + container.clientHeight
                if (yRef.current >= max) { setRunning(false); onComplete?.(); return }
                container.scrollTop = yRef.current
            }
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [running, speed, onComplete])

    return (
        <div ref={containerRef} className={className} onClick={() => setRunning((value) => !value)} style={{ height: '100%', minHeight: 320, overflow: 'hidden', background: '#0a0c10', color: '#e6e8ec', textAlign: 'center', cursor: 'pointer', ...style }}>
            <div ref={contentRef} style={{ paddingTop: '100%', paddingBottom: '100%', display: 'flex', flexDirection: 'column', gap: 32 }}>
                {title && <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: 4 }}>{title}</div>}
                {sections.map((section, i) => (
                    <div key={i}>
                        <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 2, opacity: 0.6, marginBottom: 8 }}>{section.role}</div>
                        {section.names.map((name, j) => <div key={j} style={{ fontSize: 22, fontWeight: 600 }}>{name}</div>)}
                    </div>
                ))}
            </div>
        </div>
    )
}

export interface CreditsListProps {
    sections: CreditsSection[]
    style?: React.CSSProperties
    className?: string
}

export const CreditsList: React.FC<CreditsListProps> = ({ sections, style, className }) => {
    return (
        <div className={className} style={{ color: '#e6e8ec', display: 'flex', flexDirection: 'column', gap: 24, padding: 24, ...style }}>
            {sections.map((section, i) => (
                <div key={i}>
                    <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, opacity: 0.6, marginBottom: 6 }}>{section.role}</div>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {section.names.map((name, j) => <li key={j} style={{ fontSize: 16 }}>{name}</li>)}
                    </ul>
                </div>
            ))}
        </div>
    )
}
