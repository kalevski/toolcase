import React from 'react'
import { Icon } from '../Icon'
import { Skeleton } from '../Skeleton'

export interface StatusItem {
	label: string
	status: 'ok' | 'warning' | 'error' | 'inactive'
	detail?: string
}

export interface StatusCardProps {
	title?: string
	items: StatusItem[]
	loading?: boolean
	loadingCount?: number
}

const STATUS_CONFIG: Record<StatusItem['status'], { icon: string; className: string }> = {
	ok: { icon: 'check-circle-fill', className: 'ok' },
	warning: { icon: 'exclamation-triangle-fill', className: 'warning' },
	error: { icon: 'x-circle-fill', className: 'error' },
	inactive: { icon: 'dash-circle', className: 'inactive' },
}

export const StatusCard: React.FC<StatusCardProps> = ({ title, items, loading = false, loadingCount = 3 }) => {
	if (loading) {
		return (
			<div className="component-dashboard-card__body component-dashboard-card__body--status">
				{title && <Skeleton width="30%" />}
				<ul className="component-dashboard-card__status-list">
					{Array.from({ length: loadingCount }, (_, i) => (
						<li key={i} className="component-dashboard-card__status-item">
							<Skeleton shape="circle" width="1rem" height="1rem" />
							<Skeleton width="60%" />
						</li>
					))}
				</ul>
			</div>
		)
	}

	return (
		<div className="component-dashboard-card__body component-dashboard-card__body--status">
			{title && <span className="component-dashboard-card__status-title">{title}</span>}
			<ul className="component-dashboard-card__status-list">
				{items.map((item, i) => {
					const cfg = STATUS_CONFIG[item.status]
					return (
						<li key={i} className={`component-dashboard-card__status-item component-dashboard-card__status-item--${cfg.className}`}>
							<Icon name={cfg.icon} className="component-dashboard-card__status-icon" />
							<span className="component-dashboard-card__status-label">{item.label}</span>
							{item.detail && <span className="component-dashboard-card__status-detail">{item.detail}</span>}
						</li>
					)
				})}
			</ul>
		</div>
	)
}
