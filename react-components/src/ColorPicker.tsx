import React, { useState, useRef, useEffect } from 'react'
import { Skeleton } from './Skeleton'
import { useClickOutside } from './hooks/useClickOutside'

export type ColorOption = {
	hex: string
	label?: string
}

export interface ColorPickerProps {
	label?: string
	colors: ColorOption[] | string[]
	value?: string
	onChange?: (color: string) => void
	className?: string
	columns?: number
	loading?: boolean
}

function getHex(option: ColorOption | string) {
	return typeof option === 'string' ? option : option.hex
}
function getLabel(option: ColorOption | string) {
	return typeof option === 'string' ? option : option.label || option.hex
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
	label,
	colors,
	value,
	onChange,
	className = '',
	columns = 5,
	loading = false,
}) => {
	const initial = value || getHex(colors[0])
	const [selected, setSelected] = useState(initial)
	const [open, setOpen] = useState(false)
	const [hexInput, setHexInput] = useState(initial)
	const rootRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (value !== undefined && value !== selected) {
			setSelected(value)
			setHexInput(value)
		}
	}, [value])

	useClickOutside(rootRef, () => setOpen(false))

	const handleSelect = (color: string) => {
		setSelected(color)
		setHexInput(color)
		setOpen(false)
		if (onChange) onChange(color)
	}

	const handleHexCommit = () => {
		const normalized = hexInput.trim().startsWith('#') ? hexInput.trim() : `#${hexInput.trim()}`
		if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
			setSelected(normalized)
			if (onChange) onChange(normalized)
		} else {
			// revert on invalid input
			setHexInput(selected)
		}
	}

	if (loading) {
		return (
			<div className={`component component-color-picker${className ? ` ${className}` : ''}`}>
				{label && <label className="component-color-picker__label">{label}</label>}
				<Skeleton shape="rect" width="3rem" height="2.5rem" />
			</div>
		)
	}

	return (
		<div className={`component component-color-picker${className ? ` ${className}` : ''}`} ref={rootRef}>
			{label && <label className="component-color-picker__label">{label}</label>}
			<button
				type="button"
				className="component-color-picker__trigger"
				onClick={() => setOpen((o) => !o)}
			>
				<span className="component-color-picker__swatch" style={{ background: selected }} />
				<span className="component-color-picker__hex_label">{getLabel(colors.find(c => getHex(c) === selected) || selected)}</span>
			</button>
			{open && (
				<div className="component-color-picker__dropdown">
					<div
						className="component-color-picker__grid"
						style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
					>
						{colors.map((option) => (
							<button
								key={getHex(option)}
								type="button"
								className={`component-color-picker__option${selected === getHex(option) ? ' component-color-picker__option--selected' : ''}`}
								style={{ background: getHex(option) }}
								onClick={() => handleSelect(getHex(option))}
								title={getLabel(option)}
							/>
						))}
					</div>
					<div className="component-color-picker__hex-input">
						<span className="component-color-picker__hex-hash">#</span>
						<input
							type="text"
							className="component-color-picker__hex-field"
							value={hexInput.replace(/^#/, '')}
							maxLength={6}
							spellCheck={false}
							onChange={(e) => setHexInput(`#${e.target.value}`)}
							onBlur={handleHexCommit}
							onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
							aria-label="Hex color value"
						/>
					</div>
				</div>
			)}
		</div>
	)
}
