import React, { useId, useRef, useState, useCallback, useEffect } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

export type RangeValue = [number, number]

export interface RangeSliderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
	value?: RangeValue
	onChange?: (value: RangeValue) => void
	min?: number
	max?: number
	step?: number
	ticks?: boolean
	showTooltip?: boolean
	formatValue?: (value: number) => string
	label?: string
	error?: string
	disabled?: boolean
	className?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number) {
	return Math.max(min, Math.min(max, val))
}

function snapToStep(val: number, min: number, step: number): number {
	return Math.round((val - min) / step) * step + min
}

function pct(val: number, min: number, max: number): number {
	return ((val - min) / (max - min)) * 100
}

// ── Component ──────────────────────────────────────────────────────────────────

export const RangeSlider: React.FC<RangeSliderProps> = ({
	value: valueProp,
	onChange,
	min = 0,
	max = 100,
	step = 1,
	ticks = false,
	showTooltip = true,
	formatValue,
	label,
	error,
	disabled = false,
	className = '',
	...rest
}) => {
	const genId = useId()
	const inputId = `range-slider-${genId.replace(/[^a-zA-Z0-9_-]/g, '')}`
	const errorId = error ? `${inputId}-error` : undefined
	const fmt = formatValue ?? ((v: number) => String(v))

	const defaultValue: RangeValue = [min, max]
	const [internalValue, setInternalValue] = useState<RangeValue>(valueProp ?? defaultValue)
	const value: RangeValue = valueProp !== undefined ? valueProp : internalValue

	useEffect(() => {
		if (valueProp !== undefined) setInternalValue(valueProp)
	}, [valueProp])

	const [dragging, setDragging] = useState<'low' | 'high' | null>(null)
	const trackRef = useRef<HTMLDivElement>(null)

	const setValue = useCallback((next: RangeValue) => {
		if (valueProp === undefined) setInternalValue(next)
		onChange?.(next)
	}, [valueProp, onChange])

	const getValueFromPointer = useCallback((clientX: number): number => {
		if (!trackRef.current) return min
		const { left, width } = trackRef.current.getBoundingClientRect()
		const ratio = clamp((clientX - left) / width, 0, 1)
		return ratio * (max - min) + min
	}, [min, max])

	const handlePointerDown = (handle: 'low' | 'high') => (e: React.PointerEvent) => {
		if (disabled) return
		e.preventDefault()
		;(e.target as HTMLElement).setPointerCapture(e.pointerId)
		setDragging(handle)
	}

	const handlePointerMove = (e: React.PointerEvent) => {
		if (!dragging || disabled) return
		const raw = getValueFromPointer(e.clientX)
		const snapped = clamp(snapToStep(raw, min, step), min, max)
		if (dragging === 'low') {
			setValue([Math.min(snapped, value[1] - step), value[1]])
		} else {
			setValue([value[0], Math.max(snapped, value[0] + step)])
		}
	}

	const handlePointerUp = () => setDragging(null)

	const handleKeyLow = (e: React.KeyboardEvent) => {
		if (disabled) return
		switch (e.key) {
			case 'ArrowRight': case 'ArrowUp':
				e.preventDefault(); setValue([clamp(snapToStep(value[0] + step, min, step), min, value[1] - step), value[1]]); break
			case 'ArrowLeft': case 'ArrowDown':
				e.preventDefault(); setValue([clamp(snapToStep(value[0] - step, min, step), min, value[1] - step), value[1]]); break
			case 'Home': e.preventDefault(); setValue([min, value[1]]); break
			case 'End':  e.preventDefault(); setValue([value[1] - step, value[1]]); break
		}
	}

	const handleKeyHigh = (e: React.KeyboardEvent) => {
		if (disabled) return
		switch (e.key) {
			case 'ArrowRight': case 'ArrowUp':
				e.preventDefault(); setValue([value[0], clamp(snapToStep(value[1] + step, min, step), value[0] + step, max)]); break
			case 'ArrowLeft': case 'ArrowDown':
				e.preventDefault(); setValue([value[0], clamp(snapToStep(value[1] - step, min, step), value[0] + step, max)]); break
			case 'Home': e.preventDefault(); setValue([value[0], value[0] + step]); break
			case 'End':  e.preventDefault(); setValue([value[0], max]); break
		}
	}

	const lowPct  = pct(clamp(value[0], min, max), min, max)
	const highPct = pct(clamp(value[1], min, max), min, max)

	const tickValues: number[] = ticks
		? Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step)
		: []

	const rootClass = [
		'component component-range-slider',
		disabled ? 'component-range-slider--disabled' : '',
		error    ? 'component-range-slider--error'    : '',
		className,
	].filter(Boolean).join(' ')

	return (
		<div className={rootClass} {...rest}>
			{label && (
				<div className="component-range-slider__header">
					<label className="component-range-slider__label">{label}</label>
					<span className="component-range-slider__value-badge">
						{fmt(value[0])} – {fmt(value[1])}
					</span>
				</div>
			)}

			<div
				ref={trackRef}
				className="component-range-slider__track-area"
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerUp}
			>
				{/* Native inputs (visually hidden, for a11y) */}
				<input
					type="range" className="component-range-slider__native component-range-slider__native--low"
					min={min} max={max} step={step} value={value[0]} disabled={disabled}
					aria-label={label ? `${label} minimum` : 'Minimum value'}
					aria-valuemin={min} aria-valuemax={value[1]} aria-valuenow={value[0]} aria-valuetext={fmt(value[0])}
					aria-invalid={error ? true : undefined} aria-describedby={errorId}
					onChange={(e) => setValue([Math.min(parseFloat(e.target.value), value[1] - step), value[1]])}
					onKeyDown={handleKeyLow}
				/>
				<input
					type="range" className="component-range-slider__native component-range-slider__native--high"
					min={min} max={max} step={step} value={value[1]} disabled={disabled}
					aria-label={label ? `${label} maximum` : 'Maximum value'}
					aria-valuemin={value[0]} aria-valuemax={max} aria-valuenow={value[1]} aria-valuetext={fmt(value[1])}
					onChange={(e) => setValue([value[0], Math.max(parseFloat(e.target.value), value[0] + step)])}
					onKeyDown={handleKeyHigh}
				/>

				{/* Visual track */}
				<div className="component-range-slider__track">
					<div
						className="component-range-slider__fill"
						style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
					/>

					{/* Low thumb */}
					<div
						className={[
							'component-range-slider__thumb',
							dragging === 'low' ? 'component-range-slider__thumb--dragging' : '',
						].filter(Boolean).join(' ')}
						style={{ left: `${lowPct}%` }}
						onPointerDown={handlePointerDown('low')}
						tabIndex={disabled ? -1 : 0}
						role="slider"
						aria-label={label ? `${label} minimum` : 'Minimum value'}
						aria-valuenow={value[0]} aria-valuemin={min} aria-valuemax={value[1]}
						onKeyDown={handleKeyLow}
					>
						{showTooltip && dragging === 'low' && (
							<div className="component-range-slider__tooltip">{fmt(value[0])}</div>
						)}
					</div>

					{/* High thumb */}
					<div
						className={[
							'component-range-slider__thumb',
							dragging === 'high' ? 'component-range-slider__thumb--dragging' : '',
						].filter(Boolean).join(' ')}
						style={{ left: `${highPct}%` }}
						onPointerDown={handlePointerDown('high')}
						tabIndex={disabled ? -1 : 0}
						role="slider"
						aria-label={label ? `${label} maximum` : 'Maximum value'}
						aria-valuenow={value[1]} aria-valuemin={value[0]} aria-valuemax={max}
						onKeyDown={handleKeyHigh}
					>
						{showTooltip && dragging === 'high' && (
							<div className="component-range-slider__tooltip">{fmt(value[1])}</div>
						)}
					</div>
				</div>

				{ticks && tickValues.length > 0 && (
					<div className="component-range-slider__ticks" aria-hidden="true">
						{tickValues.map((tv) => (
							<div
								key={tv}
								className={[
									'component-range-slider__tick',
									tv >= value[0] && tv <= value[1] ? 'component-range-slider__tick--filled' : '',
								].filter(Boolean).join(' ')}
								style={{ left: `${pct(tv, min, max)}%` }}
							>
								<span className="component-range-slider__tick-label">{fmt(tv)}</span>
							</div>
						))}
					</div>
				)}
			</div>

			{error && (
				<div id={errorId} className="invalid-feedback d-block">{error}</div>
			)}
		</div>
	)
}
