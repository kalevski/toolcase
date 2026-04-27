import React from 'react'
import { Icon } from './Icon'

export type SocialKind =
	| 'github'
	| 'x'
	| 'linkedin'
	| 'mastodon'
	| 'youtube'
	| 'rss'
	| 'discord'
	| 'instagram'
	| 'tiktok'

export interface SocialLink {
	kind: SocialKind
	href: string
	label?: string
}

export interface SocialLinksProps extends React.HTMLAttributes<HTMLDivElement> {
	links: SocialLink[]
	size?: 'sm' | 'md' | 'lg'
	variant?: 'ghost' | 'filled'
}

const ICONS: Record<SocialKind, string> = {
	github: 'github',
	x: 'twitter-x',
	linkedin: 'linkedin',
	mastodon: 'mastodon',
	youtube: 'youtube',
	rss: 'rss',
	discord: 'discord',
	instagram: 'instagram',
	tiktok: 'tiktok',
}

export const SocialLinks: React.FC<SocialLinksProps> = ({
	links,
	size = 'md',
	variant = 'ghost',
	className = '',
	...rest
}) => {
	const rootClass = `component component-social-links component-social-links--${size} component-social-links--${variant} ${className}`.trim()

	return (
		<div className={rootClass} {...rest}>
			{links.map((link, i) => (
				<a
					key={`${link.kind}-${i}`}
					href={link.href}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={link.label ?? link.kind}
					className={`component-social-links__link component-social-links__link--${link.kind}`}
				>
					<Icon name={ICONS[link.kind]} aria-hidden={true} />
				</a>
			))}
		</div>
	)
}

export default SocialLinks
