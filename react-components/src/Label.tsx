import React from 'react'

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
	children?: React.ReactNode
	required?: boolean
	tooltip?: string
	size?: 'small' | 'default' | 'large'
}

export const Label: React.FC<LabelProps> = ({
	children,
	required = false,
	tooltip,
	size = 'default',
	className = '',
	...props
}) => {
	const rootClass = [
		'component component-label',
		`component-label--${size}`,
		className,
	].filter(Boolean).join(' ')

	return (
		<label {...props} className={rootClass}>
			<span className="component-label__text">
				{children}
				{required && <span className="component-label__required" aria-hidden="true">*</span>}
			</span>
			{tooltip && (
				<span className="component-label__tooltip" title={tooltip}>
					<i className="bi bi-info-circle" />
				</span>
			)}
		</label>
	)
}
