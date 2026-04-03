import React from 'react'

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
	children?: React.ReactNode
	keys?: string[]
}

export const Kbd: React.FC<KbdProps> = ({
	children,
	keys,
	className = '',
	...props
}) => {
	const rootClass = ['component component-kbd', className].filter(Boolean).join(' ')

	if (keys && keys.length > 0) {
		return (
			<span className={rootClass}>
				{keys.map((key, i) => (
					<React.Fragment key={i}>
						{i > 0 && <span className="component-kbd__separator">+</span>}
						<kbd {...props} className="component-kbd__key">{key}</kbd>
					</React.Fragment>
				))}
			</span>
		)
	}

	return <kbd {...props} className={rootClass}>{children}</kbd>
}
