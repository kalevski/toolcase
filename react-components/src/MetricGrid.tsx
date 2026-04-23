import React from 'react'
import { Icon } from './Icon'

export interface MetricTileProps {
	label: string
	value: React.ReactNode
	unit?: string
	icon?: string
	hint?: React.ReactNode
	className?: string
}

export const MetricTile: React.FC<MetricTileProps> = ({
	label,
	value,
	unit,
	icon,
	hint,
	className,
}) => {
	const rootClass = `component component-metric-tile ${className || ''}`.trim()
	return (
		<div className={rootClass}>
			<div className="component-metric-tile__eyebrow">
				{icon && (
					<span className="component-metric-tile__icon">
						<Icon name={icon} decorative />
					</span>
				)}
				<span className="component-metric-tile__label">{label}</span>
			</div>
			<div className="component-metric-tile__value">
				<span className="component-metric-tile__number">{value}</span>
				{unit && <span className="component-metric-tile__unit">{unit}</span>}
			</div>
			{hint && <div className="component-metric-tile__hint">{hint}</div>}
		</div>
	)
}

export interface MetricGridProps {
	items?: (MetricTileProps & { key?: string })[]
	columns?: 2 | 3 | 4
	className?: string
	children?: React.ReactNode
}

export const MetricGrid: React.FC<MetricGridProps> = ({
	items,
	columns = 3,
	className,
	children,
}) => {
	const rootClass = `component component-metric-grid component-metric-grid--cols-${columns} ${className || ''}`.trim()
	return (
		<div className={rootClass}>
			{items
				? items.map((item, i) => {
						const { key, ...rest } = item
						return <MetricTile key={key ?? i} {...rest} />
					})
				: children}
		</div>
	)
}
