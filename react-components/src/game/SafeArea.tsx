import React from 'react'

export interface SafeAreaProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode
    /** Adds extra inset on top of env(safe-area-inset-*). */
    extra?: number
}

export const SafeArea = React.forwardRef<HTMLDivElement, SafeAreaProps>(({ children, extra = 0, style, ...props }, ref) => {
    const merged: React.CSSProperties = {
        position: 'relative',
        width: '100%',
        height: '100%',
        paddingTop: `calc(env(safe-area-inset-top, 0px) + ${extra}px)`,
        paddingRight: `calc(env(safe-area-inset-right, 0px) + ${extra}px)`,
        paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${extra}px)`,
        paddingLeft: `calc(env(safe-area-inset-left, 0px) + ${extra}px)`,
        boxSizing: 'border-box',
        ...style,
    }
    return <div ref={ref} {...props} style={merged}>{children}</div>
})
SafeArea.displayName = 'SafeArea'
