import React from 'react'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
	label?: string
	className?: string
	textareaClassName?: string
}

export const Textarea: React.FC<TextareaProps> = ({ label, className = '', textareaClassName = '', ...props }) => {
	return (
		<>
			{label && (
				<label className="form-label form-label-inline" htmlFor={props.id}>
					{label}
				</label>
			)}
			<textarea {...props} className={`form-control form-textarea ${textareaClassName}`.trim()} id={props.id} />
		</>
	)
}
