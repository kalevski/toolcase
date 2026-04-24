import React, { useState } from 'react'
import { VerticalItemList, VerticalItemListItem } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const ITEMS: VerticalItemListItem[] = [
	{ key: 'dashboard', icon: 'grid', text: 'Dashboard', badge: 3 },
	{ key: 'users', icon: 'people', text: 'Users', badge: 12 },
	{ key: 'settings', icon: 'gear', text: 'Settings' },
	{ key: 'files', icon: 'folder', text: 'Files', badge: '2 GB' },
	{ key: 'analytics', icon: 'graph-up', text: 'Analytics' },
]

const CONTENT: Record<string, { title: string; description: string }> = {
	dashboard: { title: 'Dashboard', description: 'Overview of your project metrics and recent activity.' },
	users: { title: 'Users', description: 'Manage team members, roles, and permissions.' },
	settings: { title: 'Settings', description: 'Configure project preferences and integrations.' },
	files: { title: 'Files', description: 'Browse and manage uploaded assets and documents.' },
	analytics: { title: 'Analytics', description: 'View traffic, usage stats, and performance charts.' },
}

const VerticalItemListDemo = () => {
	const [selected, setSelected] = useState('dashboard')
	const content = CONTENT[selected]

	return (
		<DemoPage
			eyebrow="Data Display"
			title="VerticalItemList"
			lede="A sidebar list with icons, badges, and active state — paired with a content panel."
		>
			<DemoSection title="Sidebar list with content panel">
				<div style={{ border: '1px solid #e2e8f0', overflow: 'hidden', minHeight: 320 }}>
					<VerticalItemList
						items={ITEMS}
						activeKey={selected}
						onSelect={setSelected}
					>
						{content && (
							<div style={{ padding: '1.5rem' }}>
								<h4>{content.title}</h4>
								<p style={{ color: '#64748b' }}>{content.description}</p>
							</div>
						)}
					</VerticalItemList>
				</div>
			</DemoSection>
		</DemoPage>
	)
}

export default VerticalItemListDemo
