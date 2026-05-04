import React, { useState } from 'react'
import {
	Chip,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const ChipDemo: React.FC = () => {
	const [selected, setSelected] = useState<Set<string>>(new Set(['react']))
	const [tags, setTags] = useState(['react', 'typescript', 'vue', 'node'])

	const toggle = (key: string) => {
		setSelected((prev) => {
			const next = new Set(prev)
			if (next.has(key)) next.delete(key)
			else next.add(key)
			return next
		})
	}

	const removeTag = (tag: string) => {
		setTags((prev) => prev.filter((t) => t !== tag))
	}

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Buttons & Actions</RichPageHeaderChip>}
				title="Chip"
				description="Selectable pill-shaped button with icon, variant, and selected state."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Selectable">
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
					{['react', 'vue', 'angular', 'svelte'].map((fw) => (
						<Chip
							key={fw}
							selected={selected.has(fw)}
							onClick={() => toggle(fw)}
							variant="primary"
						>
							{fw.charAt(0).toUpperCase() + fw.slice(1)}
						</Chip>
					))}
				</div>
			</SectionCard>

			<SectionCard title="Variants (selected)">
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
					<Chip variant="primary" selected>Primary</Chip>
					<Chip variant="info" selected>Info</Chip>
					<Chip variant="success" selected>Success</Chip>
					<Chip variant="warning" selected>Warning</Chip>
					<Chip variant="danger" selected>Danger</Chip>
				</div>
			</SectionCard>

			<SectionCard title="With Icon">
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
					<Chip icon="star">Favorites</Chip>
					<Chip icon="clock-history">Recent</Chip>
					<Chip icon="tag" variant="info" selected>Tagged</Chip>
				</div>
			</SectionCard>

			<SectionCard title="Disabled">
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
					<Chip disabled>Disabled</Chip>
					<Chip disabled selected variant="primary">Disabled Selected</Chip>
				</div>
			</SectionCard>

			<SectionCard title="Secondary Variant">
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
					<Chip variant="secondary">Secondary</Chip>
					<Chip variant="secondary" selected>Selected</Chip>
					<Chip variant="secondary" icon="tag">Tagged</Chip>
				</div>
			</SectionCard>

			<SectionCard title="Removable Chips">
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
					{tags.map((tag) => (
						<Chip
							key={tag}
							variant="primary"
							onRemove={() => removeTag(tag)}
						>
							{tag}
						</Chip>
					))}
					{tags.length === 0 && (
						<button className="btn btn-sm btn-outline-secondary" onClick={() => setTags(['react', 'typescript', 'vue', 'node'])}>
							Reset
						</button>
					)}
				</div>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default ChipDemo
