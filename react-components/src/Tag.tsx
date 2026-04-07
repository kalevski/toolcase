import React from 'react'
import { Icon } from './Icon'

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
	children?: React.ReactNode
	label?: string
	variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
	removable?: boolean
	onRemove?: () => void
}

export const Tag: React.FC<TagProps> = ({
	children,
	label,
	variant = 'secondary',
	removable = false,
	onRemove,
	className = '',
	...props
}) => {
	const rootClass = [
		'component component-tag',
		`component-tag--${variant}`,
		className,
	].filter(Boolean).join(' ')

	return (
		<span {...props} className={rootClass}>
			<span className="component-tag__label">{label ?? children}</span>
			{removable && (
				<button
					type="button"
					className="component-tag__remove"
					onClick={onRemove}
					aria-label="Remove"
				>
					<Icon name="x" />
				</button>
			)}
		</span>
	)
}
