import React from 'react'
import { Label } from './Label'

export type SelectSize = 'small' | 'default' | 'large'

export interface SelectOption {
	value: string
	label: string
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
	label?: string
	options: SelectOption[]
	className?: string
	selectClassName?: string
	error?: string
	size?: SelectSize
}

const SIZE_CLASS: Record<SelectSize, string> = {
	small: 'form-select-sm',
	default: '',
	large: 'form-select-lg',
}

export const Select: React.FC<SelectProps> = ({ label, options, className = '', selectClassName = '', error, size = 'default', ...props }) => {
	const generatedId = React.useId()
	const selectId = props.id ?? generatedId
	const errorId = error ? `${selectId}-error` : undefined
	const selectClass = [
		'form-select',
		SIZE_CLASS[size],
		error ? 'is-invalid' : '',
		selectClassName,
	].filter(Boolean).join(' ')
	return (
		<div className={className}>
			{label && (
				<Label htmlFor={selectId}>
					{label}
				</Label>
			)}
			<select
				{...props}
				className={selectClass}
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
