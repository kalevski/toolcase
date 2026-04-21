import React from 'react'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
	children?: React.ReactNode
	label?: string
	variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'
	pill?: boolean
	size?: 'sm' | 'md' | 'lg'
}

export const Badge: React.FC<BadgeProps> = ({ children, label, variant = 'secondary', pill = false, size = 'md', ...props }) => {
	let badgeClass = `${props.className || ''} component component-badge badge bg-${variant}`
	if (pill) badgeClass += ' rounded-pill'
	if (size === 'sm') badgeClass += ' component-badge--sm'
	if (size === 'lg') badgeClass += ' component-badge--lg'
	return (
		<span {...props} className={badgeClass.trim()}>
			{label}
			{children}
		</span>
	)
}
