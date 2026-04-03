import React from 'react'

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
	size?: 'small' | 'default' | 'large'
	label?: string
	variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
}

export const Spinner: React.FC<SpinnerProps> = ({
	size = 'default',
	label,
	variant = 'primary',
	className = '',
	...props
}) => {
	const rootClass = [
		'component component-spinner',
		`component-spinner--${size}`,
		`component-spinner--${variant}`,
		className,
	].filter(Boolean).join(' ')

	return (
		<div {...props} className={rootClass} role="status">
			<span className="component-spinner__circle" />
			{label ? (
				<span className="component-spinner__label">{label}</span>
			) : (
				<span className="visually-hidden">Loading…</span>
			)}
		</div>
	)
}
