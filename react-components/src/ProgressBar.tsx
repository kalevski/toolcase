import React from 'react'
import { Text } from './Text'

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
	value: number
	label?: string
	variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'
	height?: number | string
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
	value,
	label,
	variant = 'primary',
	height = 8,
	...props
}) => {
	return (
		<div className="mb-3">
			{label && (
				<div className="d-flex justify-content-between mb-1">
					<Text variant="muted" size="small">{label}</Text>
					<Text variant="muted" size="small">{value}%</Text>
				</div>
			)}
			<div {...props} className={`progress${props.className ? ' ' + props.className : ''}`} style={{ height }}>
				<div
					className={`progress-bar bg-${variant}`}
					style={{ width: `${value}%` }}
					role="progressbar"
					aria-valuenow={value}
					aria-valuemin={0}
					aria-valuemax={100}
				></div>
			</div>
		</div>
	)
}
