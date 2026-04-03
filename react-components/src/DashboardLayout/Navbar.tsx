import React, { useEffect, useRef } from 'react'

export interface NavbarProps {
	isSidebarOpen?: boolean
	minLeftWidth?: number
	toggleSidebar?: () => void
	leftComponent?: React.ReactNode
	rightComponent?: React.ReactNode
}

export const Navbar: React.FC<NavbarProps> = ({
	isSidebarOpen,
	minLeftWidth = 200,
	toggleSidebar,
	leftComponent,
	rightComponent,
}) => {
	const middle = useRef(null)
	useEffect(() => {
		const middleEl = middle.current as unknown as HTMLDivElement
		middleEl.classList.remove('navbar--section__hidden')
		if (middleEl.clientWidth < minLeftWidth) {
			middleEl.classList.add('navbar--section__hidden')
		}
	}, [middle, isSidebarOpen])

	return (
		<nav className="layout--dashboard__navbar">
			<div className="navbar--section navbar--section__start">
				<div className="navbar--toggle" onClick={toggleSidebar}>
					☰
				</div>
			</div>
			<div ref={middle} className="navbar--section">
				{leftComponent}
			</div>
			<div className="navbar--section">{rightComponent}</div>
		</nav>
	)
}
