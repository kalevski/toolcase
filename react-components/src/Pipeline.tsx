import type { FC, HTMLAttributes, ReactNode } from 'react'

export interface PipelineStep {
	num?: ReactNode
	title: ReactNode
	sub?: ReactNode
	icon?: ReactNode
	state?: 'default' | 'live' | 'complete'
}

export interface PipelineProps extends HTMLAttributes<HTMLDivElement> {
	steps: PipelineStep[]
}

export const Pipeline: FC<PipelineProps> = ({ steps, className, ...rest }) => {
	const rootClassName = ['component', 'component-pipeline', className].filter(Boolean).join(' ')
	return (
		<div
			className={rootClassName}
			style={{ ['--pipeline-count' as string]: steps.length }}
			{...rest}
		>
			{steps.map((step, index) => (
				<div
					key={index}
					className={[
						'component-pipeline__step',
						step.state === 'live' && 'component-pipeline__step--live',
						step.state === 'complete' && 'component-pipeline__step--complete',
					]
						.filter(Boolean)
						.join(' ')}
				>
					{step.num !== undefined && <div className="component-pipeline__num">{step.num}</div>}
					<div className="component-pipeline__title">
						{step.icon && (
							<span className="component-pipeline__icon" aria-hidden="true">
								{step.icon}
							</span>
						)}
						<span>{step.title}</span>
					</div>
					{step.sub && <div className="component-pipeline__sub">{step.sub}</div>}
				</div>
			))}
		</div>
	)
}

Pipeline.displayName = 'Pipeline'
