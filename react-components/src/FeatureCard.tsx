import type { FC, HTMLAttributes, ReactNode } from 'react'

export type FeatureCardSize = 'default' | 'wide' | 'full'

export interface FeatureCardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
	icon?: ReactNode
	eyebrow?: ReactNode
	title: ReactNode
	description?: ReactNode
	visual?: ReactNode
	size?: FeatureCardSize
	inline?: boolean
}

export const FeatureCard: FC<FeatureCardProps> = ({
	icon,
	eyebrow,
	title,
	description,
	visual,
	size = 'default',
	inline = false,
	className,
	children,
	...rest
}) => {
	const rootClassName = [
		'component',
		'component-feature-card',
		`component-feature-card--${size}`,
		inline && 'component-feature-card--inline',
		className,
	]
		.filter(Boolean)
		.join(' ')

	return (
		<article className={rootClassName} {...rest}>
			<div className="component-feature-card__head">
				{icon && (
					<span className="component-feature-card__icon" aria-hidden="true">
						{icon}
					</span>
				)}
				<div className="component-feature-card__copy">
					{eyebrow && <span className="component-feature-card__eyebrow">{eyebrow}</span>}
					<h3 className="component-feature-card__title">{title}</h3>
					{description && <p className="component-feature-card__description">{description}</p>}
				</div>
			</div>
			{(visual || children) && (
				<div className="component-feature-card__visual">{visual ?? children}</div>
			)}
		</article>
	)
}

FeatureCard.displayName = 'FeatureCard'
