import React from 'react'
import { tcIcons, type TcIconName } from './tc-icons'

export type IconSet = 'bi' | 'tc'

export interface IconProps extends React.HTMLAttributes<HTMLElement> {
	name: string
	set?: IconSet
	as?: React.ElementType
	size?: number | string
	color?: string
	label?: string
	decorative?: boolean
}

export const Icon: React.FC<IconProps> = ({
	name,
	set = 'bi',
	as: Component = 'i',
	size,
	color,
	label,
	decorative,
	className,
	style,
	title,
	role,
	...rest
}) => {
	const restProps = { ...rest } as Record<string, unknown>
	const ariaHidden = restProps['aria-hidden'] as boolean | undefined
	const ariaLabel = restProps['aria-label'] as string | undefined
	delete restProps['aria-hidden']
	delete restProps['aria-label']

	const isDecorative = decorative ?? (!label && !ariaLabel)

	const mergedStyle: React.CSSProperties = {
		...(style || {}),
		...(size !== undefined ? { fontSize: typeof size === 'number' ? `${size}px` : size } : {}),
		...(color ? { color } : {}),
	}

	if (set === 'tc') {
		const markup = tcIcons[name as TcIconName] ?? ''
		const tcClassName = ['component-icon', 'component-icon--tc', className].filter(Boolean).join(' ').trim()
		const svgStyle: React.CSSProperties = {
			...mergedStyle,
			width: '1em',
			height: '1em',
			verticalAlign: '-0.125em',
			fill: 'none',
		}
		const titleText = title || label
		const inner = titleText ? `<title>${titleText}</title>${markup}` : markup
		return (
			<svg
				{...(restProps as React.SVGAttributes<SVGSVGElement>)}
				viewBox="0 0 24 24"
				className={tcClassName}
				style={svgStyle}
				aria-hidden={isDecorative ? true : ariaHidden}
				aria-label={isDecorative ? undefined : (ariaLabel ?? label)}
				role={isDecorative ? undefined : (role ?? 'img')}
				focusable="false"
				dangerouslySetInnerHTML={{ __html: inner }}
			/>
		)
	}

	const biClassName = ['bi', `bi-${name}`, className].filter(Boolean).join(' ').trim()

	return (
		<Component
			{...(restProps as React.HTMLAttributes<HTMLElement>)}
			className={biClassName}
			style={mergedStyle}
			title={title || label}
			aria-hidden={isDecorative ? true : ariaHidden}
			aria-label={isDecorative ? undefined : (ariaLabel ?? label)}
			role={isDecorative ? undefined : (role ?? 'img')}
		/>
	)
}

export default Icon
