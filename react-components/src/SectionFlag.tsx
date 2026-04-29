import React from 'react'

export interface SectionFlagProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
	title: React.ReactNode
	subtitle?: React.ReactNode
	align?: 'left' | 'center'
}

export const SectionFlag: React.FC<SectionFlagProps> = ({
	title,
	subtitle,
	align = 'center',
	className = '',
	...rest
}) => {
	const cls = [
		'component component-section-flag',
		`component-section-flag--${align}`,
		className,
	].filter(Boolean).join(' ')

	return (
		<div className={cls} {...rest}>
			<div className="component-section-flag__title">{title}</div>
			{subtitle && <div className="component-section-flag__sub">{subtitle}</div>}
		</div>
	)
}
