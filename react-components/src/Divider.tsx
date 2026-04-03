import React from 'react'

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
	vertical?: boolean
	label?: string
}

export const Divider: React.FC<DividerProps> = ({
	vertical = false,
	label,
	...props
}) => {
	const className = [
		'component component-divider',
		vertical ? 'component-divider--vertical' : 'component-divider--horizontal',
		props.className || '',
	].filter(Boolean).join(' ')

	return (
		<div {...props} className={className} role="separator">
			{label && <span className="component-divider__label">{label}</span>}
		</div>
	)
}
