import React, { useId } from 'react'

export interface CycleWheelProps extends React.HTMLAttributes<HTMLDivElement> {
	phases: string[]
	currentIndex: number
	centerLabel?: React.ReactNode
	centerValue: React.ReactNode
	centerPill?: React.ReactNode
	centerSub?: React.ReactNode
	spinSeconds?: number
	paused?: boolean
}

export const CycleWheel: React.FC<CycleWheelProps> = ({
	phases,
	currentIndex,
	centerLabel,
	centerValue,
	centerPill,
	centerSub,
	spinSeconds = 60,
	paused = false,
	className = '',
	style,
	...rest
}) => {
	const baseId = useId()
	const rimId = `${baseId}-rim`

	const rootClass = [
		'component component-cycle-wheel',
		paused ? 'component-cycle-wheel--paused' : '',
		className,
	].filter(Boolean).join(' ')

	const ringText = phases.map((p) => `↻ ${p.toUpperCase()}`).join(' · ') + ' · '
	const repeated = ringText.repeat(3)

	const slotAngle = 360 / Math.max(phases.length, 1)
	const arrowRot = currentIndex * slotAngle

	const ringStyle: React.CSSProperties = {
		animationDuration: `${spinSeconds}s`,
		animationPlayState: paused ? 'paused' : 'running',
	}

	return (
		<div className={rootClass} style={style} {...rest}>
			<div className="component-cycle-wheel__inner">
				<svg className="component-cycle-wheel__ring" viewBox="0 0 400 400" style={ringStyle} aria-hidden={true}>
					<defs>
						<path
							id={rimId}
							d="M 200,200 m -188,0 a 188,188 0 1,1 376,0 a 188,188 0 1,1 -376,0"
						/>
					</defs>
					<circle cx="200" cy="200" r="196" fill="none" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="3 4" />
					<circle cx="200" cy="200" r="174" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="2 5" />
					<text>
						<textPath href={`#${rimId}`} startOffset="0">{repeated}</textPath>
					</text>
				</svg>

				<svg className="component-cycle-wheel__pointer" viewBox="0 0 400 400" aria-hidden={true}>
					<g transform="translate(200,200)">
						<g stroke="currentColor" strokeOpacity="0.4" strokeWidth="1">
							{phases.map((_, i) => (
								<line key={i} x1="0" y1="-180" x2="0" y2="-168" transform={`rotate(${i * slotAngle})`} />
							))}
						</g>
						<line
							x1="0" y1="-180" x2="0" y2="-105"
							stroke="currentColor" strokeWidth="3"
							transform={`rotate(${arrowRot})`}
						/>
						<circle
							r="7" cx="0" cy="-180"
							fill="currentColor"
							transform={`rotate(${arrowRot})`}
						/>
					</g>
				</svg>

				<div className="component-cycle-wheel__core">
					{centerLabel && <div className="component-cycle-wheel__core-label">{centerLabel}</div>}
					<div className="component-cycle-wheel__core-value">{centerValue}</div>
					{centerPill && <div className="component-cycle-wheel__core-pill">{centerPill}</div>}
					{centerSub && <div className="component-cycle-wheel__core-sub">{centerSub}</div>}
				</div>
			</div>
		</div>
	)
}
