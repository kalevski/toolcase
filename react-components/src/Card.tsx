import React from 'react'

export interface CardProps {
	children?: React.ReactNode
	header?: React.ReactNode
	variant?: 'default' | 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
	className?: string
}

export const Card: React.FC<CardProps> = ({ children, header, variant = 'default', className }) => {
	const classNameValue = `component component-card card border-1 ${variant !== 'default' ? `bg-${variant} text-white` : ''} ${className || ''}`
	return (
		<div className={classNameValue}>
			{header && <div className="card-header">{header}</div>}
			<div className="card-body">{children}</div>
		</div>
	)
}
