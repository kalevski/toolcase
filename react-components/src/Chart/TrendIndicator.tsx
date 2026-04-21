import React from 'react'

export interface TrendIndicatorProps {
	value: number | string
	direction?: 'up' | 'down' | 'neutral'
	size?: 'small' | 'default' | 'large'
	className?: string
}

export const TrendIndicator: React.FC<TrendIndicatorProps> = ({
	value,
	direction,
	size = 'default',
	className = '',
}) => {
	const computed: 'up' | 'down' | 'neutral' = direction ?? (
		typeof value === 'number'
			? value > 0 ? 'up' : value < 0 ? 'down' : 'neutral'
			: 'neutral'
	)

	const displayValue = typeof value === 'number'
		? `${value > 0 ? '+' : ''}${value}%`
		: value

	const iconName =
		computed === 'up' ? 'arrow-up-short' :
		computed === 'down' ? 'arrow-down-short' :
		'dash'

	return (
		<span
			className={`component-chart__trend component-chart__trend--${computed} component-chart__trend--size-${size}${className ? ` ${className}` : ''}`}
			role="status"
			aria-label={`Trend ${computed}: ${displayValue}`}
		>
			<i className={`bi bi-${iconName}`} aria-hidden="true" />
			<span>{displayValue}</span>
		</span>
	)
}
