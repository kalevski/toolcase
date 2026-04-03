import React, { useId, useState, useCallback } from 'react'
import { Input } from './Input'
import { Textarea } from './Textarea'
import { DatePicker } from './DatePicker'
import { ColorPicker, ColorOption } from './ColorPicker'
import { IconPicker, IconOption } from './IconPicker'
import { TagInput } from './TagInput'
import { Checkbox } from './Checkbox'
import { CheckboxGroup, CheckboxGroupOption } from './CheckboxGroup'
import { Radio } from './Radio'
import { RadioGroup, RadioGroupOption } from './RadioGroup'
import { Switch } from './Switch'
import { Dropdown, DropdownItem } from './Dropdown'
import { ExtendedSelect, ExtendedSelectItem } from './ExtendedSelect'
import { HelperText } from './HelperText'
import { Tooltip } from './Tooltip'
import { Icon } from './Icon'

export type FormInputType =
	| 'text'
	| 'textarea'
	| 'date'
	| 'email'
	| 'range'
	| 'color'
	| 'icon'
	| 'tag'
	| 'checkbox'
	| 'checkbox-group'
	| 'radio'
	| 'radio-group'
	| 'url'
	| 'number'
	| 'boolean'
	| 'dropdown'
	| 'extended-select'

export type FormInputValidator = (value: unknown) => unknown

export interface FormInputProps {
	type: FormInputType
	label?: string
	help?: string
	helper?: string
	error?: string
	className?: string

	// Validation
	validate?: FormInputValidator | FormInputValidator[]
	onErrorMessage?: (validationResult: unknown) => string

	// Common input props
	name?: string
	id?: string
	placeholder?: string
	disabled?: boolean
	required?: boolean
	value?: unknown
	defaultValue?: unknown
	onChange?: (value: unknown, hasError: boolean) => void

	// Text / Email / URL / Number / Range specific
	min?: number | string
	max?: number | string
	step?: number | string

	// Textarea specific
	rows?: number

	// Color picker specific
	colors?: ColorOption[] | string[]
	columns?: number

	// Icon picker specific
	icons?: IconOption[]

	// Tag input specific
	recommendations?: string[]
	allowCreate?: boolean
	maxTags?: number

	// Checkbox / Radio inline
	inline?: boolean

	// Checkbox-group / Radio-group specific
	options?: CheckboxGroupOption[] | RadioGroupOption[]

	// Dropdown specific
	items?: DropdownItem[] | ExtendedSelectItem[]

	// ExtendedSelect specific
	searchPlaceholder?: string
	noResultsText?: string
}

const isEmpty = (value: unknown): boolean => {
	if (value == null) return true
	if (typeof value === 'string') return value.trim() === ''
	if (Array.isArray(value)) return value.length === 0
	return false
}

export const FormInput: React.FC<FormInputProps> = ({
	type,
	label,
	help,
	helper,
	error,
	className = '',
	validate,
	onErrorMessage,
	name,
	id,
	placeholder,
	disabled,
	required,
	value,
	defaultValue,
	onChange,
	min,
	max,
	step,
	rows,
	colors,
	columns,
	icons,
	recommendations,
	allowCreate,
	maxTags,
	inline,
	options,
	items,
	searchPlaceholder,
	noResultsText,
}) => {
	const autoId = useId()
	const inputId = id || autoId
	const [validationError, setValidationError] = useState<string | null>(null)

	const handleChange = useCallback((newValue: unknown) => {
		if (validate) {
			const validators = Array.isArray(validate) ? validate : [validate]
			for (const validator of validators) {
				const result = validator(newValue)
				if (result != null) {
					const message = onErrorMessage ? onErrorMessage(result) : String(result)
					setValidationError(message)
					onChange?.(newValue, true)
					return
				}
			}
		}
		if (required && isEmpty(newValue)) {
			setValidationError('required')
			onChange?.(newValue, true)
			return
		}
		setValidationError(null)
		onChange?.(newValue, false)
	}, [validate, onErrorMessage, onChange, required])

	const effectiveError = error || validationError || undefined

	const renderLabel = () => {
		if (!label) return null
		return (
			<div className="component-form-input__label">
				<label className="form-label form-label-inline mb-0" htmlFor={inputId}>
					{label}
					{required && <span className="component-form-input__required">*</span>}
				</label>
				{help && (
					<Tooltip content={help} position="top">
						<span className="component-form-input__help">
							<Icon name="question-circle" size="0.85rem" decorative />
						</span>
					</Tooltip>
				)}
			</div>
		)
	}

	const renderFooter = () => {
		if (!effectiveError && !helper) return null
		if (effectiveError) {
			return <HelperText variant="error" text={effectiveError} />
		}
		return <HelperText variant="default" text={helper} />
	}

	const renderInput = () => {
		switch (type) {
			case 'text':
			case 'email':
			case 'url':
			case 'number':
				return (
					<Input
						id={inputId}
						type={type}
						name={name}
						placeholder={placeholder}
						disabled={disabled}
						required={required}
						value={value as string | number | undefined}
						defaultValue={defaultValue as string | number | undefined}
						onChange={(e) => handleChange(e.target.value)}
						min={min}
						max={max}
						step={step}
						className={effectiveError ? 'is-invalid' : ''}
						inputClassName={effectiveError ? 'is-invalid' : ''}
					/>
				)

			case 'range':
				return (
					<input
						id={inputId}
						type="range"
						className={`form-range${effectiveError ? ' is-invalid' : ''}`}
						name={name}
						disabled={disabled}
						value={value as number | string | undefined}
						defaultValue={defaultValue as number | string | undefined}
						onChange={(e) => handleChange(e.target.value)}
						min={min}
						max={max}
						step={step}
					/>
				)

			case 'textarea':
				return (
					<Textarea
						id={inputId}
						name={name}
						placeholder={placeholder}
						disabled={disabled}
						required={required}
						value={value as string | undefined}
						defaultValue={defaultValue as string | undefined}
						onChange={(e) => handleChange(e.target.value)}
						rows={rows}
						textareaClassName={effectiveError ? 'is-invalid' : ''}
					/>
				)

			case 'date':
				return (
					<DatePicker
						value={value as string | undefined}
						onChange={(date) => handleChange(date)}
						disabled={disabled}
						min={min as string | undefined}
						max={max as string | undefined}
					/>
				)

			case 'color':
				return (
					<ColorPicker
						colors={colors || []}
						value={value as string | undefined}
						onChange={(color) => handleChange(color)}
						columns={columns}
					/>
				)

			case 'icon':
				return (
					<IconPicker
						icons={icons || []}
						value={value as string | undefined}
						onChange={(val) => handleChange(val)}
						columns={columns}
					/>
				)

			case 'tag':
				return (
					<TagInput
						value={value as string[] | undefined}
						defaultValue={defaultValue as string[] | undefined}
						onChange={(tags) => handleChange(tags)}
						placeholder={placeholder}
						disabled={disabled}
						recommendations={recommendations}
						allowCreate={allowCreate}
						maxTags={maxTags}
					/>
				)

			case 'checkbox':
				return (
					<Checkbox
						id={inputId}
						name={name}
						label={undefined}
						disabled={disabled}
						checked={value as boolean | undefined}
						defaultChecked={defaultValue as boolean | undefined}
						onChange={(e) => handleChange(e.target.checked)}
						inline={inline}
					/>
				)

			case 'checkbox-group':
				return (
					<CheckboxGroup
						options={options as CheckboxGroupOption[] || []}
						value={value as string[] | undefined}
						onChange={(vals) => handleChange(vals)}
						inline={inline}
						name={name}
					/>
				)

			case 'radio':
				return (
					<Radio
						id={inputId}
						name={name}
						label={undefined}
						disabled={disabled}
						checked={value as boolean | undefined}
						defaultChecked={defaultValue as boolean | undefined}
						onChange={(e) => handleChange(e.target.checked)}
						inline={inline}
					/>
				)

			case 'radio-group':
				return (
					<RadioGroup
						options={options as RadioGroupOption[] || []}
						value={value as string | undefined}
						onChange={(val) => handleChange(val)}
						inline={inline}
						name={name}
					/>
				)

			case 'boolean':
				return (
					<Switch
						id={inputId}
						name={name}
						disabled={disabled}
						checked={value as boolean | undefined}
						defaultChecked={defaultValue as boolean | undefined}
						onChange={(e) => handleChange(e.target.checked)}
					/>
				)

			case 'dropdown':
				return (
					<Dropdown
						items={items as DropdownItem[]}
						value={value as string | undefined}
						onChange={(key) => handleChange(key)}
						placeholder={placeholder}
					/>
				)

			case 'extended-select':
				return (
					<ExtendedSelect
						items={items as ExtendedSelectItem[]}
						value={value as string | undefined}
						onChange={(key) => handleChange(key)}
						placeholder={placeholder}
						searchPlaceholder={searchPlaceholder}
						noResultsText={noResultsText}
					/>
				)

			default:
				return null
		}
	}

	const isInlineInput = type === 'checkbox' || type === 'boolean'
	const rootClass = `component component-form-input component-form-input--${type}${isInlineInput ? ' component-form-input--inline' : ''}${effectiveError ? ' component-form-input--error' : ''} ${className}`.trim()

	return (
		<div className={rootClass}>
			{isInlineInput ? (
				<div className="component-form-input__inline-wrap">
					{renderInput()}
					{renderLabel()}
				</div>
			) : (
				<>
					{renderLabel()}
					{renderInput()}
				</>
			)}
			{renderFooter()}
		</div>
	)
}
