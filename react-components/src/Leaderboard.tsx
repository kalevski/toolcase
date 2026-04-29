import React from 'react'
import { RankCell } from './RankCell'
import { LeaderboardTrend, LeaderboardTrendDirection } from './LeaderboardTrend'

export interface LeaderboardEntry {
	id: string
	rank: number
	displayName: React.ReactNode
	handle?: React.ReactNode
	avatar?: React.ReactNode
	tierLabel?: React.ReactNode
	tierColor?: 'cyan' | 'yellow' | 'pink' | 'red' | 'gray'
	sprints?: React.ReactNode
	trendValue?: React.ReactNode
	trendDirection?: LeaderboardTrendDirection
	points: React.ReactNode
	highlight?: boolean
}

export interface LeaderboardProps extends React.HTMLAttributes<HTMLDivElement> {
	entries: LeaderboardEntry[]
	columns?: {
		rank?: string
		dev?: string
		tier?: string
		sprints?: string
		trend?: string
		points?: string
	}
}

const DEFAULT_HEADERS = {
	rank: 'RANK',
	dev: 'DEV',
	tier: 'TIER',
	sprints: 'SPR',
	trend: '7D Δ',
	points: 'POINTS',
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
	entries,
	columns,
	className = '',
	...rest
}) => {
	const headers = { ...DEFAULT_HEADERS, ...(columns ?? {}) }

	return (
		<div className={`component component-leaderboard ${className}`.trim()} role="table" {...rest}>
			<div className="component-leaderboard__head" role="row">
				<div role="columnheader">{headers.rank}</div>
				<div role="columnheader">{headers.dev}</div>
				<div role="columnheader">{headers.tier}</div>
				<div role="columnheader">{headers.sprints}</div>
				<div role="columnheader">{headers.trend}</div>
				<div role="columnheader">{headers.points}</div>
			</div>
			{entries.map((e) => {
				const cls = [
					'component-leaderboard__row',
					e.rank === 1 ? 'component-leaderboard__row--top1' : '',
					e.rank === 2 ? 'component-leaderboard__row--top2' : '',
					e.rank === 3 ? 'component-leaderboard__row--top3' : '',
					e.highlight ? 'component-leaderboard__row--me' : '',
				].filter(Boolean).join(' ')
				return (
					<div key={e.id} className={cls} role="row">
						<div role="cell" className="component-leaderboard__rank">
							<RankCell rank={e.rank} />
						</div>
						<div role="cell" className="component-leaderboard__name">
							{e.avatar && <span className="component-leaderboard__avatar">{e.avatar}</span>}
							<span className="component-leaderboard__handle">
								<b>{e.displayName}</b>
								{e.handle && <span className="component-leaderboard__sub">{e.handle}</span>}
							</span>
						</div>
						<div role="cell">
							{e.tierLabel && (
								<span
									className={`component-leaderboard__tier component-leaderboard__tier--${e.tierColor ?? 'gray'}`}
								>
									{e.tierLabel}
								</span>
							)}
						</div>
						<div role="cell" className="component-leaderboard__spr">{e.sprints}</div>
						<div role="cell" className="component-leaderboard__trend">
							{e.trendDirection ? (
								<LeaderboardTrend value={e.trendValue ?? ''} direction={e.trendDirection} />
							) : null}
						</div>
						<div role="cell" className="component-leaderboard__pts">{e.points}</div>
					</div>
				)
			})}
		</div>
	)
}
