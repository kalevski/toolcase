import React from 'react'

export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
	label?: string
	className?: string
	inputClassName?: string
	inline?: boolean
}

export const Radio: React.FC<RadioProps> = ({
	label,
	className = '',
	inputClassName = '',
	inline = false,
	...props
}) => {
	const wrapperClass = `form-check${inline ? ' form-check-inline' : ''} ${className}`.trim()
	return (
		<div className={wrapperClass}>
			<input type="radio" className={`form-check-input ${inputClassName}`.trim()} {...props} />
			{label && (
				<label className="form-check-label" htmlFor={props.id}>
					{label}
				</label>
			)}
		</div>
	)
}
