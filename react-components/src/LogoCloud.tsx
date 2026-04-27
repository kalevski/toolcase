import React from 'react'

export interface LogoCloudLogo {
	src: string
	alt: string
	href?: string
	width?: number
}

export interface LogoCloudProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
	title?: React.ReactNode
	logos: LogoCloudLogo[]
	grayscale?: boolean
	columns?: number
}

export const LogoCloud: React.FC<LogoCloudProps> = ({
	title,
	logos,
	grayscale = true,
	columns,
	className = '',
	...rest
}) => {
	const rootClass = [
		'component',
		'component-logo-cloud',
		grayscale ? 'component-logo-cloud--grayscale' : '',
		className,
	]
		.filter(Boolean)
		.join(' ')

	const style = columns
		? ({ '--lc-columns': columns } as React.CSSProperties)
		: undefined

	return (
		<section className={rootClass} style={style} {...rest}>
			{title ? <p className="component-logo-cloud__title">{title}</p> : null}
			<div className="component-logo-cloud__grid">
				{logos.map((logo, i) => {
					const img = (
						<img
							src={logo.src}
							alt={logo.alt}
							className="component-logo-cloud__logo"
							style={logo.width ? { maxWidth: logo.width } : undefined}
							loading="lazy"
						/>
					)
					return logo.href ? (
						<a key={i} href={logo.href} className="component-logo-cloud__link" target="_blank" rel="noopener noreferrer">
							{img}
						</a>
					) : (
						<span key={i} className="component-logo-cloud__link">
							{img}
						</span>
					)
				})}
			</div>
		</section>
	)
}

export default LogoCloud
