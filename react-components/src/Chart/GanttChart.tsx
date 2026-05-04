import React, { useMemo } from 'react'
import { Skeleton } from '../Skeleton'

export interface GanttTask {
	id: string
	label: string
	start: string
	end: string
	color?: string
	progress?: number
	dependencies?: string[]
}

export interface GanttChartProps {
	tasks: GanttTask[]
	title?: string
	subtitle?: string
	startDate?: string
	endDate?: string
	loading?: boolean
	onTaskClick?: (task: GanttTask) => void
	className?: string
}

const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

const LABEL_W = 130
const ROW_H = 36
const HEADER_H = 32
const VW = 700
const CHART_W = VW - LABEL_W
const DAY_MS = 86_400_000

export const GanttChart: React.FC<GanttChartProps> = ({
	tasks,
	title,
	subtitle,
	startDate,
	endDate,
	loading = false,
	onTaskClick,
	className = '',
}) => {
	const { markers, resolvedTasks, svgH } = useMemo(() => {
		if (!tasks.length) return { markers: [], resolvedTasks: [], svgH: HEADER_H + 10 }

		const starts = tasks.map(t => new Date(t.start).getTime())
		const ends = tasks.map(t => new Date(t.end).getTime())
		const ts = startDate ? new Date(startDate).getTime() : Math.min(...starts)
		const te = endDate ? new Date(endDate).getTime() : Math.max(...ends)
		const totalMs = te - ts || DAY_MS

		const xFor = (ts2: number): number => LABEL_W + ((ts2 - ts) / totalMs) * CHART_W

		const totalDays = Math.ceil(totalMs / DAY_MS)
		const stepDays = Math.max(1, Math.ceil(totalDays / 8))
		const mks: { x: number; label: string }[] = []
		for (let d = 0; d <= totalDays; d += stepDays) {
			const dt = new Date(ts + d * DAY_MS)
			mks.push({
				x: LABEL_W + (d / totalDays) * CHART_W,
				label: `${dt.getMonth() + 1}/${dt.getDate()}`,
			})
		}

		const rt = tasks.map((t, i) => {
			const s = new Date(t.start).getTime()
			const e = new Date(t.end).getTime()
			return {
				...t,
				color: t.color ?? PALETTE[i % PALETTE.length],
				x: xFor(s),
				x2: xFor(e),
				y: HEADER_H + i * ROW_H,
			}
		})

		return {
			markers: mks,
			resolvedTasks: rt,
			svgH: HEADER_H + tasks.length * ROW_H + 8,
		}
	}, [tasks, startDate, endDate])

	if (loading) {
		return (
			<div className={`component-chart__inner component-chart__inner--gantt${className ? ` ${className}` : ''}`}>
				{title && <div className="component-chart__header"><Skeleton width="40%" /></div>}
				<Skeleton height={200} />
			</div>
		)
	}

	if (!tasks?.length) {
		return (
			<div className={`component-chart__inner component-chart__inner--gantt${className ? ` ${className}` : ''}`}>
				{(title || subtitle) && (
					<div className="component-chart__header">
						{title && <div className="component-chart__title">{title}</div>}
						{subtitle && <div className="component-chart__subtitle">{subtitle}</div>}
					</div>
				)}
				<div className="component-chart__empty">No tasks</div>
			</div>
		)
	}

	return (
		<div className={`component-chart__inner component-chart__inner--gantt${className ? ` ${className}` : ''}`}>
			{(title || subtitle) && (
				<div className="component-chart__header">
					{title && <div className="component-chart__title">{title}</div>}
					{subtitle && <div className="component-chart__subtitle">{subtitle}</div>}
				</div>
			)}
			<div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] }}>
				<svg
					width={VW}
					height={svgH}
					aria-label={title ?? 'Gantt chart'}
				>
					{/* Alternating row stripes */}
					{resolvedTasks.map((t, i) => (
						<rect
							key={i}
							x={0}
							y={HEADER_H + i * ROW_H}
							width={VW}
							height={ROW_H}
							fill={i % 2 === 0 ? '#ffffff' : '#f8fafc'}
						/>
					))}
					{/* Header background */}
					<rect x={0} y={0} width={VW} height={HEADER_H} fill="#f1f5f9" />
					{/* Date markers */}
					{markers.map((m, i) => (
						<g key={i}>
							<line x1={m.x} y1={HEADER_H - 8} x2={m.x} y2={svgH} stroke="#e2e8f0" strokeWidth="1" />
							<text x={m.x} y={HEADER_H - 10} textAnchor="middle" fontSize="9" fill="#94a3b8">{m.label}</text>
						</g>
					))}
					{/* Task rows */}
					{resolvedTasks.map((t, i) => {
						const barW = Math.max(t.x2 - t.x, 4)
						const barH = ROW_H * 0.5
						const barY = t.y + ROW_H * 0.25
						return (
							<g
								key={i}
								style={{ cursor: onTaskClick ? 'pointer' : undefined }}
								onClick={() => onTaskClick?.(t)}
								aria-label={t.label}
							>
								{/* Row label */}
								<text
									x={LABEL_W - 8}
									y={t.y + ROW_H / 2 + 4}
									textAnchor="end"
									fontSize="11"
									fill="#1e293b"
								>
									{t.label.length > 14 ? `${t.label.slice(0, 13)}…` : t.label}
								</text>
								{/* Task bar */}
								{t.progress !== undefined ? (
									<>
										<rect x={t.x} y={barY} width={barW} height={barH} fill={t.color} fillOpacity="0.3" />
										<rect x={t.x} y={barY} width={barW * (t.progress / 100)} height={barH} fill={t.color} />
									</>
								) : (
									<rect x={t.x} y={barY} width={barW} height={barH} fill={t.color} />
								)}
							</g>
						)
					})}
					{/* Left border */}
					<line x1={LABEL_W} y1={0} x2={LABEL_W} y2={svgH} stroke="#e2e8f0" strokeWidth="1" />
				</svg>
			</div>
		</div>
	)
}
