import React from 'react'

export interface SkillSlot {
    id: string
    icon?: React.ReactNode
    hotkey?: string
    /** 0..1 — 1 = ready, 0 = just used. */
    cooldown?: number
    /** Remaining cooldown seconds for label. */
    remaining?: number
    charges?: number
    disabled?: boolean
    onActivate?: () => void
    selected?: boolean
}

export interface SkillBarProps {
    slots: SkillSlot[]
    slotSize?: number
    gap?: number
    style?: React.CSSProperties
    className?: string
}

export const SkillBar: React.FC<SkillBarProps> = ({ slots, slotSize = 56, gap = 4, style, className }) => {
    return (
        <div className={className} style={{ display: 'flex', gap, ...style }}>
            {slots.map((slot) => {
                const cd = slot.cooldown ?? 1
                const onCooldown = cd < 1
                return (
                    <button
                        key={slot.id}
                        type="button"
                        disabled={slot.disabled || onCooldown}
                        onClick={() => slot.onActivate?.()}
                        style={{
                            position: 'relative',
                            width: slotSize,
                            height: slotSize,
                            background: 'rgba(15,18,24,0.7)',
                            border: `1px solid ${slot.selected ? '#6aa9ff' : 'rgba(255,255,255,0.15)'}`,
                            borderRadius: 4,
                            padding: 0,
                            cursor: slot.disabled ? 'not-allowed' : 'pointer',
                            color: '#e6e8ec',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: slot.disabled ? 0.4 : 1,
                            overflow: 'hidden',
                        }}
                    >
                        <div style={{ fontSize: slotSize * 0.5 }}>{slot.icon}</div>
                        {onCooldown && (
                            <div style={{ position: 'absolute', inset: 0, background: `conic-gradient(rgba(0,0,0,0.6) ${(1 - cd) * 360}deg, transparent 0deg)`, pointerEvents: 'none' }} />
                        )}
                        {onCooldown && slot.remaining !== undefined && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: slotSize * 0.32, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{slot.remaining.toFixed(slot.remaining < 10 ? 1 : 0)}</div>
                        )}
                        {slot.hotkey && <div style={{ position: 'absolute', top: 2, left: 4, fontSize: 10, opacity: 0.7 }}>{slot.hotkey}</div>}
                        {slot.charges !== undefined && slot.charges > 0 && (
                            <div style={{ position: 'absolute', bottom: 2, right: 4, fontSize: 11, fontWeight: 700, color: '#ffd35a' }}>{slot.charges}</div>
                        )}
                    </button>
                )
            })}
        </div>
    )
}

export const Hotbar = SkillBar
export const ActionBar = SkillBar
