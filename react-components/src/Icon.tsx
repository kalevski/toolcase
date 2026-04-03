import React from 'react'

export interface IconProps extends React.HTMLAttributes<HTMLElement> {
	name: string
	as?: React.ElementType
	size?: number | string
	color?: string
	label?: string
	decorative?: boolean
}

export const Icon: React.FC<IconProps> = ({
	name,
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

	const resolvedClassName = ['bi', `bi-${name}`, className].filter(Boolean).join(' ').trim()

	const mergedStyle: React.CSSProperties = {
		...(style || {}),
		...(size !== undefined ? { fontSize: typeof size === 'number' ? `${size}px` : size } : {}),
		...(color ? { color } : {}),
	}

	return (
		<Component
			{...(restProps as React.HTMLAttributes<HTMLElement>)}
			className={resolvedClassName}
			style={mergedStyle}
			title={title || label}
			aria-hidden={isDecorative ? true : ariaHidden}
			aria-label={isDecorative ? undefined : (ariaLabel ?? label)}
			role={isDecorative ? undefined : (role ?? 'img')}
		/>
	)
}

export default Icon
