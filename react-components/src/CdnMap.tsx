import type { FC, HTMLAttributes } from 'react'

export interface CdnMapNode {
	top: string
	left: string
	variant?: 'primary' | 'accent'
	label?: string
}

export interface CdnMapProps extends HTMLAttributes<HTMLDivElement> {
	nodes: CdnMapNode[]
	height?: number | string
}

export const CdnMap: FC<CdnMapProps> = ({ nodes, height = 160, className, style, ...rest }) => {
	const rootClassName = ['component', 'component-cdn-map', className].filter(Boolean).join(' ')
	return (
		<div
			className={rootClassName}
			style={{ ...style, height: typeof height === 'number' ? `${height}px` : height }}
			{...rest}
		>
			<div className="component-cdn-map__grid" aria-hidden="true" />
			{nodes.map((node, index) => (
				<span
					key={index}
					className={[
						'component-cdn-map__node',
						node.variant === 'accent' && 'component-cdn-map__node--accent',
					]
						.filter(Boolean)
						.join(' ')}
					style={{ top: node.top, left: node.left }}
					aria-label={node.label}
				/>
			))}
		</div>
	)
}

CdnMap.displayName = 'CdnMap'
