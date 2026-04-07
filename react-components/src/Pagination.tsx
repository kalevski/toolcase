import React from 'react'
import { Icon } from './Icon'

export interface PaginationProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
	page: number
	totalPages: number
	totalResults?: number
	pageSize?: number
	siblingCount?: number
	onChange?: (page: number) => void
}

function buildRange(start: number, end: number): number[] {
	const result: number[] = []
	for (let i = start; i <= end; i++) result.push(i)
	return result
}

function buildPages(page: number, totalPages: number, siblings: number): (number | 'dots')[] {
	const totalSlots = siblings * 2 + 5 // first + last + current + 2 dots + siblings each side
	if (totalPages <= totalSlots) return buildRange(1, totalPages)

	const leftSibling = Math.max(page - siblings, 1)
	const rightSibling = Math.min(page + siblings, totalPages)

	const showLeftDots = leftSibling > 2
	const showRightDots = rightSibling < totalPages - 1

	if (!showLeftDots && showRightDots) {
		const leftCount = siblings * 2 + 3
		return [...buildRange(1, leftCount), 'dots', totalPages]
	}

	if (showLeftDots && !showRightDots) {
		const rightCount = siblings * 2 + 3
		return [1, 'dots', ...buildRange(totalPages - rightCount + 1, totalPages)]
	}

	return [1, 'dots', ...buildRange(leftSibling, rightSibling), 'dots', totalPages]
}

export const Pagination: React.FC<PaginationProps> = ({
	page,
	totalPages,
	totalResults,
	pageSize,
	siblingCount = 1,
	onChange,
	className = '',
	...props
}) => {
	const rootClass = [
		'component component-pagination',
		className,
	].filter(Boolean).join(' ')

	const pages = buildPages(page, totalPages, siblingCount)

	const rangeStart = totalResults !== undefined && pageSize ? (page - 1) * pageSize + 1 : undefined
	const rangeEnd = totalResults !== undefined && pageSize ? Math.min(page * pageSize, totalResults) : undefined

	return (
		<div {...props} className={rootClass}>
			{totalResults !== undefined && rangeStart !== undefined && rangeEnd !== undefined && (
				<span className="component-pagination__summary">
					{rangeStart}–{rangeEnd} of {totalResults}
				</span>
			)}

			<nav className="component-pagination__nav" aria-label="Pagination">
				<button
					type="button"
					className="component-pagination__btn component-pagination__btn--prev"
					disabled={page <= 1}
					onClick={() => onChange?.(page - 1)}
					aria-label="Previous page"
				>
					<Icon name="chevron-left" />
				</button>

				{pages.map((p, i) =>
					p === 'dots' ? (
						<span key={`dots-${i}`} className="component-pagination__dots">…</span>
					) : (
						<button
							key={p}
							type="button"
							className={[
								'component-pagination__btn component-pagination__btn--page',
								p === page ? 'component-pagination__btn--active' : '',
							].filter(Boolean).join(' ')}
							aria-current={p === page ? 'page' : undefined}
							onClick={() => onChange?.(p)}
						>
							{p}
						</button>
					),
				)}

				<button
					type="button"
					className="component-pagination__btn component-pagination__btn--next"
					disabled={page >= totalPages}
					onClick={() => onChange?.(page + 1)}
					aria-label="Next page"
				>
					<Icon name="chevron-right" />
				</button>
			</nav>
		</div>
	)
}
