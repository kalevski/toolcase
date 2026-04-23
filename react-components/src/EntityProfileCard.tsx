import React from 'react'
import { Icon } from './Icon'
import { Skeleton } from './Skeleton'

export interface MetaItem {
	icon?: string
	label: string
	value: React.ReactNode
	hint?: React.ReactNode
	mono?: boolean
}

export interface EntityProfileCardProps {
	lead?: React.ReactNode
	title: React.ReactNode
	subtitle?: React.ReactNode
	chips?: React.ReactNode
	meta: MetaItem[]
	loading?: boolean
	className?: string
}

export const EntityProfileCard: React.FC<EntityProfileCardProps> = ({
	lead,
	title,
	subtitle,
	chips,
	meta,
	loading = false,
	className,
}) => {
	const rootClass = `component component-entity-profile-card ${className || ''}`.trim()

	if (loading) {
		return (
			<div className={rootClass}>
				<div className="component-entity-profile-card__hero">
					<Skeleton shape="circle" width={56} height={56} />
					<div className="component-entity-profile-card__identity">
						<Skeleton width="40%" height="1.25rem" />
						<Skeleton width="30%" />
					</div>
				</div>
				<div className="component-entity-profile-card__meta">
					{Array.from({ length: 4 }, (_, i) => (
						<div key={i} className="component-entity-profile-card__meta-item">
							<Skeleton width="40%" />
							<Skeleton width="70%" height="1.1rem" />
						</div>
					))}
				</div>
			</div>
		)
	}

	return (
		<div className={rootClass}>
			<div className="component-entity-profile-card__hero">
				{lead && <div className="component-entity-profile-card__lead">{lead}</div>}
				<div className="component-entity-profile-card__identity">
					<div className="component-entity-profile-card__title">{title}</div>
					{chips && <div className="component-entity-profile-card__chips">{chips}</div>}
					{subtitle && (
						<div className="component-entity-profile-card__subtitle">{subtitle}</div>
					)}
				</div>
			</div>
			{meta.length > 0 && (
				<div className="component-entity-profile-card__meta">
					{meta.map((item, i) => {
						const valueClass = `component-entity-profile-card__meta-value${item.mono ? ' component-entity-profile-card__meta-value--mono' : ''}`
						return (
							<div key={i} className="component-entity-profile-card__meta-item">
								<div className="component-entity-profile-card__meta-eyebrow">
									{item.icon && (
										<span className="component-entity-profile-card__meta-icon">
											<Icon name={item.icon} decorative />
										</span>
									)}
									<span className="component-entity-profile-card__meta-label">
										{item.label}
									</span>
								</div>
								<div className={valueClass}>{item.value}</div>
								{item.hint && (
									<div className="component-entity-profile-card__meta-hint">{item.hint}</div>
								)}
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}
