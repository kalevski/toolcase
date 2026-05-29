import React from 'react'

export type SpinnerShape = 'ring' | 'dots' | 'bars' | 'grid' | 'pulse'

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
	size?: 'small' | 'default' | 'large'
	label?: string
	variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
	/** Visual style of the spinner. */
	shape?: SpinnerShape
}

// part count per shape (0 = single element); `ring` keeps the legacy `__circle` class.
const SHAPE_CONFIG: Record<SpinnerShape, { part: string; count: number }> = {
	ring: { part: 'circle', count: 0 },
	dots: { part: 'dots', count: 3 },
	bars: { part: 'bars', count: 4 },
	grid: { part: 'grid', count: 9 },
	pulse: { part: 'pulse', count: 0 },
}

const renderShape = (shape: SpinnerShape) => {
	const { part, count } = SHAPE_CONFIG[shape]
	if (count === 0) {
		return <span className={`component-spinner__${part}`} />
	}
	return (
		<span className={`component-spinner__${part}`}>
			{Array.from({ length: count }, (_, i) => (
				<i key={i} />
			))}
		</span>
	)
}

export const Spinner: React.FC<SpinnerProps> = ({
	size = 'default',
	label,
	variant = 'primary',
	shape = 'ring',
	className = '',
	...props
}) => {
	const rootClass = [
		'component component-spinner',
		`component-spinner--${size}`,
		`component-spinner--${variant}`,
		`component-spinner--${shape}`,
		className,
	].filter(Boolean).join(' ')

	return (
		<div {...props} className={rootClass} role="status">
			{renderShape(shape)}
			{label ? (
				<span className="component-spinner__label">{label}</span>
			) : (
				<span className="visually-hidden">Loading…</span>
			)}
		</div>
	)
}
