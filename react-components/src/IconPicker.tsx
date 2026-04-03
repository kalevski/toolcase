import React, { useState, useRef, useEffect } from 'react'

export type IconOption =
	| {
			icon: React.ReactNode
			label?: string
			value: string
	  }
	| string

export interface IconPickerProps {
	label?: string
	icons: IconOption[]
	value?: string
	onChange?: (value: string) => void
	className?: string
	columns?: number
	triggerStyle?: React.CSSProperties
	triggerClassName?: string
}

function getIcon(option: IconOption): React.ReactNode {
	return typeof option === 'string' ? option : option.icon
}
function getLabel(option: IconOption): string {
	return typeof option === 'string' ? option : option.label || option.value
}
function getValue(option: IconOption): string {
	return typeof option === 'string' ? option : option.value
}

export const IconPicker: React.FC<IconPickerProps> = ({
	label,
	icons,
	value,
	onChange,
	className = '',
	columns = 5,
	triggerStyle,
	triggerClassName = '',
}) => {
	const initial = value || getValue(icons[0])
	const [selected, setSelected] = useState(initial)
	const [open, setOpen] = useState(false)
	const rootRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (value !== undefined && value !== selected) {
			setSelected(value)
		}
	}, [value])

	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
				setOpen(false)
			}
		}
		document.addEventListener('mousedown', handler)
		return () => document.removeEventListener('mousedown', handler)
	}, [])

	const handleSelect = (val: string) => {
		setSelected(val)
		setOpen(false)
		if (onChange) onChange(val)
	}

	const selectedOption = icons.find((i) => getValue(i) === selected) || icons[0]

	return (
		<div className={`component component-icon-picker${className ? ` ${className}` : ''}`} ref={rootRef}>
			{label && <label className="component-icon-picker__label">{label}</label>}
			<button
				type="button"
				className={`component-icon-picker__trigger${triggerClassName ? ` ${triggerClassName}` : ''}`}
				onClick={() => setOpen((o) => !o)}
				style={triggerStyle}
			>
				<i className={'bi bi-' + getIcon(selectedOption)}></i>
			</button>
			{open && (
				<div className="component-icon-picker__dropdown">
					<div
						className="component-icon-picker__grid"
						style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
					>
						{icons.map((option) => (
							<button
								key={getValue(option)}
								type="button"
								className={`component-icon-picker__option${selected === getValue(option) ? ' component-icon-picker__option--selected' : ''}`}
								onClick={() => handleSelect(getValue(option))}
								title={getLabel(option)}
							>
								<i className={'bi bi-' + getIcon(option)}></i>
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
