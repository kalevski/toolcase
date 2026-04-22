import type { ButtonHTMLAttributes, FC, HTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'
import { Skeleton } from './Skeleton'

export interface PricingCardAction extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
	label: string
	outline?: boolean
	size?: 'small' | 'default' | 'large'
	variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
}

export interface PricingCardFeature {
	id?: string
	label: ReactNode
	helper?: ReactNode
	iconName?: string
	icon?: ReactNode
}

export interface PricingCardProps extends HTMLAttributes<HTMLDivElement> {
	name: string
	price: ReactNode
	period: ReactNode
	description: ReactNode
	features: Array<string | PricingCardFeature>
	highlight?: boolean
	action: PricingCardAction
	badgeText?: ReactNode
	featureIconName?: string
	featureIcon?: ReactNode
	loading?: boolean
}

export const PricingCard: FC<PricingCardProps> = ({
	name,
	price,
	period,
	description,
	features,
	highlight = false,
	action,
	badgeText = 'Popular',
	featureIconName = 'check-circle-fill',
	featureIcon,
	loading = false,
	className,
	style,
	...rest
}) => {
	const normalizedFeatures: PricingCardFeature[] = features.map((feature) =>
		typeof feature === 'string' ? { label: feature } : feature,
	)

	const rootClassName = [
		'component',
		'component-pricing-card',
		highlight && 'component-pricing-card--highlight',
		className,
	]
		.filter(Boolean)
		.join(' ')

	const renderFeatureIcon = (featureItem: PricingCardFeature) => {
		if (featureItem.icon) {
			return featureItem.icon
		}
		if (featureIcon) {
			return featureIcon
		}
		const iconName = featureItem.iconName ?? featureIconName ?? 'check-circle-fill'
		return <Icon name={iconName} decorative />
	}

	const {
		label: actionLabel,
		className: actionCustomClass,
		outline: actionOutline,
		variant: _actionVariant,
		size: _actionSize,
		type: actionType = 'button',
		...actionRest
	} = action

	const actionClassName = [
		'component-pricing-card__action',
		actionOutline ? 'component-pricing-card__action--outline' : 'component-pricing-card__action--primary',
		actionCustomClass,
	]
		.filter(Boolean)
		.join(' ')

	if (loading) {
		return (
			<div className={rootClassName} style={style} {...rest}>
				<div className="component-pricing-card__body">
					<div className="component-pricing-card__header">
						<Skeleton width="40%" />
					</div>
					<div className="component-pricing-card__price-row">
						<Skeleton width="50%" height="2.6rem" />
					</div>
					<Skeleton count={2} />
					<div className="component-pricing-card__features">
						<Skeleton count={4} />
					</div>
					<Skeleton height="2.75rem" />
				</div>
			</div>
		)
	}

	return (
		<div className={rootClassName} style={style} {...rest}>
			<div className="component-pricing-card__body">
				<div className="component-pricing-card__header">
					<span className="component-pricing-card__eyebrow">{name}</span>
					{highlight && badgeText && (
						<span className="component-pricing-card__badge">{badgeText}</span>
					)}
				</div>

				<div className="component-pricing-card__price-row">
					<span className="component-pricing-card__price">{price}</span>
					{period && <span className="component-pricing-card__period">/ {period}</span>}
				</div>

				<p className="component-pricing-card__description">{description}</p>

				<button
					{...actionRest}
					type={actionType}
					className={actionClassName}
				>
					{actionLabel}
					<span className="component-pricing-card__action-arrow" aria-hidden="true">
						<Icon name="arrow-right" decorative />
					</span>
				</button>

				<ul className="component-pricing-card__features">
					{normalizedFeatures.map((featureItem, index) => (
						<li
							key={featureItem.id ?? `${name}-feature-${index}`}
							className="component-pricing-card__feature"
						>
							<span className="component-pricing-card__feature-icon" aria-hidden="true">
								{renderFeatureIcon(featureItem)}
							</span>
							<span className="component-pricing-card__feature-text">
								<span className="component-pricing-card__feature-label">{featureItem.label}</span>
								{featureItem.helper && (
									<span className="component-pricing-card__feature-helper"> — {featureItem.helper}</span>
								)}
							</span>
						</li>
					))}
				</ul>
			</div>
		</div>
	)
}

PricingCard.displayName = 'PricingCard'
