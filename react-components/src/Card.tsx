import React from 'react'
import { Skeleton } from './Skeleton'

export interface CardProps {
	children?: React.ReactNode
	header?: React.ReactNode
	variant?: 'default' | 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
	className?: string
	loading?: boolean
}

export const Card: React.FC<CardProps> = ({ children, header, variant = 'default', className, loading = false }) => {
	const classNameValue = `component component-card card border-1 ${variant !== 'default' ? `bg-${variant} text-white` : ''} ${className || ''}`
	if (loading) {
		return (
			<div className={classNameValue}>
				{header !== undefined && (
					<div className="card-header"><Skeleton width="40%" /></div>
				)}
				<div className="card-body">
					<Skeleton count={3} />
				</div>
			</div>
		)
	}
	return (
		<div className={classNameValue}>
			{header && <div className="card-header">{header}</div>}
			<div className="card-body">{children}</div>
		</div>
	)
}
