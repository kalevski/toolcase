import React, { useState, useRef, useEffect } from 'react'
import { Icon } from './Icon'
import { Skeleton } from './Skeleton'

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
	loading?: boolean
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
	loading = false,
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

	if (loading) {
		return (
			<div className={`component component-icon-picker${className ? ` ${className}` : ''}`}>
				{label && <label className="component-icon-picker__label">{label}</label>}
				<Skeleton shape="rect" width="3rem" height="2.5rem" />
			</div>
		)
	}

	return (
		<div className={`component component-icon-picker${className ? ` ${className}` : ''}`} ref={rootRef}>
			{label && <label className="component-icon-picker__label">{label}</label>}
			<button
				type="button"
				className={`component-icon-picker__trigger${triggerClassName ? ` ${triggerClassName}` : ''}`}
				onClick={() => setOpen((o) => !o)}
				style={triggerStyle}
			>
				<Icon name={String(getIcon(selectedOption))} />
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
								<Icon name={String(getIcon(option))} />
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
