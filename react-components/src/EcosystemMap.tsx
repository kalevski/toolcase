import React from 'react'

export interface EcosystemNode {
	name: string
	href?: string
	accent?: string
}

export interface EcosystemRing {
	label?: string
	items: EcosystemNode[]
}

export interface EcosystemMapProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
	core: { name: string; label?: string }
	rings: EcosystemRing[]
	size?: number
	title?: React.ReactNode
}

const Node: React.FC<{ node: EcosystemNode; style?: React.CSSProperties; isCore?: boolean }> = ({ node, style, isCore }) => {
	const accent = node.accent
		? ({ '--em-node-accent': node.accent } as React.CSSProperties)
		: undefined
	const merged: React.CSSProperties = { ...accent, ...style }
	const className = `component-ecosystem-map__node ${isCore ? 'component-ecosystem-map__node--core' : ''}`
	return node.href ? (
		<a className={className} href={node.href} style={merged} target="_blank" rel="noopener noreferrer">
			{node.name}
		</a>
	) : (
		<span className={className} style={merged}>{node.name}</span>
	)
}

export const EcosystemMap: React.FC<EcosystemMapProps> = ({
	core,
	rings,
	size = 480,
	title,
	className = '',
	...rest
}) => {
	const rootClass = `component component-ecosystem-map ${className}`.trim()

	return (
		<section className={rootClass} {...rest}>
			{title ? <h3 className="component-ecosystem-map__title">{title}</h3> : null}
			<div
				className="component-ecosystem-map__radial"
				style={{ '--em-size': `${size}px` } as React.CSSProperties}
				aria-hidden="false"
			>
				<div className="component-ecosystem-map__center">
					<Node node={{ name: core.name }} isCore />
					{core.label ? (
						<span className="component-ecosystem-map__center-label">{core.label}</span>
					) : null}
				</div>
				{rings.map((ring, ri) => {
					const radius = ((ri + 1) / rings.length) * 0.45 + 0.1
					return (
						<div
							key={ri}
							className="component-ecosystem-map__ring"
							style={{ '--em-radius': radius } as React.CSSProperties}
							aria-hidden="true"
						>
							{ring.items.map((node, ni) => {
								const angle = (ni / ring.items.length) * Math.PI * 2 - Math.PI / 2
								const x = 50 + radius * 100 * Math.cos(angle)
								const y = 50 + radius * 100 * Math.sin(angle)
								return (
									<Node
										key={`${node.name}-${ni}`}
										node={node}
										style={{ left: `${x}%`, top: `${y}%`, position: 'absolute', transform: 'translate(-50%, -50%)' }}
									/>
								)
							})}
						</div>
					)
				})}
			</div>
			<div className="component-ecosystem-map__list" aria-hidden="false">
				<div className="component-ecosystem-map__list-group">
					<span className="component-ecosystem-map__list-label">Core</span>
					<Node node={{ name: core.name }} isCore />
				</div>
				{rings.map((ring, ri) => (
					<div key={ri} className="component-ecosystem-map__list-group">
						<span className="component-ecosystem-map__list-label">{ring.label ?? `Ring ${ri + 1}`}</span>
						<div className="component-ecosystem-map__list-items">
							{ring.items.map((node, ni) => (
								<Node key={`${node.name}-${ni}`} node={node} />
							))}
						</div>
					</div>
				))}
			</div>
		</section>
	)
}

export default EcosystemMap
