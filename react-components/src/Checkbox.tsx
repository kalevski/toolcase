import React, { useId } from 'react'

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
	label?: string
	className?: string
	inputClassName?: string
	inline?: boolean
}

export const Checkbox: React.FC<CheckboxProps> = ({
	label,
	className = '',
	inputClassName = '',
	inline = false,
	...props
}) => {
	const generatedId = useId()
	const checkboxId = props.id ?? generatedId
	const wrapperClass = `form-check${inline ? ' form-check-inline' : ''} ${className}`.trim()
	return (
		<div className={wrapperClass}>
			<input type="checkbox" className={`form-check-input ${inputClassName}`.trim()} {...props} id={checkboxId} />
			{label && (
				<label className="form-check-label" htmlFor={checkboxId}>
					{label}
				</label>
			)}
		</div>
	)
}
