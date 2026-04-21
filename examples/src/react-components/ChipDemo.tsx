import React, { useState } from 'react'
import { Chip, Card, CodeSnippet } from '@toolcase/react-components'

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
		<div className="container my-5">
			<div className="row">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-4">Chip</h1>
					<p className="text-muted mb-5">
						Selectable pill-shaped button with icon, variant, and selected state.
					</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h3 mb-4">Selectable</h2>
						<div className="d-flex gap-2 flex-wrap">
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
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h3 mb-4">Variants (selected)</h2>
						<div className="d-flex gap-2 flex-wrap">
							<Chip variant="primary" selected>Primary</Chip>
							<Chip variant="info" selected>Info</Chip>
							<Chip variant="success" selected>Success</Chip>
							<Chip variant="warning" selected>Warning</Chip>
							<Chip variant="danger" selected>Danger</Chip>
						</div>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h3 mb-4">With Icon</h2>
						<div className="d-flex gap-2 flex-wrap">
							<Chip icon="star">Favorites</Chip>
							<Chip icon="clock-history">Recent</Chip>
							<Chip icon="tag" variant="info" selected>Tagged</Chip>
						</div>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h3 mb-4">Disabled</h2>
						<div className="d-flex gap-2 flex-wrap">
							<Chip disabled>Disabled</Chip>
							<Chip disabled selected variant="primary">Disabled Selected</Chip>
						</div>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h3 mb-4">Secondary Variant</h2>
						<div className="d-flex gap-2 flex-wrap">
							<Chip variant="secondary">Secondary</Chip>
							<Chip variant="secondary" selected>Selected</Chip>
							<Chip variant="secondary" icon="tag">Tagged</Chip>
						</div>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h3 mb-4">Removable Chips</h2>
						<div className="d-flex gap-2 flex-wrap">
							{tags.map((tag) => (
								<Chip
									key={tag}
									variant="primary"
									removable
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
					</Card>
				</div>
			</div>

		{/* Usage */}
		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Usage</h2>
					<CodeSnippet
						language="typescript"
						code={`import { Chip } from '@toolcase/react-components'

<Chip>Default</Chip>
<Chip variant="primary" removable onRemove={handleRemove}>React</Chip>`}
					/>
				</Card>
			</div>
		</div>
		</div>
	)
}

export default ChipDemo
