import React from 'react'

export interface PageIndicatorProps {
    count: number
    index: number
    onSelect?: (index: number) => void
    size?: number
    gap?: number
    color?: string
    activeColor?: string
    style?: React.CSSProperties
    className?: string
}

export const PageIndicator: React.FC<PageIndicatorProps> = ({ count, index, onSelect, size = 8, gap = 8, color = 'rgba(255,255,255,0.25)', activeColor = '#6aa9ff', style, className }) => {
    return (
        <div className={className} style={{ display: 'inline-flex', gap, alignItems: 'center', ...style }}>
            {Array.from({ length: count }).map((_, i) => {
                const active = i === index
                return (
                    <button
                        key={i}
                        type="button"
                        aria-label={`Go to page ${i + 1}`}
                        onClick={() => onSelect?.(i)}
                        style={{
                            width: active ? size * 2.5 : size,
                            height: size,
                            borderRadius: size,
                            background: active ? activeColor : color,
                            border: 'none',
                            padding: 0,
                            cursor: onSelect ? 'pointer' : 'default',
                            transition: 'width 200ms, background 200ms',
                        }}
                    />
                )
            })}
        </div>
    )
}
