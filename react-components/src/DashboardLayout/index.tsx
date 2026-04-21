import React from 'react'
import { Navbar } from './Navbar'
import { Sidebar } from './Sidebar'
import { Content } from './Content'

export interface DashboardLayoutProps {
	children: React.ReactNode
	navbarLeftComponent?: React.ReactNode
	navbarRightComponent?: React.ReactNode
	brandComponent?: React.ReactNode
	sidebarMenuComponent?: React.ReactNode
	sidebarPanelComponent?: React.ReactNode
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
	children,
	brandComponent,
	navbarLeftComponent,
	navbarRightComponent,
	sidebarMenuComponent,
	sidebarPanelComponent,
}) => {
	const [sidebarOpen, setSidebarOpen] = React.useState(false)

	React.useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && sidebarOpen) setSidebarOpen(false)
		}
		document.addEventListener('keydown', handler)
		return () => document.removeEventListener('keydown', handler)
	}, [sidebarOpen])

	const toggleSidebar = () => {
		setSidebarOpen(!sidebarOpen)
	}

	return (
		<div className="layout layout--dashboard layout--dashboard__light">
			<div className={`layout--dashboard__wrapper ${sidebarOpen ? 'sidebar__open' : ''}`}>
				<Navbar
					isSidebarOpen={sidebarOpen}
					toggleSidebar={toggleSidebar}
					leftComponent={navbarLeftComponent}
					rightComponent={navbarRightComponent}
				/>
				<div className="layout--dashboard__overlay" onClick={toggleSidebar}></div>
				<Sidebar
					brandComponent={brandComponent}
					menuComponent={sidebarMenuComponent}
					panelComponent={sidebarPanelComponent}
				/>
				<Content>{children}</Content>
			</div>
		</div>
	)
}
