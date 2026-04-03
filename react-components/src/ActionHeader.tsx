import React from 'react'
import { Button } from './Button'
import { Icon } from './Icon'

export interface ActionHeaderAction {
	key: string
	icon?: string
	label: string
	alt?: string
	disabled?: boolean
}

export interface ActionHeaderProps {
	actions: ActionHeaderAction[]
	onExec?: (key: string) => void
	disabled?: boolean
	className?: string
	children?: React.ReactNode
}

export const ActionHeader: React.FC<ActionHeaderProps> = ({
	actions,
	onExec,
	disabled = false,
	className = '',
	children,
}) => {
	return (
		<div className={`component component-action-header${className ? ` ${className}` : ''}`}>
			{children && <div className="component-action-header__content">{children}</div>}
			<div className="component-action-header__actions">
				{actions.map(action => (
					<Button
						key={action.key}
						size="small"
						variant="secondary"
						outline
						disabled={disabled || action.disabled}
						title={action.alt}
						onClick={() => onExec?.(action.key)}
					>
						{action.icon && <Icon name={action.icon} />}
						{action.label && <span>{action.icon ? ` ${action.label}` : action.label}</span>}
					</Button>
				))}
			</div>
		</div>
	)
}
