import React from 'react'
import { Text } from './Text'

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
	value: number
	label?: string
	variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'
	height?: number | string
	indeterminate?: boolean
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
	value,
	label,
	variant = 'primary',
	height = 8,
	indeterminate = false,
	...props
}) => {
	const rootClass = [
		'component component-progress-bar',
		indeterminate ? 'component-progress-bar--indeterminate' : '',
		props.className,
	].filter(Boolean).join(' ')

	return (
		<div className="mb-3">
			{label && (
				<div className="d-flex justify-content-between mb-1">
					<Text variant="muted" size="small">{label}</Text>
					{!indeterminate && <Text variant="muted" size="small">{value}%</Text>}
				</div>
			)}
			<div
				{...props}
				className={`progress${rootClass ? ' ' + rootClass : ''}`}
				style={{ height }}
				aria-label={!label ? (indeterminate ? 'Loading…' : `${value}%`) : undefined}
			>
				<div
					className={`progress-bar bg-${variant}`}
					style={indeterminate ? undefined : { width: `${value}%` }}
					role="progressbar"
					aria-valuenow={indeterminate ? undefined : value}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuetext={indeterminate ? 'Loading…' : `${value}%`}
				></div>
			</div>
		</div>
	)
}
