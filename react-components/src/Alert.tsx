import React from 'react'
import { Icon } from './Icon'
import { IconButton } from './IconButton'

export interface AlertProps {
	children?: React.ReactNode
	message?: string
	title?: string
	icon?: React.ReactNode
	variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
	dismissible?: boolean
	onClose?: () => void
	className?: string
}

export const Alert: React.FC<AlertProps> = ({
	children,
	message,
	title,
	icon,
	variant = 'primary',
	dismissible = false,
	onClose,
	className = '',
}) => {
	const alertClass = `component component-alert alert alert-${variant} d-flex align-items-center justify-content-between ${className}`.trim()
	return (
		<div className={alertClass} role="alert">
			<div className="component-alert-content d-flex align-items-center gap-2">
				{icon && <span className="component-alert-icon">
					<Icon name={icon as string} />
				</span>}
				<div>
					{title && <div className="component-alert-title fw-bold mb-1">{title}</div>}
					{message}
					{children}
				</div>
			</div>
			{dismissible && <IconButton icon="x-lg" variant="secondary" size="small" label="Close" className="ms-2" onClick={onClose} />}
		</div>
	)
}
