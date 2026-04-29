import React from 'react'

export type BriefDifficulty = 'easy' | 'medium' | 'hard'

export interface BriefCardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'id' | 'title'> {
	id: string
	icon?: React.ReactNode
	difficulty: BriefDifficulty
	title: React.ReactNode
	body: React.ReactNode
	metaLeft?: React.ReactNode
	metaRight?: React.ReactNode
	onClick?: () => void
}

export const BriefCard: React.FC<BriefCardProps> = ({
	id,
	icon,
	difficulty,
	title,
	body,
	metaLeft,
	metaRight,
	onClick,
	className = '',
	...rest
}) => {
	const interactive = typeof onClick === 'function'
	const rootClass = [
		'component component-brief-card',
		`component-brief-card--${difficulty}`,
		interactive ? 'component-brief-card--interactive' : '',
		className,
	].filter(Boolean).join(' ')

	const interactiveProps: React.HTMLAttributes<HTMLElement> = interactive
		? {
				role: 'button',
				tabIndex: 0,
				onClick,
				onKeyDown: (e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault()
						onClick!()
					}
				},
			}
		: {}

	return (
		<article className={rootClass} {...interactiveProps} {...rest}>
			{icon && <div className="component-brief-card__icon" aria-hidden={true}>{icon}</div>}
			<div className="component-brief-card__id">{id}</div>
			<div className="component-brief-card__diff">{difficulty.toUpperCase()}</div>
			<h3 className="component-brief-card__title">{title}</h3>
			<p className="component-brief-card__body">{body}</p>
			{(metaLeft || metaRight) && (
				<div className="component-brief-card__meta">
					<span className="component-brief-card__meta-left">{metaLeft}</span>
					<span className="component-brief-card__meta-right">{metaRight}</span>
				</div>
			)}
		</article>
	)
}
