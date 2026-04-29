import React from 'react'

export interface TierItem {
	id: string
	name: React.ReactNode
	range: React.ReactNode
	color?: 'gray' | 'cyan' | 'yellow' | 'pink' | 'red'
}

export interface TierLadderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
	title?: React.ReactNode
	tiers: TierItem[]
	currentTierId?: string
	summary?: React.ReactNode
}

export const TierLadder: React.FC<TierLadderProps> = ({
	title,
	tiers,
	currentTierId,
	summary,
	className = '',
	...rest
}) => {
	return (
		<div className={`component component-tier-ladder ${className}`.trim()} {...rest}>
			{title && <h4 className="component-tier-ladder__title">{title}</h4>}
			<div className="component-tier-ladder__rows" role="list">
				{tiers.map((t) => {
					const isCurrent = t.id === currentTierId
					const cls = [
						'component-tier-ladder__row',
						`component-tier-ladder__row--${t.color ?? 'gray'}`,
						isCurrent ? 'component-tier-ladder__row--current' : '',
					].filter(Boolean).join(' ')
					return (
						<div key={t.id} role="listitem" className={cls} aria-current={isCurrent ? 'true' : undefined}>
							<span className="component-tier-ladder__dot" aria-hidden={true} />
							<span className="component-tier-ladder__name">
								{t.name}
								{isCurrent && <span className="component-tier-ladder__you" aria-hidden={true}> ◀ YOU</span>}
							</span>
							<span className="component-tier-ladder__range">{t.range}</span>
						</div>
					)
				})}
			</div>
			{summary && <div className="component-tier-ladder__summary">{summary}</div>}
		</div>
	)
}
