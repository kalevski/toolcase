import React, { useId, useCallback } from 'react'

// ── Input ──────────────────────────────────────────────────────────────────────

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
    className?: string
    inputClassName?: string
    error?: string
}

export const Input: React.FC<InputProps> = ({ label, className = '', inputClassName = '', error, ...props }) => {
    const generatedId = useId()
    const inputId = props.id ?? generatedId
    const errorId = error ? `${inputId}-error` : undefined
    return (
        <div className={`component component-input ${className}`.trim()}>
            {label && (
                <label className="component-form-label" htmlFor={inputId}>
                    {label}
                </label>
            )}
            <input
                {...props}
                className={`component-form-control${error ? ' is-invalid' : ''} ${inputClassName}`.trim()}
                id={inputId}
                aria-invalid={error ? true : undefined}
                aria-describedby={errorId ?? props['aria-describedby']}
            />
            {error && (
                <div id={errorId} className="component-invalid-feedback">
                    {error}
                </div>
            )}
        </div>
    )
}

// ── Textarea ─────────────────────────────────────────────────────────────────────

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string
    className?: string
    textareaClassName?: string
    error?: string
}

export const Textarea: React.FC<TextareaProps> = ({
    label,
    className = '',
    textareaClassName = '',
    error,
    ...props
}) => {
    const generatedId = useId()
    const textareaId = props.id ?? generatedId
    const errorId = error ? `${textareaId}-error` : undefined
    return (
        <div className={`component component-textarea${className ? ` ${className}` : ''}`}>
            {label && (
                <label className="component-form-label" htmlFor={textareaId}>
                    {label}
                </label>
            )}
            <textarea
                {...props}
                className={`component-form-control component-form-textarea${error ? ' is-invalid' : ''} ${textareaClassName}`.trim()}
                id={textareaId}
                aria-invalid={error ? true : undefined}
                aria-describedby={errorId ?? props['aria-describedby']}
            />
            {error && (
                <div id={errorId} className="component-invalid-feedback">
                    {error}
                </div>
            )}
        </div>
    )
}

// ── Select ─────────────────────────────────────────────────────────────────────

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

const SELECT_SIZE_CLASS: Record<SelectSize, string> = {
    small: 'component-form-select--sm',
    default: '',
    large: 'component-form-select--lg',
}

export const Select: React.FC<SelectProps> = ({
    label,
    options,
    className = '',
    selectClassName = '',
    error,
    size = 'default',
    ...props
}) => {
    const generatedId = useId()
    const selectId = props.id ?? generatedId
    const errorId = error ? `${selectId}-error` : undefined
    const selectClass = [
        'component-form-select',
        SELECT_SIZE_CLASS[size],
        error ? 'is-invalid' : '',
        selectClassName,
    ]
        .filter(Boolean)
        .join(' ')
    return (
        <div className={`component component-select ${className}`.trim()}>
            {label && (
                <label className="component-form-label" htmlFor={selectId}>
                    {label}
                </label>
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
            {error && (
                <div id={errorId} className="component-invalid-feedback">
                    {error}
                </div>
            )}
        </div>
    )
}

// ── Checkbox ─────────────────────────────────────────────────────────────────────

export type CheckboxSize = 'small' | 'default' | 'large'

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    label?: string
    className?: string
    inputClassName?: string
    inline?: boolean
    size?: CheckboxSize
}

export const Checkbox: React.FC<CheckboxProps> = ({
    label,
    className = '',
    inputClassName = '',
    inline = false,
    size = 'default',
    ...props
}) => {
    const generatedId = useId()
    const checkboxId = props.id ?? generatedId
    const wrapperClass = [
        'component component-checkbox',
        size !== 'default' ? `component-checkbox--${size}` : '',
        inline ? 'component-checkbox--inline' : '',
        className,
    ]
        .filter(Boolean)
        .join(' ')
    return (
        <div className={wrapperClass}>
            <input
                type="checkbox"
                className={`component-checkbox__input ${inputClassName}`.trim()}
                {...props}
                id={checkboxId}
            />
            {label && (
                <label className="component-checkbox__label" htmlFor={checkboxId}>
                    {label}
                </label>
            )}
        </div>
    )
}

// ── Switch ─────────────────────────────────────────────────────────────────────

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
    label?: string
    size?: 'small' | 'default' | 'large'
}

export const Switch: React.FC<SwitchProps> = ({ label, size = 'default', className = '', id, ...props }) => {
    const rootClass = [
        'component component-switch',
        `component-switch--${size}`,
        props.disabled ? 'component-switch--disabled' : '',
        className,
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <label className={rootClass} htmlFor={id}>
            <input {...props} type="checkbox" id={id} className="component-switch__input" />
            <span className="component-switch__track">
                <span className="component-switch__knob" />
            </span>
            {label && <span className="component-switch__label">{label}</span>}
        </label>
    )
}

// ── NumberInput ─────────────────────────────────────────────────────────────────

export type NumberInputSize = 'small' | 'default' | 'large'

export interface NumberInputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type' | 'prefix' | 'size'> {
    value?: number | ''
    onChange?: (value: number | '') => void
    step?: number
    min?: number
    max?: number
    precision?: number
    label?: string
    error?: string
    prefix?: React.ReactNode
    suffix?: React.ReactNode
    className?: string
    inputClassName?: string
    size?: NumberInputSize
}

function clamp(val: number, min?: number, max?: number): number {
    if (min !== undefined && val < min) return min
    if (max !== undefined && val > max) return max
    return val
}

function round(val: number, precision?: number): number {
    if (precision === undefined) return val
    const f = Math.pow(10, precision)
    return Math.round(val * f) / f
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
    (
        {
            value,
            onChange,
            step = 1,
            min,
            max,
            precision,
            label,
            error,
            prefix,
            suffix,
            className = '',
            inputClassName = '',
            disabled,
            size = 'default',
            ...rest
        },
        ref,
    ) => {
        const generatedId = useId()
        const inputId = rest.id ?? generatedId
        const errorId = error ? `${inputId}-error` : undefined

        const increment = useCallback(() => {
            const current = typeof value === 'number' ? value : 0
            const next = round(clamp(current + step, min, max), precision)
            onChange?.(next)
        }, [value, step, min, max, precision, onChange])

        const decrement = useCallback(() => {
            const current = typeof value === 'number' ? value : 0
            const next = round(clamp(current - step, min, max), precision)
            onChange?.(next)
        }, [value, step, min, max, precision, onChange])

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const raw = e.target.value
            if (raw === '' || raw === '-') {
                onChange?.('')
                return
            }
            const parsed = parseFloat(raw)
            if (!isNaN(parsed)) {
                onChange?.(round(clamp(parsed, min, max), precision))
            }
        }

        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'ArrowUp') {
                e.preventDefault()
                increment()
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                decrement()
            }
            rest.onKeyDown?.(e)
        }

        const atMin = min !== undefined && typeof value === 'number' && value <= min
        const atMax = max !== undefined && typeof value === 'number' && value >= max

        const rootClass = [
            'component component-number-input',
            size !== 'default' ? `component-number-input--${size}` : '',
            error ? 'component-number-input--error' : '',
            disabled ? 'component-number-input--disabled' : '',
            className,
        ]
            .filter(Boolean)
            .join(' ')

        return (
            <div className={rootClass}>
                {label && (
                    <label className="component-form-label" htmlFor={inputId}>
                        {label}
                    </label>
                )}
                <div className="component-number-input__control">
                    <button
                        type="button"
                        className="component-number-input__btn component-number-input__btn--dec"
                        aria-label="Decrement"
                        disabled={disabled || atMin}
                        onClick={decrement}
                        tabIndex={-1}
                    >
                        <span aria-hidden="true">−</span>
                    </button>

                    {prefix && (
                        <span className="component-number-input__prefix" aria-hidden="true">
                            {prefix}
                        </span>
                    )}

                    <input
                        {...rest}
                        ref={ref}
                        id={inputId}
                        type="number"
                        className={['component-number-input__input', error ? 'is-invalid' : '', inputClassName]
                            .filter(Boolean)
                            .join(' ')}
                        value={value ?? ''}
                        min={min}
                        max={max}
                        step={step}
                        disabled={disabled}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={errorId ?? rest['aria-describedby']}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                    />

                    {suffix && (
                        <span className="component-number-input__suffix" aria-hidden="true">
                            {suffix}
                        </span>
                    )}

                    <button
                        type="button"
                        className="component-number-input__btn component-number-input__btn--inc"
                        aria-label="Increment"
                        disabled={disabled || atMax}
                        onClick={increment}
                        tabIndex={-1}
                    >
                        <span aria-hidden="true">+</span>
                    </button>
                </div>

                {error && (
                    <div id={errorId} className="component-invalid-feedback component-invalid-feedback--block">
                        {error}
                    </div>
                )}
            </div>
        )
    },
)

NumberInput.displayName = 'NumberInput'

// ── RadioGroup ─────────────────────────────────────────────────────────────────

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
    const groupName = name || useId()
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
            {label && <span className="component-form-label component-radio-group__label">{label}</span>}
            {options.map((option) => {
                const optId = `${groupName}-${option.value}`
                return (
                    <div
                        key={option.value}
                        className={['component-radio', inline ? 'component-radio--inline' : '']
                            .filter(Boolean)
                            .join(' ')}
                    >
                        <input
                            type="radio"
                            className="component-radio__input"
                            id={optId}
                            name={groupName}
                            value={option.value}
                            checked={value === option.value}
                            onChange={() => onChange?.(option.value)}
                            disabled={option.disabled}
                        />
                        <label className="component-radio__label" htmlFor={optId}>
                            {option.label}
                        </label>
                    </div>
                )
            })}
        </div>
    )
}
