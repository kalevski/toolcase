import React from 'react'

export interface RankCellProps extends React.HTMLAttributes<HTMLSpanElement> {
	rank: number
	pad?: number
}

function rankTier(rank: number): 'top1' | 'top2' | 'top3' | 'rest' {
	if (rank === 1) return 'top1'
	if (rank === 2) return 'top2'
	if (rank === 3) return 'top3'
	return 'rest'
}

export const RankCell: React.FC<RankCellProps> = ({
	rank,
	pad = 2,
	className = '',
	...rest
}) => {
	const tier = rankTier(rank)
	return (
		<span
			className={`component component-rank-cell component-rank-cell--${tier} ${className}`.trim()}
			{...rest}
		>
			{String(rank).padStart(pad, '0')}
		</span>
	)
}
