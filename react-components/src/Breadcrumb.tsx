import React from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
	label: string
	href?: string
	onClick?: (e: React.MouseEvent) => void
}

export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
	items: BreadcrumbItem[]
	/**
	 * Custom separator between crumbs.
	 * Default: '/'
	 */
	separator?: React.ReactNode
	/**
	 * Maximum number of visible crumbs before collapsing middle ones.
	 * When exceeded, the first and last `maxItems - 1` crumbs are shown
	 * with an ellipsis button that expands the full list.
	 * Default: 0 (no collapse)
	 */
	maxItems?: number
	className?: string
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
	items,
	separator = '/',
	maxItems = 0,
	className = '',
	...rest
}) => {
	const [expanded, setExpanded] = React.useState(false)

	const shouldCollapse = maxItems > 0 && !expanded && items.length > maxItems

	let visible: (BreadcrumbItem | null)[]
	if (shouldCollapse) {
		// Show first item, ellipsis placeholder (null), last (maxItems - 1) items
		const tail = items.slice(items.length - (maxItems - 1))
		visible = [items[0], null, ...tail]
	} else {
		visible = items
	}

	const rootClass = ['component component-breadcrumb', className].filter(Boolean).join(' ')

	return (
		<nav className={rootClass} aria-label="breadcrumb" {...rest}>
			<ol className="component-breadcrumb__list">
				{visible.map((item, index) => {
					const isLast = index === visible.length - 1

					if (item === null) {
						// Ellipsis button
						return (
							<li key="__ellipsis" className="component-breadcrumb__item">
								<button
									type="button"
									className="component-breadcrumb__ellipsis"
									aria-label="Show full path"
									onClick={() => setExpanded(true)}
								>
									&hellip;
								</button>
								<span className="component-breadcrumb__separator" aria-hidden="true">
									{separator}
								</span>
							</li>
						)
					}

					return (
						<li
							key={index}
							className={[
								'component-breadcrumb__item',
								isLast ? 'component-breadcrumb__item--current' : '',
							].filter(Boolean).join(' ')}
						>
							{isLast || !item.href && !item.onClick ? (
								<span
									className="component-breadcrumb__label"
									aria-current={isLast ? 'page' : undefined}
								>
									{item.label}
								</span>
							) : (
								<a
									href={item.href ?? '#'}
									className="component-breadcrumb__link"
									onClick={item.onClick}
								>
									{item.label}
								</a>
							)}
							{!isLast && (
								<span className="component-breadcrumb__separator" aria-hidden="true">
									{separator}
								</span>
							)}
						</li>
					)
				})}
			</ol>
		</nav>
	)
}
