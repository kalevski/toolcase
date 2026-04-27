import React from 'react'
import { Icon } from './Icon'

export type CompatStatus = 'supported' | 'deprecated' | 'unsupported' | 'planned'

export interface CompatibilityMatrixProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
	versions: string[]
	platforms: string[]
	support: Record<string, Record<string, CompatStatus>>
	title?: React.ReactNode
}

const ICONS: Record<CompatStatus, string> = {
	supported: 'check-circle-fill',
	deprecated: 'exclamation-circle-fill',
	unsupported: 'x-circle-fill',
	planned: 'clock-fill',
}

const LABELS: Record<CompatStatus, string> = {
	supported: 'Supported',
	deprecated: 'Deprecated',
	unsupported: 'Unsupported',
	planned: 'Planned',
}

export const CompatibilityMatrix: React.FC<CompatibilityMatrixProps> = ({
	versions,
	platforms,
	support,
	title,
	className = '',
	...rest
}) => {
	const rootClass = `component component-compatibility-matrix ${className}`.trim()

	return (
		<div className={rootClass} {...rest}>
			{title ? <h3 className="component-compatibility-matrix__title">{title}</h3> : null}
			<div className="component-compatibility-matrix__scroll">
				<table className="component-compatibility-matrix__table">
					<thead>
						<tr>
							<th scope="col" className="component-compatibility-matrix__corner">Version</th>
							{platforms.map((p) => (
								<th key={p} scope="col" className="component-compatibility-matrix__head">
									{p}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{versions.map((v) => (
							<tr key={v}>
								<th scope="row" className="component-compatibility-matrix__version">
									{v}
								</th>
								{platforms.map((p) => {
									const status = support[v]?.[p] ?? 'unsupported'
									return (
										<td
											key={p}
											className={`component-compatibility-matrix__cell component-compatibility-matrix__cell--${status}`}
										>
											<Icon name={ICONS[status]} aria-label={LABELS[status]} />
										</td>
									)
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<ul className="component-compatibility-matrix__legend">
				{(Object.keys(LABELS) as CompatStatus[]).map((s) => (
					<li key={s} className={`component-compatibility-matrix__legend-item component-compatibility-matrix__legend-item--${s}`}>
						<Icon name={ICONS[s]} aria-hidden={true} />
						<span>{LABELS[s]}</span>
					</li>
				))}
			</ul>
		</div>
	)
}

export default CompatibilityMatrix
