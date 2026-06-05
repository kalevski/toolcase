import React, { useEffect, useRef, useState } from 'react'
import { usePopup } from './hooks/usePopup'

export interface FileTag {
	id: string
	name: string
}

export interface FileTagsProps {
	readonly?: boolean
	tags: FileTag[]
	selectedIds?: string[]
	onChange?: (selectedIds: string[]) => void
}

export const FileTags: React.FC<FileTagsProps> = ({ readonly = false, tags, selectedIds = [], onChange }) => {
	const addedTags = tags.filter((tag) => selectedIds.includes(tag.id))
	const freeTags = tags.filter((tag) => !selectedIds.includes(tag.id))
	const [search, setSearch] = useState('')

	const searchInputEl = useRef<HTMLInputElement>(null)
	// Self-contained popup (Escape / outside-click / focus restore / arrow nav) —
	// the previous markup used `data-bs-toggle="dropdown"`, which silently
	// requires Bootstrap JS that this package neither ships nor declares.
	const popup = usePopup<HTMLDivElement, HTMLSpanElement, HTMLUListElement>({
		arrowNav: true,
		onClose: () => setSearch(''),
	})

	// Focus the search field once the menu has rendered (replaces the old
	// setTimeout(…, 50) hack).
	useEffect(() => {
		if (popup.open) searchInputEl.current?.focus()
	}, [popup.open])

	const handleRemoveTag = (tagId: string) => {
		onChange?.(selectedIds.filter((id) => id !== tagId))
	}

	const handleAddTag = (tagId: string) => {
		onChange?.([...selectedIds, tagId])
		popup.close()
	}

	const onTriggerKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault()
			popup.toggle()
			return
		}
		popup.triggerProps.onKeyDown(e)
	}

	const filteredTags = freeTags
		.filter((tag) => tag.name.toLowerCase().includes(search.toLowerCase()))
		.slice(0, 5)

	return (
		<div className="component component-file-tags" role="group" aria-label="File tags" ref={popup.rootRef}>
			{addedTags.map((tag) => (
				<span
					key={tag.id}
					className="badge badge--tag"
					role="button"
					tabIndex={readonly ? -1 : 0}
					aria-label={`Remove tag ${tag.name}`}
					onClick={() => !readonly && handleRemoveTag(tag.id)}
					onKeyDown={(e) => e.key === 'Enter' && !readonly && handleRemoveTag(tag.id)}
				>
					{tag.name}
				</span>
			))}
			{!readonly && (
				<span
					ref={popup.triggerProps.ref}
					className="badge badge--add"
					aria-haspopup={true}
					aria-expanded={popup.open}
					aria-label="Add tag"
					role="button"
					tabIndex={0}
					onClick={popup.triggerProps.onClick}
					onKeyDown={onTriggerKeyDown}
				>
					+
				</span>
			)}
			{!readonly && popup.open && (
				<ul className="dropdown-menu show dropdown-menu--small component-file-tags__dropdown" {...popup.popupProps}>
					<li className="component-file-tags__search">
						<input
							ref={searchInputEl}
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search tags…"
							autoComplete="off"
						/>
					</li>
					{filteredTags.length > 0 && <li className="component-file-tags__divider" />}
					{filteredTags.map((tag) => (
						<li key={tag.id}>
							<button
								type="button"
								className="dropdown-item"
								onClick={() => handleAddTag(tag.id)}
							>
								{tag.name}
							</button>
						</li>
					))}
					{filteredTags.length === 0 && (
						<li className="component-file-tags__empty">
							{freeTags.length === 0 ? 'All tags assigned' : 'No matching tags'}
						</li>
					)}
				</ul>
			)}
		</div>
	)
}

export default FileTags
