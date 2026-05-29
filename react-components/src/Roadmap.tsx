import React from 'react'

export type RoadmapStatus = 'shipped' | 'in-progress' | 'planned' | 'considering'

export interface RoadmapItem {
	title: string
	description?: React.ReactNode
	href?: string
	eta?: string
}

export interface RoadmapColumn {
	status: RoadmapStatus
	title?: string
	items: RoadmapItem[]
}

export interface RoadmapProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
	columns: RoadmapColumn[]
	layout?: 'kanban' | 'stacked'
	title?: React.ReactNode
}

const STATUS_LABELS: Record<RoadmapStatus, string> = {
	shipped: 'Shipped',
	'in-progress': 'In Progress',
	planned: 'Planned',
	considering: 'Considering',
}

export const Roadmap: React.FC<RoadmapProps> = ({
	columns,
	layout = 'kanban',
	title,
	className = '',
	...rest
}) => {
	const rootClass = `component component-roadmap component-roadmap--${layout} ${className}`.trim()

	return (
		<section className={rootClass} {...rest}>
			{title ? <h3 className="component-roadmap__title">{title}</h3> : null}
			<div className="component-roadmap__columns">
				{columns.map((col) => (
					<div
						key={col.status}
						className={`component-roadmap__column component-roadmap__column--${col.status}`}
					>
						<div className="component-roadmap__column-head">
							<span className="component-roadmap__status-dot" aria-hidden="true" />
							<span className="component-roadmap__column-title">
								{col.title ?? STATUS_LABELS[col.status]}
							</span>
							<span className="component-roadmap__column-count">{col.items.length}</span>
						</div>
						{col.items.length === 0 ? (
							<p className="component-roadmap__empty">Nothing here yet.</p>
						) : (
							<ul className="component-roadmap__items">
								{col.items.map((item, i) => {
									const inner = (
										<>
											<div className="component-roadmap__item-head">
												<span className="component-roadmap__item-title">{item.title}</span>
												{item.eta ? (
													<span className="component-roadmap__item-eta">{item.eta}</span>
												) : null}
											</div>
											{item.description ? (
												<p className="component-roadmap__item-description">{item.description}</p>
											) : null}
										</>
									)
									return (
										<li key={i} className="component-roadmap__item">
											{item.href ? (
												<a href={item.href} target="_blank" rel="noopener noreferrer">{inner}</a>
											) : (
												inner
											)}
										</li>
									)
								})}
							</ul>
						)}
					</div>
				))}
			</div>
		</section>
	)
}

export default Roadmap
