import React, { useState } from 'react'
import { VerticalItemList, VerticalItemListItem, Card, CodeSnippet } from '../../src'

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
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">VerticalItemList</h1>
					<p className="text-muted mb-0">A sidebar list with icons, badges, and active state — paired with a content panel.</p>
				</div>
			</div>

			<div className="row mb-5">
			<div className="col-lg-8">
			<div className="border" style={{ overflow: 'hidden', minHeight: 320 }}>
				<VerticalItemList
					items={ITEMS}
					activeKey={selected}
					onSelect={setSelected}
				>
					{content && (
						<div className="p-4">
							<h4>{content.title}</h4>
							<p className="text-muted">{content.description}</p>
						</div>
					)}
				</VerticalItemList>
			</div>
			</div>
			</div>

		{/* Usage */}
		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Usage</h2>
					<CodeSnippet
						language="typescript"
						code={`import { VerticalItemList } from '@webgame-cloud/react-components'

<VerticalItemList
  items={[
    { key: 'dashboard', icon: 'grid', text: 'Dashboard', badge: 3 },
    { key: 'settings', icon: 'gear', text: 'Settings' },
  ]}
  activeKey={selected}
  onSelect={setSelected}
>
  {children}
</VerticalItemList>`}
					/>
				</Card>
			</div>
		</div>
		</div>
	)
}

export default VerticalItemListDemo
