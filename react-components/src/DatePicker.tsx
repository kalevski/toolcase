import React, { useState } from 'react'
import { Label } from './Label'

export interface DatePickerProps {
	label?: string
	value?: string
	onChange?: (date: string) => void
	disabled?: boolean
	min?: string
	max?: string
	className?: string
}

export const DatePicker: React.FC<DatePickerProps> = ({
	label,
	value,
	onChange,
	disabled = false,
	min,
	max,
	className = '',
}) => {
	const [selectedDate, setSelectedDate] = useState(value || '')

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSelectedDate(e.target.value)
		onChange?.(e.target.value)
	}

	return (
		<div className={`component component-date-picker ${className}`.trim()}>
			{label && <Label className="mb-1">{label}</Label>}
			<input
				type="date"
				className="form-control date-input"
				value={selectedDate}
				onChange={handleChange}
				disabled={disabled}
				min={min}
				max={max}
			/>
		</div>
	)
}

export default DatePicker
