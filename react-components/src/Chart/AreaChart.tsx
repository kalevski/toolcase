import React, { useState } from 'react'
import { Skeleton } from '../Skeleton'
import type { LineChartSeries } from './LineChart'

export type { LineChartSeries as AreaChartSeries }

export interface AreaChartProps {
	series: LineChartSeries[]
	title?: string
	subtitle?: string
	height?: number
	stacked?: boolean
	showGrid?: boolean
	showLegend?: boolean
	xFormatter?: (v: string | number) => string
	yFormatter?: (v: number) => string
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

export const AreaChart: React.FC<AreaChartProps> = ({
	series,
	title,
	subtitle,
	height = 260,
	showGrid = true,
	showLegend = true,
	xFormatter,
	yFormatter,
	loading = false,
	className = '',
}) => {
	const [tooltip, setTooltip] = useState<TooltipState | null>(null)
	const fmt = yFormatter ?? defaultFmt

	if (loading) {
		return (
			<div className={`component-chart__inner component-chart__inner--area${className ? ` ${className}` : ''}`}>
				{title && <div className="component-chart__header"><Skeleton width="40%" /></div>}
				<Skeleton height={height} />
			</div>
		)
	}

	if (!series?.length) {
		return (
			<div className={`component-chart__inner component-chart__inner--area${className ? ` ${className}` : ''}`}>
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

	const allX = Array.from(new Set(series.flatMap(s => s.data.map(p => String(p.x)))))
	const allYVals = series.flatMap(s => s.data.map(p => p.y))
	const yMax = niceMax(Math.max(...allYVals) * 1.1)

	const VW = 560, VH = height
	const PL = 52, PR = 20, PT = 18, PB = 40
	const cW = VW - PL - PR
	const cH = VH - PT - PB

	const YTICKS = 5
	const yTicks = Array.from({ length: YTICKS + 1 }, (_, i) => (yMax / YTICKS) * i)

	const xPos = (xVal: string | number): number => {
		const idx = allX.indexOf(String(xVal))
		if (allX.length <= 1) return PL + cW / 2
		return PL + (idx / (allX.length - 1)) * cW
	}
	const yPos = (yVal: number): number => PT + cH - (yVal / yMax) * cH
	const baseline = PT + cH

	return (
		<div className={`component-chart__inner component-chart__inner--area${className ? ` ${className}` : ''}`}>
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
				aria-label={title ?? 'Area chart'}
				onMouseLeave={() => setTooltip(null)}
			>
				{/* Grid + Y labels */}
				{showGrid && yTicks.map((t, i) => {
					const y = yPos(t)
					return (
						<g key={i}>
							<line x1={PL} y1={y} x2={PL + cW} y2={y} stroke="#e2e8f0" strokeWidth="1" />
							<text x={PL - 6} y={y + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{fmt(t)}</text>
						</g>
					)
				})}
				{/* X labels */}
				{allX.map((x, i) => {
					const skip = Math.ceil(allX.length / 10)
					if (i % skip !== 0 && i !== allX.length - 1) return null
					return (
						<text key={i} x={xPos(x)} y={PT + cH + 18} textAnchor="middle" fontSize="11" fill="#64748b">
							{xFormatter ? xFormatter(x) : x}
						</text>
					)
				})}
				{/* Axes */}
				<line x1={PL} y1={baseline} x2={PL + cW} y2={baseline} stroke="#cbd5e1" strokeWidth="1" />
				<line x1={PL} y1={PT} x2={PL} y2={baseline} stroke="#e2e8f0" strokeWidth="1" />
				{/* Area fills (rendered below lines) */}
				{series.map((s, si) => {
					const color = s.color ?? PALETTE[si % PALETTE.length]
					const pts = s.data.filter(p => allX.includes(String(p.x)))
					if (!pts.length) return null
					const first = pts[0], last = pts[pts.length - 1]
					const areaD = [
						`M ${xPos(first.x).toFixed(1)} ${baseline.toFixed(1)}`,
						...pts.map(p => `L ${xPos(p.x).toFixed(1)} ${yPos(p.y).toFixed(1)}`),
						`L ${xPos(last.x).toFixed(1)} ${baseline.toFixed(1)}`,
						'Z',
					].join(' ')
					return <path key={si} d={areaD} fill={color} fillOpacity="0.12" stroke="none" />
				})}
				{/* Lines + dots */}
				{series.map((s, si) => {
					const color = s.color ?? PALETTE[si % PALETTE.length]
					const pts = s.data.filter(p => allX.includes(String(p.x)))
					if (!pts.length) return null
					const d = pts.map((p, pi) =>
						`${pi === 0 ? 'M' : 'L'} ${xPos(p.x).toFixed(1)} ${yPos(p.y).toFixed(1)}`
					).join(' ')
					return (
						<g key={si}>
							<path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
							{pts.map((p, pi) => (
								<circle
									key={pi}
									cx={xPos(p.x)}
									cy={yPos(p.y)}
									r="3.5"
									fill={color}
									stroke="#fff"
									strokeWidth="1.5"
									style={{ cursor: 'pointer' }}
									onMouseEnter={() => setTooltip({
										cx: xPos(p.x),
										cy: yPos(p.y) - 14,
										text: `${s.label}: ${fmt(p.y)}`,
									})}
								/>
							))}
						</g>
					)
				})}
				{/* Tooltip */}
				{tooltip && (
					<g>
						<rect x={tooltip.cx - 52} y={tooltip.cy - 17} width={104} height={19} rx="3" fill="#1e293b" />
						<text x={tooltip.cx} y={tooltip.cy - 4} textAnchor="middle" fontSize="11" fill="#fff">{tooltip.text}</text>
					</g>
				)}
			</svg>
			{showLegend && series.length > 1 && (
				<div className="component-chart__legend">
					{series.map((s, si) => (
						<div key={si} className="component-chart__legend-item">
							<span className="component-chart__legend-dot" style={{ background: s.color ?? PALETTE[si % PALETTE.length] }} />
							<span>{s.label}</span>
						</div>
					))}
				</div>
			)}
		</div>
	)
}
