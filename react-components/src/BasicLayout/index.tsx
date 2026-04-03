import React from 'react'

export interface BasicLayoutProps {
	children?: React.ReactNode
	brand?: React.ReactNode
}

export const BasicLayout: React.FC<BasicLayoutProps> = ({ children, brand }) => {
	return (
		<div className="layout layout--basic">
			{brand && (
				<div className="layout--basic__brand">
					<div className="container">
						{brand}
					</div>
				</div>
			)}
			<div className="layout--basic__content">
				<div className="container">
					{children}
				</div>
			</div>
		</div>
	)
}
