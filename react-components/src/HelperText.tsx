import React from 'react'
import { Icon } from './Icon'

export interface HelperTextProps {
	children?: React.ReactNode
	text?: string
	variant?: 'default' | 'success' | 'warning' | 'error'
	icon?: string
	className?: string
}

export const HelperText: React.FC<HelperTextProps> = ({
	children,
	text,
	variant = 'default',
	icon,
	className = '',
}) => {
	const resolvedIcon = icon ?? (variant === 'success'
		? 'bi-check-circle-fill'
		: variant === 'warning'
			? 'bi-exclamation-triangle-fill'
			: variant === 'error'
				? 'bi-x-circle-fill'
				: 'bi-info-circle')

	return (
		<p className={`component component-helper-text component-helper-text--${variant}${className ? ` ${className}` : ''}`}>
			<Icon name={resolvedIcon.replace('bi-', '')} className="component-helper-text__icon" />
			<span className="component-helper-text__content">{text}{children}</span>
		</p>
	)
}
