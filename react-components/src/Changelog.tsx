import type { FC, HTMLAttributes } from 'react'
import { Tag } from './Tag'

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
}

export const Changelog: FC<ChangelogProps> = ({
	entries,
	maxVisible = 5,
	readMoreHref,
	readMoreLabel = 'View full changelog',
	className,
	...rest
}) => {
	const visibleEntries = entries.slice(0, maxVisible)

	const rootClassName = ['component component-changelog', className].filter(Boolean).join(' ')

	if (visibleEntries.length === 0) {
		return null
	}

	return (
		<section className={rootClassName} {...rest}>
			<div className="component-changelog__inner">
				<header className="component-changelog__header">
					<div className="component-changelog__header-copy">
						<p className="component-changelog__eyebrow">Latest updates</p>
						<h2 className="component-changelog__title">Product changelog</h2>
						<p className="component-changelog__subtitle">
							Stay up to date with the most recent improvements, fixes, and new features.
						</p>
					</div>
					<a href={readMoreHref} className="component-changelog__read-more-button">
						{readMoreLabel}
					</a>
				</header>

				<div className="component-changelog__slider" aria-live="polite">
					<div className="component-changelog__track">
						{visibleEntries.map((entry, index) => (
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
