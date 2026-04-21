import React, { useState } from 'react'
import { Skeleton } from '../Skeleton'

export interface BarChartDataItem {
	label: string
	value: number
	color?: string
}

export interface BarChartProps {
	data: BarChartDataItem[]
	title?: string
	subtitle?: string
	orientation?: 'vertical' | 'horizontal'
	height?: number
	showValues?: boolean
	yFormatter?: (v: number) => string
	onClick?: (item: BarChartDataItem, index: number) => void
	loading?: boolean
	className?: string
}

const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

interface TooltipState { cx: number; cy: number; text: string }

const niceMax = (v: number): number => {
	if (v <= 0) return 10
	const e = Math.pow(10, Math.floor(Math.log10(v)))
	return Math.ceil(v / e) * e
}

const defaultFmt = (v: number): string => {
	if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
	if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`
	return String(Math.round(v))
}

export const BarChart: React.FC<BarChartProps> = ({
	data,
	title,
	subtitle,
	orientation = 'vertical',
	height = 260,
	showValues = false,
	yFormatter,
	onClick,
	loading = false,
	className = '',
}) => {
	const [tooltip, setTooltip] = useState<TooltipState | null>(null)
	const fmt = yFormatter ?? defaultFmt

	if (loading) {
		return (
			<div className={`component-chart__inner component-chart__inner--bar${className ? ` ${className}` : ''}`}>
				{title && <div className="component-chart__header"><Skeleton width="40%" /></div>}
				<Skeleton height={height} />
			</div>
		)
	}

	if (!data?.length) {
		return (
			<div className={`component-chart__inner component-chart__inner--bar${className ? ` ${className}` : ''}`}>
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

	const VW = 560
	const VH = height
	const PL = 52, PR = 12, PT = 18, PB = 38
	const cW = VW - PL - PR
	const cH = VH - PT - PB
	const maxVal = niceMax(Math.max(...data.map(d => d.value)))
	const TICKS = 5
	const ticks = Array.from({ length: TICKS + 1 }, (_, i) => (maxVal / TICKS) * i)

	if (orientation === 'vertical') {
		const bGroup = cW / data.length
		const bW = bGroup * 0.65
		const bOff = bGroup * 0.175

		return (
			<div className={`component-chart__inner component-chart__inner--bar${className ? ` ${className}` : ''}`}>
				{(title || subtitle) && (
					<div className="component-chart__header">
						{title && <div className="component-chart__title">{title}</div>}
						{subtitle && <div className="component-chart__subtitle">{subtitle}</div>}
					</div>
				)}
				<svg
					viewBox={`0 0 ${VW} ${VH}`}
					width="100%"
					height={VH}
					aria-label={title ?? 'Bar chart'}
					onMouseLeave={() => setTooltip(null)}
				>
					{ticks.map((t, i) => {
						const y = PT + cH - (t / maxVal) * cH
						return (
							<g key={i}>
								<line x1={PL} y1={y} x2={PL + cW} y2={y} stroke="#e2e8f0" strokeWidth="1" />
								<text x={PL - 6} y={y + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{fmt(t)}</text>
							</g>
						)
					})}
					<line x1={PL} y1={PT + cH} x2={PL + cW} y2={PT + cH} stroke="#cbd5e1" strokeWidth="1" />
					{data.map((d, i) => {
						const bH = (d.value / maxVal) * cH
						const x = PL + i * bGroup + bOff
						const y = PT + cH - bH
						const color = d.color ?? PALETTE[i % PALETTE.length]
						return (
							<g
								key={i}
								style={{ cursor: onClick ? 'pointer' : undefined }}
								onClick={() => onClick?.(d, i)}
								onMouseEnter={() => setTooltip({ cx: x + bW / 2, cy: y - 12, text: `${d.label}: ${fmt(d.value)}` })}
							>
								<rect x={x} y={y} width={bW} height={bH} fill={color} />
								{showValues && (
									<text x={x + bW / 2} y={y - 5} textAnchor="middle" fontSize="11" fill="#1e293b" fontWeight="600">
										{fmt(d.value)}
									</text>
								)}
								<text x={x + bW / 2} y={PT + cH + 18} textAnchor="middle" fontSize="11" fill="#64748b">{d.label}</text>
							</g>
						)
					})}
					{tooltip && (
						<g>
							<rect x={tooltip.cx - 44} y={tooltip.cy - 17} width={88} height={19} rx="3" fill="#1e293b" />
							<text x={tooltip.cx} y={tooltip.cy - 4} textAnchor="middle" fontSize="11" fill="#fff">{tooltip.text}</text>
						</g>
					)}
				</svg>
			</div>
		)
	}

	// Horizontal orientation
	const bGroup = cH / data.length
	const bH2 = bGroup * 0.65
	const bOff2 = bGroup * 0.175
	const xTicks = Array.from({ length: TICKS + 1 }, (_, i) => (maxVal / TICKS) * i)

	return (
		<div className={`component-chart__inner component-chart__inner--bar${className ? ` ${className}` : ''}`}>
			{(title || subtitle) && (
				<div className="component-chart__header">
					{title && <div className="component-chart__title">{title}</div>}
					{subtitle && <div className="component-chart__subtitle">{subtitle}</div>}
				</div>
			)}
			<svg
				viewBox={`0 0 ${VW} ${VH}`}
				width="100%"
				height={VH}
				aria-label={title ?? 'Bar chart'}
				onMouseLeave={() => setTooltip(null)}
			>
				{xTicks.map((t, i) => {
					const x = PL + (t / maxVal) * cW
					return (
						<g key={i}>
							<line x1={x} y1={PT} x2={x} y2={PT + cH} stroke="#e2e8f0" strokeWidth="1" />
							<text x={x} y={PT + cH + 16} textAnchor="middle" fontSize="11" fill="#94a3b8">{fmt(t)}</text>
						</g>
					)
				})}
				<line x1={PL} y1={PT} x2={PL} y2={PT + cH} stroke="#cbd5e1" strokeWidth="1" />
				{data.map((d, i) => {
					const bW2 = (d.value / maxVal) * cW
					const y = PT + i * bGroup + bOff2
					const color = d.color ?? PALETTE[i % PALETTE.length]
					return (
						<g
							key={i}
							style={{ cursor: onClick ? 'pointer' : undefined }}
							onClick={() => onClick?.(d, i)}
							onMouseEnter={() => setTooltip({ cx: PL + bW2 + 4, cy: y + bH2 / 2, text: `${d.label}: ${fmt(d.value)}` })}
						>
							<rect x={PL} y={y} width={bW2} height={bH2} fill={color} />
							{showValues && (
								<text x={PL + bW2 + 6} y={y + bH2 / 2 + 4} fontSize="11" fill="#1e293b" fontWeight="600">
									{fmt(d.value)}
								</text>
							)}
							<text x={PL - 6} y={y + bH2 / 2 + 4} textAnchor="end" fontSize="11" fill="#64748b">{d.label}</text>
						</g>
					)
				})}
				{tooltip && (
					<g>
						<rect x={tooltip.cx} y={tooltip.cy - 14} width={84} height={19} rx="3" fill="#1e293b" />
						<text x={tooltip.cx + 42} y={tooltip.cy - 1} textAnchor="middle" fontSize="11" fill="#fff">{tooltip.text}</text>
					</g>
				)}
			</svg>
		</div>
	)
}
