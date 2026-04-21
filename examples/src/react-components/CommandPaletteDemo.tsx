import React, { useState } from 'react'
import { CommandPalette, Button, Card, CodeSnippet } from '@toolcase/react-components'
import type { CommandPaletteItem } from '@toolcase/react-components'

const allItems: CommandPaletteItem[] = [
	// Navigation
	{ key: 'home',       label: 'Go to Home',       icon: 'house',          group: 'Navigation', description: 'Return to the main dashboard' },
	{ key: 'settings',   label: 'Open Settings',    icon: 'gear',           group: 'Navigation', description: 'Manage your preferences' },
	{ key: 'profile',    label: 'View Profile',     icon: 'person',         group: 'Navigation', description: 'Your personal profile page' },
	{ key: 'billing',    label: 'Billing',          icon: 'credit-card',    group: 'Navigation', description: 'Manage your subscription' },
	// Actions
	{ key: 'new-file',   label: 'New File',         icon: 'file-plus',      group: 'Actions',    description: 'Create a new file', keywords: ['create', 'add'] },
	{ key: 'new-folder', label: 'New Folder',       icon: 'folder-plus',    group: 'Actions',    description: 'Create a new folder' },
	{ key: 'upload',     label: 'Upload Files',     icon: 'cloud-upload',   group: 'Actions',    description: 'Upload files from your computer' },
	// Tools
	{ key: 'search',     label: 'Search Files',     icon: 'search',         group: 'Tools',      description: 'Full-text search across your files' },
	{ key: 'theme',      label: 'Toggle Theme',     icon: 'moon',           group: 'Tools',      description: 'Switch between light and dark mode' },
	{ key: 'shortcuts',  label: 'Keyboard Shortcuts', icon: 'keyboard',     group: 'Tools',      description: 'View all keyboard shortcuts' },
]

export const CommandPaletteDemo: React.FC = () => {
	const [open, setOpen] = useState(false)
	const [lastSelected, setLastSelected] = useState<string>('')

	const handleSelect = (item: CommandPaletteItem) => {
		setLastSelected(item.label)
		setOpen(false)
	}

	const usageCode = `import { CommandPalette } from '@toolcase/react-components'
import type { CommandPaletteItem } from '@toolcase/react-components'

const items: CommandPaletteItem[] = [
  { key: 'home', label: 'Go to Home', icon: 'house', group: 'Navigation' },
  { key: 'settings', label: 'Open Settings', icon: 'gear', group: 'Navigation' },
]

const [open, setOpen] = useState(false)

<button onClick={() => setOpen(true)}>Open palette</button>

<CommandPalette
  items={items}
  open={open}
  onClose={() => setOpen(false)}
  onSelect={(item) => console.log(item.key)}
  placeholder="Search commands…"
/>`

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">CommandPalette</h1>
					<p className="text-muted mb-0">
						Keyboard-first search overlay with grouped results, fuzzy matching, and full ARIA support.
					</p>
				</div>
			</div>

			{lastSelected && (
				<div className="row mb-3">
					<div className="col-lg-8">
						<div className="alert alert-info py-2">
							Selected: <strong>{lastSelected}</strong>
						</div>
					</div>
				</div>
			)}

			{/* Main demo */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Default</h2>
						<p className="text-muted small mb-3">10 items across 3 groups. Type to filter.</p>
						<Button variant="primary" onClick={() => setOpen(true)}>
							Open Command Palette
						</Button>
					</Card>
				</div>
			</div>

			{/* Tips */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Keyboard shortcuts</h2>
						<div className="d-flex flex-column gap-2">
							<div className="d-flex justify-content-between align-items-center">
								<span className="text-muted small">Navigate up / down</span>
								<span>
									<kbd className="badge bg-light text-dark border me-1">↑</kbd>
									<kbd className="badge bg-light text-dark border">↓</kbd>
								</span>
							</div>
							<div className="d-flex justify-content-between align-items-center">
								<span className="text-muted small">Select item</span>
								<kbd className="badge bg-light text-dark border">Enter</kbd>
							</div>
							<div className="d-flex justify-content-between align-items-center">
								<span className="text-muted small">Close palette</span>
								<kbd className="badge bg-light text-dark border">Esc</kbd>
							</div>
						</div>
					</Card>
				</div>
			</div>

			{/* Code */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet language="typescript" code={usageCode} />
					</Card>
				</div>
			</div>

			<CommandPalette
				items={allItems}
				open={open}
				onClose={() => setOpen(false)}
				onSelect={handleSelect}
				placeholder="Search commands…"
			/>
		</div>
	)
}

export default CommandPaletteDemo
