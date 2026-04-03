import React from 'react'
import { Icon } from '../Icon'

export interface DifferenceCardProps {
	title: string
	value: number
	previousValue: number
	period?: string
	formatValue?: (v: number) => string
}

const defaultFormat = (v: number) =>
	v >= 1_000_000
		? `${(v / 1_000_000).toFixed(1)}M`
		: v >= 1_000
			? `${(v / 1_000).toFixed(1)}K`
			: v.toLocaleString()

export const DifferenceCard: React.FC<DifferenceCardProps> = ({
	title,
	value,
	previousValue,
	period = 'period',
	formatValue = defaultFormat,
}) => {
	const diff = previousValue !== 0 ? ((value - previousValue) / previousValue) * 100 : 0
	const isUp = diff > 0
	const isDown = diff < 0
	const isNeutral = diff === 0
	const sign = isUp ? '+' : ''
	const directionClass = isUp ? 'up' : isDown ? 'down' : 'neutral'

	return (
		<div className="component-dashboard-card__body component-dashboard-card__body--difference">
			<span className="component-dashboard-card__diff-title">{title}</span>
			<span className="component-dashboard-card__diff-value">{formatValue(value)}</span>
			<div className={`component-dashboard-card__diff-badge component-dashboard-card__diff-badge--${directionClass}`}>
				{!isNeutral && (
					<Icon name={`arrow-${isUp ? 'up' : 'down'}-short`} />
				)}
				<span>{sign}{diff.toFixed(1)}%</span>
			</div>
			<span className="component-dashboard-card__diff-period">vs previous {period}</span>
		</div>
	)
}
