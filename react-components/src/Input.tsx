import React from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	label?: string
	className?: string
	inputClassName?: string
}

export const Input: React.FC<InputProps> = ({ label, className = '', inputClassName = '', ...props }) => {
	return (
		<>
			{label && (
				<label className="form-label form-label-inline" htmlFor={props.id}>
					{label}
				</label>
			)}
			<input {...props} className={`form-control ${inputClassName}`.trim()} id={props.id} />
		</>
	)
}
