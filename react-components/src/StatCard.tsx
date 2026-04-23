import React from 'react'
import { Icon } from './Icon'
import { Skeleton } from './Skeleton'

export interface StatCardProps {
	icon?: string
	label: string
	value: React.ReactNode
	unit?: string
	delta?: string
	deltaKind?: 'up' | 'down' | 'neutral'
	helper?: React.ReactNode
	footer?: React.ReactNode
	loading?: boolean
	className?: string
}

export const StatCard: React.FC<StatCardProps> = ({
	icon,
	label,
	value,
	unit,
	delta,
	deltaKind = 'neutral',
	helper,
	footer,
	loading = false,
	className,
}) => {
	const rootClass = `component component-stat-card ${className || ''}`.trim()

	if (loading) {
		return (
			<div className={rootClass}>
				<div className="component-stat-card__header">
					<Skeleton width="40%" />
				</div>
				<div className="component-stat-card__value">
					<Skeleton width="60%" height="2rem" />
				</div>
				<div className="component-stat-card__footer">
					<Skeleton width="30%" />
				</div>
			</div>
		)
	}

	const deltaIcon =
		deltaKind === 'up' ? 'arrow-up-short' : deltaKind === 'down' ? 'arrow-down-short' : 'dash'
	const hasFooter = delta || helper || footer

	return (
		<div className={rootClass}>
			<div className="component-stat-card__header">
				{icon && (
					<span className="component-stat-card__icon">
						<Icon name={icon} decorative />
					</span>
				)}
				<span className="component-stat-card__label">{label}</span>
			</div>
			<div className="component-stat-card__value">
				<span className="component-stat-card__number">{value}</span>
				{unit && <span className="component-stat-card__unit">{unit}</span>}
			</div>
			{hasFooter && (
				<div className="component-stat-card__footer">
					{delta && (
						<span
							className={`component-stat-card__delta component-stat-card__delta--${deltaKind}`}
						>
							<Icon name={deltaIcon} decorative />
							{delta}
						</span>
					)}
					{helper && <span className="component-stat-card__helper">{helper}</span>}
					{footer && <span className="component-stat-card__footer-extra">{footer}</span>}
				</div>
			)}
		</div>
	)
}
