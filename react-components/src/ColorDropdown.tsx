import React, { useState } from 'react'

export interface ColorPickerProps {
	label?: string
	colors: string[]
	value?: string
	onChange?: (color: string) => void
	className?: string
	dropdownClassName?: string
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
	label,
	colors,
	value,
	onChange,
	className = '',
	dropdownClassName = '',
}) => {
	const [selected, setSelected] = useState(value || colors[0])
	const [open, setOpen] = useState(false)

	const handleSelect = (color: string) => {
		setSelected(color)
		setOpen(false)
		if (onChange) onChange(color)
	}

	return (
		<div className={`component component-color-picker ${className}`.trim()}>
			{label && <label className="form-label mb-2">{label}</label>}
			<div className="dropdown">
				<button
					type="button"
					className={`picker-btn ${dropdownClassName}`.trim()}
					onClick={() => setOpen((o) => !o)}
				>
					<span className="picker-rect" style={{ background: selected }} />
					<span>{selected}</span>
					<span className="ms-auto" style={{ marginLeft: 'auto' }}>
						&#9662
					</span>
				</button>
				{open && (
					<div className="dropdown-menu show">
						{colors.map((color) => (
							<button
								key={color}
								type="button"
								className={`color-btn${selected === color ? ' selected' : ''}`}
								style={{ background: color }}
								onClick={() => handleSelect(color)}
								aria-label={color}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
