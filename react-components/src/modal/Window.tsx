import React, { JSX, MouseEvent } from 'react'

export interface WindowProps {
	children: React.ReactNode
	size: 'small' | 'medium' | 'large' | 'xlarge' | 'full'
	className?: string
}

export function Window({ children, size = 'medium', className = '' }: WindowProps) {
	const handleClick = (e: MouseEvent) => {
		e.stopPropagation()
	}

	return (
		<div className={`component-modals__window component-modals__window--${size}${className ? ` ${className}` : ''}`} onClick={handleClick}>
			{children}
		</div>
	)
}
