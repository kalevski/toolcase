import React from 'react'
import { Label } from './Label'

export interface SelectOption {
	value: string
	label: string
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
	label?: string
	options: SelectOption[]
	className?: string
	selectClassName?: string
	error?: string
}

export const Select: React.FC<SelectProps> = ({ label, options, className = '', selectClassName = '', error, ...props }) => {
	const generatedId = React.useId()
	const selectId = props.id ?? generatedId
	const errorId = error ? `${selectId}-error` : undefined
	return (
		<div className={className}>
			{label && (
				<Label htmlFor={selectId}>
					{label}
				</Label>
			)}
			<select
				{...props}
				className={`form-select${error ? ' is-invalid' : ''} ${selectClassName}`.trim()}
				id={selectId}
				aria-invalid={error ? true : undefined}
				aria-describedby={errorId ?? props['aria-describedby']}
			>
				{options.map((opt) => (
					<option key={opt.value} value={opt.value}>
						{opt.label}
					</option>
				))}
			</select>
			{error && <div id={errorId} className="invalid-feedback">{error}</div>}
		</div>
	)
}
