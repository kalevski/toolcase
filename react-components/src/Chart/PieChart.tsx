import React, { useState } from 'react'
import { Skeleton } from '../Skeleton'

export interface PieChartSlice {
	label: string
	value: number
	color?: string
}

export interface PieChartProps {
	data: PieChartSlice[]
	title?: string
	subtitle?: string
	donut?: boolean
	centerLabel?: string
	showLegend?: boolean
	height?: number
	loading?: boolean
	className?: string
}

const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

const polarToCart = (cx: number, cy: number, r: number, angle: number) => ({
	x: cx + r * Math.cos(angle),
	y: cy + r * Math.sin(angle),
})

const arcPath = (
	cx: number, cy: number,
	r: number, ir: number,
	startAngle: number, endAngle: number,
	donut: boolean,
): string => {
	const s = polarToCart(cx, cy, r, startAngle)
	const e = polarToCart(cx, cy, r, endAngle)
	const large = endAngle - startAngle > Math.PI ? 1 : 0

	if (donut) {
		const is = polarToCart(cx, cy, ir, startAngle)
		const ie = polarToCart(cx, cy, ir, endAngle)
		return [
			`M ${s.x.toFixed(2)} ${s.y.toFixed(2)}`,
			`A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`,
			`L ${ie.x.toFixed(2)} ${ie.y.toFixed(2)}`,
			`A ${ir} ${ir} 0 ${large} 0 ${is.x.toFixed(2)} ${is.y.toFixed(2)}`,
			'Z',
		].join(' ')
	}
	return [
		`M ${cx} ${cy}`,
		`L ${s.x.toFixed(2)} ${s.y.toFixed(2)}`,
		`A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`,
		'Z',
	].join(' ')
}

export const PieChart: React.FC<PieChartProps> = ({
	data,
	title,
	subtitle,
	donut = false,
	centerLabel,
	showLegend = true,
	height = 260,
	loading = false,
	className = '',
}) => {
	const [activeIndex, setActiveIndex] = useState<number | null>(null)

	if (loading) {
		return (
			<div className={`component-chart__inner component-chart__inner--pie${className ? ` ${className}` : ''}`}>
				{title && <div className="component-chart__header"><Skeleton width="40%" /></div>}
				<div style={{ display: 'flex', justifyContent: 'center' }}>
					<Skeleton shape="circle" width={height * 0.7} height={height * 0.7} />
				</div>
			</div>
		)
	}

	if (!data?.length) {
		return (
			<div className={`component-chart__inner component-chart__inner--pie${className ? ` ${className}` : ''}`}>
				{(title || subtitle) && (
					<div className="component-chart__header">
						{title && <div className="component-chart__title">{title}</div>}
						{subtitle && <div className="component-chart__subtitle">{subtitle}</div>}
					</div>
				)}
				<div className="component-chart__empty">No data</div>
			</div>
		)
	}

	const total = data.reduce((s, d) => s + d.value, 0)
	const size = Math.min(height, 260)
	const cx = size / 2
	const cy = size / 2
	const r = size / 2 - 12
	const ir = donut ? r * 0.55 : 0

	let currentAngle = -Math.PI / 2
	const slices = data.map((d, i) => {
		const angle = (d.value / total) * 2 * Math.PI
		const startAngle = currentAngle
		currentAngle += angle
		return {
			...d,
			color: d.color ?? PALETTE[i % PALETTE.length],
			startAngle,
			endAngle: currentAngle,
			pct: Math.round((d.value / total) * 100),
		}
	})

	const activeSlice = activeIndex !== null ? slices[activeIndex] : null

	return (
		<div className={`component-chart__inner component-chart__inner--pie${className ? ` ${className}` : ''}`}>
			{(title || subtitle) && (
				<div className="component-chart__header">
					{title && <div className="component-chart__title">{title}</div>}
					{subtitle && <div className="component-chart__subtitle">{subtitle}</div>}
				</div>
			)}
			<div className="component-chart__pie-layout">
				<svg
					viewBox={`0 0 ${size} ${size}`}
					width={size}
					height={size}
					aria-label={title ?? 'Pie chart'}
					onMouseLeave={() => setActiveIndex(null)}
					style={{ flexShrink: 0 }}
				>
					{slices.map((s, i) => {
						const isActive = activeIndex === i
						const scale = isActive
							? `translate(${cx}, ${cy}) scale(1.06) translate(-${cx}, -${cy})`
							: undefined
						return (
							<path
								key={i}
								d={arcPath(cx, cy, r, ir, s.startAngle, s.endAngle, donut)}
								fill={s.color}
								stroke="#fff"
								strokeWidth="2"
								transform={scale}
								style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}
								onMouseEnter={() => setActiveIndex(i)}
								aria-label={`${s.label}: ${s.pct}%`}
							/>
						)
					})}
					{donut && (
						<>
							<circle cx={cx} cy={cy} r={ir - 1} fill="#fff" />
							<text x={cx} y={cy - 6} textAnchor="middle" fontSize="12" fill="#64748b" fontWeight="500">
								{activeSlice ? activeSlice.label : (centerLabel ?? '')}
							</text>
							<text x={cx} y={cy + 14} textAnchor="middle" fontSize="22" fill="#1e293b" fontWeight="700">
								{activeSlice ? `${activeSlice.pct}%` : `${total}`}
							</text>
						</>
					)}
				</svg>
				{showLegend && (
					<div className="component-chart__legend component-chart__legend--vertical">
						{slices.map((s, i) => (
							<div
								key={i}
								className={`component-chart__legend-item${activeIndex === i ? ' component-chart__legend-item--active' : ''}`}
								onMouseEnter={() => setActiveIndex(i)}
								onMouseLeave={() => setActiveIndex(null)}
								style={{ cursor: 'pointer' }}
							>
								<span className="component-chart__legend-dot" style={{ background: s.color }} />
								<span className="component-chart__legend-label">{s.label}</span>
								<span className="component-chart__legend-pct">{s.pct}%</span>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
