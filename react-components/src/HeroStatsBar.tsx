import React from 'react'

export interface HeroStat {
	key: React.ReactNode
	value: React.ReactNode
	unit?: React.ReactNode
	zero?: boolean
}

export interface HeroStatsBarProps extends React.HTMLAttributes<HTMLDivElement> {
	stats: HeroStat[]
}

export const HeroStatsBar: React.FC<HeroStatsBarProps> = ({
	stats,
	className = '',
	style,
	...rest
}) => {
	const gridStyle: React.CSSProperties = {
		'--hsb-cols': stats.length,
		...style,
	} as React.CSSProperties
	return (
		<div
			className={`component component-hero-stats-bar ${className}`.trim()}
			style={gridStyle}
			role="list"
			{...rest}
		>
			{stats.map((s, i) => (
				<div
					key={i}
					role="listitem"
					className={[
						'component-hero-stats-bar__cell',
						s.zero ? 'component-hero-stats-bar__cell--zero' : '',
					].filter(Boolean).join(' ')}
				>
					<div className="component-hero-stats-bar__key">{s.key}</div>
					<div className="component-hero-stats-bar__value">
						{s.value}
						{s.unit && <small className="component-hero-stats-bar__unit">{s.unit}</small>}
					</div>
				</div>
			))}
		</div>
	)
}
