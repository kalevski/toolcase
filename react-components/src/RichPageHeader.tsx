import React from 'react'
import { Icon } from './Icon'
import type { EntityColor } from './tokens'

export type RichPageHeaderIconColor = EntityColor

export interface RichPageHeaderChipProps {
	icon?: string
	children: React.ReactNode
	className?: string
}

export const RichPageHeaderChip: React.FC<RichPageHeaderChipProps> = ({
	icon,
	children,
	className,
}) => (
	<span className={`component-rich-page-header__chip ${className || ''}`.trim()}>
		{icon && <Icon name={icon} decorative />}
		<span>{children}</span>
	</span>
)

export interface RichPageHeaderProps {
	icon?: { name: string; color?: RichPageHeaderIconColor }
	chips?: React.ReactNode
	title: React.ReactNode
	sub?: React.ReactNode
	description?: React.ReactNode
	actions?: React.ReactNode
	className?: string
}

export const RichPageHeader: React.FC<RichPageHeaderProps> = ({
	icon,
	chips,
	title,
	sub,
	description,
	actions,
	className,
}) => {
	const iconColor = icon?.color ?? 'slate'
	return (
		<div className={`component component-rich-page-header ${className || ''}`.trim()}>
			<div className="component-rich-page-header__main">
				{icon && (
					<div
						className={`component-rich-page-header__icon component-rich-page-header__icon--${iconColor}`}
					>
						<Icon name={icon.name} decorative />
					</div>
				)}
				<div className="component-rich-page-header__body">
					{chips && <div className="component-rich-page-header__chips">{chips}</div>}
					<h1 className="component-rich-page-header__title">{title}</h1>
					{sub && <div className="component-rich-page-header__sub">{sub}</div>}
					{description && (
						<p className="component-rich-page-header__description">{description}</p>
					)}
				</div>
			</div>
			{actions && <div className="component-rich-page-header__actions">{actions}</div>}
		</div>
	)
}
