import React from 'react'
import { Icon } from '../Icon'
import { Skeleton } from '../Skeleton'

export interface ActivityItem {
	icon?: string
	title: string
	description?: string
	username?: string
	time?: string
}

export interface ActivityCardProps {
	title?: string
	activities: ActivityItem[]
	loading?: boolean
	loadingCount?: number
}

export const ActivityCard: React.FC<ActivityCardProps> = ({
	title,
	activities,
	loading = false,
	loadingCount = 3,
}) => {
	if (loading) {
		return (
			<div className="component-dashboard-card__body component-dashboard-card__body--activity">
				{title && <Skeleton width="30%" />}
				<ul className="component-dashboard-card__activity-list">
					{Array.from({ length: loadingCount }, (_, i) => (
						<li key={i} className="component-dashboard-card__activity-item">
							<div className="component-dashboard-card__activity-icon-wrap">
								<Skeleton shape="circle" width="1.5rem" height="1.5rem" />
							</div>
							<div className="component-dashboard-card__activity-content">
								<Skeleton width="70%" />
								<Skeleton width="50%" />
							</div>
						</li>
					))}
				</ul>
			</div>
		)
	}

	return (
		<div className="component-dashboard-card__body component-dashboard-card__body--activity">
			{title && <span className="component-dashboard-card__activity-title">{title}</span>}
			<ul className="component-dashboard-card__activity-list">
				{activities.map((item, i) => (
					<li key={i} className="component-dashboard-card__activity-item">
						<div className="component-dashboard-card__activity-icon-wrap">
							<Icon name={item.icon ?? 'circle-fill'} />
							{i < activities.length - 1 && <span className="component-dashboard-card__activity-line" />}
						</div>
						<div className="component-dashboard-card__activity-content">
							<div className="component-dashboard-card__activity-header">
								<span className="component-dashboard-card__activity-item-title">{item.title}</span>
								{item.time && <span className="component-dashboard-card__activity-time">{item.time}</span>}
							</div>
							{item.description && (
								<span className="component-dashboard-card__activity-desc">{item.description}</span>
							)}
							{item.username && (
								<span className="component-dashboard-card__activity-user">by {item.username}</span>
							)}
						</div>
					</li>
				))}
			</ul>
		</div>
	)
}
