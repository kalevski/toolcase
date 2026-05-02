import React from 'react'

export interface BuffEntry {
    id: string
    icon?: React.ReactNode
    name?: string
    /** Remaining seconds. */
    remaining?: number
    /** Original duration; for ratio. */
    duration?: number
    stacks?: number
    debuff?: boolean
}

export interface BuffBarProps {
    buffs: BuffEntry[]
    iconSize?: number
    gap?: number
    debuffsBelow?: boolean
    style?: React.CSSProperties
    className?: string
}

const BuffIcon: React.FC<{ buff: BuffEntry, size: number }> = ({ buff, size }) => {
    const ratio = buff.duration && buff.remaining !== undefined ? Math.max(0, Math.min(1, buff.remaining / buff.duration)) : 1
    return (
        <div title={buff.name} style={{ position: 'relative', width: size, height: size, background: 'rgba(15,18,24,0.7)', border: `1px solid ${buff.debuff ? 'rgba(210,58,58,0.5)' : 'rgba(106,169,255,0.5)'}`, borderRadius: 4, color: '#e6e8ec', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <div style={{ fontSize: size * 0.55 }}>{buff.icon}</div>
            {ratio < 1 && <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, rgba(0,0,0,0.5) ${100 - ratio * 100}%, transparent ${100 - ratio * 100}%)` }} />}
            {buff.remaining !== undefined && buff.remaining < 60 && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, fontSize: 10, textAlign: 'center', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{Math.ceil(buff.remaining)}</div>}
            {buff.stacks !== undefined && buff.stacks > 1 && <div style={{ position: 'absolute', top: 1, right: 3, fontSize: 10, fontWeight: 700 }}>{buff.stacks}</div>}
        </div>
    )
}

export const BuffBar: React.FC<BuffBarProps> = ({ buffs, iconSize = 32, gap = 4, debuffsBelow = false, style, className }) => {
    if (debuffsBelow) {
        const positives = buffs.filter((buff) => !buff.debuff)
        const negatives = buffs.filter((buff) => buff.debuff)
        return (
            <div className={className} style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>
                <div style={{ display: 'flex', gap }}>{positives.map((buff) => <BuffIcon key={buff.id} buff={buff} size={iconSize} />)}</div>
                <div style={{ display: 'flex', gap }}>{negatives.map((buff) => <BuffIcon key={buff.id} buff={buff} size={iconSize} />)}</div>
            </div>
        )
    }
    return (
        <div className={className} style={{ display: 'flex', gap, ...style }}>
            {buffs.map((buff) => <BuffIcon key={buff.id} buff={buff} size={iconSize} />)}
        </div>
    )
}

export const DebuffBar: React.FC<BuffBarProps> = (props) => <BuffBar {...props} buffs={props.buffs.map((buff) => ({ ...buff, debuff: true }))} />
