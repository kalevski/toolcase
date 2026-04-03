import React from 'react'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
	icon?: string
	children?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({
	icon,
	children,
	className = '',
	...props
}) => {
	const rootClass = `component component-empty-state ${className}`.trim()
	return (
		<div {...props} className={rootClass}>
			{icon && <i className={`bi bi-${icon} component-empty-state__icon`} />}
			<div className="component-empty-state__content">
				{children}
			</div>
		</div>
	)
}
