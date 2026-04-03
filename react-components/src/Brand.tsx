import type { FC, HTMLAttributes, ReactNode } from 'react'
import { Badge } from './Badge'


export interface BrandProps extends HTMLAttributes<HTMLDivElement> {
	primaryText?: ReactNode
	secondaryText?: ReactNode
	label?: ReactNode
	color?: string // hex color for underline
	xlarge?: boolean // scale 300%
}


export const Brand: FC<BrandProps> = ({
	primaryText,
	secondaryText,
	label,
	color,
	xlarge,
	className,
	onClick = undefined,
	...rest
}) => {
	const clickable = typeof onClick === 'function'
	const classList = ['component component-brand', className]
	if (clickable) {
		classList.push('component-brand--clickable')
	}
	if (xlarge) {
		classList.push('component-brand--xlarge')
	}
	const rootClass = classList.filter(Boolean).join(' ')

	// Style for underline color
	const underlineStyle = color
		? { textDecoration: `underline`, textDecorationColor: color }
		: { textDecoration: 'underline' }

	return (
		<div className={rootClass} onClick={onClick} {...rest}>
			<span style={underlineStyle} className="component-brand__text-group">
				{primaryText && <span className="component-brand--primaryText">{primaryText}</span>}
				{secondaryText && <span className="component-brand--secondaryText">{secondaryText}</span>}
			</span>
			{label && (
				<div className="component-brand--label">
					<Badge>{label}</Badge>
				</div>
			)}
		</div>
	)
}
