import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Skeleton } from './Skeleton'
import { useClickOutside } from './hooks/useClickOutside'

export interface TagInputProps {
	label?: string
	recommendations?: string[]
	value?: string[]
	defaultValue?: string[]
	onChange?: (tags: string[]) => void
	placeholder?: string
	disabled?: boolean
	className?: string
	allowCreate?: boolean
	maxTags?: number
	loading?: boolean
}

export const TagInput: React.FC<TagInputProps> = ({
	label,
	recommendations = [],
	value,
	defaultValue = [],
	onChange,
	placeholder = 'Add a tag…',
	disabled = false,
	className = '',
	allowCreate = false,
	maxTags = 0,
	loading = false,
}) => {
	const isControlled = value !== undefined
	const [internalTags, setInternalTags] = useState<string[]>(defaultValue)
	const tags = isControlled ? value : internalTags

	const [input, setInput] = useState('')
	const [open, setOpen] = useState(false)
	const [highlightIdx, setHighlightIdx] = useState(-1)

	const rootRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)
	const listRef = useRef<HTMLUListElement>(null)

	const atLimit = maxTags > 0 && tags.length >= maxTags

	const updateTags = useCallback(
		(next: string[]) => {
			if (!isControlled) setInternalTags(next)
			onChange?.(next)
		},
		[isControlled, onChange],
	)

	const addTag = useCallback(
		(tag: string) => {
			const t = tag.trim()
			if (!t || tags.includes(t) || atLimit) return
			if (!allowCreate && !recommendations.includes(t)) return
			updateTags([...tags, t])
			setInput('')
			setHighlightIdx(-1)
		},
		[tags, atLimit, allowCreate, recommendations, updateTags],
	)

	const removeTag = useCallback(
		(tag: string) => {
			updateTags(tags.filter((t) => t !== tag))
		},
		[tags, updateTags],
	)

	const query = input.trim().toLowerCase()

	const filtered = recommendations.filter(
		(r) => r.toLowerCase().includes(query) && !tags.includes(r),
	)

	const showCreate =
		allowCreate && query !== '' && !tags.includes(input.trim()) && !recommendations.includes(input.trim())

	const totalItems = filtered.length + (showCreate ? 1 : 0)
	const showDropdown = open && totalItems > 0

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			setHighlightIdx((i) => (i + 1) % totalItems)
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			setHighlightIdx((i) => (i <= 0 ? totalItems - 1 : i - 1))
		} else if (e.key === 'Enter') {
			e.preventDefault()
			if (highlightIdx >= 0 && highlightIdx < filtered.length) {
				addTag(filtered[highlightIdx])
			} else if (highlightIdx === filtered.length && showCreate) {
				addTag(input.trim())
			} else if (query) {
				addTag(input.trim())
			}
		} else if (e.key === 'Escape') {
			setOpen(false)
			setHighlightIdx(-1)
		} else if (e.key === 'Backspace' && !input && tags.length) {
			removeTag(tags[tags.length - 1])
		}
	}

	useEffect(() => {
		if (highlightIdx < 0 || !listRef.current) return
		const el = listRef.current.children[highlightIdx] as HTMLElement | undefined
		el?.scrollIntoView({ block: 'nearest' })
	}, [highlightIdx])

	useClickOutside(rootRef, () => {
		setOpen(false)
		setHighlightIdx(-1)
	})

	useEffect(() => {
		const form = rootRef.current?.closest('form')
		if (!form) return
		const onReset = () => updateTags(defaultValue)
		form.addEventListener('reset', onReset)
		return () => form.removeEventListener('reset', onReset)
	}, [defaultValue, updateTags])

	if (loading) {
		return (
			<div className={`component component-tag-input${className ? ` ${className}` : ''}`}>
				{label && <label className="component-tag-input__label">{label}</label>}
				<div className="component-tag-input__field">
					<Skeleton />
				</div>
			</div>
		)
	}

	return (
		<div ref={rootRef} className={`component component-tag-input${className ? ` ${className}` : ''}`}>
			{label && <label className="component-tag-input__label">{label}</label>}

			<div
				className={`component-tag-input__field${open ? ' component-tag-input__field--focus' : ''}${disabled ? ' component-tag-input__field--disabled' : ''}`}
				onClick={() => inputRef.current?.focus()}
			>
				{tags.map((tag) => (
					<span className="component-tag-input__tag" key={tag}>
						{tag}
						{!disabled && (
							<button
								type="button"
								className="component-tag-input__tag-remove"
								onClick={(e) => {
									e.stopPropagation()
									removeTag(tag)
								}}
								aria-label={`Remove ${tag}`}
							>
								<i className="bi bi-x" />
							</button>
						)}
					</span>
				))}

				<input
					ref={inputRef}
					type="text"
					className="component-tag-input__input"
					value={input}
					onChange={(e) => {
						setInput(e.target.value)
						setHighlightIdx(-1)
						if (!open) setOpen(true)
					}}
					onKeyDown={handleKeyDown}
					onFocus={() => setOpen(true)}
					onPaste={(e) => {
						const text = e.clipboardData.getData('text')
						if (!text.includes(',')) return
						e.preventDefault()
						const parts = text.split(',').map((t) => t.trim()).filter(Boolean)
						const next = [...tags]
						for (const part of parts) {
							if (!next.includes(part) && (maxTags === 0 || next.length < maxTags)) {
								if (allowCreate || recommendations.includes(part)) {
									next.push(part)
								}
							}
						}
						updateTags(next)
						setInput('')
					}}
					placeholder={tags.length === 0 ? placeholder : ''}
					disabled={disabled || atLimit}
					autoComplete="off"
				/>
			</div>

			{showDropdown && (
				<ul ref={listRef} className="component-tag-input__dropdown" role="listbox">
					{filtered.map((tag, i) => (
						<li
							key={tag}
							role="option"
							aria-selected={highlightIdx === i}
							className={`component-tag-input__dropdown-item${highlightIdx === i ? ' component-tag-input__dropdown-item--active' : ''}`}
							onMouseEnter={() => setHighlightIdx(i)}
							onMouseDown={(e) => {
								e.preventDefault()
								addTag(tag)
							}}
						>
							{tag}
						</li>
					))}
					{showCreate && (
						<li
							role="option"
							aria-selected={highlightIdx === filtered.length}
							className={`component-tag-input__dropdown-item component-tag-input__dropdown-item--create${highlightIdx === filtered.length ? ' component-tag-input__dropdown-item--active' : ''}`}
							onMouseEnter={() => setHighlightIdx(filtered.length)}
							onMouseDown={(e) => {
								e.preventDefault()
								addTag(input.trim())
							}}
						>
							Create "<strong>{input.trim()}</strong>"
						</li>
					)}
				</ul>
			)}

			{maxTags > 0 && (
				<span className="component-tag-input__counter">
					{tags.length}/{maxTags}
				</span>
			)}
		</div>
	)
}

export default TagInput
