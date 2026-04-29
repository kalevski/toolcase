import React from 'react'

export type PhaseStatus = 'done' | 'lit' | 'upcoming' | 'continuous'

export interface PhaseItem {
	num: React.ReactNode
	title: React.ReactNode
	body: React.ReactNode
	tag?: React.ReactNode
	command?: React.ReactNode
	status?: PhaseStatus
}

export interface PhaseGridProps extends React.HTMLAttributes<HTMLDivElement> {
	phases: PhaseItem[]
	columns?: number
}

export const PhaseGrid: React.FC<PhaseGridProps> = ({
	phases,
	columns = 4,
	className = '',
	style,
	...rest
}) => {
	const rootClass = `component component-phase-grid ${className}`.trim()
	const gridStyle: React.CSSProperties = {
		gridTemplateColumns: `repeat(${columns}, 1fr)`,
		...style,
	}

	return (
		<div className={rootClass} style={gridStyle} role="list" {...rest}>
			{phases.map((p, i) => {
				const status = p.status ?? 'upcoming'
				return (
					<div
						key={i}
						role="listitem"
						className={`component-phase-grid__cell component-phase-grid__cell--${status}`}
						aria-current={status === 'lit' ? 'step' : undefined}
					>
						<div className="component-phase-grid__num">{p.num}</div>
						<div className="component-phase-grid__title">{p.title}</div>
						<div className="component-phase-grid__body">{p.body}</div>
						{p.tag && <span className="component-phase-grid__tag">{p.tag}</span>}
						{p.command && <div className="component-phase-grid__cmd">{p.command}</div>}
					</div>
				)
			})}
		</div>
	)
}
