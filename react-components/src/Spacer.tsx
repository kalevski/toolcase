import React from 'react'

export interface SpacerProps extends React.HTMLAttributes<HTMLDivElement> {
	size?: string | number
	axis?: 'horizontal' | 'vertical'
}

export const Spacer: React.FC<SpacerProps> = ({
	size,
	axis = 'vertical',
	className = '',
	style,
	...props
}) => {
	const isFlex = size === undefined
	const spacerStyle: React.CSSProperties = isFlex
		? { flex: '1 1 auto', ...style }
		: axis === 'vertical'
			? { height: size, width: '100%', flexShrink: 0, ...style }
			: { width: size, height: '100%', flexShrink: 0, ...style }

	const rootClass = ['component component-spacer', className].filter(Boolean).join(' ')

	return <div {...props} className={rootClass} style={spacerStyle} />
}
