import type { FC, HTMLAttributes } from 'react'
import { Tag } from './Tag'
import { Skeleton } from './Skeleton'

export interface ChangelogEntry {
	id?: string | number
	date: string
	title: string
	description: string
	tag?: string
}

export interface ChangelogProps extends HTMLAttributes<HTMLElement> {
	entries: ChangelogEntry[]
	maxVisible?: number
	readMoreHref: string
	readMoreLabel?: string
	loading?: boolean
}

export const Changelog: FC<ChangelogProps> = ({
	entries,
	maxVisible = 5,
	readMoreHref,
	readMoreLabel = 'View full changelog',
	loading = false,
	className,
	...rest
}) => {
	const visibleEntries = entries.slice(0, maxVisible)

	const rootClassName = ['component component-changelog', className].filter(Boolean).join(' ')

	if (!loading && visibleEntries.length === 0) {
		return null
	}

	return (
		<section className={rootClassName} {...rest}>
			<div className="component-changelog__inner">
				<header className="component-changelog__header">
					{loading ? (
						<div className="component-changelog__header-copy">
							<Skeleton width="30%" />
							<Skeleton width="50%" height="1.5em" />
						</div>
					) : (
						<div className="component-changelog__header-copy">
							<p className="component-changelog__eyebrow">Latest updates</p>
							<h2 className="component-changelog__title">Product changelog</h2>
							<p className="component-changelog__subtitle">
								Stay up to date with the most recent improvements, fixes, and new features.
							</p>
						</div>
					)}
					{!loading && (
						<a href={readMoreHref} className="component-changelog__read-more-button">
							{readMoreLabel}
						</a>
					)}
				</header>

				<div className="component-changelog__slider" aria-live="polite">
					<div className="component-changelog__track">
						{loading ? (
							Array.from({ length: maxVisible }, (_, i) => (
								<article key={i} className="component-changelog__item">
									<Skeleton width="25%" />
									<Skeleton width="60%" height="1.25em" />
									<Skeleton count={2} />
								</article>
							))
						) : visibleEntries.map((entry, index) => (
							<article key={entry.id ?? `${entry.date}-${index}`} className="component-changelog__item">
								<div className="component-changelog__item-meta">
									<span className="component-changelog__item-date">{entry.date}</span>
								{entry.tag && <Tag label={entry.tag} variant="primary" />}
								</div>
								<h3 className="component-changelog__item-title">{entry.title}</h3>
								<p className="component-changelog__item-description">{entry.description}</p>
							</article>
						))}
					</div>
				</div>
			</div>
		</section>
	)
}

export default Changelog
