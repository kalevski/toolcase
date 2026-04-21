import React, { useId, useRef, useState, useCallback, useEffect } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SliderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
	value?: number
	onChange?: (value: number) => void
	min?: number
	max?: number
	step?: number
	/** Show tick marks at every `step` interval. */
	ticks?: boolean
	/** Show the current value in a floating tooltip while dragging. */
	showTooltip?: boolean
	/** Custom formatter for the value displayed in tick labels and tooltip. */
	formatValue?: (value: number) => string
	/** Optional label rendered above the track. */
	label?: string
	/** Error message. */
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

export const Slider: React.FC<SliderProps> = ({
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
	const generatedId = useId()
	const inputId = `slider-${generatedId.replace(/[^a-zA-Z0-9_-]/g, '')}`
	const errorId = error ? `${inputId}-error` : undefined
	const fmt = formatValue ?? ((v: number) => String(v))

	// Internal state for uncontrolled + dragging tooltip
	const [internalValue, setInternalValue] = useState<number>(valueProp ?? min)
	const value = valueProp !== undefined ? valueProp : internalValue
	const [dragging, setDragging] = useState(false)

	const trackRef = useRef<HTMLDivElement>(null)

	const setValue = useCallback((next: number) => {
		const snapped = clamp(snapToStep(next, min, step), min, max)
		if (valueProp === undefined) setInternalValue(snapped)
		onChange?.(snapped)
	}, [valueProp, min, max, step, onChange])

	// Sync internal state when controlled value changes
	useEffect(() => {
		if (valueProp !== undefined) setInternalValue(valueProp)
	}, [valueProp])

	// Mouse / touch drag handlers
	const getValueFromPointer = useCallback((clientX: number): number => {
		if (!trackRef.current) return value
		const { left, width } = trackRef.current.getBoundingClientRect()
		const ratio = clamp((clientX - left) / width, 0, 1)
		return ratio * (max - min) + min
	}, [value, min, max])

	const handlePointerDown = (e: React.PointerEvent) => {
		if (disabled) return
		e.preventDefault()
		;(e.target as HTMLElement).setPointerCapture(e.pointerId)
		setDragging(true)
		setValue(getValueFromPointer(e.clientX))
	}

	const handlePointerMove = (e: React.PointerEvent) => {
		if (!dragging || disabled) return
		setValue(getValueFromPointer(e.clientX))
	}

	const handlePointerUp = () => setDragging(false)

	// Keyboard
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (disabled) return
		switch (e.key) {
			case 'ArrowRight':
			case 'ArrowUp':
				e.preventDefault(); setValue(value + step); break
			case 'ArrowLeft':
			case 'ArrowDown':
				e.preventDefault(); setValue(value - step); break
			case 'PageUp':
				e.preventDefault(); setValue(value + step * 10); break
			case 'PageDown':
				e.preventDefault(); setValue(value - step * 10); break
			case 'Home':
				e.preventDefault(); setValue(min); break
			case 'End':
				e.preventDefault(); setValue(max); break
		}
	}

	// Ticks
	const tickCount = ticks ? Math.round((max - min) / step) + 1 : 0
	const tickValues: number[] = ticks
		? Array.from({ length: tickCount }, (_, i) => min + i * step)
		: []

	const fillPct = pct(clamp(value, min, max), min, max)

	const rootClass = [
		'component component-slider',
		disabled ? 'component-slider--disabled' : '',
		ticks    ? 'component-slider--ticks'    : '',
		className,
	].filter(Boolean).join(' ')

	return (
		<div className={rootClass} {...rest}>
			{label && (
				<div className="component-slider__header">
					<label className="component-slider__label" htmlFor={inputId}>
						{label}
					</label>
					<span className="component-slider__value-badge">{fmt(value)}</span>
				</div>
			)}

			<div
				ref={trackRef}
				className="component-slider__track-area"
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerUp}
			>
				{/* Native input for accessibility (visually hidden but functional) */}
				<input
					id={inputId}
					type="range"
					className="component-slider__native"
					min={min}
					max={max}
					step={step}
					value={value}
					disabled={disabled}
					aria-valuemin={min}
					aria-valuemax={max}
					aria-valuenow={value}
					aria-valuetext={fmt(value)}
					aria-invalid={error ? true : undefined}
					aria-describedby={errorId}
					onChange={(e) => setValue(parseFloat(e.target.value))}
					onKeyDown={handleKeyDown}
				/>

				{/* Visual track */}
				<div className="component-slider__track">
					<div
						className="component-slider__fill"
						style={{ width: `${fillPct}%` }}
					/>
					{/* Thumb */}
					<div
						className={[
							'component-slider__thumb',
							dragging ? 'component-slider__thumb--dragging' : '',
						].filter(Boolean).join(' ')}
						style={{ left: `${fillPct}%` }}
					>
						{showTooltip && dragging && (
							<div className="component-slider__tooltip" role="status" aria-live="off">
								{fmt(value)}
							</div>
						)}
					</div>
				</div>

				{/* Ticks */}
				{ticks && tickValues.length > 0 && (
					<div className="component-slider__ticks" aria-hidden="true">
						{tickValues.map((tv) => (
							<div
								key={tv}
								className={[
									'component-slider__tick',
									tv <= value ? 'component-slider__tick--filled' : '',
								].filter(Boolean).join(' ')}
								style={{ left: `${pct(tv, min, max)}%` }}
							>
								<span className="component-slider__tick-label">{fmt(tv)}</span>
							</div>
						))}
					</div>
				)}
			</div>

			{error && (
				<div id={errorId} className="invalid-feedback d-block">
					{error}
				</div>
			)}
		</div>
	)
}
