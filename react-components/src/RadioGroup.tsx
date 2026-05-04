import React from 'react'
import { Radio } from './Radio'
import { Label } from './Label'

export interface RadioGroupOption {
	value: string
	label: string
	disabled?: boolean
}

export interface RadioGroupProps {
	label?: string
	options: RadioGroupOption[]
	value?: string
	onChange?: (selectedValue: string) => void
	inline?: boolean
	className?: string
	name?: string
	id?: string
	required?: boolean
	'aria-describedby'?: string
	'aria-labelledby'?: string
	'aria-invalid'?: boolean
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
	label,
	options,
	value,
	onChange,
	inline = false,
	className = '',
	name,
	id,
	required,
	'aria-describedby': ariaDescribedBy,
	'aria-labelledby': ariaLabelledBy,
	'aria-invalid': ariaInvalid,
}) => {
	const handleRadioChange = (optionValue: string) => {
		if (!onChange) return
		onChange(optionValue)
	}

	return (
		<div
			id={id}
			role="radiogroup"
			aria-required={required ? true : undefined}
			aria-describedby={ariaDescribedBy}
			aria-labelledby={ariaLabelledBy}
			aria-invalid={ariaInvalid}
			className={`component component-radio-group ${className}`.trim()}
		>
			{label && <Label className="d-block mb-2">{label}</Label>}
			{options.map((option) => (
				<Radio
					key={option.value}
					id={`${name || 'radio-group'}-${option.value}`}
					name={name}
					value={option.value}
					label={option.label}
					checked={value === option.value}
					onChange={() => handleRadioChange(option.value)}
					disabled={option.disabled}
					inline={inline}
				/>
			))}
		</div>
	)
}
