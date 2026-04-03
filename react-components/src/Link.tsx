import React from 'react'

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
	children?: React.ReactNode
	variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
	underline?: 'always' | 'hover' | 'none'
	external?: boolean
}

export const Link: React.FC<LinkProps> = ({
	children,
	variant = 'primary',
	underline = 'hover',
	external = false,
	className = '',
	...props
}) => {
	const rootClass = [
		'component component-link',
		`component-link--${variant}`,
		`component-link--underline-${underline}`,
		className,
	].filter(Boolean).join(' ')

	const externalProps = external ? { target: '_blank', rel: 'noopener noreferrer' } : {}

	return (
		<a {...props} {...externalProps} className={rootClass}>
			{children}
			{external && <i className="bi bi-box-arrow-up-right component-link__external-icon" />}
		</a>
	)
}
