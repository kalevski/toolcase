import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	children?: React.ReactNode
	/** @deprecated Use `children` instead. */
	label?: string
	outline?: boolean
	size?: 'small' | 'default' | 'large'
	variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((
	{
		children,
		label,
		outline = false,
		size = 'default',
		variant = 'primary',
		...props
	},
	ref,
) => {
	let buttonClass = `${props.className || ''} btn btn${outline ? '-outline' : ''}-${variant}`
	if (size === 'large') {
		buttonClass += ' btn-lg'
	} else if (size === 'small') {
		buttonClass += ' btn-sm'
	}

	return (
		<button {...props} ref={ref} className={buttonClass}>
			{children ?? label}
		</button>
	)
})

Button.displayName = 'Button'
