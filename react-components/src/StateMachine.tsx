import React from 'react'

export type StateMachineStatus = 'done' | 'active' | 'reserved' | 'future'

export interface StateMachineItem {
	id: string
	label: React.ReactNode
	note?: React.ReactNode
	status?: StateMachineStatus
}

export interface StateMachineProps extends React.HTMLAttributes<HTMLDivElement> {
	states: StateMachineItem[]
	compact?: boolean
}

export const StateMachine: React.FC<StateMachineProps> = ({
	states,
	compact = false,
	className = '',
	...rest
}) => {
	const rootClass = [
		'component component-state-machine',
		compact ? 'component-state-machine--compact' : '',
		className,
	].filter(Boolean).join(' ')

	return (
		<div className={rootClass} role="list" {...rest}>
			{states.map((s, i) => {
				const status = s.status ?? 'future'
				return (
					<div
						key={s.id}
						role="listitem"
						className={`component-state-machine__cell component-state-machine__cell--${status}`}
						aria-current={status === 'active' ? 'step' : undefined}
					>
						<div className="component-state-machine__rank">— {String(i + 1).padStart(2, '0')}{status === 'active' ? ' NOW' : ''}</div>
						<div className="component-state-machine__name">{s.label}</div>
						{s.note && <div className="component-state-machine__note">{s.note}</div>}
					</div>
				)
			})}
		</div>
	)
}
