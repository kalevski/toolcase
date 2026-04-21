import React, { useId, useRef, useState, useEffect, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { Icon } from './Icon'
import { Skeleton } from './Skeleton'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CommandPaletteItem {
	key: string
	label: string
	description?: string
	icon?: string
	group?: string
	/** Keywords added to the search space but not displayed. */
	keywords?: string[]
}

export interface CommandPaletteProps {
	items: CommandPaletteItem[]
	open: boolean
	onClose: () => void
	onSelect: (item: CommandPaletteItem) => void
	placeholder?: string
	loading?: boolean
	className?: string
}

// ── Fuzzy filter ───────────────────────────────────────────────────────────────

function matches(item: CommandPaletteItem, query: string): boolean {
	if (!query) return true
	const q = query.toLowerCase()
	const haystack = [item.label, item.description ?? '', ...(item.keywords ?? [])]
		.join(' ')
		.toLowerCase()
	// Simple: every word of the query must appear in the haystack
	return q.split(/\s+/).every((word) => haystack.includes(word))
}

function highlight(text: string, query: string): React.ReactNode {
	if (!query) return text
	const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const parts = text.split(new RegExp(`(${q})`, 'gi'))
	return parts.map((part, i) =>
		part.toLowerCase() === query.toLowerCase()
			? <mark key={i} className="component-command-palette__highlight">{part}</mark>
			: part,
	)
}

// ── Component ──────────────────────────────────────────────────────────────────

export const CommandPalette: React.FC<CommandPaletteProps> = ({
	items,
	open,
	onClose,
	onSelect,
	placeholder = 'Search…',
	loading = false,
	className = '',
}) => {
	const [query, setQuery] = useState('')
	const [activeIndex, setActiveIndex] = useState(0)
	const inputRef = useRef<HTMLInputElement>(null)
	const listRef = useRef<HTMLUListElement>(null)
	const id = useId()
	const inputId = `cmd-input-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`
	const listId  = `cmd-list-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`

	const filtered = items.filter((item) => matches(item, query))

	// Group items
	const groups: { group: string; items: CommandPaletteItem[] }[] = []
	const seen = new Map<string, number>()
	filtered.forEach((item) => {
		const g = item.group ?? ''
		if (!seen.has(g)) {
			seen.set(g, groups.length)
			groups.push({ group: g, items: [] })
		}
		groups[seen.get(g)!].items.push(item)
	})

	// Flat list for keyboard nav
	const flat = groups.flatMap((g) => g.items)

	// Focus input on open; reset state on close
	useEffect(() => {
		if (open) {
			setQuery('')
			setActiveIndex(0)
			requestAnimationFrame(() => inputRef.current?.focus())
		}
	}, [open])

	// Reset activeIndex when query changes
	useEffect(() => { setActiveIndex(0) }, [query])

	// Scroll active item into view
	useEffect(() => {
		if (!listRef.current) return
		const el = listRef.current.querySelector<HTMLElement>('[aria-selected="true"]')
		el?.scrollIntoView({ block: 'nearest' })
	}, [activeIndex])

	// Close on Escape / backdrop click handled below
	const close = useCallback(() => {
		setQuery('')
		onClose()
	}, [onClose])

	useEffect(() => {
		if (!open) return
		const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
		document.addEventListener('keydown', handler)
		return () => document.removeEventListener('keydown', handler)
	}, [open, close])

	// Keyboard nav inside the list
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			setActiveIndex((i) => Math.min(i + 1, flat.length - 1))
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			setActiveIndex((i) => Math.max(i - 1, 0))
		} else if (e.key === 'Enter') {
			e.preventDefault()
			if (flat[activeIndex]) { onSelect(flat[activeIndex]); close() }
		}
	}

	if (!open) return null

	return ReactDOM.createPortal(
		<div
			className="component-command-palette__backdrop"
			onClick={close}
			aria-hidden="true"
		>
			<div
				className={`component component-command-palette ${className}`.trim()}
				role="dialog"
				aria-modal="true"
				aria-label="Command palette"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={handleKeyDown}
			>
				{/* Search input */}
				<div className="component-command-palette__search">
					<span className="component-command-palette__search-icon" aria-hidden="true">
						<Icon name="search" />
					</span>
					<input
						ref={inputRef}
						id={inputId}
						type="text"
						role="combobox"
						aria-autocomplete="list"
						aria-controls={listId}
						aria-activedescendant={flat[activeIndex] ? `${listId}-item-${flat[activeIndex].key}` : undefined}
						aria-expanded={true}
						className="component-command-palette__input"
						placeholder={placeholder}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						autoComplete="off"
						spellCheck={false}
					/>
					{query && (
						<button
							type="button"
							className="component-command-palette__clear"
							aria-label="Clear search"
							onClick={() => { setQuery(''); inputRef.current?.focus() }}
						>
							<Icon name="x" aria-hidden={true} />
						</button>
					)}
				</div>

				{/* Results */}
				<ul
					ref={listRef}
					id={listId}
					role="listbox"
					className="component-command-palette__list"
					aria-label="Results"
				>
					{loading && (
						<li className="component-command-palette__loading">
							<Skeleton />
							<Skeleton width="60%" />
						</li>
					)}
					{!loading && filtered.length === 0 && (
						<li className="component-command-palette__empty">
							No results for &ldquo;{query}&rdquo;
						</li>
					)}
					{!loading && groups.map(({ group, items: groupItems }) => (
						<React.Fragment key={group}>
							{group && (
								<li className="component-command-palette__group-label" aria-hidden="true">
									{group}
								</li>
							)}
							{groupItems.map((item) => {
								const flatIdx = flat.indexOf(item)
								const isActive = flatIdx === activeIndex
								return (
									<li
										key={item.key}
										id={`${listId}-item-${item.key}`}
										role="option"
										aria-selected={isActive}
										className={[
											'component-command-palette__item',
											isActive ? 'component-command-palette__item--active' : '',
										].filter(Boolean).join(' ')}
										onMouseEnter={() => setActiveIndex(flatIdx)}
										onClick={() => { onSelect(item); close() }}
									>
										{item.icon && (
											<span className="component-command-palette__item-icon" aria-hidden="true">
												<Icon name={item.icon} />
											</span>
										)}
										<span className="component-command-palette__item-body">
											<span className="component-command-palette__item-label">
												{highlight(item.label, query)}
											</span>
											{item.description && (
												<span className="component-command-palette__item-desc">
													{item.description}
												</span>
											)}
										</span>
									</li>
								)
							})}
						</React.Fragment>
					))}
				</ul>

				{/* Footer hint */}
				<div className="component-command-palette__footer" aria-hidden="true">
					<span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
					<span><kbd>↵</kbd> select</span>
					<span><kbd>Esc</kbd> close</span>
				</div>
			</div>
		</div>,
		document.body,
	)
}
