import type { ButtonHTMLAttributes, FC, HTMLAttributes, ReactNode } from 'react'
import { Button } from './Button'
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
	badgeText = 'Recommended',
	featureIconName = 'plus-lg',
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
		'component component-pricing-card card border-0 h-100 position-relative overflow-hidden',
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

		if (!featureIconName && !featureItem.iconName) {
			return null
		}

		return <Icon name={featureItem.iconName ?? featureIconName ?? 'plus-lg'} size={18} decorative />
	}

	const { label: actionLabel, className: actionCustomClass, size: actionSize, ...actionRest } = action

	const actionClassName = ['component-pricing-card__action', 'w-100', 'py-2', 'mt-auto', actionCustomClass]
		.filter(Boolean)
		.join(' ')

	if (loading) {
		return (
			<div className={rootClassName} style={style} {...rest}>
				<span className="component-pricing-card__accent position-absolute top-0 start-0 w-100" />
				<div className="component-pricing-card__body card-body d-flex flex-column p-4 p-lg-5">
					<div className="mb-3">
						<Skeleton width="30%" />
						<Skeleton width="50%" height="2.5rem" />
					</div>
					<Skeleton count={2} />
					<div className="mt-4 flex-grow-1">
						<Skeleton count={4} />
					</div>
					<Skeleton height="2.5rem" />
				</div>
			</div>
		)
	}

	return (
		<div className={rootClassName} style={style} {...rest}>
			<span className="component-pricing-card__accent position-absolute top-0 start-0 w-100" />
			<div className="component-pricing-card__body card-body d-flex flex-column p-4 p-lg-5">
				<div className="component-pricing-card__header d-flex justify-content-between align-items-start mb-3">
					<div>
						<span className="component-pricing-card__eyebrow text-uppercase small fw-semibold text-primary mb-1 d-inline-block">
							{name}
						</span>
						<div className="component-pricing-card__price-row d-flex align-items-baseline gap-2">
							<span className="component-pricing-card__price display-5 fw-bold text-dark lh-1">{price}</span>
							{period && (
								<span className="component-pricing-card__period text-body-secondary small">/ {period}</span>
							)}
						</div>
					</div>
					{highlight && badgeText && (
						<span className="component-pricing-card__badge badge bg-primary text-white fw-semibold rounded-pill">
							{badgeText}
						</span>
					)}
				</div>
				<div className="component-pricing-card__description text-body-secondary mb-4">{description}</div>
				<ul className="component-pricing-card__features list-unstyled mb-4 flex-grow-1">
					{normalizedFeatures.map((featureItem, index) => (
						<li
							key={featureItem.id ?? `${name}-feature-${index}`}
							className="component-pricing-card__feature d-flex align-items-start gap-3 mb-3 text-dark"
						>
							<span className="component-pricing-card__feature-icon d-inline-flex align-items-center justify-content-center rounded-circle">
								{renderFeatureIcon(featureItem)}
							</span>
							<span className="component-pricing-card__feature-text fw-semibold">
								{featureItem.label}
								{featureItem.helper && (
									<span className="component-pricing-card__feature-helper d-block fw-normal text-body-secondary small mt-1">
										{featureItem.helper}
									</span>
								)}
							</span>
						</li>
					))}
				</ul>
				<Button
					{...actionRest}
					className={actionClassName}
					size={actionSize ?? 'default'}
					label={actionLabel}
				/>
			</div>
		</div>
	)
}
