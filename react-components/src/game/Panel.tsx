import React from 'react'

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode
    bordered?: boolean
    /** Optional 9-slice background image; provide a CSS `border-image` source. */
    nineSlice?: string
    /** Border slice in pixels for nine-slice. */
    nineSliceFill?: number
    padding?: number | string
}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(({ children, bordered = true, nineSlice, nineSliceFill = 16, padding = 16, style, ...props }, ref) => {
    const merged: React.CSSProperties = {
        position: 'relative',
        padding,
        background: nineSlice ? 'transparent' : 'rgba(15, 18, 24, 0.85)',
        color: '#e6e8ec',
        ...(bordered && !nineSlice ? { border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8 } : null),
        ...(nineSlice
            ? {
                borderImageSource: `url("${nineSlice}")`,
                borderImageSlice: nineSliceFill,
                borderImageRepeat: 'stretch',
                borderImageWidth: `${nineSliceFill}px`,
                borderStyle: 'solid',
                borderWidth: nineSliceFill,
            }
            : null),
        ...style,
    }
    return <div ref={ref} {...props} style={merged}>{children}</div>
})
Panel.displayName = 'Panel'
