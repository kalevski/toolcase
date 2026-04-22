import type { FC, ReactNode, CSSProperties } from 'react'

export interface DemoGridProps {
	columns?: number
	minItemWidth?: number
	gap?: number
	children: ReactNode
}

/**
 * Responsive auto-fit grid for laying out demo variants side-by-side.
 * `columns` = hard cap; `minItemWidth` = min size before wrapping.
 */
export const DemoGrid: FC<DemoGridProps> = ({
	columns,
	minItemWidth = 240,
	gap = 16,
	children,
}) => {
	const style: CSSProperties = {
		display: 'grid',
		gap,
		gridTemplateColumns: columns
			? `repeat(${columns}, minmax(0, 1fr))`
			: `repeat(auto-fit, minmax(${minItemWidth}px, 1fr))`,
	}
	return <div style={style}>{children}</div>
}

export default DemoGrid
