import React, { useEffect, useId, useRef, useState } from 'react'
import { Icon } from './Icon'
import { Skeleton } from './Skeleton'
import { useClickOutside } from './hooks/useClickOutside'

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
	placeholder = 'Select…',
	loading = false,
	className,
	...rest
}) => {
	const [open, setOpen] = useState(false)
	const [activeIndex, setActiveIndex] = useState(-1)
	const containerRef = useRef<HTMLDivElement>(null)
	const listRef = useRef<HTMLUListElement>(null)
	const reactId = useId()
	const listId = `dropdown-list-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`

	const selected = items.find((item) => item.key === value)
	const enabledItems = items.filter((item) => !item.disabled)

	useClickOutside(containerRef, () => setOpen(false))

	// Keep the keyboard highlight in range when `items` change under an open menu.
	useEffect(() => {
		if (activeIndex >= enabledItems.length) {
			setActiveIndex(enabledItems.length - 1)
		}
	}, [enabledItems.length, activeIndex])

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
		setActiveIndex(-1)
	}

	const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault()
			if (!open) {
				setOpen(true)
				setActiveIndex(0)
			} else {
				const next = e.key === 'ArrowDown'
					? (activeIndex + 1) % enabledItems.length
					: (activeIndex - 1 + enabledItems.length) % enabledItems.length
				setActiveIndex(next)
			}
		} else if (e.key === 'Home') {
			e.preventDefault()
			setActiveIndex(0)
		} else if (e.key === 'End') {
			e.preventDefault()
			setActiveIndex(enabledItems.length - 1)
		} else if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault()
			if (!open) {
				setOpen(true)
				setActiveIndex(0)
			} else if (activeIndex >= 0) {
				handleSelect(enabledItems[activeIndex].key)
			}
		} else if (e.key === 'Escape') {
			setOpen(false)
			setActiveIndex(-1)
		}
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
				aria-controls={open ? listId : undefined}
				aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${enabledItems[activeIndex]?.key}` : undefined}
				onClick={() => { setOpen((o) => !o); setActiveIndex(0) }}
				onKeyDown={handleTriggerKeyDown}
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
				<span className="component-dropdown__trigger-chevron" aria-hidden="true">
					<Icon name="chevron-down" size={14} />
				</span>
			</button>

			{open && (
				<ul ref={listRef} id={listId} className="component-dropdown__list" role="listbox">
					{items.map((item) => {
						const enabledIndex = enabledItems.findIndex((i) => i.key === item.key)
						const isHighlighted = enabledIndex === activeIndex
						const isActive = item.key === value
						const itemClassName = [
							'component-dropdown__option',
							isActive ? 'component-dropdown__option--active' : '',
							item.disabled ? 'component-dropdown__option--disabled' : '',
							isHighlighted ? 'component-dropdown__option--highlighted' : '',
						]
							.filter(Boolean)
							.join(' ')

						return (
							<li
								key={item.key}
								id={`${listId}-${item.key}`}
								className={itemClassName}
								role="option"
								aria-selected={isActive}
								aria-disabled={item.disabled || undefined}
								onClick={() => !item.disabled && handleSelect(item.key)}
								onMouseEnter={() => !item.disabled && setActiveIndex(enabledIndex)}
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