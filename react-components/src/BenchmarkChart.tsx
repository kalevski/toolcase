import React, { useMemo } from 'react'

export interface BenchmarkBar {
	label: string
	value: number
	unit?: string
	color?: string
	baseline?: boolean
}

export interface BenchmarkChartProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
	bars: BenchmarkBar[]
	lowerIsBetter?: boolean
	scale?: 'linear' | 'log'
	title?: React.ReactNode
}

const formatValue = (n: number): string => {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
	return n.toLocaleString()
}

export const BenchmarkChart: React.FC<BenchmarkChartProps> = ({
	bars,
	lowerIsBetter = false,
	scale = 'linear',
	title,
	className = '',
	...rest
}) => {
	const { max, leaderIndex } = useMemo(() => {
		const values = bars.map((b) => b.value)
		const m = Math.max(...values, 1)
		const target = lowerIsBetter ? Math.min(...values) : Math.max(...values)
		const idx = values.findIndex((v) => v === target)
		return { max: m, leaderIndex: idx }
	}, [bars, lowerIsBetter])

	const computeWidth = (value: number): number => {
		if (scale === 'log') {
			const logVal = Math.log10(Math.max(value, 1))
			const logMax = Math.log10(Math.max(max, 1))
			return logMax > 0 ? (logVal / logMax) * 100 : 0
		}
		return (value / max) * 100
	}

	const rootClass = `component component-benchmark-chart ${className}`.trim()

	return (
		<div className={rootClass} {...rest}>
			{title ? <h3 className="component-benchmark-chart__title">{title}</h3> : null}
			<div className="component-benchmark-chart__bars">
				{bars.map((bar, i) => {
					const isLeader = i === leaderIndex
					const accent = bar.color
						? ({ '--bch-accent': bar.color } as React.CSSProperties)
						: undefined
					return (
						<div
							key={`${bar.label}-${i}`}
							className={`component-benchmark-chart__bar ${isLeader ? 'component-benchmark-chart__bar--leader' : ''} ${bar.baseline ? 'component-benchmark-chart__bar--baseline' : ''}`}
							style={accent}
						>
							<div className="component-benchmark-chart__label">{bar.label}</div>
							<div className="component-benchmark-chart__track">
								<div
									className="component-benchmark-chart__fill"
									style={{ width: `${computeWidth(bar.value)}%` }}
								/>
							</div>
							<div className="component-benchmark-chart__value">
								{formatValue(bar.value)}
								{bar.unit ? <span className="component-benchmark-chart__unit"> {bar.unit}</span> : null}
							</div>
						</div>
					)
				})}
			</div>
			<div className="component-benchmark-chart__caption">
				{lowerIsBetter ? 'Lower is better' : 'Higher is better'}
			</div>
		</div>
	)
}

export default BenchmarkChart
