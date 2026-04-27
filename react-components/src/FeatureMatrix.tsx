import React from 'react'
import { Icon } from './Icon'

export type MatrixValue = boolean | 'partial' | string | React.ReactNode

export interface MatrixColumn {
	name: string
	highlight?: boolean
	accent?: string
	tagline?: string
}

export interface MatrixRow {
	feature: string
	description?: string
	values: MatrixValue[]
}

export interface FeatureMatrixProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
	columns: MatrixColumn[]
	rows: MatrixRow[]
	title?: React.ReactNode
}

const renderValue = (v: MatrixValue): React.ReactNode => {
	if (v === true) return <Icon name="check-circle-fill" className="component-feature-matrix__yes" aria-label="Yes" />
	if (v === false) return <Icon name="dash-circle" className="component-feature-matrix__no" aria-label="No" />
	if (v === 'partial')
		return <Icon name="circle-half" className="component-feature-matrix__partial" aria-label="Partial" />
	return v as React.ReactNode
}

export const FeatureMatrix: React.FC<FeatureMatrixProps> = ({
	columns,
	rows,
	title,
	className = '',
	...rest
}) => {
	const rootClass = `component component-feature-matrix ${className}`.trim()

	return (
		<div className={rootClass} {...rest}>
			{title ? <h3 className="component-feature-matrix__title">{title}</h3> : null}
			<div className="component-feature-matrix__scroll">
				<table className="component-feature-matrix__table">
					<thead>
						<tr>
							<th className="component-feature-matrix__feature-head" scope="col">
								Feature
							</th>
							{columns.map((col) => {
								const style = col.accent
									? ({ '--fmx-accent': col.accent } as React.CSSProperties)
									: undefined
								return (
									<th
										key={col.name}
										scope="col"
										className={`component-feature-matrix__col-head ${col.highlight ? 'component-feature-matrix__col-head--highlight' : ''}`}
										style={style}
									>
										<span className="component-feature-matrix__col-name">{col.name}</span>
										{col.tagline ? (
											<span className="component-feature-matrix__col-tagline">{col.tagline}</span>
										) : null}
									</th>
								)
							})}
						</tr>
					</thead>
					<tbody>
						{rows.map((row, ri) => (
							<tr key={ri}>
								<th scope="row" className="component-feature-matrix__feature">
									<span className="component-feature-matrix__feature-name">{row.feature}</span>
									{row.description ? (
										<span className="component-feature-matrix__feature-desc">{row.description}</span>
									) : null}
								</th>
								{columns.map((col, ci) => (
									<td
										key={ci}
										className={`component-feature-matrix__cell ${col.highlight ? 'component-feature-matrix__cell--highlight' : ''}`}
									>
										{renderValue(row.values[ci])}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	)
}

export default FeatureMatrix
