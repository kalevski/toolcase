import React from 'react'
import { Spinner } from '../Spinner'

export interface ChartContainerProps {
	title?: string
	subtitle?: string
	children?: React.ReactNode
	legend?: React.ReactNode
	actions?: React.ReactNode
	loading?: boolean
	empty?: boolean
	emptySlot?: React.ReactNode
	className?: string
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
	title,
	subtitle,
	children,
	legend,
	actions,
	loading = false,
	empty = false,
	emptySlot,
	className = '',
}) => {
	const hasHeader = title || subtitle || actions

	return (
		<div className={`component-chart__container${className ? ` ${className}` : ''}`}>
			{hasHeader && (
				<div className="component-chart__container-header">
					{(title || subtitle) && (
						<div className="component-chart__container-heading">
							{title && <div className="component-chart__title">{title}</div>}
							{subtitle && <div className="component-chart__subtitle">{subtitle}</div>}
						</div>
					)}
					{actions && (
						<div className="component-chart__container-actions">{actions}</div>
					)}
				</div>
			)}
			<div className="component-chart__container-body">
				{loading ? (
					<div className="component-chart__container-loading" role="status" aria-label="Loading">
						<Spinner />
					</div>
				) : empty ? (
					<div className="component-chart__container-empty">
						{emptySlot ?? <span>No data available</span>}
					</div>
				) : (
					children
				)}
			</div>
			{legend && (
				<div className="component-chart__container-legend">{legend}</div>
			)}
		</div>
	)
}
