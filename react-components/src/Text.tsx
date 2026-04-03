import React from 'react'

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
	children?: React.ReactNode
	variant?: 'default' | 'muted' | 'code' | 'mono' | 'truncate'
	size?: 'small' | 'default' | 'large'
	as?: 'p' | 'span' | 'small' | 'div'
}

export const Text: React.FC<TextProps> = ({
	children,
	variant = 'default',
	size = 'default',
	as: Tag = 'span',
	className = '',
	...props
}) => {
	const rootClass = [
		'component component-text',
		`component-text--${variant}`,
		`component-text--${size}`,
		className,
	].filter(Boolean).join(' ')

	return (
		<Tag {...props} className={rootClass}>
			{children}
		</Tag>
	)
}
