import React, { useMemo } from 'react'
import { Skeleton } from '../Skeleton'

export interface SliceItem {
	value: number
	text: string
	color?: string
}

export interface SlicesCardProps {
	title?: string
	slices: SliceItem[]
	size?: number
	strokeWidth?: number
	loading?: boolean
}

const DEFAULT_COLORS = [
	'#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6',
]

export const SlicesCard: React.FC<SlicesCardProps> = ({
	title,
	slices,
	size = 140,
	strokeWidth = 18,
	loading = false,
}) => {
	if (loading) {
		return (
			<div className="component-dashboard-card__body component-dashboard-card__body--slices">
				{title && <Skeleton width="30%" />}
				<div className="component-dashboard-card__slices-chart">
					<Skeleton variant="circle" width={`${size}px`} height={`${size}px`} />
				</div>
				<ul className="component-dashboard-card__slices-legend">
					{Array.from({ length: 3 }, (_, i) => (
						<li key={i} className="component-dashboard-card__slices-legend-item">
							<Skeleton width="60%" />
						</li>
					))}
				</ul>
			</div>
		)
	}

	const total = useMemo(() => slices.reduce((sum, s) => sum + s.value, 0), [slices])

	const segments = useMemo(() => {
		const radius = (size - strokeWidth) / 2
		const circumference = 2 * Math.PI * radius
		let accumulated = 0

		return slices.map((slice, i) => {
			const fraction = total > 0 ? slice.value / total : 0
			const dashLength = fraction * circumference
			const gap = circumference - dashLength
			const offset = -accumulated * circumference + circumference * 0.25
			accumulated += fraction

			return {
				...slice,
				color: slice.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
				dashArray: `${dashLength} ${gap}`,
				dashOffset: offset,
				radius,
			}
		})
	}, [slices, total, size, strokeWidth])

	const center = size / 2

	return (
		<div className="component-dashboard-card__body component-dashboard-card__body--slices">
			{title && <span className="component-dashboard-card__slices-title">{title}</span>}
			<div className="component-dashboard-card__slices-chart">
				<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
					{segments.map((seg, i) => (
						<circle
							key={i}
							cx={center}
							cy={center}
							r={seg.radius}
							fill="none"
							stroke={seg.color}
							strokeWidth={strokeWidth}
							strokeDasharray={seg.dashArray}
							strokeDashoffset={seg.dashOffset}
							strokeLinecap="round"
						/>
					))}
				</svg>
				<span className="component-dashboard-card__slices-total">{total.toLocaleString()}</span>
			</div>
			<ul className="component-dashboard-card__slices-legend">
				{segments.map((seg, i) => (
					<li key={i} className="component-dashboard-card__slices-legend-item">
						<span className="component-dashboard-card__slices-dot" style={{ background: seg.color }} />
						<span className="component-dashboard-card__slices-legend-text">{seg.text}</span>
						<span className="component-dashboard-card__slices-legend-value">{seg.value.toLocaleString()}</span>
					</li>
				))}
			</ul>
		</div>
	)
}
