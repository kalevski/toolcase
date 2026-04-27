import React from 'react'

export interface BadgeRowItem {
	label: string
	value: string
	color?: string
	href?: string
}

export interface BadgeRowProps extends React.HTMLAttributes<HTMLDivElement> {
	badges: BadgeRowItem[]
	size?: 'sm' | 'md'
}

export const BadgeRow: React.FC<BadgeRowProps> = ({
	badges,
	size = 'md',
	className = '',
	...rest
}) => {
	const rootClass = `component component-badge-row component-badge-row--${size} ${className}`.trim()

	return (
		<div className={rootClass} role="list" {...rest}>
			{badges.map((badge, index) => {
				const Tag = badge.href ? 'a' : 'span'
				const props = badge.href
					? { href: badge.href, target: '_blank', rel: 'noopener noreferrer' }
					: {}
				const style = badge.color ? { '--bdr-accent': badge.color } as React.CSSProperties : undefined
				return (
					<Tag
						key={`${badge.label}-${index}`}
						className="component-badge-row__item"
						role="listitem"
						style={style}
						{...props}
					>
						<span className="component-badge-row__label">{badge.label}</span>
						<span className="component-badge-row__value">{badge.value}</span>
					</Tag>
				)
			})}
		</div>
	)
}

export default BadgeRow
