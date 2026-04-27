import React from 'react'
import { Icon } from './Icon'

export type CommunityKind =
	| 'github'
	| 'discord'
	| 'slack'
	| 'x'
	| 'mastodon'
	| 'rss'
	| 'mail'
	| 'youtube'
	| 'discussions'

export interface CommunityLink {
	kind: CommunityKind
	label: string
	href: string
	count?: number
	description?: string
}

export interface CommunityLinksProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
	links: CommunityLink[]
	title?: React.ReactNode
}

const ICONS: Record<CommunityKind, string> = {
	github: 'github',
	discord: 'discord',
	slack: 'slack',
	x: 'twitter-x',
	mastodon: 'mastodon',
	rss: 'rss',
	mail: 'envelope',
	youtube: 'youtube',
	discussions: 'chat-dots',
}

const formatCount = (n: number): string => {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
	return String(n)
}

export const CommunityLinks: React.FC<CommunityLinksProps> = ({
	links,
	title,
	className = '',
	...rest
}) => {
	const rootClass = `component component-community-links ${className}`.trim()

	return (
		<section className={rootClass} {...rest}>
			{title ? <h3 className="component-community-links__title">{title}</h3> : null}
			<div className="component-community-links__grid">
				{links.map((link, i) => (
					<a
						key={i}
						className={`component-community-links__card component-community-links__card--${link.kind}`}
						href={link.href}
						target="_blank"
						rel="noopener noreferrer"
					>
						<Icon name={ICONS[link.kind]} className="component-community-links__icon" aria-hidden={true} />
						<div className="component-community-links__body">
							<span className="component-community-links__label">{link.label}</span>
							{link.description ? (
								<span className="component-community-links__description">{link.description}</span>
							) : null}
						</div>
						{link.count !== undefined ? (
							<span className="component-community-links__count">{formatCount(link.count)}</span>
						) : null}
					</a>
				))}
			</div>
		</section>
	)
}

export default CommunityLinks
