import React from 'react'

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
	children?: React.ReactNode
	as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
	gradient?: boolean
}

export const Heading: React.FC<HeadingProps> = ({
	children,
	as: Tag = 'h2',
	gradient = false,
	className = '',
	...props
}) => {
	const rootClass = [
		'component component-heading',
		`component-heading--${Tag}`,
		gradient ? 'component-heading--gradient' : '',
		className,
	].filter(Boolean).join(' ')

	return (
		<Tag {...props} className={rootClass}>
			{children}
		</Tag>
	)
}
