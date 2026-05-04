import React, { useId, useRef, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface OTPInputProps {
	length?: number
	value?: string
	onChange?: (value: string) => void
	mode?: 'numeric' | 'alphanumeric'
	masked?: boolean
	label?: string
	error?: string
	disabled?: boolean
	autoFocus?: boolean
	className?: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export const OTPInput: React.FC<OTPInputProps> = ({
	length = 6,
	value = '',
	onChange,
	mode = 'numeric',
	masked = false,
	label,
	error,
	disabled = false,
	autoFocus = false,
	className = '',
}) => {
	const genId = useId()
	const groupId = `otp-${genId.replace(/[^a-zA-Z0-9_-]/g, '')}`
	const errorId = error ? `${groupId}-error` : undefined
	const inputsRef = useRef<(HTMLInputElement | null)[]>([])

	const chars = Array.from({ length }, (_, i) => value[i] ?? '')

	const isValidChar = useCallback((ch: string) => {
		if (mode === 'numeric') return /^\d$/.test(ch)
		return /^[a-zA-Z0-9]$/.test(ch)
	}, [mode])

	const focusAt = (idx: number) => {
		inputsRef.current[idx]?.focus()
		inputsRef.current[idx]?.select()
	}

	const updateChar = (idx: number, ch: string) => {
		const arr = chars.slice()
		arr[idx] = ch
		onChange?.(arr.join(''))
	}

	const handleChange = (idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
		const raw = e.target.value.replace(value[idx] ?? '', '').slice(-1)
		if (!raw) return
		if (!isValidChar(raw)) return
		updateChar(idx, raw.toUpperCase())
		if (idx < length - 1) focusAt(idx + 1)
	}

	const handleKeyDown = (idx: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Backspace') {
			e.preventDefault()
			if (chars[idx]) {
				updateChar(idx, '')
			} else if (idx > 0) {
				updateChar(idx - 1, '')
				focusAt(idx - 1)
			}
		}
		if (e.key === 'ArrowLeft'  && idx > 0)          { e.preventDefault(); focusAt(idx - 1) }
		if (e.key === 'ArrowRight' && idx < length - 1) { e.preventDefault(); focusAt(idx + 1) }
	}

	const handlePaste = (e: React.ClipboardEvent) => {
		e.preventDefault()
		const pasted = e.clipboardData.getData('text')
		const filtered = pasted
			.split('')
			.filter(isValidChar)
			.slice(0, length)
			.map((c) => c.toUpperCase())
		const arr = chars.slice()
		filtered.forEach((ch, i) => { arr[i] = ch })
		onChange?.(arr.join(''))
		const nextFocus = Math.min(filtered.length, length - 1)
		setTimeout(() => focusAt(nextFocus), 0)
	}

	const rootClass = [
		'component component-otp-input',
		error    ? 'component-otp-input--error'    : '',
		disabled ? 'component-otp-input--disabled' : '',
		className,
	].filter(Boolean).join(' ')

	return (
		<div className={rootClass}>
			{label && (
				<label className="form-label component-otp-input__label" id={`${groupId}-label`}>
					{label}
				</label>
			)}
			<div
				className="component-otp-input__fields"
				role="group"
				aria-labelledby={label ? `${groupId}-label` : undefined}
				aria-describedby={errorId}
			>
				{chars.map((ch, idx) => (
					<input
						key={idx}
						ref={(el) => { inputsRef.current[idx] = el }}
						className={[
							'component-otp-input__cell',
							error    ? 'is-invalid'  : '',
							ch       ? 'component-otp-input__cell--filled' : '',
						].filter(Boolean).join(' ')}
						type={masked ? 'password' : mode === 'numeric' ? 'tel' : 'text'}
						inputMode={mode === 'numeric' ? 'numeric' : 'text'}
						pattern={mode === 'numeric' ? '[0-9]*' : '[A-Za-z0-9]*'}
						maxLength={1}
						value={ch}
						disabled={disabled}
						autoFocus={autoFocus && idx === 0}
						autoComplete={idx === 0 ? 'one-time-code' : 'off'}
						aria-label={`Digit ${idx + 1} of ${length}`}
						aria-invalid={error ? true : undefined}
						onChange={handleChange(idx)}
						onKeyDown={handleKeyDown(idx)}
						onPaste={handlePaste}
						onFocus={(e) => e.target.select()}
					/>
				))}
			</div>
			{error && (
				<div id={errorId} className="invalid-feedback d-block">{error}</div>
			)}
		</div>
	)
}
