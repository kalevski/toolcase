import React from 'react'

export type MatchmakingState = 'searching' | 'found' | 'connecting' | 'failed' | 'idle'

export interface MatchmakingScreenProps {
    state: MatchmakingState
    elapsedSeconds?: number
    estimatedSeconds?: number
    region?: React.ReactNode
    mode?: React.ReactNode
    foundLabel?: React.ReactNode
    onCancel?: () => void
    onAccept?: () => void
    style?: React.CSSProperties
    className?: string
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${String(s).padStart(2, '0')}`
}

export const MatchmakingScreen: React.FC<MatchmakingScreenProps> = ({ state, elapsedSeconds = 0, estimatedSeconds, region, mode, foundLabel = 'Match Found!', onCancel, onAccept, style, className }) => {
    return (
        <div className={className} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#e6e8ec', height: '100%', minHeight: 320, padding: 24, ...style }}>
            <div style={{ width: 80, height: 80, position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: state === 'found' ? '#3aa256' : '#6aa9ff', animation: state === 'searching' || state === 'connecting' ? 'mm-spin 1s linear infinite' : undefined }} />
                <style>{`@keyframes mm-spin { to { transform: rotate(360deg); } }`}</style>
            </div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>
                {state === 'searching' && 'Searching for match'}
                {state === 'connecting' && 'Connecting...'}
                {state === 'found' && foundLabel}
                {state === 'failed' && 'Matchmaking failed'}
                {state === 'idle' && 'Idle'}
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, opacity: 0.7 }}>
                {mode && <div>Mode: {mode}</div>}
                {region && <div>Region: {region}</div>}
                <div>Elapsed: {formatTime(elapsedSeconds)}</div>
                {estimatedSeconds !== undefined && <div>Est: {formatTime(estimatedSeconds)}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {state === 'found' && onAccept && <button type="button" onClick={onAccept} style={{ padding: '10px 18px', background: '#3aa256', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>Accept</button>}
                {onCancel && <button type="button" onClick={onCancel} style={{ padding: '10px 18px', background: 'transparent', color: '#e6e8ec', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>}
            </div>
        </div>
    )
}
