import React, { useState, useRef, useCallback } from 'react'

export interface TooltipProps {
	children: React.ReactElement
	content: React.ReactNode
	position?: 'top' | 'bottom' | 'left' | 'right'
	className?: string
}

export const Tooltip: React.FC<TooltipProps> = ({
	children,
	content,
	position = 'top',
	className = '',
}) => {
	const [visible, setVisible] = useState(false)
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const show = useCallback(() => {
		if (timeoutRef.current) clearTimeout(timeoutRef.current)
		setVisible(true)
	}, [])

	const hide = useCallback(() => {
		timeoutRef.current = setTimeout(() => setVisible(false), 100)
	}, [])

	const rootClass = [
		'component component-tooltip',
		className,
	].filter(Boolean).join(' ')

	return (
		<span
			className={rootClass}
			onMouseEnter={show}
			onMouseLeave={hide}
			onFocus={show}
			onBlur={hide}
		>
			{children}
			{visible && (
				<span className={`component-tooltip__bubble component-tooltip__bubble--${position}`} role="tooltip">
					{content}
				</span>
			)}
		</span>
	)
}
