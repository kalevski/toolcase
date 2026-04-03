import React from 'react'
import { Icon } from '../Icon'

export interface ListItem {
	label: string
	value: string | number
	icon?: string
	color?: string
}

export interface ListCardProps {
	title?: string
	items: ListItem[]
	ordered?: boolean
}

export const ListCard: React.FC<ListCardProps> = ({
	title,
	items,
	ordered = false,
}) => {
	return (
		<div className="component-dashboard-card__body component-dashboard-card__body--list">
			{title && <span className="component-dashboard-card__list-title">{title}</span>}
			<ul className="component-dashboard-card__list">
				{items.map((item, i) => (
					<li key={i} className="component-dashboard-card__list-item">
						{ordered && <span className="component-dashboard-card__list-rank">{i + 1}</span>}
						{item.icon && (
							<span className="component-dashboard-card__list-icon" style={item.color ? { color: item.color } : undefined}>
								<Icon name={item.icon} />
							</span>
						)}
						<span className="component-dashboard-card__list-label">{item.label}</span>
						<span className="component-dashboard-card__list-value">{item.value}</span>
					</li>
				))}
			</ul>
		</div>
	)
}
