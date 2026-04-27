import React from 'react'
import { Icon } from './Icon'

export interface ApiItem {
	name: string
	signature: string
	returns?: string
	description?: React.ReactNode
	since?: string
	deprecated?: boolean
	href?: string
}

export interface ApiReferenceGroup {
	title: string
	items: ApiItem[]
}

export interface ApiReferenceTableProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
	groups?: ApiReferenceGroup[]
	items?: ApiItem[]
	title?: React.ReactNode
}

const Row: React.FC<{ item: ApiItem }> = ({ item }) => (
	<div
		className={`component-api-reference-table__row ${item.deprecated ? 'component-api-reference-table__row--deprecated' : ''}`}
	>
		<div className="component-api-reference-table__name-col">
			<code className="component-api-reference-table__name">
				{item.href ? <a href={item.href}>{item.name}</a> : item.name}
			</code>
			<div className="component-api-reference-table__meta">
				{item.since ? (
					<span className="component-api-reference-table__since">since {item.since}</span>
				) : null}
				{item.deprecated ? (
					<span className="component-api-reference-table__deprecated">
						<Icon name="exclamation-triangle-fill" aria-hidden={true} /> deprecated
					</span>
				) : null}
			</div>
		</div>
		<div className="component-api-reference-table__sig-col">
			<code className="component-api-reference-table__signature">{item.signature}</code>
			{item.returns ? (
				<span className="component-api-reference-table__returns">
					<span className="component-api-reference-table__returns-label">returns</span>
					<code>{item.returns}</code>
				</span>
			) : null}
		</div>
		{item.description ? (
			<div className="component-api-reference-table__desc">{item.description}</div>
		) : null}
	</div>
)

export const ApiReferenceTable: React.FC<ApiReferenceTableProps> = ({
	groups,
	items,
	title,
	className = '',
	...rest
}) => {
	const rootClass = `component component-api-reference-table ${className}`.trim()

	return (
		<div className={rootClass} {...rest}>
			{title ? <h3 className="component-api-reference-table__title">{title}</h3> : null}
			{groups
				? groups.map((g) => (
						<div key={g.title} className="component-api-reference-table__group">
							<h4 className="component-api-reference-table__group-title">{g.title}</h4>
							<div className="component-api-reference-table__rows">
								{g.items.map((item) => (
									<Row key={item.name} item={item} />
								))}
							</div>
						</div>
					))
				: null}
			{items ? (
				<div className="component-api-reference-table__rows">
					{items.map((item) => (
						<Row key={item.name} item={item} />
					))}
				</div>
			) : null}
		</div>
	)
}

export default ApiReferenceTable
