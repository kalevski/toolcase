import React, { useState } from 'react'
import { Skeleton } from '../Skeleton'

export interface FunnelStep {
	label: string
	value: number
	color?: string
}

export interface FunnelChartProps {
	data: FunnelStep[]
	title?: string
	subtitle?: string
	height?: number
	showLabels?: boolean
	loading?: boolean
	onClick?: (step: FunnelStep, index: number) => void
	className?: string
}

const PALETTE = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#dde4ff', '#e8ecfe', '#f0f3ff']

export const FunnelChart: React.FC<FunnelChartProps> = ({
	data,
	title,
	subtitle,
	height = 300,
	showLabels = true,
	loading = false,
	onClick,
	className = '',
}) => {
	const [activeIndex, setActiveIndex] = useState<number | null>(null)

	if (loading) {
		return (
			<div className={`component-chart__inner component-chart__inner--funnel${className ? ` ${className}` : ''}`}>
				{title && <div className="component-chart__header"><Skeleton width="40%" /></div>}
				<Skeleton height={height} />
			</div>
		)
	}

	if (!data?.length) {
		return (
			<div className={`component-chart__inner component-chart__inner--funnel${className ? ` ${className}` : ''}`}>
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

	const maxVal = Math.max(...data.map(d => d.value))
	const VW = 560
	const VH = height
	const stepH = VH / data.length
	const maxW = VW * 0.88
	const cx = VW / 2
	const GAP = 2

	const steps = data.map((d, i) => {
		const w = (d.value / maxVal) * maxW
		const prevW = i === 0 ? maxW : (data[i - 1].value / maxVal) * maxW
		const color = d.color ?? PALETTE[i % PALETTE.length]
		const y = i * stepH
		const pct = data[0].value > 0 ? Math.round((d.value / data[0].value) * 100) : 100
		const topL = cx - prevW / 2
		const topR = cx + prevW / 2
		const botL = cx - w / 2
		const botR = cx + w / 2
		const yTop = y + GAP
		const yBot = y + stepH - GAP
		const points = `${topL.toFixed(1)},${yTop.toFixed(1)} ${topR.toFixed(1)},${yTop.toFixed(1)} ${botR.toFixed(1)},${yBot.toFixed(1)} ${botL.toFixed(1)},${yBot.toFixed(1)}`
		return { ...d, color, pct, points, midY: y + stepH / 2 }
	})

	return (
		<div className={`component-chart__inner component-chart__inner--funnel${className ? ` ${className}` : ''}`}>
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
				aria-label={title ?? 'Funnel chart'}
				onMouseLeave={() => setActiveIndex(null)}
			>
				{steps.map((s, i) => (
					<g
						key={i}
						style={{
							cursor: onClick ? 'pointer' : undefined,
							opacity: activeIndex !== null && activeIndex !== i ? 0.72 : 1,
							transition: 'opacity 0.15s ease',
						}}
						onClick={() => onClick?.(s, i)}
						onMouseEnter={() => setActiveIndex(i)}
					>
						<polygon points={s.points} fill={s.color} />
						{showLabels && (
							<>
								<text
									x={cx}
									y={s.midY - 6}
									textAnchor="middle"
									dominantBaseline="middle"
									fontSize="12"
									fill="#fff"
									fontWeight="600"
									style={{ pointerEvents: 'none' }}
								>
									{s.label}
								</text>
								<text
									x={cx}
									y={s.midY + 10}
									textAnchor="middle"
									dominantBaseline="middle"
									fontSize="11"
									fill="rgba(255,255,255,0.9)"
									style={{ pointerEvents: 'none' }}
								>
									{s.value.toLocaleString()}{i > 0 ? ` (${s.pct}%)` : ''}
								</text>
							</>
						)}
					</g>
				))}
			</svg>
		</div>
	)
}
