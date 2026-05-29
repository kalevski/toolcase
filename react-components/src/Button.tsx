import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	children?: React.ReactNode
	/** @deprecated Use `children` instead. */
	label?: string
	outline?: boolean
	size?: 'small' | 'default' | 'large'
	variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger' | 'link'
	/** Shows a spinner, disables the button, and sets `aria-busy`. */
	loading?: boolean
	/** Stretches the button to the full width of its container. */
	fullWidth?: boolean
	/** Icon rendered before the label. */
	startIcon?: React.ReactNode
	/** Icon rendered after the label. */
	endIcon?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((
	{
		children,
		label,
		outline = false,
		size = 'default',
		variant = 'primary',
		loading = false,
		fullWidth = false,
		startIcon,
		endIcon,
		className,
		disabled,
		type,
		...props
	},
	ref,
) => {
	const buttonClass = [
		'btn',
		variant === 'link' ? 'btn-link' : `btn${outline ? '-outline' : ''}-${variant}`,
		size === 'large' && 'btn-lg',
		size === 'small' && 'btn-sm',
		fullWidth && 'w-100',
		'd-inline-flex align-items-center justify-content-center gap-2',
		className,
	].filter(Boolean).join(' ')

	const content = children ?? label

	return (
		<button
			{...props}
			ref={ref}
			type={type ?? 'button'}
			className={buttonClass}
			disabled={disabled || loading}
			aria-busy={loading || undefined}
		>
			{loading && (
				<span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
			)}
			{!loading && startIcon}
			{content}
			{!loading && endIcon}
		</button>
	)
})

Button.displayName = 'Button'
