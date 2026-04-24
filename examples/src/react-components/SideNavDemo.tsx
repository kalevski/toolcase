import { useState } from 'react'
import { SideNav, SideNavSection } from '@toolcase/react-components'
import { DashboardLayout } from '@toolcase/react-components'
import { Brand } from '@toolcase/react-components'
import { Badge } from '@toolcase/react-components'
import { Card } from '@toolcase/react-components'

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
		</DashboardLayout>
	)
}

export default SideNavDemo
