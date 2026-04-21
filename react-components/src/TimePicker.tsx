import React, { useEffect, useId, useRef, useState } from 'react'
import { useClickOutside } from './hooks/useClickOutside'
import { Icon } from './Icon'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TimePickerProps {
	value?: string
	onChange?: (value: string) => void
	format?: '12h' | '24h'
	minuteStep?: number
	showSeconds?: boolean
	label?: string
	placeholder?: string
	error?: string
	disabled?: boolean
	clearable?: boolean
	className?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0') }

function parseTime(value: string, fmt: '12h' | '24h') {
	const parts = value.split(':')
	let h = parseInt(parts[0] ?? '0', 10)
	const m = parseInt(parts[1] ?? '0', 10)
	const s = parseInt(parts[2] ?? '0', 10)
	let period: 'AM' | 'PM' = 'AM'
	if (fmt === '12h') {
		period = h >= 12 ? 'PM' : 'AM'
		h = h % 12 || 12
	}
	return { h, m, s, period }
}

function buildValue(h: number, m: number, s: number, period: 'AM' | 'PM', fmt: '12h' | '24h', showSec: boolean) {
	let hour24 = h
	if (fmt === '12h') {
		if (period === 'AM') { hour24 = h === 12 ? 0 : h }
		else { hour24 = h === 12 ? 12 : h + 12 }
	}
	return showSec ? `${pad(hour24)}:${pad(m)}:${pad(s)}` : `${pad(hour24)}:${pad(m)}`
}

function formatDisplay(value: string, fmt: '12h' | '24h', showSec: boolean) {
	if (!value) return ''
	const { h, m, s, period } = parseTime(value, fmt)
	if (fmt === '12h') {
		return showSec ? `${pad(h)}:${pad(m)}:${pad(s)} ${period}` : `${pad(h)}:${pad(m)} ${period}`
	}
	return showSec ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}`
}

// ── Scroll column ──────────────────────────────────────────────────────────────

interface ScrollColumnProps {
	options: number[]
	value: number
	onChange: (v: number) => void
	label: string
	format?: (v: number) => string
}

const ScrollColumn: React.FC<ScrollColumnProps> = ({ options, value, onChange, label, format = pad }) => {
	const colRef = useRef<HTMLUListElement>(null)

	const scrollTo = (v: number, behavior: ScrollBehavior = 'smooth') => {
		if (!colRef.current) return
		const idx = options.indexOf(v)
		if (idx < 0) return
		const child = colRef.current.children[idx] as HTMLElement
		child?.scrollIntoView({ block: 'center', behavior })
	}

	useEffect(() => {
		scrollTo(value, 'instant')
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	return (
		<div className="component-time-picker__column" role="listbox" aria-label={label}>
			<ul ref={colRef} className="component-time-picker__column-list">
				{options.map((opt) => (
					<li
						key={opt}
						className={[
							'component-time-picker__column-item',
							opt === value ? 'component-time-picker__column-item--selected' : '',
						].filter(Boolean).join(' ')}
						role="option"
						aria-selected={opt === value}
						tabIndex={0}
						onClick={() => { onChange(opt); setTimeout(() => scrollTo(opt), 0) }}
						onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(opt) } }}
					>
						{format(opt)}
					</li>
				))}
			</ul>
		</div>
	)
}

// ── TimePicker ─────────────────────────────────────────────────────────────────

export const TimePicker: React.FC<TimePickerProps> = ({
	value = '',
	onChange,
	format = '24h',
	minuteStep = 5,
	showSeconds = false,
	label,
	placeholder = 'Select time',
	error,
	disabled = false,
	clearable = false,
	className = '',
}) => {
	const genId = useId()
	const inputId = `timepicker-${genId.replace(/[^a-zA-Z0-9_-]/g, '')}`
	const errorId = error ? `${inputId}-error` : undefined

	const [open, setOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)
	useClickOutside(containerRef, () => setOpen(false))

	const current = value ? parseTime(value, format) : { h: 12, m: 0, s: 0, period: 'AM' as const }

	const setH = (h: number) => onChange?.(buildValue(h, current.m, current.s, current.period as 'AM' | 'PM', format, showSeconds))
	const setM = (m: number) => onChange?.(buildValue(current.h, m, current.s, current.period as 'AM' | 'PM', format, showSeconds))
	const setS = (s: number) => onChange?.(buildValue(current.h, current.m, s, current.period as 'AM' | 'PM', format, showSeconds))
	const setPeriod = (p: 'AM' | 'PM') => onChange?.(buildValue(current.h, current.m, current.s, p, format, showSeconds))

	const hourOptions = format === '12h'
		? Array.from({ length: 12 }, (_, i) => i + 1)
		: Array.from({ length: 24 }, (_, i) => i)
	const minuteOptions = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep)
	const secondOptions = Array.from({ length: 60 }, (_, i) => i)

	const displayText = value ? formatDisplay(value, format, showSeconds) : ''

	const rootClass = [
		'component component-time-picker',
		error    ? 'component-time-picker--error'    : '',
		disabled ? 'component-time-picker--disabled' : '',
		open     ? 'component-time-picker--open'     : '',
		className,
	].filter(Boolean).join(' ')

	return (
		<div className={rootClass} ref={containerRef}>
			{label && (
				<label htmlFor={inputId} className="form-label component-time-picker__label">
					{label}
				</label>
			)}

			<div className="component-time-picker__control">
				<button
					id={inputId}
					type="button"
					className="component-time-picker__trigger"
					aria-haspopup="listbox"
					aria-expanded={open}
					aria-invalid={error ? true : undefined}
					aria-describedby={errorId}
					disabled={disabled}
					onClick={() => setOpen((o) => !o)}
					onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
				>
					<Icon name="clock" className="component-time-picker__icon" />
					<span className={displayText ? '' : 'component-time-picker__placeholder'}>
						{displayText || placeholder}
					</span>
				</button>

				{clearable && value && (
					<button
						type="button"
						className="component-time-picker__clear"
						aria-label="Clear time"
						onClick={(e) => { e.stopPropagation(); onChange?.('') }}
					>
						<Icon name="x" />
					</button>
				)}
			</div>

			{open && (
				<div className="component-time-picker__dropdown">
					<div className="component-time-picker__columns">
						<ScrollColumn label="Hours" options={hourOptions} value={current.h} onChange={setH} />
						<div className="component-time-picker__sep" aria-hidden="true">:</div>
						<ScrollColumn label="Minutes" options={minuteOptions} value={current.m} onChange={setM} />
						{showSeconds && <>
							<div className="component-time-picker__sep" aria-hidden="true">:</div>
							<ScrollColumn label="Seconds" options={secondOptions} value={current.s} onChange={setS} />
						</>}
						{format === '12h' && (
							<div className="component-time-picker__period-col">
								{(['AM', 'PM'] as const).map((p) => (
									<button
										key={p}
										type="button"
										className={[
											'component-time-picker__period-btn',
											current.period === p ? 'component-time-picker__period-btn--active' : '',
										].filter(Boolean).join(' ')}
										onClick={() => setPeriod(p)}
									>
										{p}
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			)}

			{error && (
				<div id={errorId} className="invalid-feedback d-block">{error}</div>
			)}
		</div>
	)
}
