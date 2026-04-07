import React, { useState } from 'react'
import { Icon } from './Icon'

export interface GroupProps {
	label: string
	badge?: string
	defaultCollapsed?: boolean
	children?: React.ReactNode
	onActionClick?: () => void
	actionLabel?: string
	actionIcon?: string
}

export const Group: React.FC<GroupProps> = ({
	label,
	badge,
	defaultCollapsed = false,
	children,
	onActionClick,
	actionLabel = `${label}`,
	actionIcon = 'plus-lg',
}) => {
	const [collapsed, setCollapsed] = useState(defaultCollapsed)

	return (
		<div className="component component-group">
			<div className="component-group__header">
				<button
					type="button"
					className="component-group__collapse"
					onClick={() => setCollapsed((prev) => !prev)}
					aria-label={collapsed ? 'Expand' : 'Collapse'}
				>
					<Icon name={collapsed ? 'chevron-right' : 'chevron-down'} />
				</button>
				<span className="component-group__label">{label}</span>
				{badge && <span className="component-group__badge">{badge}</span>}
				{onActionClick && (
					<button
						type="button"
						className="component-group__add"
						onClick={onActionClick}
						aria-label={actionLabel}
					>
						<Icon name={actionIcon} />
					</button>
				)}
			</div>
			{!collapsed && (
				<div className="component-group__content">
					{children}
				</div>
			)}
		</div>
	)
}
