import React from 'react'

export interface Contributor {
	login: string
	avatarUrl: string
	contributions?: number
	profileUrl?: string
}

export interface ContributorWallProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
	contributors: Contributor[]
	maxVisible?: number
	title?: React.ReactNode
}

export const ContributorWall: React.FC<ContributorWallProps> = ({
	contributors,
	maxVisible,
	title,
	className = '',
	...rest
}) => {
	const visible = maxVisible ? contributors.slice(0, maxVisible) : contributors
	const overflow = maxVisible ? Math.max(0, contributors.length - maxVisible) : 0
	const rootClass = `component component-contributor-wall ${className}`.trim()

	return (
		<section className={rootClass} {...rest}>
			{title ? <h3 className="component-contributor-wall__title">{title}</h3> : null}
			<div className="component-contributor-wall__grid">
				{visible.map((c) => {
					const tooltip = c.contributions
						? `@${c.login} — ${c.contributions} contributions`
						: `@${c.login}`
					const inner = (
						<>
							<img
								src={c.avatarUrl}
								alt={c.login}
								className="component-contributor-wall__avatar"
								loading="lazy"
							/>
							<span className="component-contributor-wall__login">{c.login}</span>
						</>
					)
					return c.profileUrl ? (
						<a
							key={c.login}
							href={c.profileUrl}
							className="component-contributor-wall__item"
							title={tooltip}
							target="_blank"
							rel="noopener noreferrer"
						>
							{inner}
						</a>
					) : (
						<span key={c.login} className="component-contributor-wall__item" title={tooltip}>
							{inner}
						</span>
					)
				})}
				{overflow > 0 && (
					<span className="component-contributor-wall__overflow">+{overflow} more</span>
				)}
			</div>
		</section>
	)
}

export default ContributorWall
