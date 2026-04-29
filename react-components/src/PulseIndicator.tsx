import React from 'react'

export interface PulseIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
	label: React.ReactNode
	color?: string
	paused?: boolean
}

export const PulseIndicator: React.FC<PulseIndicatorProps> = ({
	label,
	color,
	paused = false,
	className = '',
	style,
	...rest
}) => {
	const cls = [
		'component component-pulse-indicator',
		paused ? 'component-pulse-indicator--paused' : '',
		className,
	].filter(Boolean).join(' ')

	const dotStyle: React.CSSProperties | undefined = color
		? ({ background: color, boxShadow: `0 0 12px ${color}` } as React.CSSProperties)
		: undefined

	const rootStyle: React.CSSProperties | undefined = color ? { color, ...style } : style

	return (
		<span className={cls} style={rootStyle} role="status" aria-live="polite" {...rest}>
			<span className="component-pulse-indicator__dot" style={dotStyle} aria-hidden={true} />
			<span className="component-pulse-indicator__label">{label}</span>
		</span>
	)
}
