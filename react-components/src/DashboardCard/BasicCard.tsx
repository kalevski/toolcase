import React from 'react'
import { Icon } from '../Icon'
import { Skeleton } from '../Skeleton'

export interface BasicCardProps {
	textA: string
	textB: string
	icon?: string
	loading?: boolean
}

export const BasicCard: React.FC<BasicCardProps> = ({ textA, textB, icon, loading = false }) => {
	if (loading) {
		return (
			<div className="component-dashboard-card__body component-dashboard-card__body--basic">
				<Skeleton variant="circle" width="2.5rem" height="2.5rem" />
				<div className="component-dashboard-card__basic-text">
					<Skeleton width="50%" />
					<Skeleton width="30%" height="1.5em" />
				</div>
			</div>
		)
	}

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
