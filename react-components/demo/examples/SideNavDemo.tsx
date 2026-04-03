import { useState } from 'react'
import { SideNav, SideNavSection } from '../../src/SideNav'
import { DashboardLayout } from '../../src/DashboardLayout'
import { Brand } from '../../src/Brand'
import { Badge } from '../../src/Badge'
import { Card, CodeSnippet } from '../../src'

const sections: SideNavSection[] = [
	{
		title: 'Main',
		items: [
			{ key: 'dashboard', label: 'Dashboard', icon: 'grid-1x2', active: true },
			{ key: 'projects', label: 'Projects', icon: 'folder2', badge: '3' },
			{ key: 'builds', label: 'Builds', icon: 'hammer' },
			{ key: 'deployments', label: 'Deployments', icon: 'cloud-upload' },
		],
	},
	{
		title: 'Assets',
		items: [
			{ key: 'files', label: 'File Manager', icon: 'file-earmark' },
			{ key: 'images', label: 'Images', icon: 'image' },
			{ key: 'database', label: 'Database', icon: 'database' },
		],
	},
	{
		title: 'Account',
		items: [
			{ key: 'team', label: 'Team', icon: 'people' },
			{ key: 'billing', label: 'Billing', icon: 'credit-card', disabled: true, badge: <Badge variant="warning" pill>Pro</Badge> },
			{ key: 'settings', label: 'Settings', icon: 'gear' },
			{ key: 'help', label: 'Help & Support', icon: 'question-circle' },
		],
	},
]

const SideNavDemo = () => {
	const [activeKey, setActiveKey] = useState('dashboard')

	const activeSections = sections.map((section) => ({
		...section,
		items: section.items.map((item) => ({
			...item,
			active: item.key === activeKey,
			onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
				e.preventDefault()
				setActiveKey(item.key!)
			},
		})),
	}))

	return (
		<DashboardLayout
			brandComponent={<Brand primaryText="WEBGAME" secondaryText=".CLOUD" label="beta" />}
			sidebarMenuComponent={<SideNav sections={activeSections} />}
		>
			<Card>
				<h5 className="card-title">Active Page: {activeKey}</h5>
				<p className="card-text text-muted">
					Click items in the sidebar to navigate.
				</p>
			</Card>
			<Card className="mt-4">
				<h2 className="h5 mb-3">Usage</h2>
				<CodeSnippet
					language="typescript"
					code={`import { SideNav, SideNavSection } from '@webgame-cloud/react-components'

const sections: SideNavSection[] = [
  {
    title: 'Main',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'grid-1x2', active: true },
      { key: 'projects', label: 'Projects', icon: 'folder2', badge: '3' },
      { key: 'settings', label: 'Settings', icon: 'gear' },
    ],
  },
]

<SideNav sections={sections} />`}
				/>
			</Card>
		</DashboardLayout>
	)
}

export default SideNavDemo
