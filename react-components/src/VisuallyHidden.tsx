import React from 'react'

export interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLSpanElement> {
	children: React.ReactNode
	as?: 'span' | 'div'
}

export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({
	children,
	as: Tag = 'span',
	...props
}) => {
	return (
		<Tag {...props} className="component component-visually-hidden">
			{children}
		</Tag>
	)
}
