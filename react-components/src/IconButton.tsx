import React from 'react'
import { Icon } from './Icon'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	icon: string
	size?: 'small' | 'default' | 'large'
	variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
	outline?: boolean
	label?: string
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>((
	{
		icon,
		size = 'default',
		variant = 'secondary',
		outline = false,
		label,
		className = '',
		...props
	},
	ref,
) => {
	const rootClass = [
		'component component-icon-button',
		`component-icon-button--${size}`,
		`component-icon-button--${variant}`,
		outline ? 'component-icon-button--outline' : '',
		className,
	].filter(Boolean).join(' ')

	return (
		<button {...props} ref={ref} className={rootClass} aria-label={label ?? icon}>
			<Icon name={icon} />
		</button>
	)
})

IconButton.displayName = 'IconButton'

