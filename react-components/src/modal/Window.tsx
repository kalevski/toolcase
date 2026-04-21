import React, { JSX, MouseEvent, useId } from 'react'

export interface WindowProps {
	children: React.ReactNode
	size: 'small' | 'medium' | 'large' | 'xlarge' | 'full'
	className?: string
	title?: string
}

export function Window({ children, size = 'medium', className = '', title }: WindowProps) {
	const handleClick = (e: MouseEvent) => {
		e.stopPropagation()
	}

	const titleId = useId()

	return (
		<div
			className={`component-modals__window component-modals__window--${size}${className ? ` ${className}` : ''}`}
			onClick={handleClick}
			role="dialog"
			aria-modal="true"
			aria-labelledby={title ? titleId : undefined}
			tabIndex={-1}
		>
			{title && <span id={titleId} className="visually-hidden">{title}</span>}
			{children}
		</div>
	)
}
