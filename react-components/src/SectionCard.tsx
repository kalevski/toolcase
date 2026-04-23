import React from 'react'
import { Card } from './Card'
import { Icon } from './Icon'

export interface SectionCardProps {
	title: string
	icon?: string
	action?: React.ReactNode
	variant?: 'default' | 'danger'
	className?: string
	children?: React.ReactNode
}

export const SectionCard: React.FC<SectionCardProps> = ({
	title,
	icon,
	action,
	variant = 'default',
	className,
	children,
}) => {
	const rootClass = `component-section-card component-section-card--${variant} ${className || ''}`.trim()
	const header = (
		<div className="component-section-card__header">
			<div className="component-section-card__title">
				{icon && (
					<span className="component-section-card__icon">
						<Icon name={icon} decorative />
					</span>
				)}
				<h3 className="component-section-card__heading">{title}</h3>
			</div>
			{action && <div className="component-section-card__action">{action}</div>}
		</div>
	)
	return (
		<Card className={rootClass} header={header}>
			{children}
		</Card>
	)
}
