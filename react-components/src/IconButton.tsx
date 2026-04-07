import React from 'react'
import { Icon } from './Icon'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	icon: string
	size?: 'small' | 'default' | 'large'
	variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
	outline?: boolean
	label?: string
}

export const IconButton: React.FC<IconButtonProps> = ({
	icon,
	size = 'default',
	variant = 'secondary',
	outline = false,
	label,
	className = '',
	...props
}) => {
	const rootClass = [
		'component component-icon-button',
		`component-icon-button--${size}`,
		`component-icon-button--${variant}`,
		outline ? 'component-icon-button--outline' : '',
		className,
	].filter(Boolean).join(' ')

	return (
		<button {...props} className={rootClass} aria-label={label ?? icon}>
			<Icon name={icon} />
		</button>
	)
}
