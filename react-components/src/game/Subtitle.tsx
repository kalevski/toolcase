import React from 'react'

export interface SubtitleProps {
    text: React.ReactNode
    speaker?: React.ReactNode
    /** Background block behind text. */
    boxed?: boolean
    align?: 'left' | 'center' | 'right'
    fontSize?: number
    maxWidth?: number | string
    style?: React.CSSProperties
    className?: string
}

export const Subtitle: React.FC<SubtitleProps> = ({ text, speaker, boxed = true, align = 'center', fontSize = 18, maxWidth = 720, style, className }) => {
    if (!text) return null
    return (
        <div className={className} style={{ maxWidth, color: '#fff', fontSize, textAlign: align, lineHeight: 1.4, textShadow: boxed ? undefined : '0 2px 6px rgba(0,0,0,0.95)', ...style }}>
            {speaker && <div style={{ fontSize: fontSize * 0.7, color: '#ffd35a', marginBottom: 4 }}>{speaker}</div>}
            <div style={{ background: boxed ? 'rgba(0,0,0,0.7)' : 'transparent', padding: boxed ? '8px 14px' : 0, borderRadius: 4, display: 'inline-block' }}>{text}</div>
        </div>
    )
}

export const CaptionBox = Subtitle
