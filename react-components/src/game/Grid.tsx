import React from 'react'

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode
    columns?: number | string
    rows?: number | string
    gap?: number | string
    cellSize?: number | string
}

export const Grid = React.forwardRef<HTMLDivElement, GridProps>(({ children, columns = 4, rows, gap = 4, cellSize, style, ...props }, ref) => {
    const cols = typeof columns === 'number' ? (cellSize ? `repeat(${columns}, ${typeof cellSize === 'number' ? cellSize + 'px' : cellSize})` : `repeat(${columns}, 1fr)`) : columns
    const rws = rows === undefined ? undefined : typeof rows === 'number' ? (cellSize ? `repeat(${rows}, ${typeof cellSize === 'number' ? cellSize + 'px' : cellSize})` : `repeat(${rows}, 1fr)`) : rows
    const merged: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: cols,
        gridTemplateRows: rws,
        gap,
        ...style,
    }
    return <div ref={ref} {...props} style={merged}>{children}</div>
})
Grid.displayName = 'Grid'
