import React from 'react'

export type AnchorPosition =
    | 'top-left' | 'top' | 'top-right'
    | 'left' | 'center' | 'right'
    | 'bottom-left' | 'bottom' | 'bottom-right'

export interface AnchorProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode
    position?: AnchorPosition
    inset?: number | string
}

const positionMap: Record<AnchorPosition, React.CSSProperties> = {
    'top-left': { top: 0, left: 0 },
    'top': { top: 0, left: '50%', transform: 'translateX(-50%)' },
    'top-right': { top: 0, right: 0 },
    'left': { top: '50%', left: 0, transform: 'translateY(-50%)' },
    'center': { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
    'right': { top: '50%', right: 0, transform: 'translateY(-50%)' },
    'bottom-left': { bottom: 0, left: 0 },
    'bottom': { bottom: 0, left: '50%', transform: 'translateX(-50%)' },
    'bottom-right': { bottom: 0, right: 0 },
}

export const Anchor = React.forwardRef<HTMLDivElement, AnchorProps>(({ children, position = 'top-left', inset = 16, style, ...props }, ref) => {
    const base = positionMap[position]
    const merged: React.CSSProperties = {
        position: 'absolute',
        margin: inset,
        ...base,
        ...style,
    }
    return <div ref={ref} {...props} style={merged}>{children}</div>
})
Anchor.displayName = 'Anchor'
