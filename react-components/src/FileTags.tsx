import React, { useRef, useState, KeyboardEvent } from 'react'

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

	const tagAddEl = useRef<HTMLSpanElement>(null)
	const searchInputEl = useRef<HTMLInputElement>(null)

	const handleTagAddClick = () => {
		setSearch('')
		setTimeout(() => searchInputEl.current?.focus(), 50)
	}

	const handleRemoveTag = (tagId: string) => {
		onChange?.(selectedIds.filter((id) => id !== tagId))
	}

	const handleAddTag = (tagId: string) => {
		onChange?.([...selectedIds, tagId])
	}

	const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Escape') {
			setSearch('')
			searchInputEl.current?.blur()
		}
	}

	const filteredTags = freeTags
		.filter((tag) => tag.name.toLowerCase().includes(search.toLowerCase()))
		.slice(0, 5)

	return (
		<div className="component component-file-tags" role="group" aria-label="File tags">
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
					ref={tagAddEl}
					onClick={handleTagAddClick}
					className="badge badge--add"
					data-bs-toggle="dropdown"
					aria-expanded="false"
					aria-label="Add tag"
					role="button"
					tabIndex={0}
				>
					+
				</span>
			)}
			{!readonly && (
				<ul className="dropdown-menu dropdown-menu--small component-file-tags__dropdown">
					<li className="component-file-tags__search">
						<input
							ref={searchInputEl}
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							onKeyDown={handleSearchKeyDown}
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
