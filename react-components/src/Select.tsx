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
}

export const Select: React.FC<SelectProps> = ({ label, options, className = '', selectClassName = '', ...props }) => {
	return (
		<div className={className}>
			{label && (
				<Label htmlFor={props.id}>
					{label}
				</Label>
			)}
			<select {...props} className={`form-select ${selectClassName}`.trim()} id={props.id}>
				{options.map((opt) => (
					<option key={opt.value} value={opt.value}>
						{opt.label}
					</option>
				))}
			</select>
		</div>
	)
}
