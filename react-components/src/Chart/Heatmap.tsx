import React, { useState } from 'react'
import { Skeleton } from '../Skeleton'

export interface HeatmapCell {
	row: string | number
	col: string | number
	value: number
}

export interface HeatmapProps {
	data: HeatmapCell[]
	rows: (string | number)[]
	cols: (string | number)[]
	title?: string
	subtitle?: string
	colorScale?: string[]
	cellSize?: number
	loading?: boolean
	className?: string
}

const DEFAULT_SCALE = ['#f1f5f9', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8']

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
	const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
	return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : null
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const interpolateColor = (scale: string[], t: number): string => {
	if (t <= 0) return scale[0]
	if (t >= 1) return scale[scale.length - 1]
	const seg = (scale.length - 1) * t
	const lo = Math.floor(seg)
	const hi = Math.ceil(seg)
	const f = seg - lo
	const c1 = hexToRgb(scale[lo])
	const c2 = hexToRgb(scale[hi])
	if (!c1 || !c2) return scale[lo]
	return `rgb(${Math.round(lerp(c1.r, c2.r, f))},${Math.round(lerp(c1.g, c2.g, f))},${Math.round(lerp(c1.b, c2.b, f))})`
}

export const Heatmap: React.FC<HeatmapProps> = ({
	data,
	rows,
	cols,
	title,
	subtitle,
	colorScale = DEFAULT_SCALE,
	cellSize = 28,
	loading = false,
	className = '',
}) => {
	const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

	if (loading) {
		return (
			<div className={`component-chart__inner component-chart__inner--heatmap${className ? ` ${className}` : ''}`}>
				{title && <div className="component-chart__header"><Skeleton width="40%" /></div>}
				<Skeleton height={200} />
			</div>
		)
	}

	const allVals = data.map(d => d.value)
	const minVal = Math.min(...allVals)
	const maxVal = Math.max(...allVals)
	const range = maxVal - minVal || 1

	const LABEL_W = 80
	const HEADER_H = 22
	const GAP = 2
	const svgW = LABEL_W + cols.length * (cellSize + GAP) + 20
	const svgH = HEADER_H + rows.length * (cellSize + GAP) + 10

	const cellMap = new Map(data.map(d => [`${d.row}::${d.col}`, d.value]))

	return (
		<div className={`component-chart__inner component-chart__inner--heatmap${className ? ` ${className}` : ''}`}>
			{(title || subtitle) && (
				<div className="component-chart__header">
					{title && <div className="component-chart__title">{title}</div>}
					{subtitle && <div className="component-chart__subtitle">{subtitle}</div>}
				</div>
			)}
			<div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] }}>
				<svg
					width={svgW}
					height={svgH}
					aria-label={title ?? 'Heatmap'}
					onMouseLeave={() => setTooltip(null)}
				>
					{/* Column headers */}
					{cols.map((col, ci) => (
						<text
							key={ci}
							x={LABEL_W + ci * (cellSize + GAP) + cellSize / 2}
							y={HEADER_H - 5}
							textAnchor="middle"
							fontSize="10"
							fill="#64748b"
						>
							{String(col)}
						</text>
					))}
					{/* Rows */}
					{rows.map((row, ri) => (
						<g key={ri}>
							<text
								x={LABEL_W - 6}
								y={HEADER_H + ri * (cellSize + GAP) + cellSize / 2 + 4}
								textAnchor="end"
								fontSize="10"
								fill="#64748b"
							>
								{String(row)}
							</text>
							{cols.map((col, ci) => {
								const v = cellMap.get(`${row}::${col}`)
								const t = v !== undefined ? (v - minVal) / range : -1
								const fill = t >= 0 ? interpolateColor(colorScale, t) : '#f8fafc'
								const cx = LABEL_W + ci * (cellSize + GAP)
								const cy = HEADER_H + ri * (cellSize + GAP)
								return (
									<rect
										key={ci}
										x={cx}
										y={cy}
										width={cellSize}
										height={cellSize}
										fill={fill}
										onMouseEnter={() => v !== undefined && setTooltip({
											x: cx + cellSize / 2,
											y: cy - 8,
											text: `${row} / ${col}: ${v}`,
										})}
									/>
								)
							})}
						</g>
					))}
					{/* Tooltip */}
					{tooltip && (
						<g>
							<rect x={tooltip.x - 52} y={tooltip.y - 18} width={104} height={19} rx="3" fill="#1e293b" />
							<text x={tooltip.x} y={tooltip.y - 5} textAnchor="middle" fontSize="10" fill="#fff">{tooltip.text}</text>
						</g>
					)}
				</svg>
			</div>
		</div>
	)
}
