import React from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
	/** Maximum height of the scrollable area */
	maxHeight?: string | number
	/** Maximum width of the scrollable area */
	maxWidth?: string | number
	/** Which axis can scroll */
	axis?: 'x' | 'y' | 'both'
	children: React.ReactNode
	className?: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export const ScrollArea: React.FC<ScrollAreaProps> = ({
	maxHeight,
	maxWidth,
	axis = 'y',
	children,
	className = '',
	style,
	...rest
}) => {
	const overflowX = axis === 'x' || axis === 'both' ? 'auto' : 'hidden'
	const overflowY = axis === 'y' || axis === 'both' ? 'auto' : 'hidden'

	const sizeStyle: React.CSSProperties = {}
	if (maxHeight !== undefined) {
		sizeStyle.maxHeight = typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight
	}
	if (maxWidth !== undefined) {
		sizeStyle.maxWidth = typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth
	}

	const rootClass = [
		'component component-scroll-area',
		`component-scroll-area--axis-${axis}`,
		className,
	].filter(Boolean).join(' ')

	return (
		<div
			className={rootClass}
			style={{ overflowX, overflowY, ...sizeStyle, ...style }}
			{...rest}
		>
			{children}
		</div>
	)
}
