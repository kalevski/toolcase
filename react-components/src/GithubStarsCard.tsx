import React, { useEffect, useState } from 'react'
import { Icon } from './Icon'

export interface GithubStatsData {
	stars?: number
	forks?: number
	contributors?: number
	version?: string
}

export interface GithubStarsCardProps extends React.HTMLAttributes<HTMLDivElement> {
	owner: string
	repo: string
	stats?: GithubStatsData
	fetchLive?: boolean
	ctaLabel?: string
}

const formatNumber = (n: number): string => {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
	return String(n)
}

export const GithubStarsCard: React.FC<GithubStarsCardProps> = ({
	owner,
	repo,
	stats,
	fetchLive = false,
	ctaLabel = 'Star on GitHub',
	className = '',
	...rest
}) => {
	const [live, setLive] = useState<GithubStatsData | undefined>(undefined)

	useEffect(() => {
		if (!fetchLive) return
		let cancelled = false
		fetch(`https://api.github.com/repos/${owner}/${repo}`)
			.then((r) => r.json())
			.then((data) => {
				if (cancelled) return
				setLive({
					stars: data.stargazers_count,
					forks: data.forks_count,
				})
			})
			.catch(() => {})
		return () => {
			cancelled = true
		}
	}, [fetchLive, owner, repo])

	const merged: GithubStatsData = { ...live, ...stats }
	const rootClass = `component component-github-stars-card ${className}`.trim()
	const repoUrl = `https://github.com/${owner}/${repo}`

	return (
		<div className={rootClass} {...rest}>
			<div className="component-github-stars-card__head">
				<Icon name="github" className="component-github-stars-card__logo" aria-hidden={true} />
				<a
					className="component-github-stars-card__repo"
					href={repoUrl}
					target="_blank"
					rel="noopener noreferrer"
				>
					{owner}/{repo}
				</a>
			</div>
			<div className="component-github-stars-card__stats">
				{merged.stars !== undefined && (
					<div className="component-github-stars-card__stat">
						<Icon name="star-fill" aria-hidden={true} />
						<span className="component-github-stars-card__value">{formatNumber(merged.stars)}</span>
						<span className="component-github-stars-card__label">stars</span>
					</div>
				)}
				{merged.forks !== undefined && (
					<div className="component-github-stars-card__stat">
						<Icon name="diagram-2" aria-hidden={true} />
						<span className="component-github-stars-card__value">{formatNumber(merged.forks)}</span>
						<span className="component-github-stars-card__label">forks</span>
					</div>
				)}
				{merged.contributors !== undefined && (
					<div className="component-github-stars-card__stat">
						<Icon name="people-fill" aria-hidden={true} />
						<span className="component-github-stars-card__value">{formatNumber(merged.contributors)}</span>
						<span className="component-github-stars-card__label">contributors</span>
					</div>
				)}
				{merged.version && (
					<div className="component-github-stars-card__stat">
						<Icon name="tag-fill" aria-hidden={true} />
						<span className="component-github-stars-card__value">{merged.version}</span>
						<span className="component-github-stars-card__label">latest</span>
					</div>
				)}
			</div>
			<a
				className="component-github-stars-card__cta"
				href={`${repoUrl}/stargazers`}
				target="_blank"
				rel="noopener noreferrer"
			>
				<Icon name="star" aria-hidden={true} />
				{ctaLabel}
			</a>
		</div>
	)
}

export default GithubStarsCard
