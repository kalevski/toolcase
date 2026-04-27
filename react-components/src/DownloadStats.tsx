import React, { useMemo } from 'react'

export interface DownloadStatsProps extends React.HTMLAttributes<HTMLDivElement> {
	packageName: string
	weekly?: number
	monthly?: number
	total?: number
	sparkline?: number[]
	registry?: 'npm' | 'pypi' | 'crates'
}

const formatNumber = (n: number): string => {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
	return String(n)
}

const Sparkline: React.FC<{ data: number[] }> = ({ data }) => {
	const path = useMemo(() => {
		if (data.length === 0) return ''
		const max = Math.max(...data, 1)
		const min = Math.min(...data, 0)
		const range = max - min || 1
		const w = 100
		const h = 28
		return data
			.map((v, i) => {
				const x = (i / Math.max(data.length - 1, 1)) * w
				const y = h - ((v - min) / range) * h
				return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
			})
			.join(' ')
	}, [data])

	return (
		<svg
			className="component-download-stats__sparkline"
			viewBox="0 0 100 28"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
		</svg>
	)
}

export const DownloadStats: React.FC<DownloadStatsProps> = ({
	packageName,
	weekly,
	monthly,
	total,
	sparkline,
	registry = 'npm',
	className = '',
	...rest
}) => {
	const rootClass = `component component-download-stats ${className}`.trim()

	return (
		<div className={rootClass} {...rest}>
			<div className="component-download-stats__head">
				<span className="component-download-stats__registry">{registry}</span>
				<span className="component-download-stats__pkg">{packageName}</span>
			</div>
			<div className="component-download-stats__numbers">
				{weekly !== undefined && (
					<div className="component-download-stats__stat">
						<span className="component-download-stats__value">{formatNumber(weekly)}</span>
						<span className="component-download-stats__label">/ week</span>
					</div>
				)}
				{monthly !== undefined && (
					<div className="component-download-stats__stat">
						<span className="component-download-stats__value">{formatNumber(monthly)}</span>
						<span className="component-download-stats__label">/ month</span>
					</div>
				)}
				{total !== undefined && (
					<div className="component-download-stats__stat">
						<span className="component-download-stats__value">{formatNumber(total)}</span>
						<span className="component-download-stats__label">total</span>
					</div>
				)}
			</div>
			{sparkline && sparkline.length > 0 ? <Sparkline data={sparkline} /> : null}
		</div>
	)
}

export default DownloadStats
