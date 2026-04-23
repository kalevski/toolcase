import React from 'react'
import type { EntityColor } from './tokens'

export type EntityCellColor = EntityColor

export interface EntityCellProps {
	name: string
	subLabel?: string
	initial: string
	color: EntityCellColor
	size?: 'sm' | 'md' | 'lg'
	onClick?: () => void
	className?: string
}

export const EntityCell: React.FC<EntityCellProps> = ({
	name,
	subLabel,
	initial,
	color,
	size = 'md',
	onClick,
	className,
}) => {
	const rootClass = `component component-entity-cell component-entity-cell--${size} ${className || ''}`.trim()
	const tileClass = `component-entity-cell__tile component-entity-cell__tile--${color}`

	return (
		<div className={rootClass}>
			<span className={tileClass} aria-hidden="true">
				{initial.slice(0, 2).toUpperCase()}
			</span>
			<div className="component-entity-cell__labels">
				{onClick ? (
					<button
						type="button"
						onClick={onClick}
						className="component-entity-cell__name component-entity-cell__name--button"
					>
						{name}
					</button>
				) : (
					<span className="component-entity-cell__name">{name}</span>
				)}
				{subLabel && <span className="component-entity-cell__sub">{subLabel}</span>}
			</div>
		</div>
	)
}
