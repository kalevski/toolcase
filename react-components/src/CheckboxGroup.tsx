import React from 'react'
import { Checkbox } from './Checkbox'
import { Label } from './Label'

export interface CheckboxGroupOption {
	value: string
	label: string
	disabled?: boolean
}

export interface CheckboxGroupProps {
	label?: string
	options: CheckboxGroupOption[]
	value?: string[]
	onChange?: (checkedValues: string[]) => void
	inline?: boolean
	className?: string
	name?: string
	id?: string
	required?: boolean
	'aria-describedby'?: string
	'aria-labelledby'?: string
	'aria-invalid'?: boolean
}

export const CheckboxGroup: React.FC<CheckboxGroupProps> = ({
	label,
	options,
	value = [],
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
	const handleCheckboxChange = (optionValue: string, checked: boolean) => {
		if (!onChange) return

		const newCheckedValues = checked ? [...value, optionValue] : value.filter((v) => v !== optionValue)

		onChange(newCheckedValues)
	}

	return (
		<div
			id={id}
			role="group"
			aria-required={required ? true : undefined}
			aria-describedby={ariaDescribedBy}
			aria-labelledby={ariaLabelledBy}
			aria-invalid={ariaInvalid}
			className={`component component-checkbox-group ${className}`.trim()}
		>
			{label && <Label className="d-block mb-2">{label}</Label>}
			{options.map((option) => (
				<Checkbox
					key={option.value}
					id={`${name || 'checkbox-group'}-${option.value}`}
					name={name}
					value={option.value}
					label={option.label}
					checked={value.includes(option.value)}
					onChange={(e) => handleCheckboxChange(option.value, e.target.checked)}
					disabled={option.disabled}
					inline={inline}
				/>
			))}
		</div>
	)
}
