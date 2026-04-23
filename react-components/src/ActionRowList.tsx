import React from 'react'
import { Icon } from './Icon'
import { Button } from './Button'

export type ActionRowButtonVariant =
	| 'primary'
	| 'secondary'
	| 'success'
	| 'warning'
	| 'info'
	| 'danger'

export interface ActionRow {
	key: string
	icon: string
	title: string
	description: string
	buttonText: string
	buttonVariant?: ActionRowButtonVariant
	disabled?: boolean
}

export interface ActionRowListProps {
	actions: ActionRow[]
	onActionClick: (key: string) => void
	outline?: boolean
	trailingIcon?: string | null
	className?: string
}

export const ActionRowList: React.FC<ActionRowListProps> = ({
	actions,
	onActionClick,
	outline = true,
	trailingIcon = 'arrow-right',
	className,
}) => {
	const rootClass = `component component-action-row-list ${className || ''}`.trim()
	return (
		<ul className={rootClass}>
			{actions.map((action, i) => {
				const isLast = i === actions.length - 1
				const rowClass = `component-action-row-list__row${isLast ? ' component-action-row-list__row--last' : ''}`
				return (
					<li key={action.key} className={rowClass}>
						<div className="component-action-row-list__lead">
							<span className="component-action-row-list__icon">
								<Icon name={action.icon} decorative />
							</span>
							<div className="component-action-row-list__copy">
								<div className="component-action-row-list__title">{action.title}</div>
								<div className="component-action-row-list__description">
									{action.description}
								</div>
							</div>
						</div>
						<div className="component-action-row-list__cta">
							<Button
								variant={action.buttonVariant ?? 'primary'}
								outline={outline}
								size="small"
								disabled={action.disabled}
								onClick={() => onActionClick(action.key)}
							>
								<span>{action.buttonText}</span>
								{trailingIcon && (
									<Icon
										name={trailingIcon}
										decorative
										className="component-action-row-list__trailing"
									/>
								)}
							</Button>
						</div>
					</li>
				)
			})}
		</ul>
	)
}
