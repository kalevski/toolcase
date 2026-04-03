import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	children?: React.ReactNode
	label?: string
	outline?: boolean
	size?: 'small' | 'default' | 'large'
	variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
	ref?: React.Ref<HTMLButtonElement> | undefined
}

export const Button: React.FC<ButtonProps> = ({
	children,
	label,
	outline = false,
	size = 'default',
	variant = 'primary',
	ref = undefined,
	...props
}) => {
	let buttonClass = `${props.className || ''} btn btn${outline ? '-outline' : ''}-${variant}`
	if (size === 'large') {
		buttonClass += ' btn-lg'
	} else if (size === 'small') {
		buttonClass += ' btn-sm'
	}

	if (!label && !children) {
		label = '[YOUR LABEL]'
	}

	return (
		<button {...props} className={buttonClass}>
			{label || ''}
			{children}
		</button>
	)
}
