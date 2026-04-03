import { useState } from 'react'
import { Brand, DashboardLayout, SideNav, SideNavSection, UsageSummaryPanel, Dropdown, DropdownItem, UserPanel } from '../../src'

const projects: DropdownItem[] = [
	{ key: 'proj-1', name: 'My RPG Game', description: 'Fantasy RPG multiplayer project', icon: 'controller' },
	{ key: 'proj-2', name: 'Space Shooter', description: 'Arcade space shooter prototype', icon: 'rocket-takeoff' },
	{ key: 'proj-3', name: 'Puzzle World', description: 'Casual puzzle game for mobile', icon: 'puzzle' },
]

const sections: SideNavSection[] = [
	{
		title: 'Project',
		items: [
			{ key: 'dashboard', label: 'Dashboard', icon: 'grid-1x2' },
			{ key: 'members', label: 'Members', icon: 'people', badge: '5' },
			{ key: 'settings', label: 'Settings', icon: 'gear' },
		],
	},
	{
		title: 'Assets',
		items: [
			{ key: 'files', label: 'Files', icon: 'file-earmark' },
			{ key: 'bundles', label: 'Bundles', icon: 'box-seam' },
			{ key: 'builds', label: 'Builds', icon: 'hammer' },
			{ key: 'configs', label: 'Configs', icon: 'sliders' },
		],
	},
	{
		title: 'Tools',
		items: [
			{ key: 'i18n', label: 'Localization', icon: 'translate' },
		],
	},
]

const UsageSummaryPanelEl = () => (
	<UsageSummaryPanel
		title="Account Usage"
		usage={[
			{ label: 'Storage', used: 75, total: 100, measurementUnit: 'GB' },
		]}
	/>
)

export const FullAppDemo = () => {
	const [activeKey, setActiveKey] = useState('dashboard')
	const [selectedProject, setSelectedProject] = useState('proj-1')

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

	const sidebarMenu = <>
		<Dropdown
			items={projects}
			value={selectedProject}
			onChange={setSelectedProject}
			placeholder="Select a project"
		/>
		<SideNav sections={activeSections} />
	</>

	return (
		<DashboardLayout
			brandComponent={<Brand primaryText="WEBGAME" secondaryText=".CLOUD" label="demo" />}
			sidebarMenuComponent={sidebarMenu}
			sidebarPanelComponent={<UserPanel username='@kalevski' initials='DK' />}
		>
			PAGE HERE
		</DashboardLayout>
	)
}
