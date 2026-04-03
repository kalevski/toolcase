import React from 'react'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
	children?: React.ReactNode
	label?: string
	variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'
	pill?: boolean
}

export const Badge: React.FC<BadgeProps> = ({ children, label, variant = 'secondary', pill = false, ...props }) => {
	let badgeClass = `${props.className || ''} component component-badge badge bg-${variant}`
	if (pill) badgeClass += ' rounded-pill'
	if (!label && !children) label = '[YOUR LABEL]'
	return (
		<span {...props} className={badgeClass.trim()}>
			{label}
			{children}
		</span>
	)
}
