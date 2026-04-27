import React from 'react'
import { Icon } from './Icon'

export interface GoodFirstIssue {
	title: string
	labels: string[]
	commentCount?: number
	updatedAt?: string
	href: string
	repo?: string
}

export interface GoodFirstIssuesProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
	issues: GoodFirstIssue[]
	emptyState?: React.ReactNode
	title?: React.ReactNode
}

export const GoodFirstIssues: React.FC<GoodFirstIssuesProps> = ({
	issues,
	emptyState,
	title,
	className = '',
	...rest
}) => {
	const rootClass = `component component-good-first-issues ${className}`.trim()

	return (
		<section className={rootClass} {...rest}>
			{title ? <h3 className="component-good-first-issues__title">{title}</h3> : null}
			{issues.length === 0 ? (
				<div className="component-good-first-issues__empty">
					{emptyState ?? <p>No good first issues right now — check back soon.</p>}
				</div>
			) : (
				<ul className="component-good-first-issues__list">
					{issues.map((issue, i) => (
						<li key={i} className="component-good-first-issues__item">
							<a
								className="component-good-first-issues__link"
								href={issue.href}
								target="_blank"
								rel="noopener noreferrer"
							>
								<div className="component-good-first-issues__head">
									<span className="component-good-first-issues__issue-title">{issue.title}</span>
									{issue.repo ? (
										<span className="component-good-first-issues__repo">{issue.repo}</span>
									) : null}
								</div>
								<div className="component-good-first-issues__meta">
									<div className="component-good-first-issues__labels">
										{issue.labels.map((label) => (
											<span key={label} className="component-good-first-issues__label">
												{label}
											</span>
										))}
									</div>
									<div className="component-good-first-issues__stats">
										{issue.commentCount !== undefined ? (
											<span className="component-good-first-issues__stat">
												<Icon name="chat-dots" aria-hidden={true} /> {issue.commentCount}
											</span>
										) : null}
										{issue.updatedAt ? (
											<span className="component-good-first-issues__stat">
												<Icon name="clock" aria-hidden={true} /> {issue.updatedAt}
											</span>
										) : null}
									</div>
								</div>
							</a>
						</li>
					))}
				</ul>
			)}
		</section>
	)
}

export default GoodFirstIssues
