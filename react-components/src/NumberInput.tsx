import React, { useId, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

export type NumberInputSize = 'small' | 'default' | 'large'

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type' | 'prefix' | 'size'> {
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

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────────────────

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(({
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
}, ref) => {
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
		if (e.key === 'ArrowUp')   { e.preventDefault(); increment() }
		if (e.key === 'ArrowDown') { e.preventDefault(); decrement() }
		if (e.key === 'PageUp')    { e.preventDefault()
			const current = typeof value === 'number' ? value : 0
			onChange?.(round(clamp(current + step * 10, min, max), precision))
		}
		if (e.key === 'PageDown')  { e.preventDefault()
			const current = typeof value === 'number' ? value : 0
			onChange?.(round(clamp(current - step * 10, min, max), precision))
		}
		rest.onKeyDown?.(e)
	}

	const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
		// Only intercept when the input is focused
		if (document.activeElement !== e.currentTarget) return
		e.preventDefault()
		if (e.deltaY < 0) increment()
		else              decrement()
	}

	const atMin = min !== undefined && typeof value === 'number' && value <= min
	const atMax = max !== undefined && typeof value === 'number' && value >= max

	const rootClass = [
		'component component-number-input',
		size !== 'default' ? `component-number-input--${size}` : '',
		error    ? 'component-number-input--error'    : '',
		disabled ? 'component-number-input--disabled' : '',
		className,
	].filter(Boolean).join(' ')

	return (
		<div className={rootClass}>
			{label && (
				<label className="form-label" htmlFor={inputId}>
					{label}
				</label>
			)}
			<div className="component-number-input__control">
				{/* Decrement */}
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

				{/* Prefix */}
				{prefix && (
					<span className="component-number-input__prefix" aria-hidden="true">
						{prefix}
					</span>
				)}

				{/* Input */}
				<input
					{...rest}
					ref={ref}
					id={inputId}
					type="number"
					className={[
						'component-number-input__input',
						error ? 'is-invalid' : '',
						inputClassName,
					].filter(Boolean).join(' ')}
					value={value ?? ''}
					min={min}
					max={max}
					step={step}
					disabled={disabled}
					aria-invalid={error ? true : undefined}
					aria-describedby={errorId ?? rest['aria-describedby']}
					onChange={handleChange}
					onKeyDown={handleKeyDown}
					onWheel={handleWheel}
				/>

				{/* Suffix */}
				{suffix && (
					<span className="component-number-input__suffix" aria-hidden="true">
						{suffix}
					</span>
				)}

				{/* Increment */}
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
				<div id={errorId} className="invalid-feedback d-block">
					{error}
				</div>
			)}
		</div>
	)
})

NumberInput.displayName = 'NumberInput'
