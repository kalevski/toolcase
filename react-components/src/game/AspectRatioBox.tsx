import React from 'react'

export interface AspectRatioBoxProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode
    /** Ratio = width / height. Default 16/9. */
    ratio?: number
}

export const AspectRatioBox = React.forwardRef<HTMLDivElement, AspectRatioBoxProps>(({ children, ratio = 16 / 9, style, ...props }, ref) => {
    const merged: React.CSSProperties = {
        position: 'relative',
        width: '100%',
        aspectRatio: String(ratio),
        ...style,
    }
    return (
        <div ref={ref} {...props} style={merged}>
            <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
        </div>
    )
})
AspectRatioBox.displayName = 'AspectRatioBox'
