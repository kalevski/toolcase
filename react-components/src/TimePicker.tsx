import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
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

type Period = 'AM' | 'PM'
interface TimeParts { h: number; m: number; s: number; period: Period }

const DEFAULT_TIME: TimeParts = { h: 12, m: 0, s: 0, period: 'AM' }

// ── Helpers ────────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')

function parseTime(value: string, fmt: '12h' | '24h'): TimeParts {
	const [hh = '0', mm = '0', ss = '0'] = value.split(':')
	let h = parseInt(hh, 10)
	const m = parseInt(mm, 10)
	const s = parseInt(ss, 10)
	let period: Period = 'AM'
	if (fmt === '12h') {
		period = h >= 12 ? 'PM' : 'AM'
		h = h % 12 || 12
	}
	return { h, m, s, period }
}

function buildValue({ h, m, s, period }: TimeParts, fmt: '12h' | '24h', showSec: boolean) {
	let hour24 = h
	if (fmt === '12h') {
		hour24 = period === 'AM' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12)
	}
	return showSec ? `${pad(hour24)}:${pad(m)}:${pad(s)}` : `${pad(hour24)}:${pad(m)}`
}

function formatDisplay(value: string, fmt: '12h' | '24h', showSec: boolean) {
	if (!value) return ''
	const { h, m, s, period } = parseTime(value, fmt)
	const base = showSec ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}`
	return fmt === '12h' ? `${base} ${period}` : base
}

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ')

// ── Scroll column ──────────────────────────────────────────────────────────────

interface ScrollColumnProps {
	options: number[]
	value: number
	onChange: (v: number) => void
	label: string
	format?: (v: number) => string
}

const ScrollColumn: React.FC<ScrollColumnProps> = ({ options, value, onChange, label, format = pad }) => {
	const listRef = useRef<HTMLUListElement>(null)
	const mounted = useRef(false)

	// Keep the selected option centered; jump instantly on mount, glide on change.
	useEffect(() => {
		const idx = options.indexOf(value)
		const child = listRef.current?.children[idx] as HTMLElement | undefined
		child?.scrollIntoView({ block: 'center', behavior: mounted.current ? 'smooth' : 'instant' })
		mounted.current = true
	}, [value, options])

	return (
		<div className="component-time-picker__column" role="listbox" aria-label={label}>
			<ul ref={listRef} className="component-time-picker__column-list">
				{options.map((opt) => (
					<li
						key={opt}
						className={cx(
							'component-time-picker__column-item',
							opt === value && 'component-time-picker__column-item--selected',
						)}
						role="option"
						aria-selected={opt === value}
						tabIndex={0}
						onClick={() => onChange(opt)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault()
								onChange(opt)
							}
						}}
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
	const rawId = useId()
	const inputId = `timepicker-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`
	const errorId = error ? `${inputId}-error` : undefined

	const [open, setOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)
	useClickOutside(containerRef, () => setOpen(false))

	const current = value ? parseTime(value, format) : DEFAULT_TIME
	const commit = (patch: Partial<TimeParts>) =>
		onChange?.(buildValue({ ...current, ...patch }, format, showSeconds))

	const hourOptions = useMemo(
		() =>
			format === '12h'
				? Array.from({ length: 12 }, (_, i) => i + 1)
				: Array.from({ length: 24 }, (_, i) => i),
		[format],
	)
	const minuteOptions = useMemo(
		() => Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep),
		[minuteStep],
	)
	const secondOptions = useMemo(() => Array.from({ length: 60 }, (_, i) => i), [])

	const displayText = formatDisplay(value, format, showSeconds)

	const rootClass = cx(
		'component component-time-picker',
		error && 'component-time-picker--error',
		disabled && 'component-time-picker--disabled',
		open && 'component-time-picker--open',
		className,
	)

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
						<ScrollColumn label="Hours" options={hourOptions} value={current.h} onChange={(h) => commit({ h })} />
						<div className="component-time-picker__sep" aria-hidden="true">:</div>
						<ScrollColumn label="Minutes" options={minuteOptions} value={current.m} onChange={(m) => commit({ m })} />
						{showSeconds && (
							<>
								<div className="component-time-picker__sep" aria-hidden="true">:</div>
								<ScrollColumn label="Seconds" options={secondOptions} value={current.s} onChange={(s) => commit({ s })} />
							</>
						)}
						{format === '12h' && (
							<div className="component-time-picker__period-col">
								{(['AM', 'PM'] as const).map((p) => (
									<button
										key={p}
										type="button"
										className={cx(
											'component-time-picker__period-btn',
											current.period === p && 'component-time-picker__period-btn--active',
										)}
										onClick={() => commit({ period: p })}
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
