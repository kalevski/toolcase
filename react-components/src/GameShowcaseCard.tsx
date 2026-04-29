import React from 'react'
import { Stamp, StampColor } from './Stamp'

export type ComplianceState = 'yes' | 'no' | 'flag'

export interface GameStamp {
	label: React.ReactNode
	color?: StampColor
}

export interface GameShowcaseCardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
	art?: React.ReactNode
	artPlaceholder?: React.ReactNode
	stamps?: GameStamp[]
	metaLeft?: React.ReactNode
	metaRight?: React.ReactNode
	title: React.ReactNode
	pitch: React.ReactNode
	tags?: string[]
	compliance?: ComplianceState[]
	onClick?: () => void
}

export const GameShowcaseCard: React.FC<GameShowcaseCardProps> = ({
	art,
	artPlaceholder = '[ BUILD · CAPTURE ]',
	stamps,
	metaLeft,
	metaRight,
	title,
	pitch,
	tags,
	compliance,
	onClick,
	className = '',
	...rest
}) => {
	const interactive = typeof onClick === 'function'
	const rootClass = [
		'component component-game-showcase',
		interactive ? 'component-game-showcase--interactive' : '',
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
			<div className="component-game-showcase__art">
				{art ?? <div className="component-game-showcase__placeholder">{artPlaceholder}</div>}
				{stamps && stamps.length > 0 && (
					<div className="component-game-showcase__stamps">
						{stamps.map((s, i) => (
							<Stamp key={i} label={s.label} color={s.color} position="tl" />
						))}
					</div>
				)}
			</div>
			<div className="component-game-showcase__info">
				{(metaLeft || metaRight) && (
					<div className="component-game-showcase__meta">
						<span>{metaLeft}</span>
						<span>{metaRight}</span>
					</div>
				)}
				<h5 className="component-game-showcase__title">{title}</h5>
				<p className="component-game-showcase__pitch">{pitch}</p>
				{(tags || compliance) && (
					<div className="component-game-showcase__foot">
						{tags && <span className="component-game-showcase__tags">{tags.join(' · ')}</span>}
						{compliance && (
							<span className="component-game-showcase__compliance" aria-label="brief compliance">
								{compliance.map((c, i) => (
									<span
										key={i}
										className={`component-game-showcase__comp component-game-showcase__comp--${c}`}
										aria-hidden={true}
									/>
								))}
							</span>
						)}
					</div>
				)}
			</div>
		</article>
	)
}
