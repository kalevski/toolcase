import React from 'react'
import { CodeSnippet, type CodeSnippetLanguage } from './CodeSnippet'

export interface QuickStartStep {
	title: string
	description?: React.ReactNode
	code?: string
	language?: CodeSnippetLanguage
	output?: React.ReactNode
}

export interface QuickStartProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
	steps: QuickStartStep[]
	title?: React.ReactNode
}

export const QuickStart: React.FC<QuickStartProps> = ({
	steps,
	title,
	className = '',
	...rest
}) => {
	const rootClass = `component component-quick-start ${className}`.trim()

	return (
		<section className={rootClass} {...rest}>
			{title ? <h3 className="component-quick-start__title">{title}</h3> : null}
			<ol className="component-quick-start__steps">
				{steps.map((step, index) => (
					<li key={index} className="component-quick-start__step">
						<span className="component-quick-start__index" aria-hidden="true">
							{index + 1}
						</span>
						<div className="component-quick-start__body">
							<h4 className="component-quick-start__step-title">{step.title}</h4>
							{step.description ? (
								<div className="component-quick-start__description">{step.description}</div>
							) : null}
							{step.code ? (
								<div className="component-quick-start__code">
									<CodeSnippet code={step.code} language={step.language ?? 'bash'} />
								</div>
							) : null}
							{step.output ? (
								<div className="component-quick-start__output">{step.output}</div>
							) : null}
						</div>
					</li>
				))}
			</ol>
		</section>
	)
}

export default QuickStart
