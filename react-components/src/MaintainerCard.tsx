import React from 'react'
import { Icon } from './Icon'

export type MaintainerLinkKind = 'github' | 'x' | 'linkedin' | 'mastodon' | 'website' | 'email'

export interface MaintainerLink {
	kind: MaintainerLinkKind
	href: string
}

export interface MaintainerCardProps extends React.HTMLAttributes<HTMLDivElement> {
	name: string
	avatarUrl: string
	role?: string
	bio?: string
	links?: MaintainerLink[]
	sponsorHref?: string
	sponsorLabel?: string
	location?: string
}

const ICONS: Record<MaintainerLinkKind, string> = {
	github: 'github',
	x: 'twitter-x',
	linkedin: 'linkedin',
	mastodon: 'mastodon',
	website: 'globe',
	email: 'envelope',
}

export const MaintainerCard: React.FC<MaintainerCardProps> = ({
	name,
	avatarUrl,
	role,
	bio,
	links,
	sponsorHref,
	sponsorLabel = 'Sponsor',
	location,
	className = '',
	...rest
}) => {
	const rootClass = `component component-maintainer-card ${className}`.trim()

	return (
		<article className={rootClass} {...rest}>
			<img
				src={avatarUrl}
				alt={name}
				className="component-maintainer-card__avatar"
				loading="lazy"
			/>
			<div className="component-maintainer-card__body">
				<h4 className="component-maintainer-card__name">{name}</h4>
				{role ? <p className="component-maintainer-card__role">{role}</p> : null}
				{location ? (
					<p className="component-maintainer-card__location">
						<Icon name="geo-alt-fill" aria-hidden={true} /> {location}
					</p>
				) : null}
				{bio ? <p className="component-maintainer-card__bio">{bio}</p> : null}
				<div className="component-maintainer-card__footer">
					{links && links.length > 0 ? (
						<ul className="component-maintainer-card__links">
							{links.map((link, i) => (
								<li key={i}>
									<a
										href={link.href}
										target="_blank"
										rel="noopener noreferrer"
										aria-label={link.kind}
										className="component-maintainer-card__link"
									>
										<Icon name={ICONS[link.kind]} aria-hidden={true} />
									</a>
								</li>
							))}
						</ul>
					) : null}
					{sponsorHref ? (
						<a
							href={sponsorHref}
							className="component-maintainer-card__sponsor"
							target="_blank"
							rel="noopener noreferrer"
						>
							<Icon name="heart-fill" aria-hidden={true} /> {sponsorLabel}
						</a>
					) : null}
				</div>
			</div>
		</article>
	)
}

export default MaintainerCard
