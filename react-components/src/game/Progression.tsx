import React from 'react'

export interface SkillNode {
    id: string
    x: number
    y: number
    label?: React.ReactNode
    icon?: React.ReactNode
    locked?: boolean
    unlocked?: boolean
    rank?: number
    maxRank?: number
    description?: React.ReactNode
}

export interface SkillEdge {
    from: string
    to: string
}

export interface SkillTreeProps {
    nodes: SkillNode[]
    edges: SkillEdge[]
    selectedId?: string
    onSelect?: (id: string) => void
    onUnlock?: (id: string) => void
    points?: number
    width?: number
    height?: number
    style?: React.CSSProperties
    className?: string
}

export const SkillTree: React.FC<SkillTreeProps> = ({ nodes, edges, selectedId, onSelect, onUnlock, points, width = 720, height = 480, style, className }) => {
    const map = React.useMemo(() => Object.fromEntries(nodes.map((node) => [node.id, node])), [nodes])
    const selected = nodes.find((node) => node.id === selectedId)
    return (
        <div className={className} style={{ position: 'relative', width, height, background: '#0d1014', overflow: 'auto', borderRadius: 6, color: '#e6e8ec', ...style }}>
            {points !== undefined && <div style={{ position: 'absolute', top: 8, right: 8, padding: '4px 10px', background: 'rgba(15,18,24,0.85)', borderRadius: 4, fontSize: 12, zIndex: 2 }}>Points: <strong>{points}</strong></div>}
            <svg width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {edges.map((edge, i) => {
                    const a = map[edge.from], b = map[edge.to]
                    if (!a || !b) return null
                    return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={a.unlocked && b.unlocked ? '#6aa9ff' : 'rgba(255,255,255,0.15)'} strokeWidth="2" />
                })}
            </svg>
            {nodes.map((node) => {
                const isSelected = node.id === selectedId
                const color = node.unlocked ? '#6aa9ff' : node.locked ? '#1a1c20' : '#3a3f47'
                return (
                    <button key={node.id} type="button" onClick={() => onSelect?.(node.id)} onDoubleClick={() => !node.locked && !node.unlocked && onUnlock?.(node.id)} style={{ position: 'absolute', left: node.x, top: node.y, transform: 'translate(-50%, -50%)', width: 48, height: 48, borderRadius: 6, background: color, color: '#fff', border: `2px solid ${isSelected ? '#ffd35a' : 'rgba(0,0,0,0.6)'}`, cursor: node.locked ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                        {node.icon}
                        {node.maxRank && node.rank !== undefined && <span style={{ position: 'absolute', bottom: -6, right: -6, padding: '1px 5px', background: '#0a0c10', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 10 }}>{node.rank}/{node.maxRank}</span>}
                    </button>
                )
            })}
            {selected && (
                <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, padding: 10, background: 'rgba(8,10,14,0.95)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)', zIndex: 2 }}>
                    <div style={{ fontWeight: 700 }}>{selected.label}</div>
                    {selected.description && <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{selected.description}</div>}
                    {!selected.unlocked && !selected.locked && onUnlock && <button type="button" onClick={() => onUnlock(selected.id)} style={{ marginTop: 6, padding: '4px 10px', background: '#6aa9ff', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12 }}>Unlock</button>}
                </div>
            )}
        </div>
    )
}

export const TalentTree = SkillTree

export interface AbilityCardProps {
    name: React.ReactNode
    icon?: React.ReactNode
    description?: React.ReactNode
    cooldown?: React.ReactNode
    cost?: React.ReactNode
    range?: React.ReactNode
    keybind?: React.ReactNode
    rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
    style?: React.CSSProperties
    className?: string
}

export const AbilityCard: React.FC<AbilityCardProps> = ({ name, icon, description, cooldown, cost, range, keybind, rarity, style, className }) => {
    const colors = { common: '#9aa3ad', uncommon: '#3aa256', rare: '#6aa9ff', epic: '#c93ad2', legendary: '#ffa83a' }
    const color = rarity ? colors[rarity] : '#6aa9ff'
    return (
        <div className={className} style={{ width: 280, padding: 14, background: 'rgba(15,18,24,0.85)', border: `1px solid ${color}`, borderRadius: 6, color: '#e6e8ec', ...style }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                <div style={{ width: 48, height: 48, background: 'rgba(0,0,0,0.4)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>{icon}</div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color }}>{name}</div>
                    {keybind && <div style={{ fontSize: 11, opacity: 0.6, fontFamily: 'monospace', marginTop: 2 }}>{keybind}</div>}
                </div>
            </div>
            {description && <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.4, marginBottom: 8 }}>{description}</div>}
            <div style={{ display: 'flex', gap: 12, fontSize: 11, opacity: 0.7, flexWrap: 'wrap' }}>
                {cost !== undefined && <span>Cost: <strong>{cost}</strong></span>}
                {cooldown !== undefined && <span>CD: <strong>{cooldown}</strong></span>}
                {range !== undefined && <span>Range: <strong>{range}</strong></span>}
            </div>
        </div>
    )
}

export interface Perk {
    id: string
    name: React.ReactNode
    description?: React.ReactNode
    icon?: React.ReactNode
    selected?: boolean
    locked?: boolean
}

export interface PerkPickerProps {
    perks: Perk[]
    onSelect?: (id: string) => void
    columns?: number
    style?: React.CSSProperties
    className?: string
}

export const PerkPicker: React.FC<PerkPickerProps> = ({ perks, onSelect, columns = 3, style, className }) => (
    <div className={className} style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 8, ...style }}>
        {perks.map((perk) => (
            <button key={perk.id} type="button" disabled={perk.locked} onClick={() => onSelect?.(perk.id)} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 12, background: perk.selected ? 'rgba(106,169,255,0.15)' : 'rgba(15,18,24,0.7)', color: '#e6e8ec', border: `1px solid ${perk.selected ? '#6aa9ff' : 'rgba(255,255,255,0.1)'}`, borderRadius: 6, cursor: perk.locked ? 'not-allowed' : 'pointer', textAlign: 'left', opacity: perk.locked ? 0.5 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 24 }}>{perk.icon}</span>
                    <strong>{perk.name}</strong>
                </div>
                {perk.description && <div style={{ fontSize: 12, opacity: 0.8 }}>{perk.description}</div>}
            </button>
        ))}
    </div>
)

export interface Achievement {
    id: string
    name: React.ReactNode
    description?: React.ReactNode
    icon?: React.ReactNode
    unlocked?: boolean
    progress?: number
    target?: number
    points?: number
    rarity?: number
    secret?: boolean
}

export interface AchievementListProps {
    achievements: Achievement[]
    style?: React.CSSProperties
    className?: string
}

export const AchievementList: React.FC<AchievementListProps> = ({ achievements, style, className }) => (
    <ul className={className} style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4, color: '#e6e8ec', ...style }}>
        {achievements.map((entry) => {
            const pct = entry.target && entry.progress !== undefined ? Math.min(1, entry.progress / entry.target) : entry.unlocked ? 1 : 0
            const hidden = entry.secret && !entry.unlocked
            return (
                <li key={entry.id} style={{ display: 'flex', gap: 10, padding: 10, background: 'rgba(15,18,24,0.7)', border: `1px solid ${entry.unlocked ? 'rgba(255,211,90,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 4, opacity: entry.unlocked ? 1 : 0.7 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 4, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: entry.unlocked ? '#ffd35a' : '#5a5f68' }}>{hidden ? '?' : entry.icon ?? '🏆'}</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{hidden ? 'Hidden' : entry.name}</div>
                        {!hidden && entry.description && <div style={{ fontSize: 12, opacity: 0.7 }}>{entry.description}</div>}
                        {entry.target !== undefined && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                                    <div style={{ width: `${pct * 100}%`, height: '100%', background: '#ffd35a', borderRadius: 2 }} />
                                </div>
                                <span style={{ fontSize: 11, opacity: 0.7 }}>{entry.progress ?? 0}/{entry.target}</span>
                            </div>
                        )}
                    </div>
                    {entry.points !== undefined && <div style={{ alignSelf: 'center', color: '#ffd35a', fontWeight: 700 }}>{entry.points}G</div>}
                </li>
            )
        })}
    </ul>
)

export interface StatsScreenStat {
    label: React.ReactNode
    value: React.ReactNode
    icon?: React.ReactNode
}

export interface StatsScreenSection {
    title: React.ReactNode
    stats: StatsScreenStat[]
}

export interface StatsScreenProps {
    sections: StatsScreenSection[]
    title?: React.ReactNode
    summary?: React.ReactNode
    chart?: React.ReactNode
    style?: React.CSSProperties
    className?: string
}

export const StatsScreen: React.FC<StatsScreenProps> = ({ sections, title, summary, chart, style, className }) => (
    <div className={className} style={{ color: '#e6e8ec', padding: 16, ...style }}>
        {title && <h2 style={{ margin: '0 0 4px' }}>{title}</h2>}
        {summary && <div style={{ opacity: 0.7, marginBottom: 16 }}>{summary}</div>}
        {chart && <div style={{ marginBottom: 16 }}>{chart}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sections.map((section, i) => (
                <div key={i}>
                    <div style={{ fontSize: 12, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{section.title}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6 }}>
                        {section.stats.map((stat, j) => (
                            <div key={j} style={{ padding: 8, background: 'rgba(15,18,24,0.7)', borderRadius: 4 }}>
                                <div style={{ fontSize: 11, opacity: 0.6, display: 'flex', alignItems: 'center', gap: 4 }}>{stat.icon}{stat.label}</div>
                                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{stat.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
)

export interface CodexEntry {
    id: string
    name: React.ReactNode
    icon?: React.ReactNode
    discovered?: boolean
    image?: React.ReactNode
    description?: React.ReactNode
    stats?: Array<{ label: React.ReactNode, value: React.ReactNode }>
    category?: string
}

export interface CodexProps {
    entries: CodexEntry[]
    selectedId?: string
    onSelect?: (id: string) => void
    style?: React.CSSProperties
    className?: string
}

export const Codex: React.FC<CodexProps> = ({ entries, selectedId, onSelect, style, className }) => {
    const [internal, setInternal] = React.useState(entries[0]?.id)
    const activeId = selectedId ?? internal
    const active = entries.find((entry) => entry.id === activeId)
    return (
        <div className={className} style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 12, color: '#e6e8ec', height: '100%', ...style }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, alignContent: 'flex-start', overflowY: 'auto' }}>
                {entries.map((entry) => (
                    <button key={entry.id} type="button" onClick={() => { setInternal(entry.id); onSelect?.(entry.id) }} title={entry.discovered ? String(entry.name) : 'Unknown'} style={{ aspectRatio: '1', background: 'rgba(15,18,24,0.7)', border: `2px solid ${entry.id === activeId ? '#6aa9ff' : 'rgba(255,255,255,0.08)'}`, borderRadius: 4, padding: 0, cursor: 'pointer', color: entry.discovered ? '#e6e8ec' : '#5a5f68', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                        {entry.discovered ? entry.icon : '?'}
                    </button>
                ))}
            </div>
            {active && (
                <div style={{ padding: 16, background: 'rgba(15,18,24,0.5)', borderRadius: 4, overflowY: 'auto' }}>
                    <h3 style={{ margin: '0 0 8px' }}>{active.discovered ? active.name : 'Unknown'}</h3>
                    {active.image && <div style={{ marginBottom: 12 }}>{active.image}</div>}
                    {active.discovered ? (
                        <>
                            {active.description && <p style={{ fontSize: 13, lineHeight: 1.5 }}>{active.description}</p>}
                            {active.stats && active.stats.length > 0 && (
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12 }}>
                                    {active.stats.map((stat, i) => <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}><span style={{ opacity: 0.7 }}>{stat.label}</span><span>{stat.value}</span></li>)}
                                </ul>
                            )}
                        </>
                    ) : <p style={{ opacity: 0.5 }}>You have not yet discovered this entry.</p>}
                </div>
            )}
        </div>
    )
}

export const Bestiary = Codex

export interface JournalEntry {
    id: string
    title: React.ReactNode
    description?: React.ReactNode
    body?: React.ReactNode
    objectives?: Array<{ text: React.ReactNode, completed?: boolean }>
    state?: 'active' | 'completed' | 'failed'
    rewards?: React.ReactNode
}

export interface JournalProps {
    entries: JournalEntry[]
    selectedId?: string
    onSelect?: (id: string) => void
    style?: React.CSSProperties
    className?: string
}

export const Journal: React.FC<JournalProps> = ({ entries, selectedId, onSelect, style, className }) => {
    const [internal, setInternal] = React.useState(entries[0]?.id)
    const activeId = selectedId ?? internal
    const active = entries.find((entry) => entry.id === activeId)
    return (
        <div className={className} style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 12, color: '#e6e8ec', height: '100%', ...style }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {entries.map((entry) => (
                    <li key={entry.id}>
                        <button type="button" onClick={() => { setInternal(entry.id); onSelect?.(entry.id) }} style={{ width: '100%', textAlign: 'left', padding: 10, background: entry.id === activeId ? 'rgba(255,255,255,0.08)' : 'transparent', color: '#e6e8ec', border: 'none', borderLeft: `2px solid ${entry.id === activeId ? '#ffd35a' : 'transparent'}`, cursor: 'pointer' }}>
                            <div style={{ fontWeight: 600 }}>{entry.title}</div>
                            <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase' }}>{entry.state ?? 'active'}</div>
                        </button>
                    </li>
                ))}
            </ul>
            {active && (
                <div style={{ padding: 16, overflowY: 'auto' }}>
                    <h2 style={{ margin: '0 0 4px' }}>{active.title}</h2>
                    {active.description && <p style={{ opacity: 0.8 }}>{active.description}</p>}
                    {active.objectives && active.objectives.length > 0 && (
                        <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0' }}>
                            {active.objectives.map((objective, i) => (
                                <li key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', textDecoration: objective.completed ? 'line-through' : undefined, opacity: objective.completed ? 0.5 : 1 }}>
                                    <span style={{ width: 10, height: 10, border: `1px solid ${objective.completed ? '#3aa256' : 'rgba(255,255,255,0.4)'}`, background: objective.completed ? '#3aa256' : 'transparent', borderRadius: 2 }} /> {objective.text}
                                </li>
                            ))}
                        </ul>
                    )}
                    {active.body && <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>{active.body}</div>}
                    {active.rewards && <div style={{ marginTop: 16, padding: 8, background: 'rgba(255,211,90,0.1)', border: '1px solid rgba(255,211,90,0.3)', borderRadius: 4 }}>Rewards: {active.rewards}</div>}
                </div>
            )}
        </div>
    )
}

export const QuestLog = Journal

export interface BattlePassTier {
    level: number
    xpRequired: number
    free?: { icon: React.ReactNode, label?: React.ReactNode, claimed?: boolean }
    premium?: { icon: React.ReactNode, label?: React.ReactNode, claimed?: boolean, locked?: boolean }
}

export interface BattlePassProps {
    tiers: BattlePassTier[]
    currentLevel: number
    currentXp: number
    seasonName?: React.ReactNode
    seasonEnd?: React.ReactNode
    hasPremium?: boolean
    onClaim?: (level: number, track: 'free' | 'premium') => void
    style?: React.CSSProperties
    className?: string
}

export const BattlePass: React.FC<BattlePassProps> = ({ tiers, currentLevel, currentXp, seasonName, seasonEnd, hasPremium, onClaim, style, className }) => {
    const currentTier = tiers.find((tier) => tier.level === currentLevel)
    const xpPct = currentTier ? Math.min(1, currentXp / currentTier.xpRequired) : 0
    return (
        <div className={className} style={{ color: '#e6e8ec', padding: 12, ...style }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                    <h2 style={{ margin: 0 }}>{seasonName ?? 'Battle Pass'}</h2>
                    {seasonEnd && <div style={{ fontSize: 12, opacity: 0.6 }}>Ends: {seasonEnd}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 28, fontWeight: 700 }}>{currentLevel}</div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>{currentXp.toLocaleString()} / {currentTier?.xpRequired.toLocaleString() ?? '—'} XP</div>
                </div>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginBottom: 12 }}>
                <div style={{ width: `${xpPct * 100}%`, height: '100%', background: '#ffd35a', borderRadius: 2 }} />
            </div>
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 8 }}>
                {tiers.map((tier) => {
                    const reached = tier.level <= currentLevel
                    return (
                        <div key={tier.level} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 80, opacity: reached ? 1 : 0.6 }}>
                            <div style={{ textAlign: 'center', fontSize: 11, opacity: 0.7 }}>Lv {tier.level}</div>
                            {tier.premium && (
                                <button type="button" disabled={!hasPremium || !reached || tier.premium.claimed} onClick={() => onClaim?.(tier.level, 'premium')} style={{ padding: 8, background: 'rgba(255,168,58,0.15)', border: `1px solid ${tier.premium.claimed ? '#3aa256' : 'rgba(255,168,58,0.5)'}`, borderRadius: 4, color: '#e6e8ec', cursor: hasPremium && reached && !tier.premium.claimed ? 'pointer' : 'default' }}>
                                    <div style={{ fontSize: 24 }}>{tier.premium.icon}</div>
                                    {tier.premium.label && <div style={{ fontSize: 10, marginTop: 2 }}>{tier.premium.label}</div>}
                                    {tier.premium.claimed && <div style={{ fontSize: 9, color: '#3aa256' }}>Claimed</div>}
                                </button>
                            )}
                            {tier.free && (
                                <button type="button" disabled={!reached || tier.free.claimed} onClick={() => onClaim?.(tier.level, 'free')} style={{ padding: 8, background: 'rgba(106,169,255,0.1)', border: `1px solid ${tier.free.claimed ? '#3aa256' : 'rgba(106,169,255,0.4)'}`, borderRadius: 4, color: '#e6e8ec', cursor: reached && !tier.free.claimed ? 'pointer' : 'default' }}>
                                    <div style={{ fontSize: 24 }}>{tier.free.icon}</div>
                                    {tier.free.label && <div style={{ fontSize: 10, marginTop: 2 }}>{tier.free.label}</div>}
                                    {tier.free.claimed && <div style={{ fontSize: 9, color: '#3aa256' }}>Claimed</div>}
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export const SeasonProgress = BattlePass
