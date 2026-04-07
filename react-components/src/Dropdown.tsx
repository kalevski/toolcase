import React, { useEffect, useId, useRef, useState } from 'react'
import { Icon } from './Icon'
import { Skeleton } from './Skeleton'

export interface DropdownItem {
	key: string
	name: string
	description?: string
	icon?: string
	disabled?: boolean
}

export interface DropdownProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
	items?: DropdownItem[]
	value?: string
	onChange?: (key: string) => void
	placeholder?: string
	loading?: boolean
}

export const Dropdown: React.FC<DropdownProps> = ({
	items = [],
	value,
	onChange,
	placeholder = 'Select a project',
	loading = false,
	className,
	...rest
}) => {
	const [open, setOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)
	const reactId = useId()

	const selected = items.find((item) => item.key === value)

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const rootClassName = [
		'component component-dropdown',
		open ? 'component-dropdown--open' : '',
		className || '',
	]
		.filter(Boolean)
		.join(' ')

	const handleSelect = (key: string) => {
		if (onChange) {
			onChange(key)
		}
		setOpen(false)
	}

	if (loading) {
		return (
			<div className={rootClassName} {...rest}>
				<div className="component-dropdown__trigger">
					<Skeleton />
				</div>
			</div>
		)
	}

	return (
		<div ref={containerRef} className={rootClassName} {...rest}>
			<button
				type="button"
				className="component-dropdown__trigger"
				aria-expanded={open}
				aria-haspopup="listbox"
				onClick={() => setOpen((o) => !o)}
			>
				{selected ? (
					<>
						{selected.icon && (
							<span className="component-dropdown__trigger-icon">
								<Icon name={selected.icon} size={16} />
							</span>
						)}
						<span className="component-dropdown__trigger-name">{selected.name}</span>
					</>
				) : (
					<span className="component-dropdown__trigger-placeholder">{placeholder}</span>
				)}
				<span className="component-dropdown__trigger-chevron">
					<Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} />
				</span>
			</button>

			{open && (
				<ul className="component-dropdown__list" role="listbox">
					{items.map((item) => {
						const isActive = item.key === value
						const itemClassName = [
							'component-dropdown__option',
							isActive ? 'component-dropdown__option--active' : '',
							item.disabled ? 'component-dropdown__option--disabled' : '',
						]
							.filter(Boolean)
							.join(' ')

						return (
							<li
								key={item.key}
								className={itemClassName}
								role="option"
								aria-selected={isActive}
								onClick={() => !item.disabled && handleSelect(item.key)}
							>
								{item.icon && (
								<span className="component-dropdown__option-icon">
									<Icon name={item.icon} size={16} />
								</span>
							)}
							<div className="component-dropdown__option-text">
								<span className="component-dropdown__option-name">{item.name}</span>
								{item.description && (
									<span className="component-dropdown__option-desc">{item.description}</span>
									)}
								</div>
							</li>
						)
					})}
				</ul>
			)}
		</div>
	)
}