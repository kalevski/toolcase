import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import { Skeleton } from './Skeleton'

export interface ExtendedSelectItem {
	key: string
	name: string
	description?: string
	icon?: string
	label?: string
	disabled?: boolean
}

export interface ExtendedSelectProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
	items?: ExtendedSelectItem[]
	value?: string
	onChange?: (key: string) => void
	placeholder?: string
	searchPlaceholder?: string
	noResultsText?: string
	loading?: boolean
}

export const ExtendedSelect: React.FC<ExtendedSelectProps> = ({
	items = [],
	value,
	onChange,
	placeholder = 'Select an option',
	searchPlaceholder = 'Search...',
	noResultsText = 'No results found',
	loading = false,
	className,
	...rest
}) => {
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState('')
	const containerRef = useRef<HTMLDivElement>(null)
	const searchInputRef = useRef<HTMLInputElement>(null)

	const selected = items.find((item) => item.key === value)

	const filteredItems = useMemo(() => {
		if (!search.trim()) return items
		const query = search.toLowerCase()
		return items.filter(
			(item) =>
				item.name.toLowerCase().includes(query) ||
				(item.description && item.description.toLowerCase().includes(query)) ||
				(item.label && item.label.toLowerCase().includes(query))
		)
	}, [items, search])

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setOpen(false)
				setSearch('')
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	useEffect(() => {
		if (open && searchInputRef.current) {
			searchInputRef.current.focus()
		}
	}, [open])

	const rootClassName = [
		'component component-extended-select',
		open ? 'component-extended-select--open' : '',
		className || '',
	]
		.filter(Boolean)
		.join(' ')

	const handleSelect = (key: string) => {
		if (onChange) {
			onChange(key)
		}
		setOpen(false)
		setSearch('')
	}

	if (loading) {
		return (
			<div className={rootClassName} {...rest}>
				<div className="component-extended-select__trigger">
					<Skeleton />
				</div>
			</div>
		)
	}

	return (
		<div ref={containerRef} className={rootClassName} {...rest}>
			<button
				type="button"
				className="component-extended-select__trigger"
				aria-expanded={open}
				aria-haspopup="listbox"
				onClick={() => setOpen((o) => !o)}
			>
				{selected ? (
					<>
						{selected.icon && (
							<span className="component-extended-select__trigger-icon">
								<Icon name={selected.icon} size={16} />
							</span>
						)}
						{selected.label && (
							<span className="component-extended-select__trigger-label">
								{selected.label}
							</span>
						)}
						<span className="component-extended-select__trigger-name">{selected.name}</span>
					</>
				) : (
					<span className="component-extended-select__trigger-placeholder">{placeholder}</span>
				)}
				<span className="component-extended-select__trigger-chevron">
					<Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} />
				</span>
			</button>

			{open && (
				<div className="component-extended-select__panel">
					<div className="component-extended-select__search">
						<Icon name="search" size={14} />
						<input
							ref={searchInputRef}
							type="text"
							className="component-extended-select__search-input"
							placeholder={searchPlaceholder}
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>

					<ul className="component-extended-select__list" role="listbox">
						{filteredItems.length === 0 && (
							<li className="component-extended-select__empty">{noResultsText}</li>
						)}
						{filteredItems.map((item) => {
							const isActive = item.key === value
							const itemClassName = [
								'component-extended-select__option',
								isActive ? 'component-extended-select__option--active' : '',
								item.disabled ? 'component-extended-select__option--disabled' : '',
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
										<span className="component-extended-select__option-icon">
											<Icon name={item.icon} size={16} />
										</span>
									)}
									{item.label && (
										<span className="component-extended-select__option-label">
											{item.label}
										</span>
									)}
									<div className="component-extended-select__option-text">
										<span className="component-extended-select__option-name">{item.name}</span>
										{item.description && (
											<span className="component-extended-select__option-desc">{item.description}</span>
										)}
									</div>
								</li>
							)
						})}
					</ul>
				</div>
			)}
		</div>
	)
}
