import type { FC, ReactNode, CSSProperties } from 'react'
import './jsx.d'

const GC_BG = '#0a0c10'
const GC_BG2 = 'rgba(255,255,255,0.03)'
const GC_BORDER = 'rgba(255,255,255,0.08)'
const GC_FG = '#e6e8ec'
const GC_MUTED = 'rgba(230,232,236,0.55)'

export interface GcPageProps {
    category?: string
    title: string
    lede?: ReactNode
    children?: ReactNode
}

export const GcPage: FC<GcPageProps> = ({ category, title, lede, children }) => (
    <div style={{ background: GC_BG, minHeight: '100vh', padding: '40px 32px 80px', fontFamily: 'system-ui, -apple-system, sans-serif', color: GC_FG }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <header style={{ paddingBottom: 24, marginBottom: 32, borderBottom: `1px solid ${GC_BORDER}` }}>
                {category && (
                    <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem', fontWeight: 600, color: GC_MUTED, display: 'block', marginBottom: 6 }}>
                        {category}
                    </span>
                )}
                <h1 style={{ margin: 0, fontSize: 'clamp(1.6rem,3vw,2.1rem)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{title}</h1>
                {lede && <p style={{ margin: '8px 0 0', color: GC_MUTED, fontSize: '0.95rem', lineHeight: 1.55, maxWidth: '65ch' }}>{lede}</p>}
            </header>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>{children}</div>
        </div>
    </div>
)

export interface GcSectionProps {
    title?: ReactNode
    caption?: ReactNode
    children: ReactNode
    flush?: boolean
    dark?: boolean
}

export const GcSection: FC<GcSectionProps> = ({ title, caption, children, flush, dark }) => (
    <section style={{ background: dark ? 'rgba(0,0,0,0.3)' : GC_BG2, border: `1px solid ${GC_BORDER}`, borderRadius: 6 }}>
        {title && (
            <div style={{ padding: '14px 20px 12px', borderBottom: `1px solid ${GC_BORDER}` }}>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: GC_FG }}>{title}</div>
                {caption && <div style={{ marginTop: 4, fontSize: '0.8rem', color: GC_MUTED, lineHeight: 1.45 }}>{caption}</div>}
            </div>
        )}
        <div style={flush ? {} : { padding: 20 }}>{children}</div>
    </section>
)

export interface GcRowProps {
    label?: string
    children: ReactNode
    style?: CSSProperties
}

export const GcRow: FC<GcRowProps> = ({ label, children, style }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, paddingBottom: 14, marginBottom: 14, borderBottom: `1px dashed ${GC_BORDER}`, ...style }}>
        {label && (
            <div style={{ minWidth: 130, flexShrink: 0, fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: GC_MUTED, paddingTop: 4 }}>
                {label}
            </div>
        )}
        <div style={{ flex: 1 }}>{children}</div>
    </div>
)

export const GcGrid: FC<{ columns?: number; gap?: number; children: ReactNode }> = ({ columns = 2, gap = 16, children }) => (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, gap }}>{children}</div>
)
