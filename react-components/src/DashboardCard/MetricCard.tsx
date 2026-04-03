import React from 'react'
import { Icon } from '../Icon'

export interface MetricCardProps {
	title: string
	value: string | number
	subtitle?: string
	icon?: string
	trend?: number[]
	trendColor?: string
}

export const MetricCard: React.FC<MetricCardProps> = ({
	title,
	value,
	subtitle,
	icon,
	trend,
	trendColor = '#6366f1',
}) => {
	const sparkline = trend && trend.length > 1 ? buildSparklinePath(trend) : null

	return (
		<div className="component-dashboard-card__body component-dashboard-card__body--metric">
			<div className="component-dashboard-card__metric-top">
				<div className="component-dashboard-card__metric-info">
					<span className="component-dashboard-card__metric-title">{title}</span>
					<span className="component-dashboard-card__metric-value">{value}</span>
					{subtitle && <span className="component-dashboard-card__metric-subtitle">{subtitle}</span>}
				</div>
				{icon && (
					<div className="component-dashboard-card__metric-icon">
						<Icon name={icon} />
					</div>
				)}
			</div>
			{sparkline && (
				<svg className="component-dashboard-card__metric-sparkline" viewBox="0 0 120 32" preserveAspectRatio="none">
					<path d={sparkline} fill="none" stroke={trendColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			)}
		</div>
	)
}

function buildSparklinePath(data: number[]): string {
	const min = Math.min(...data)
	const max = Math.max(...data)
	const range = max - min || 1
	const stepX = 120 / (data.length - 1)

	return data
		.map((v, i) => {
			const x = i * stepX
			const y = 30 - ((v - min) / range) * 28 + 1
			return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
		})
		.join(' ')
}
