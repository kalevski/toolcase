import React from 'react'
import { Button } from './Button'

export interface DangerZoneAction {
	key: string
	label: string
	text: string
	buttonText: string
}

export interface DangerZoneActionsProps {
	actions: DangerZoneAction[]
	onActionClick?: (key: string) => void
	className?: string
}

export const DangerZoneActions: React.FC<DangerZoneActionsProps> = ({
	actions,
	onActionClick,
	className = '',
}) => {
	return (
		<div className={`component component-danger-zone-actions${className ? ` ${className}` : ''}`}>
			<ul className="component-danger-zone-actions__list">
				{actions.map((action) => (
					<li key={action.key} className="component-danger-zone-actions__item">
						<div className="component-danger-zone-actions__info">
							<strong className="component-danger-zone-actions__label">{action.label}</strong>
							<p className="component-danger-zone-actions__text">{action.text}</p>
						</div>
						<Button
							variant="danger"
							outline
							size="small"
							onClick={() => onActionClick?.(action.key)}
						>
							{action.buttonText}
						</Button>
					</li>
				))}
			</ul>
		</div>
	)
}
