import React from 'react'

export interface LoadingScreenProps {
    progress?: number
    label?: React.ReactNode
    /** Strings or nodes to rotate. */
    tips?: React.ReactNode[]
    /** Tip rotation interval in ms. */
    tipInterval?: number
    art?: React.ReactNode
    title?: React.ReactNode
    style?: React.CSSProperties
    className?: string
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ progress, label = 'Loading...', tips, tipInterval = 5000, art, title, style, className }) => {
    const [tipIndex, setTipIndex] = React.useState(0)
    React.useEffect(() => {
        if (!tips || tips.length === 0) return
        const id = window.setInterval(() => setTipIndex((i) => (i + 1) % tips.length), tipInterval)
        return () => window.clearInterval(id)
    }, [tips, tipInterval])
    const pct = progress === undefined ? null : Math.max(0, Math.min(1, progress))
    return (
        <div className={className} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 480, background: '#0a0c10', color: '#e6e8ec', overflow: 'hidden', ...style }}>
            {art && <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>{art}</div>}
            <div style={{ position: 'absolute', left: 24, right: 24, bottom: 24, zIndex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {title && <div style={{ fontSize: 28, fontWeight: 700 }}>{title}</div>}
                {tips && tips.length > 0 && <div style={{ fontSize: 14, opacity: 0.7, fontStyle: 'italic' }}>💡 {tips[tipIndex]}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.6 }}><span>{label}</span>{pct !== null && <span>{Math.round(pct * 100)}%</span>}</div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: pct !== null ? `${pct * 100}%` : '30%', height: '100%', background: '#6aa9ff', transition: 'width 200ms', animation: pct === null ? 'ls-indet 1.4s ease-in-out infinite' : undefined }} />
                </div>
                <style>{`@keyframes ls-indet { 0% { transform: translateX(-100%); } 100% { transform: translateX(333%); } }`}</style>
            </div>
        </div>
    )
}
