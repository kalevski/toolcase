import React, { useState } from 'react'
import { CommandPalette, Button } from '@toolcase/react-components'
import type { CommandPaletteItem } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

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

	return (
		<DemoPage
			eyebrow="Overlays"
			title="CommandPalette"
			lede="Keyboard-first search overlay with grouped results, fuzzy matching, and full ARIA support."
		>
			{lastSelected && (
				<div className="alert alert-info py-2">
					Selected: <strong>{lastSelected}</strong>
				</div>
			)}

			<DemoSection title="Default" caption="10 items across 3 groups. Type to filter.">
				<Button variant="primary" onClick={() => setOpen(true)}>
					Open Command Palette
				</Button>
			</DemoSection>

			<DemoSection title="Keyboard shortcuts">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
			</DemoSection>

			<CommandPalette
				items={allItems}
				open={open}
				onClose={() => setOpen(false)}
				onSelect={handleSelect}
				placeholder="Search commands…"
			/>
		</DemoPage>
	)
}

export default CommandPaletteDemo
