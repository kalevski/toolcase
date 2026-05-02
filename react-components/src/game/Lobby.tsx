import React from 'react'

export interface LobbyPlayer {
    id: string
    name: React.ReactNode
    avatar?: React.ReactNode
    ready?: boolean
    host?: boolean
    team?: number | string
    rank?: React.ReactNode
}

export interface LobbyProps {
    players: LobbyPlayer[]
    capacity: number
    map?: React.ReactNode
    mode?: React.ReactNode
    chat?: React.ReactNode
    onReady?: () => void
    onLeave?: () => void
    onStart?: () => void
    canStart?: boolean
    isReady?: boolean
    style?: React.CSSProperties
    className?: string
}

export const Lobby: React.FC<LobbyProps> = ({ players, capacity, map, mode, chat, onReady, onLeave, onStart, canStart, isReady, style, className }) => {
    const slots = Array.from({ length: capacity }, (_, i) => players[i] ?? null)
    return (
        <div className={className} style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gridTemplateRows: 'auto 1fr auto', gap: 12, padding: 16, height: '100%', color: '#e6e8ec', background: '#0a0c10', ...style }}>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(15,18,24,0.7)', borderRadius: 4 }}>
                <div><strong>Mode:</strong> {mode}</div>
                <div><strong>Map:</strong> {map}</div>
                <div>{players.length} / {capacity}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, alignContent: 'flex-start' }}>
                {slots.map((player, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'rgba(15,18,24,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, minHeight: 56 }}>
                        {player ? (
                            <>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{player.avatar}</div>
                                <div style={{ flex: 1 }}>
                                    <div>{player.host && <span title="Host" style={{ color: '#ffd35a', marginRight: 4 }}>★</span>}{player.name}</div>
                                    {player.rank && <div style={{ fontSize: 11, opacity: 0.6 }}>{player.rank}</div>}
                                </div>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: player.ready ? '#3aa256' : 'rgba(255,255,255,0.2)' }} />
                            </>
                        ) : <span style={{ opacity: 0.4 }}>Open slot...</span>}
                    </div>
                ))}
            </div>
            <div style={{ background: 'rgba(15,18,24,0.7)', borderRadius: 4, overflow: 'hidden' }}>{chat}</div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <button type="button" onClick={onLeave} style={{ padding: '8px 14px', background: 'transparent', color: '#e6e8ec', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, cursor: 'pointer' }}>Leave</button>
                <div style={{ display: 'flex', gap: 8 }}>
                    {onReady && <button type="button" onClick={onReady} style={{ padding: '8px 14px', background: isReady ? '#3aa256' : 'rgba(15,18,24,0.7)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, cursor: 'pointer' }}>{isReady ? 'Ready' : 'Not Ready'}</button>}
                    {onStart && <button type="button" onClick={onStart} disabled={!canStart} style={{ padding: '8px 14px', background: canStart ? '#6aa9ff' : 'rgba(15,18,24,0.5)', color: '#fff', border: 'none', borderRadius: 4, cursor: canStart ? 'pointer' : 'not-allowed' }}>Start</button>}
                </div>
            </div>
        </div>
    )
}
