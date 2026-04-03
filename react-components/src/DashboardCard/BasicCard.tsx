import React from 'react'
import { Icon } from '../Icon'

export interface BasicCardProps {
	textA: string
	textB: string
	icon?: string
}

export const BasicCard: React.FC<BasicCardProps> = ({ textA, textB, icon }) => {
	return (
		<div className="component-dashboard-card__body component-dashboard-card__body--basic">
			{icon && (
				<div className="component-dashboard-card__basic-icon">
					<Icon name={icon} />
				</div>
			)}
			<div className="component-dashboard-card__basic-text">
				<span className="component-dashboard-card__basic-a">{textA}</span>
				<span className="component-dashboard-card__basic-b">{textB}</span>
			</div>
		</div>
	)
}
