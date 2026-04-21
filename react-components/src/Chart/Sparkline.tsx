import React from 'react'

export interface SparklineProps {
	data: number[]
	type?: 'line' | 'bar'
	color?: string
	height?: number
	width?: number
	className?: string
}

export const Sparkline: React.FC<SparklineProps> = ({
	data,
	type = 'line',
	color = '#6366f1',
	height = 32,
	width = 120,
	className = '',
}) => {
	if (!data || data.length === 0) return null

	const min = Math.min(...data)
	const max = Math.max(...data)
	const range = max - min || 1
	const scaleY = (v: number) => height - 2 - ((v - min) / range) * (height - 4)

	if (type === 'line') {
		const d = data.map((v, i) => {
			const x = (data.length === 1 ? width / 2 : (i / (data.length - 1)) * width).toFixed(2)
			const y = scaleY(v).toFixed(2)
			return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
		}).join(' ')

		return (
			<svg
				viewBox={`0 0 ${width} ${height}`}
				width={width}
				height={height}
				aria-hidden="true"
				className={`component-chart__sparkline${className ? ` ${className}` : ''}`}
			>
				<path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
			</svg>
		)
	}

	const bw = width / data.length
	return (
		<svg
			viewBox={`0 0 ${width} ${height}`}
			width={width}
			height={height}
			aria-hidden="true"
			className={`component-chart__sparkline${className ? ` ${className}` : ''}`}
		>
			{data.map((v, i) => {
				const bh = ((v - min) / range) * (height - 2) + 2
				return (
					<rect
						key={i}
						x={i * bw + 1}
						y={height - bh}
						width={Math.max(bw - 2, 1)}
						height={bh}
						fill={color}
					/>
				)
			})}
		</svg>
	)
}
