import React from 'react'

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode
    direction?: 'vertical' | 'horizontal'
    gap?: number | string
    align?: React.CSSProperties['alignItems']
    justify?: React.CSSProperties['justifyContent']
    wrap?: boolean
    inline?: boolean
}

export const Stack = React.forwardRef<HTMLDivElement, StackProps>(({ children, direction = 'vertical', gap = 8, align, justify, wrap = false, inline = false, style, ...props }, ref) => {
    const merged: React.CSSProperties = {
        display: inline ? 'inline-flex' : 'flex',
        flexDirection: direction === 'vertical' ? 'column' : 'row',
        gap,
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? 'wrap' : 'nowrap',
        ...style,
    }
    return <div ref={ref} {...props} style={merged}>{children}</div>
})
Stack.displayName = 'Stack'
