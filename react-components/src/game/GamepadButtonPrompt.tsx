import React from 'react'

export type GamepadGlyph =
    | 'A' | 'B' | 'X' | 'Y'
    | 'cross' | 'circle' | 'square' | 'triangle'
    | 'L1' | 'L2' | 'L3' | 'R1' | 'R2' | 'R3'
    | 'LB' | 'LT' | 'LS' | 'RB' | 'RT' | 'RS'
    | 'dpad-up' | 'dpad-down' | 'dpad-left' | 'dpad-right'
    | 'start' | 'select' | 'menu' | 'view' | 'home'

export type GamepadStyle = 'xbox' | 'playstation' | 'nintendo' | 'generic'

export interface GamepadButtonPromptProps {
    glyph: GamepadGlyph
    label?: string
    layout?: GamepadStyle
    size?: number
    style?: React.CSSProperties
    className?: string
}

const symbolMap: Record<GamepadGlyph, { icon: string, color: string }> = {
    A: { icon: 'A', color: '#3aa256' },
    B: { icon: 'B', color: '#d23a3a' },
    X: { icon: 'X', color: '#3a72d2' },
    Y: { icon: 'Y', color: '#d2b73a' },
    cross: { icon: '✕', color: '#88a4d8' },
    circle: { icon: '◯', color: '#d23a3a' },
    square: { icon: '□', color: '#c93a8e' },
    triangle: { icon: '△', color: '#3aa28e' },
    L1: { icon: 'L1', color: '#7a8294' },
    L2: { icon: 'L2', color: '#7a8294' },
    L3: { icon: 'L3', color: '#7a8294' },
    R1: { icon: 'R1', color: '#7a8294' },
    R2: { icon: 'R2', color: '#7a8294' },
    R3: { icon: 'R3', color: '#7a8294' },
    LB: { icon: 'LB', color: '#7a8294' },
    LT: { icon: 'LT', color: '#7a8294' },
    LS: { icon: 'LS', color: '#7a8294' },
    RB: { icon: 'RB', color: '#7a8294' },
    RT: { icon: 'RT', color: '#7a8294' },
    RS: { icon: 'RS', color: '#7a8294' },
    'dpad-up': { icon: '▲', color: '#7a8294' },
    'dpad-down': { icon: '▼', color: '#7a8294' },
    'dpad-left': { icon: '◀', color: '#7a8294' },
    'dpad-right': { icon: '▶', color: '#7a8294' },
    start: { icon: '≡', color: '#7a8294' },
    select: { icon: '⊟', color: '#7a8294' },
    menu: { icon: '☰', color: '#7a8294' },
    view: { icon: '◫', color: '#7a8294' },
    home: { icon: '⌂', color: '#7a8294' },
}

export const GamepadButtonPrompt: React.FC<GamepadButtonPromptProps> = ({ glyph, label, size = 28, style, className }) => {
    const symbol = symbolMap[glyph]
    return (
        <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#e6e8ec', ...style }}>
            <span style={{
                width: size,
                height: size,
                borderRadius: '50%',
                background: `${symbol.color}20`,
                border: `2px solid ${symbol.color}`,
                color: symbol.color,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: size * 0.5,
                fontWeight: 700,
                fontFamily: 'monospace',
                lineHeight: 1,
            }}>{symbol.icon}</span>
            {label && <span style={{ fontSize: size * 0.5 }}>{label}</span>}
        </span>
    )
}
