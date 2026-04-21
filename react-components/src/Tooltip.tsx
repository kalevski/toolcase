import React, { useState, useRef, useCallback, useEffect } from 'react'

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
	const [adjustedPosition, setAdjustedPosition] = useState(position)
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const bubbleRef = useRef<HTMLSpanElement>(null)

	const show = useCallback(() => {
		if (timeoutRef.current) clearTimeout(timeoutRef.current)
		setVisible(true)
	}, [])

	const hide = useCallback(() => {
		timeoutRef.current = setTimeout(() => setVisible(false), 100)
	}, [])

	// Flip position when tooltip overflows the viewport
	useEffect(() => {
		if (!visible || !bubbleRef.current) return
		const rect = bubbleRef.current.getBoundingClientRect()
		let next = position
		if (position === 'top' && rect.top < 0) next = 'bottom'
		else if (position === 'bottom' && rect.bottom > window.innerHeight) next = 'top'
		else if (position === 'left' && rect.left < 0) next = 'right'
		else if (position === 'right' && rect.right > window.innerWidth) next = 'left'
		if (next !== adjustedPosition) setAdjustedPosition(next)
	}, [visible, position])

	// Reset adjusted position when base position prop changes
	useEffect(() => {
		setAdjustedPosition(position)
	}, [position])

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
				<span
					ref={bubbleRef}
					className={`component-tooltip__bubble component-tooltip__bubble--${adjustedPosition}`}
					role="tooltip"
				>
					{content}
				</span>
			)}
		</span>
	)
}
