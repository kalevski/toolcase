import React, { useState, useEffect } from 'react'
import { Icon } from './Icon'
import { Skeleton } from './Skeleton'
import { usePopup } from './hooks/usePopup'

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
	const [search, setSearch] = useState('')
	const popup = usePopup<HTMLDivElement, HTMLButtonElement>({
		arrowNav: true,
		onClose: () => setSearch(''),
	})

	useEffect(() => {
		if (value !== undefined && value !== selected) {
			setSelected(value)
		}
	}, [value])

	const handleSelect = (val: string) => {
		setSelected(val)
		popup.close()
		if (onChange) onChange(val)
	}

	const filteredIcons = search.trim()
		? icons.filter((o) => getLabel(o).toLowerCase().includes(search.toLowerCase()) || getValue(o).toLowerCase().includes(search.toLowerCase()))
		: icons

	const selectedOption = icons.find((i) => getValue(i) === selected) || icons[0]

	if (loading) {
		return (
			<div className={`component component-icon-picker${className ? ` ${className}` : ''}`}>
				{label && <label className="component-icon-picker__label">{label}</label>}
				<Skeleton variant="rect" width="3rem" height="2.5rem" />
			</div>
		)
	}

	return (
		<div className={`component component-icon-picker${className ? ` ${className}` : ''}`} ref={popup.rootRef}>
			{label && <label className="component-icon-picker__label">{label}</label>}
			<button
				type="button"
				className={`component-icon-picker__trigger${triggerClassName ? ` ${triggerClassName}` : ''}`}
				style={triggerStyle}
				{...popup.triggerProps}
			>
				<Icon name={String(getIcon(selectedOption))} />
			</button>
			{popup.open && (
				<div className="component-icon-picker__dropdown" {...popup.popupProps}>
					<div className="component-icon-picker__search">
						<input
							type="text"
							className="component-icon-picker__search-input"
							placeholder="Search icons…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							autoFocus
						/>
					</div>
					<div
						className="component-icon-picker__grid"
						style={{ '--ip-cols': columns } as React.CSSProperties}
					>
						{filteredIcons.length === 0 && (
							<span className="component-icon-picker__empty">No icons found</span>
						)}
						{filteredIcons.map((option) => (
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
