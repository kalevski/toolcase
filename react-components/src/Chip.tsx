import React from 'react'
import { Icon } from './Icon'

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	children?: React.ReactNode
	label?: string
	selected?: boolean
	variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
	icon?: string
	onRemove?: () => void
	count?: number | string
}

export const Chip: React.FC<ChipProps> = ({
	children,
	label,
	selected = false,
	variant = 'secondary',
	icon,
	onRemove,
	count,
	className = '',
	disabled,
	...props
}) => {
	const rootClass = [
		'component component-chip',
		`component-chip--${variant}`,
		selected ? 'component-chip--selected' : '',
		onRemove ? 'component-chip--removable' : '',
		disabled ? 'component-chip--disabled' : '',
		className,
	].filter(Boolean).join(' ')

	return (
		<button {...props} disabled={disabled} type={props.type ?? 'button'} className={rootClass}>
			{icon && <Icon name={icon} className="component-chip__icon" />}
			<span className="component-chip__label">{label ?? children}</span>
			{count !== undefined && <span className="component-chip__count">×{count}</span>}
			{onRemove && (
				<span
					className="component-chip__remove"
					role="button"
					aria-label="Remove"
					onClick={(e) => { e.stopPropagation(); onRemove() }}
					onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onRemove() } }}
					tabIndex={0}
				>
					<Icon name="x" size={12} />
				</span>
			)}
		</button>
	)
}
