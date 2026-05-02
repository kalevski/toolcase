import React from 'react'

export interface NetworkStatusIconProps {
    /** Round-trip time ms. */
    ping?: number
    /** Packet loss 0..1. */
    loss?: number
    connected?: boolean
    size?: number
    showLabel?: boolean
    style?: React.CSSProperties
    className?: string
}

export const NetworkStatusIcon: React.FC<NetworkStatusIconProps> = ({ ping, loss = 0, connected = true, size = 16, showLabel = false, style, className }) => {
    const bars = !connected ? 0 : ping === undefined ? 4 : ping < 60 ? 4 : ping < 120 ? 3 : ping < 200 ? 2 : 1
    const color = !connected ? '#d23a3a' : loss > 0.05 ? '#d2b73a' : ping !== undefined && ping > 200 ? '#d2b73a' : '#3aa256'
    return (
        <span className={className} title={!connected ? 'Disconnected' : `${ping ?? '?'}ms${loss > 0 ? ` · ${Math.round(loss * 100)}% loss` : ''}`} style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 1, color, ...style }}>
            {[0, 1, 2, 3].map((i) => <span key={i} style={{ width: size / 5, height: size * (0.3 + i * 0.2), background: i < bars ? color : 'rgba(255,255,255,0.15)', borderRadius: 1 }} />)}
            {showLabel && ping !== undefined && <span style={{ marginLeft: 4, fontSize: size * 0.7, fontFamily: 'monospace' }}>{ping}ms</span>}
        </span>
    )
}

export interface PingDisplayProps {
    ping?: number
    style?: React.CSSProperties
    className?: string
}

export const PingDisplay: React.FC<PingDisplayProps> = ({ ping, style, className }) => {
    const color = ping === undefined ? '#5a5f68' : ping < 60 ? '#3aa256' : ping < 200 ? '#d2b73a' : '#d23a3a'
    return <span className={className} style={{ color, fontFamily: 'monospace', fontSize: 12, ...style }}>{ping === undefined ? '—ms' : `${ping}ms`}</span>
}

export type GamePlatform = 'pc' | 'ps' | 'xbox' | 'switch' | 'mobile' | 'web' | 'mac' | 'linux'

const platformGlyph: Record<GamePlatform, string> = {
    pc: '🖥', ps: '🎮', xbox: '🎮', switch: '🎮', mobile: '📱', web: '🌐', mac: '', linux: '🐧',
}

export interface PlatformIconProps {
    platform: GamePlatform
    size?: number
    label?: boolean
    style?: React.CSSProperties
    className?: string
}

export const PlatformIcon: React.FC<PlatformIconProps> = ({ platform, size = 16, label = false, style, className }) => (
    <span className={className} title={platform.toUpperCase()} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: size, ...style }}>
        {platformGlyph[platform] || '🕹'}
        {label && <span style={{ fontSize: size * 0.65, textTransform: 'uppercase', letterSpacing: 0.5 }}>{platform}</span>}
    </span>
)

export interface VersionLabelProps {
    version: React.ReactNode
    build?: React.ReactNode
    branch?: React.ReactNode
    style?: React.CSSProperties
    className?: string
}

export const VersionLabel: React.FC<VersionLabelProps> = ({ version, build, branch, style, className }) => (
    <div className={className} style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.5)', ...style }}>
        v{version}{build && ` (${build})`}{branch && ` · ${branch}`}
    </div>
)

export interface DebugOverlayProps {
    fps?: number
    drawCalls?: number
    triangles?: number
    memMb?: number
    customRows?: Array<{ label: React.ReactNode, value: React.ReactNode }>
    style?: React.CSSProperties
    className?: string
}

export const DebugOverlay: React.FC<DebugOverlayProps> = ({ fps, drawCalls, triangles, memMb, customRows, style, className }) => {
    const fpsColor = fps === undefined ? '#fff' : fps >= 55 ? '#3aa256' : fps >= 30 ? '#d2b73a' : '#d23a3a'
    const rows: Array<{ label: React.ReactNode, value: React.ReactNode, color?: string }> = []
    if (fps !== undefined) rows.push({ label: 'FPS', value: fps.toFixed(0), color: fpsColor })
    if (drawCalls !== undefined) rows.push({ label: 'Draw calls', value: drawCalls })
    if (triangles !== undefined) rows.push({ label: 'Triangles', value: triangles.toLocaleString() })
    if (memMb !== undefined) rows.push({ label: 'Memory', value: `${memMb.toFixed(1)} MB` })
    if (customRows) rows.push(...customRows)
    return (
        <div className={className} style={{ padding: 6, background: 'rgba(0,0,0,0.7)', color: '#fff', fontFamily: 'monospace', fontSize: 11, borderRadius: 3, minWidth: 140, lineHeight: 1.4, ...style }}>
            {rows.map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: row.color }}>
                    <span style={{ opacity: 0.7 }}>{row.label}</span>
                    <span>{row.value}</span>
                </div>
            ))}
        </div>
    )
}
