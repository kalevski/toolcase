import React, { useCallback, useRef, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface VirtualListProps<T> extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
	items: T[]
	itemHeight: number | ((index: number) => number)
	renderItem: (item: T, index: number) => React.ReactNode
	/** Visible viewport height in pixels */
	height: number
	/** Extra rows to render above and below the visible range */
	overscan?: number
	onEndReached?: () => void
	/** Threshold (px from bottom) at which to fire onEndReached */
	endReachedThreshold?: number
	className?: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export function VirtualList<T>({
	items,
	itemHeight,
	renderItem,
	height,
	overscan = 3,
	onEndReached,
	endReachedThreshold = 100,
	className = '',
	...rest
}: VirtualListProps<T>): React.ReactElement {
	const [scrollTop, setScrollTop] = useState(0)
	const containerRef = useRef<HTMLDivElement>(null)
	const endFiredRef  = useRef(false)

	// Build cumulative offset table
	const offsets = React.useMemo(() => {
		const table: number[] = [0]
		for (let i = 0; i < items.length; i++) {
			const h = typeof itemHeight === 'function' ? itemHeight(i) : itemHeight
			table.push(table[i] + h)
		}
		return table
	}, [items, itemHeight])

	const totalHeight = offsets[offsets.length - 1] ?? 0

	// Find visible range using binary search on cumulative offsets
	const findIndex = (target: number) => {
		let lo = 0, hi = offsets.length - 1
		while (lo < hi) {
			const mid = (lo + hi) >> 1
			if (offsets[mid] < target) lo = mid + 1
			else hi = mid
		}
		return Math.max(0, lo - 1)
	}

	const startIndex = Math.max(0, findIndex(scrollTop) - overscan)
	const endIndex   = Math.min(items.length - 1, findIndex(scrollTop + height) + overscan)

	const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
		const st = (e.target as HTMLDivElement).scrollTop
		setScrollTop(st)

		if (onEndReached && !endFiredRef.current) {
			if (totalHeight - st - height <= endReachedThreshold) {
				endFiredRef.current = true
				onEndReached()
			}
		}
		if (endFiredRef.current && totalHeight - st - height > endReachedThreshold) {
			endFiredRef.current = false
		}
	}, [onEndReached, totalHeight, height, endReachedThreshold])

	const rootClass = [
		'component component-virtual-list',
		className,
	].filter(Boolean).join(' ')

	return (
		<div
			ref={containerRef}
			className={rootClass}
			style={{ height, overflowY: 'auto', position: 'relative' }}
			onScroll={handleScroll}
			{...rest}
		>
			{/* Spacer that represents the full list height */}
			<div style={{ height: totalHeight, position: 'relative' }}>
				{items.slice(startIndex, endIndex + 1).map((item, idx) => {
					const actualIndex = startIndex + idx
					const top = offsets[actualIndex]
					const h   = typeof itemHeight === 'function' ? itemHeight(actualIndex) : itemHeight
					return (
						<div
							key={actualIndex}
							className="component-virtual-list__row"
							style={{ position: 'absolute', top, left: 0, right: 0, height: h }}
						>
							{renderItem(item, actualIndex)}
						</div>
					)
				})}
			</div>
		</div>
	)
}
