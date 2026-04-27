import React from 'react'
import { Icon } from './Icon'

export interface PluginItem {
	name: string
	logo?: React.ReactNode | string
	description: React.ReactNode
	installCommand?: string
	href: string
	official?: boolean
	downloads?: number
}

export interface PluginGridProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
	items: PluginItem[]
	columns?: 2 | 3 | 4
	title?: React.ReactNode
}

const formatNumber = (n: number): string => {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
	return String(n)
}

export const PluginGrid: React.FC<PluginGridProps> = ({
	items,
	columns = 3,
	title,
	className = '',
	...rest
}) => {
	const rootClass = `component component-plugin-grid component-plugin-grid--cols-${columns} ${className}`.trim()

	return (
		<section className={rootClass} {...rest}>
			{title ? <h3 className="component-plugin-grid__title">{title}</h3> : null}
			<div className="component-plugin-grid__grid">
				{items.map((p, i) => (
					<a
						key={`${p.name}-${i}`}
						href={p.href}
						target="_blank"
						rel="noopener noreferrer"
						className="component-plugin-grid__card"
					>
						<header className="component-plugin-grid__head">
							{p.logo ? (
								<span className="component-plugin-grid__logo">
									{typeof p.logo === 'string' ? <img src={p.logo} alt="" loading="lazy" /> : p.logo}
								</span>
							) : null}
							<div className="component-plugin-grid__name-row">
								<span className="component-plugin-grid__name">{p.name}</span>
								{p.official ? (
									<span className="component-plugin-grid__official">
										<Icon name="patch-check-fill" aria-hidden={true} /> official
									</span>
								) : null}
							</div>
						</header>
						<p className="component-plugin-grid__description">{p.description}</p>
						<footer className="component-plugin-grid__footer">
							{p.installCommand ? (
								<code className="component-plugin-grid__install">{p.installCommand}</code>
							) : null}
							{p.downloads !== undefined ? (
								<span className="component-plugin-grid__downloads">
									<Icon name="download" aria-hidden={true} /> {formatNumber(p.downloads)}
								</span>
							) : null}
						</footer>
					</a>
				))}
			</div>
		</section>
	)
}

export default PluginGrid
