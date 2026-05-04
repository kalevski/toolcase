import React, { useId } from 'react'

export type RadioSize = 'small' | 'default' | 'large'

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
	label?: string
	className?: string
	inputClassName?: string
	inline?: boolean
	size?: RadioSize
}

export const Radio: React.FC<RadioProps> = ({
	label,
	className = '',
	inputClassName = '',
	inline = false,
	size = 'default',
	...props
}) => {
	const generatedId = useId()
	const radioId = props.id ?? generatedId
	const wrapperClass = [
		'form-check',
		'component',
		'component-radio',
		size !== 'default' ? `component-radio--${size}` : '',
		inline ? 'form-check-inline' : '',
		className,
	].filter(Boolean).join(' ')
	return (
		<div className={wrapperClass}>
			<input type="radio" className={`form-check-input ${inputClassName}`.trim()} {...props} id={radioId} />
			{label && (
				<label className="form-check-label" htmlFor={radioId}>
					{label}
				</label>
			)}
		</div>
	)
}
