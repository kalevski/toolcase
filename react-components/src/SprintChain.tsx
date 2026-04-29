import React from 'react'

export type SprintChainState = 'past' | 'now' | 'future'

export interface SprintChainItem {
	id: string
	label: React.ReactNode
	tag?: React.ReactNode
	state?: SprintChainState
}

export interface SprintChainProps extends React.HTMLAttributes<HTMLDivElement> {
	items: SprintChainItem[]
	currentId: string
	columns?: number
	header?: React.ReactNode
	headerEnd?: React.ReactNode
}

function deriveState(items: SprintChainItem[], currentId: string, idx: number): SprintChainState {
	const currentIdx = items.findIndex((it) => it.id === currentId)
	if (currentIdx < 0) return 'future'
	if (idx < currentIdx) return 'past'
	if (idx === currentIdx) return 'now'
	return 'future'
}

export const SprintChain: React.FC<SprintChainProps> = ({
	items,
	currentId,
	columns,
	header,
	headerEnd,
	className = '',
	style,
	...rest
}) => {
	const cols = columns ?? items.length
	const trackStyle: React.CSSProperties = {
		gridTemplateColumns: `repeat(${cols}, 1fr)`,
		...style,
	}

	return (
		<div className={`component component-sprint-chain ${className}`.trim()} {...rest}>
			{(header || headerEnd) && (
				<div className="component-sprint-chain__header">
					<span className="component-sprint-chain__header-start">{header}</span>
					<span className="component-sprint-chain__header-end">{headerEnd}</span>
				</div>
			)}
			<div className="component-sprint-chain__track" style={trackStyle} role="list">
				{items.map((it, i) => {
					const state = it.state ?? deriveState(items, currentId, i)
					return (
						<div
							key={it.id}
							role="listitem"
							className={`component-sprint-chain__cell component-sprint-chain__cell--${state}`}
							aria-current={state === 'now' ? 'step' : undefined}
						>
							<div className="component-sprint-chain__num">{it.label}</div>
							{it.tag && <div className="component-sprint-chain__tag">{it.tag}</div>}
						</div>
					)
				})}
			</div>
		</div>
	)
}
