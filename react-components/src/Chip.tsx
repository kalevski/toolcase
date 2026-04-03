import React from 'react'

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	children?: React.ReactNode
	label?: string
	selected?: boolean
	variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
	icon?: string
}

export const Chip: React.FC<ChipProps> = ({
	children,
	label,
	selected = false,
	variant = 'secondary',
	icon,
	className = '',
	...props
}) => {
	const rootClass = [
		'component component-chip',
		`component-chip--${variant}`,
		selected ? 'component-chip--selected' : '',
		className,
	].filter(Boolean).join(' ')

	return (
		<button {...props} type={props.type ?? 'button'} className={rootClass}>
			{icon && <i className={`bi bi-${icon} component-chip__icon`} />}
			<span className="component-chip__label">{label ?? children}</span>
		</button>
	)
}
