import React from 'react'

export type LeaderboardTrendDirection = 'up' | 'down' | 'flat'

export interface LeaderboardTrendProps extends React.HTMLAttributes<HTMLSpanElement> {
	value: React.ReactNode
	direction: LeaderboardTrendDirection
}

const ARROW: Record<LeaderboardTrendDirection, string> = {
	up: '▲',
	down: '▼',
	flat: '—',
}

export const LeaderboardTrend: React.FC<LeaderboardTrendProps> = ({
	value,
	direction,
	className = '',
	...rest
}) => (
	<span
		className={`component component-leaderboard-trend component-leaderboard-trend--${direction} ${className}`.trim()}
		{...rest}
	>
		<span className="component-leaderboard-trend__arrow" aria-hidden={true}>{ARROW[direction]}</span>
		<span className="component-leaderboard-trend__value">{value}</span>
	</span>
)
