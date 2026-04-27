import React from 'react'
import { DiffViewer } from './DiffViewer'

export interface MigrationStep {
	title: string
	description?: React.ReactNode
	before: string
	after: string
	language?: string
}

export interface MigrationGuideProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
	from: string
	to: string
	steps: MigrationStep[]
	title?: React.ReactNode
}

export const MigrationGuide: React.FC<MigrationGuideProps> = ({
	from,
	to,
	steps,
	title,
	className = '',
	...rest
}) => {
	const rootClass = `component component-migration-guide ${className}`.trim()

	return (
		<section className={rootClass} {...rest}>
			<header className="component-migration-guide__header">
				{title ? <h3 className="component-migration-guide__title">{title}</h3> : null}
				<div className="component-migration-guide__versions">
					<span className="component-migration-guide__from">{from}</span>
					<span className="component-migration-guide__arrow" aria-hidden="true">→</span>
					<span className="component-migration-guide__to">{to}</span>
				</div>
			</header>
			<ol className="component-migration-guide__steps">
				{steps.map((step, i) => (
					<li key={i} className="component-migration-guide__step">
						<div className="component-migration-guide__step-head">
							<span className="component-migration-guide__step-index" aria-hidden="true">
								{i + 1}
							</span>
							<h4 className="component-migration-guide__step-title">{step.title}</h4>
						</div>
						{step.description ? (
							<div className="component-migration-guide__step-description">
								{step.description}
							</div>
						) : null}
						<DiffViewer before={step.before} after={step.after} language={step.language} />
					</li>
				))}
			</ol>
		</section>
	)
}

export default MigrationGuide
