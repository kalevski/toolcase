import React from 'react'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
	variant?: 'text' | 'circle' | 'rect'
	width?: string | number
	height?: string | number
	count?: number
}

export const Skeleton: React.FC<SkeletonProps> = ({
	variant = 'text',
	width,
	height,
	count = 1,
	className = '',
	...props
}) => {
	const rootClass = [
		'component component-skeleton',
		`component-skeleton--${variant}`,
		className,
	].filter(Boolean).join(' ')

	const style: React.CSSProperties = {
		width: width ?? (variant === 'circle' ? height ?? 40 : '100%'),
		height: height ?? (variant === 'text' ? '1em' : variant === 'circle' ? width ?? 40 : 80),
		...props.style,
	}

	if (count > 1) {
		return (
			<div className="component-skeleton__group">
				{Array.from({ length: count }, (_, i) => (
					<div key={i} {...props} className={rootClass} style={style} />
				))}
			</div>
		)
	}

	return <div {...props} className={rootClass} style={style} />
}
