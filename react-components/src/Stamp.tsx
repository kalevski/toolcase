import React from 'react'

export type StampColor = 'pink' | 'yellow' | 'red' | 'cyan' | 'green'
export type StampPosition = 'tl' | 'tr' | 'bl' | 'br'

export interface StampProps extends React.HTMLAttributes<HTMLSpanElement> {
	label: React.ReactNode
	color?: StampColor
	position?: StampPosition
}

export const Stamp: React.FC<StampProps> = ({
	label,
	color = 'pink',
	position,
	className = '',
	...rest
}) => {
	const cls = [
		'component component-stamp',
		`component-stamp--${color}`,
		position ? `component-stamp--${position}` : '',
		className,
	].filter(Boolean).join(' ')
	return (
		<span className={cls} {...rest}>{label}</span>
	)
}
