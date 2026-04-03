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
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
	label,
	options,
	value,
	onChange,
	inline = false,
	className = '',
	name,
}) => {
	const handleRadioChange = (optionValue: string) => {
		if (!onChange) return
		onChange(optionValue)
	}

	return (
		<div className={`component component-radio-group ${className}`.trim()}>
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
