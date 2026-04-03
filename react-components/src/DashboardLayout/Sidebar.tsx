import React from 'react'

export interface SidebarProps {
	brandComponent?: React.ReactNode
	menuComponent?: React.ReactNode
	panelComponent?: React.ReactNode
}

export const Sidebar: React.FC<SidebarProps> = ({ brandComponent, menuComponent, panelComponent }) => {
	return (
		<div className="layout--dashboard__sidebar">
			<div className="sidebar--section sidebar--section__branding">{brandComponent}</div>

			<div className="sidebar--section sidebar--section__menu">{menuComponent}</div>

			<div className="sidebar--section sidebar--section__panel">{panelComponent}</div>
		</div>
	)
}
