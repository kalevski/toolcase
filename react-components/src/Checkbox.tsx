import React, { useId } from 'react'

export type CheckboxSize = 'small' | 'default' | 'large'

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
	label?: string
	className?: string
	inputClassName?: string
	inline?: boolean
	size?: CheckboxSize
}

export const Checkbox: React.FC<CheckboxProps> = ({
	label,
	className = '',
	inputClassName = '',
	inline = false,
	size = 'default',
	...props
}) => {
	const generatedId = useId()
	const checkboxId = props.id ?? generatedId
	const wrapperClass = [
		'form-check',
		'component',
		'component-checkbox',
		size !== 'default' ? `component-checkbox--${size}` : '',
		inline ? 'form-check-inline' : '',
		className,
	].filter(Boolean).join(' ')
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
