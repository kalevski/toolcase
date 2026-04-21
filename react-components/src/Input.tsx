import React, { useId } from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	label?: string
	className?: string
	inputClassName?: string
	error?: string
}

export const Input: React.FC<InputProps> = ({ label, className = '', inputClassName = '', error, ...props }) => {
	const generatedId = useId()
	const inputId = props.id ?? generatedId
	const errorId = error ? `${inputId}-error` : undefined
	return (
		<div className={`component component-input ${className}`.trim()}>
			{label && (
				<label className="form-label form-label-inline" htmlFor={inputId}>
					{label}
				</label>
			)}
			<input
				{...props}
				className={`form-control${error ? ' is-invalid' : ''} ${inputClassName}`.trim()}
				id={inputId}
				aria-invalid={error ? true : undefined}
				aria-describedby={errorId ?? props['aria-describedby']}
			/>
			{error && <div id={errorId} className="invalid-feedback">{error}</div>}
		</div>
	)
}
