import React from 'react'

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline' | 'in-game'

const presenceColor: Record<PresenceStatus, string> = {
    online: '#3aa256',
    away: '#d2b73a',
    busy: '#d23a3a',
    offline: '#5a5f68',
    'in-game': '#6aa9ff',
}

export interface Friend {
    id: string
    name: React.ReactNode
    avatar?: React.ReactNode
    status?: PresenceStatus
    activity?: React.ReactNode
    rank?: React.ReactNode
}

export interface FriendsListProps {
    friends: Friend[]
    onInvite?: (id: string) => void
    onMessage?: (id: string) => void
    onProfile?: (id: string) => void
    title?: React.ReactNode
    style?: React.CSSProperties
    className?: string
}

export const FriendsList: React.FC<FriendsListProps> = ({ friends, onInvite, onMessage, onProfile, title = 'Friends', style, className }) => {
    const sorted = [...friends].sort((a, b) => {
        const order: PresenceStatus[] = ['in-game', 'online', 'away', 'busy', 'offline']
        return order.indexOf(a.status ?? 'offline') - order.indexOf(b.status ?? 'offline')
    })
    return (
        <div className={className} style={{ minWidth: 280, color: '#e6e8ec', ...style }}>
            <div style={{ padding: '8px 10px', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{title} ({friends.filter((friend) => friend.status !== 'offline').length}/{friends.length})</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {sorted.map((friend) => {
                    const status = friend.status ?? 'offline'
                    return (
                        <li key={friend.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', opacity: status === 'offline' ? 0.6 : 1, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ position: 'relative', width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {friend.avatar}
                                <div style={{ position: 'absolute', right: -1, bottom: -1, width: 10, height: 10, borderRadius: '50%', background: presenceColor[status], border: '2px solid #0a0c10' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{friend.name}{friend.rank && <span style={{ fontSize: 10, opacity: 0.6 }}>· {friend.rank}</span>}</div>
                                <div style={{ fontSize: 11, opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{friend.activity ?? status}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                                {onInvite && <button type="button" onClick={() => onInvite(friend.id)} title="Invite" style={{ background: 'transparent', border: 'none', color: '#6aa9ff', cursor: 'pointer', fontSize: 14 }}>＋</button>}
                                {onMessage && <button type="button" onClick={() => onMessage(friend.id)} title="Message" style={{ background: 'transparent', border: 'none', color: '#e6e8ec', cursor: 'pointer', fontSize: 14 }}>💬</button>}
                                {onProfile && <button type="button" onClick={() => onProfile(friend.id)} title="Profile" style={{ background: 'transparent', border: 'none', color: '#e6e8ec', cursor: 'pointer', fontSize: 14 }}>ⓘ</button>}
                            </div>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

export interface PartyMember {
    id: string
    name: React.ReactNode
    avatar?: React.ReactNode
    ready?: boolean
    leader?: boolean
    role?: React.ReactNode
}

export interface PartyPanelProps {
    members: PartyMember[]
    capacity: number
    onInvite?: () => void
    onKick?: (id: string) => void
    onLeave?: () => void
    style?: React.CSSProperties
    className?: string
}

export const PartyPanel: React.FC<PartyPanelProps> = ({ members, capacity, onInvite, onKick, onLeave, style, className }) => {
    const slots = Array.from({ length: capacity }, (_, i) => members[i] ?? null)
    return (
        <div className={className} style={{ padding: 10, background: 'rgba(15,18,24,0.7)', borderRadius: 4, color: '#e6e8ec', minWidth: 220, ...style }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong>Party {members.length}/{capacity}</strong>
                {onLeave && <button type="button" onClick={onLeave} style={{ background: 'transparent', color: '#d23a3a', border: 'none', cursor: 'pointer', fontSize: 11 }}>Leave</button>}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {slots.map((member, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, background: 'rgba(0,0,0,0.3)', borderRadius: 3 }}>
                        {member ? (
                            <>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{member.avatar}</div>
                                <div style={{ flex: 1, fontSize: 13 }}>
                                    {member.leader && <span title="Leader" style={{ color: '#ffd35a', marginRight: 4 }}>★</span>}
                                    {member.name}
                                    {member.role && <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 6 }}>{member.role}</span>}
                                </div>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: member.ready ? '#3aa256' : 'rgba(255,255,255,0.2)' }} />
                                {onKick && !member.leader && <button type="button" onClick={() => onKick(member.id)} title="Kick" style={{ background: 'transparent', border: 'none', color: '#d23a3a', cursor: 'pointer', fontSize: 10 }}>✕</button>}
                            </>
                        ) : (
                            <button type="button" onClick={onInvite} style={{ width: '100%', background: 'transparent', border: 'none', color: '#6aa9ff', cursor: 'pointer', textAlign: 'left', padding: 0, fontSize: 12 }}>+ Invite friend</button>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export interface GuildMember {
    id: string
    name: React.ReactNode
    rank?: React.ReactNode
    online?: boolean
    contribution?: number
    note?: React.ReactNode
}

export interface GuildPanelProps {
    name: React.ReactNode
    tag?: React.ReactNode
    motto?: React.ReactNode
    members: GuildMember[]
    level?: number
    memberCap?: number
    style?: React.CSSProperties
    className?: string
}

export const GuildPanel: React.FC<GuildPanelProps> = ({ name, tag, motto, members, level, memberCap, style, className }) => (
    <div className={className} style={{ color: '#e6e8ec', ...style }}>
        <div style={{ padding: 12, background: 'rgba(15,18,24,0.85)', borderRadius: 4, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <h2 style={{ margin: 0 }}>{tag && `[${tag}] `}{name}</h2>
                {level !== undefined && <span style={{ fontSize: 12, color: '#ffd35a' }}>Lv {level}</span>}
            </div>
            {motto && <div style={{ fontSize: 13, fontStyle: 'italic', opacity: 0.7, marginTop: 4 }}>{motto}</div>}
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>Members: {members.length}{memberCap ? ` / ${memberCap}` : ''}</div>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {members.map((member) => (
                <li key={member.id} style={{ display: 'flex', gap: 10, padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: member.online ? '#3aa256' : '#5a5f68', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{member.name}</span>
                    {member.rank && <span style={{ fontSize: 11, opacity: 0.7 }}>{member.rank}</span>}
                    {member.contribution !== undefined && <span style={{ fontSize: 11, color: '#ffd35a' }}>{member.contribution.toLocaleString()}</span>}
                </li>
            ))}
        </ul>
    </div>
)

export const ClanRoster = GuildPanel

export interface PlayerCardProps {
    name: React.ReactNode
    avatar?: React.ReactNode
    title?: React.ReactNode
    rank?: React.ReactNode
    level?: number
    stats?: Array<{ label: React.ReactNode, value: React.ReactNode }>
    actions?: Array<{ id: string, label: React.ReactNode, onClick?: () => void, danger?: boolean }>
    onlineStatus?: PresenceStatus
    style?: React.CSSProperties
    className?: string
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ name, avatar, title, rank, level, stats, actions, onlineStatus, style, className }) => (
    <div className={className} style={{ width: 280, padding: 14, background: 'rgba(15,18,24,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e6e8ec', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', ...style }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <div style={{ position: 'relative', width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                {avatar}
                {onlineStatus && <div style={{ position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, borderRadius: '50%', background: presenceColor[onlineStatus], border: '2px solid #0a0c10' }} />}
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{name}</div>
                {title && <div style={{ fontSize: 11, color: '#ffd35a' }}>{title}</div>}
                <div style={{ fontSize: 11, opacity: 0.7, display: 'flex', gap: 8 }}>
                    {level !== undefined && <span>Lv {level}</span>}
                    {rank && <span>{rank}</span>}
                </div>
            </div>
        </div>
        {stats && stats.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0', fontSize: 12 }}>
                {stats.map((stat, i) => <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}><span style={{ opacity: 0.7 }}>{stat.label}</span><span>{stat.value}</span></li>)}
            </ul>
        )}
        {actions && actions.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                {actions.map((action) => (
                    <button key={action.id} type="button" onClick={action.onClick} style={{ flex: 1, padding: '6px 10px', background: action.danger ? '#d23a3a' : 'rgba(106,169,255,0.15)', color: '#fff', border: `1px solid ${action.danger ? '#d23a3a' : '#6aa9ff'}`, borderRadius: 3, cursor: 'pointer', fontSize: 12 }}>{action.label}</button>
                ))}
            </div>
        )}
    </div>
)

export interface ReportPlayerDialogProps {
    open: boolean
    playerName?: React.ReactNode
    reasons?: Array<{ id: string, label: string }>
    onSubmit?: (reasonId: string, comment: string) => void
    onCancel?: () => void
}

export const ReportPlayerDialog: React.FC<ReportPlayerDialogProps> = ({ open, playerName, reasons = [
    { id: 'cheating', label: 'Cheating' },
    { id: 'harassment', label: 'Harassment' },
    { id: 'griefing', label: 'Griefing' },
    { id: 'inappropriate-name', label: 'Inappropriate name' },
    { id: 'other', label: 'Other' },
], onSubmit, onCancel }) => {
    const [reason, setReason] = React.useState(reasons[0]?.id ?? '')
    const [comment, setComment] = React.useState('')
    if (!open) return null
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 420, padding: 18, background: '#13161d', color: '#e6e8ec', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }}>
                <h3 style={{ margin: '0 0 4px' }}>Report Player</h3>
                {playerName && <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>{playerName}</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                    {reasons.map((entry) => (
                        <label key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                            <input type="radio" checked={reason === entry.id} onChange={() => setReason(entry.id)} /> {entry.label}
                        </label>
                    ))}
                </div>
                <textarea placeholder="Additional details (optional)" value={comment} onChange={(event) => setComment(event.target.value)} style={{ width: '100%', minHeight: 70, padding: 8, background: 'rgba(15,18,24,0.7)', color: '#e6e8ec', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                    <button type="button" onClick={onCancel} style={{ padding: '8px 14px', background: 'transparent', color: '#e6e8ec', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                    <button type="button" onClick={() => onSubmit?.(reason, comment)} style={{ padding: '8px 14px', background: '#d23a3a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Submit Report</button>
                </div>
            </div>
        </div>
    )
}

export interface MutedPlayer {
    id: string
    name: React.ReactNode
    mutedAt?: React.ReactNode
    reason?: React.ReactNode
}

export interface MuteListProps {
    players: MutedPlayer[]
    onUnmute?: (id: string) => void
    style?: React.CSSProperties
    className?: string
}

export const MuteList: React.FC<MuteListProps> = ({ players, onUnmute, style, className }) => (
    <ul className={className} style={{ listStyle: 'none', padding: 0, margin: 0, color: '#e6e8ec', ...style }}>
        {players.length === 0 && <li style={{ padding: 12, opacity: 0.6, textAlign: 'center' }}>No muted players</li>}
        {players.map((player) => (
            <li key={player.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ flex: 1 }}>{player.name}{player.reason && <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 6 }}>({player.reason})</span>}</span>
                {player.mutedAt && <span style={{ fontSize: 11, opacity: 0.5 }}>{player.mutedAt}</span>}
                {onUnmute && <button type="button" onClick={() => onUnmute(player.id)} style={{ padding: '4px 8px', background: 'transparent', color: '#6aa9ff', border: '1px solid #6aa9ff', borderRadius: 3, cursor: 'pointer', fontSize: 11 }}>Unmute</button>}
            </li>
        ))}
    </ul>
)

export interface InviteToastProps {
    open: boolean
    inviter?: React.ReactNode
    avatar?: React.ReactNode
    body?: React.ReactNode
    onAccept?: () => void
    onDecline?: () => void
    timeoutSeconds?: number
    style?: React.CSSProperties
    className?: string
}

export const InviteToast: React.FC<InviteToastProps> = ({ open, inviter, avatar, body = 'Invited you to a party', onAccept, onDecline, timeoutSeconds, style, className }) => {
    const [remaining, setRemaining] = React.useState(timeoutSeconds)
    React.useEffect(() => {
        if (!open || timeoutSeconds === undefined) return
        setRemaining(timeoutSeconds)
        const id = window.setInterval(() => setRemaining((value) => (value === undefined ? undefined : Math.max(0, value - 1))), 1000)
        return () => window.clearInterval(id)
    }, [open, timeoutSeconds])
    React.useEffect(() => {
        if (remaining === 0) onDecline?.()
    }, [remaining, onDecline])

    if (!open) return null
    return (
        <div className={className} style={{ width: 320, padding: 12, background: 'rgba(15,18,24,0.95)', border: '1px solid rgba(106,169,255,0.4)', borderRadius: 6, color: '#e6e8ec', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', ...style }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{avatar}</div>
                <div style={{ flex: 1 }}>
                    <strong>{inviter}</strong>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{body}</div>
                </div>
                {remaining !== undefined && <div style={{ fontSize: 11, opacity: 0.7 }}>{remaining}s</div>}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button type="button" onClick={onAccept} style={{ flex: 1, padding: '6px 10px', background: '#3aa256', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Accept</button>
                <button type="button" onClick={onDecline} style={{ flex: 1, padding: '6px 10px', background: 'transparent', color: '#e6e8ec', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 3, cursor: 'pointer', fontSize: 12 }}>Decline</button>
            </div>
        </div>
    )
}
