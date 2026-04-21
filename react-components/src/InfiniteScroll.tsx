import React, { useCallback, useEffect, useRef } from 'react'
import { Spinner } from './Spinner'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface InfiniteScrollProps {
	onLoadMore: () => void
	hasMore: boolean
	loading?: boolean
	/** Rendered inside the loader area while loading */
	loadingSlot?: React.ReactNode
	/** Rendered when loading is done but there are no more items */
	endSlot?: React.ReactNode
	/** Intersection threshold (0–1). Default: 0.1 */
	threshold?: number
	/** Root margin in px. Default: 0 */
	rootMargin?: string
	children: React.ReactNode
	className?: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export const InfiniteScroll: React.FC<InfiniteScrollProps> = ({
	onLoadMore,
	hasMore,
	loading = false,
	loadingSlot,
	endSlot,
	threshold = 0.1,
	rootMargin = '0px',
	children,
	className = '',
}) => {
	const sentinelRef = useRef<HTMLDivElement>(null)
	const observerRef = useRef<IntersectionObserver | null>(null)

	const handleIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
		if (entries[0]?.isIntersecting && hasMore && !loading) {
			onLoadMore()
		}
	}, [hasMore, loading, onLoadMore])

	useEffect(() => {
		const sentinel = sentinelRef.current
		if (!sentinel) return

		observerRef.current?.disconnect()

		observerRef.current = new IntersectionObserver(handleIntersect, {
			threshold,
			rootMargin,
		})
		observerRef.current.observe(sentinel)

		return () => {
			observerRef.current?.disconnect()
		}
	}, [handleIntersect, threshold, rootMargin])

	const rootClass = ['component component-infinite-scroll', className].filter(Boolean).join(' ')

	return (
		<div className={rootClass}>
			{children}

			{/* Sentinel */}
			<div ref={sentinelRef} className="component-infinite-scroll__sentinel" aria-hidden="true" />

			{/* Loading state */}
			{loading && (
				<div className="component-infinite-scroll__loader" role="status" aria-live="polite">
					{loadingSlot ?? <Spinner size="small" />}
				</div>
			)}

			{/* End state */}
			{!hasMore && !loading && endSlot && (
				<div className="component-infinite-scroll__end">
					{endSlot}
				</div>
			)}
		</div>
	)
}
