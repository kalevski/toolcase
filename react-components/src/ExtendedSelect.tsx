import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import { Skeleton } from './Skeleton'
import { useClickOutside } from './hooks/useClickOutside'

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
	const [debouncedSearch, setDebouncedSearch] = useState('')
	const [activeIndex, setActiveIndex] = useState(-1)
	const containerRef = useRef<HTMLDivElement>(null)
	const searchInputRef = useRef<HTMLInputElement>(null)
	const listRef = useRef<HTMLUListElement>(null)
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const reactId = useId()
	const listId = `es-list-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`

	const selected = items.find((item) => item.key === value)

	const filteredItems = useMemo(() => {
		if (!debouncedSearch.trim()) return items
		const query = debouncedSearch.toLowerCase()
		return items.filter(
			(item) =>
				item.name.toLowerCase().includes(query) ||
				(item.description && item.description.toLowerCase().includes(query)) ||
				(item.label && item.label.toLowerCase().includes(query))
		)
	}, [items, debouncedSearch])

	const enabledFiltered = filteredItems.filter((i) => !i.disabled)

	useClickOutside(containerRef, () => {
		setOpen(false)
		setSearch('')
		setDebouncedSearch('')
		setActiveIndex(-1)
	})

	useEffect(() => {
		if (open && searchInputRef.current) {
			searchInputRef.current.focus()
		}
	}, [open])

	// Scroll highlighted item into view
	useEffect(() => {
		if (activeIndex < 0 || !listRef.current) return
		const el = listRef.current.children[activeIndex] as HTMLElement | undefined
		el?.scrollIntoView({ block: 'nearest' })
	}, [activeIndex])

	const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const v = e.target.value
		setSearch(v)
		setActiveIndex(-1)
		if (debounceRef.current) clearTimeout(debounceRef.current)
		debounceRef.current = setTimeout(() => setDebouncedSearch(v), 200)
	}, [])

	const rootClassName = [
		'component component-extended-select',
		open ? 'component-extended-select--open' : '',
		className || '',
	]
		.filter(Boolean)
		.join(' ')

	const handleSelect = (key: string) => {
		if (onChange) onChange(key)
		setOpen(false)
		setSearch('')
		setDebouncedSearch('')
		setActiveIndex(-1)
	}

	const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			setActiveIndex((i) => (i + 1) % enabledFiltered.length)
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			setActiveIndex((i) => (i - 1 + enabledFiltered.length) % enabledFiltered.length)
		} else if (e.key === 'Enter') {
			e.preventDefault()
			if (activeIndex >= 0 && enabledFiltered[activeIndex]) {
				handleSelect(enabledFiltered[activeIndex].key)
			}
		} else if (e.key === 'Escape') {
			setOpen(false)
			setSearch('')
			setDebouncedSearch('')
			setActiveIndex(-1)
		} else if (e.key === 'Home') {
			e.preventDefault()
			setActiveIndex(0)
		} else if (e.key === 'End') {
			e.preventDefault()
			setActiveIndex(enabledFiltered.length - 1)
		}
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
							onChange={handleSearchChange}
							onKeyDown={handleSearchKeyDown}
							aria-controls={listId}
							aria-activedescendant={activeIndex >= 0 ? `${listId}-${enabledFiltered[activeIndex]?.key}` : undefined}
						/>
					</div>

					<ul ref={listRef} id={listId} className="component-extended-select__list" role="listbox">
						{filteredItems.length === 0 && (
							<li className="component-extended-select__empty">{noResultsText}</li>
						)}
						{filteredItems.map((item) => {
							const enabledIndex = enabledFiltered.findIndex((i) => i.key === item.key)
							const isHighlighted = enabledIndex === activeIndex
							const isActive = item.key === value
							const itemClassName = [
								'component-extended-select__option',
								isActive ? 'component-extended-select__option--active' : '',
								item.disabled ? 'component-extended-select__option--disabled' : '',
								isHighlighted ? 'component-extended-select__option--highlighted' : '',
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
