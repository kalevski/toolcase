import React from 'react'

export interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
	status?: 'online' | 'offline' | 'busy' | 'away'
	size?: 'small' | 'default' | 'large'
	label?: string
	pulse?: boolean
}

export const StatusDot: React.FC<StatusDotProps> = ({
	status = 'offline',
	size = 'default',
	label,
	pulse = false,
	className = '',
	...props
}) => {
	const rootClass = [
		'component component-status-dot',
		`component-status-dot--${status}`,
		`component-status-dot--${size}`,
		pulse ? 'component-status-dot--pulse' : '',
		className,
	].filter(Boolean).join(' ')

	return (
		<span {...props} className={rootClass} role="status" aria-label={label ?? status}>
			<span className="component-status-dot__dot" />
			{label && <span className="component-status-dot__label">{label}</span>}
		</span>
	)
}
