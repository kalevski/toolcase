import React from 'react'
import { Icon } from './Icon'

export interface ActionItem {
	key: string
	icon?: string
	label: string
}

export interface ActionItemsProps {
	items: ActionItem[]
	onActionClick?: (key: string) => void
}

export const ActionItems: React.FC<ActionItemsProps> = ({ items, onActionClick }) => {
	if (items.length === 0) return null

	return (
		<div className="component component-action-items">
			<span
				className="component-action-items__trigger"
				data-bs-toggle="dropdown"
				aria-expanded="false"
			>
				<Icon name="three-dots-vertical" />
			</span>
			<ul className="dropdown-menu component-action-items__dropdown">
				{items.map((item) => (
					<li key={item.key}>
						<button
							type="button"
							className="dropdown-item"
							onClick={(e) => {
								e.stopPropagation()
								onActionClick?.(item.key)
							}}
						>
							{item.icon && <Icon name={item.icon} />}
							<span>{item.label}</span>
						</button>
					</li>
				))}
			</ul>
		</div>
	)
}
