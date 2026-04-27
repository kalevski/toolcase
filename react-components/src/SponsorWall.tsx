import React from 'react'

export type SponsorTierSize = 'xl' | 'lg' | 'md' | 'sm'

export interface SponsorLogo {
	src: string
	alt: string
	href?: string
}

export interface SponsorTier {
	name: string
	label?: React.ReactNode
	logos: SponsorLogo[]
	size?: SponsorTierSize
}

export interface SponsorWallProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
	tiers: SponsorTier[]
	title?: React.ReactNode
}

export const SponsorWall: React.FC<SponsorWallProps> = ({
	tiers,
	title,
	className = '',
	...rest
}) => {
	const rootClass = `component component-sponsor-wall ${className}`.trim()

	return (
		<section className={rootClass} {...rest}>
			{title ? <h3 className="component-sponsor-wall__title">{title}</h3> : null}
			{tiers.map((tier) => (
				<div
					key={tier.name}
					className={`component-sponsor-wall__tier component-sponsor-wall__tier--${tier.size ?? 'md'}`}
				>
					<div className="component-sponsor-wall__tier-label">{tier.label ?? tier.name}</div>
					<div className="component-sponsor-wall__logos">
						{tier.logos.map((logo, i) => {
							const img = (
								<img
									src={logo.src}
									alt={logo.alt}
									className="component-sponsor-wall__logo"
									loading="lazy"
								/>
							)
							return logo.href ? (
								<a
									key={i}
									href={logo.href}
									className="component-sponsor-wall__link"
									target="_blank"
									rel="noopener noreferrer"
								>
									{img}
								</a>
							) : (
								<span key={i} className="component-sponsor-wall__link">
									{img}
								</span>
							)
						})}
					</div>
				</div>
			))}
		</section>
	)
}

export default SponsorWall
