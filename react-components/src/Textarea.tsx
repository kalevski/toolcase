import React, { useId } from 'react'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
	label?: string
	className?: string
	textareaClassName?: string
	error?: string
}

export const Textarea: React.FC<TextareaProps> = ({ label, className = '', textareaClassName = '', error, ...props }) => {
	const generatedId = useId()
	const textareaId = props.id ?? generatedId
	const errorId = error ? `${textareaId}-error` : undefined
	return (
		<div className={`component component-textarea${className ? ` ${className}` : ''}`}>
			{label && (
				<label className="form-label form-label-inline" htmlFor={textareaId}>
					{label}
				</label>
			)}
			<textarea
				{...props}
				className={`form-control form-textarea${error ? ' is-invalid' : ''} ${textareaClassName}`.trim()}
				id={textareaId}
				aria-invalid={error ? true : undefined}
				aria-describedby={errorId ?? props['aria-describedby']}
			/>
			{error && <div id={errorId} className="invalid-feedback">{error}</div>}
		</div>
	)
}
