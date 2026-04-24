import React, { useState } from 'react'
import { ContextMenu } from '@toolcase/react-components'
import type { ContextMenuItem } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const fileMenuItems: ContextMenuItem[] = [
	{ key: 'open', label: 'Open', icon: 'folder2-open' },
	{ key: 'rename', label: 'Rename', icon: 'pencil' },
	{ key: 'duplicate', label: 'Duplicate', icon: 'copy' },
	{ divider: true, key: 'sep1', label: '' },
	{
		key: 'share',
		label: 'Share',
		icon: 'share',
		items: [
			{ key: 'share-link', label: 'Copy link', icon: 'link-45deg' },
			{ key: 'share-email', label: 'Send via email', icon: 'envelope' },
		],
	},
	{ divider: true, key: 'sep2', label: '' },
	{ key: 'delete', label: 'Delete', icon: 'trash', danger: true },
]

const tableRowItems: ContextMenuItem[] = [
	{ key: 'view', label: 'View details', icon: 'eye' },
	{ key: 'edit', label: 'Edit', icon: 'pencil' },
	{ key: 'disabled-action', label: 'Disabled action', icon: 'lock', disabled: true },
	{ divider: true, key: 'sep', label: '' },
	{ key: 'archive', label: 'Archive', icon: 'archive', danger: true },
]

export const ContextMenuDemo: React.FC = () => {
	const [lastAction, setLastAction] = useState<string>('')

	return (
		<DemoPage
			eyebrow="Overlays"
			title="ContextMenu"
			lede="Appears on right-click with keyboard navigation, nested submenus, and ARIA roles."
		>
			{lastAction && (
				<div className="alert alert-info py-2">
					Last action: <strong>{lastAction}</strong>
				</div>
			)}

			<DemoSection title="File operations (with submenu)">
				<ContextMenu items={fileMenuItems} onSelect={setLastAction}>
					<div
						style={{
							background: '#f8fafc',
							border: '2px dashed #e2e8f0',
							borderRadius: 8,
							cursor: 'context-menu',
							padding: '2.5rem 1.5rem',
							textAlign: 'center',
							userSelect: 'none',
						}}
					>
						<i className="bi bi-file-earmark-text" style={{ fontSize: '2rem', color: '#94a3b8' }} />
						<p className="text-muted mt-2 mb-0 small">Right-click for file options</p>
					</div>
				</ContextMenu>
			</DemoSection>

			<DemoSection title="Table row actions (with disabled item)">
				<ContextMenu items={tableRowItems} onSelect={setLastAction}>
					<div
						style={{
							background: '#f8fafc',
							border: '1px solid #e2e8f0',
							borderRadius: 8,
							cursor: 'context-menu',
							padding: '1rem 1.5rem',
							userSelect: 'none',
						}}
					>
						<div className="d-flex justify-content-between align-items-center">
							<div>
								<strong>user@example.com</strong>
								<span className="text-muted ms-3 small">Admin</span>
							</div>
							<span className="badge bg-success">Active</span>
						</div>
					</div>
				</ContextMenu>
			</DemoSection>
		</DemoPage>
	)
}

export default ContextMenuDemo
