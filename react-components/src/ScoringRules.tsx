import React from 'react'

export interface ScoringRule {
	icon?: React.ReactNode
	title: React.ReactNode
	description: React.ReactNode
	points: React.ReactNode
	suffix?: React.ReactNode
	accent?: 'pink' | 'yellow' | 'cyan' | 'green' | 'red'
}

export interface ScoringRulesProps extends React.HTMLAttributes<HTMLDivElement> {
	rules: ScoringRule[]
}

export const ScoringRules: React.FC<ScoringRulesProps> = ({
	rules,
	className = '',
	...rest
}) => {
	return (
		<div className={`component component-scoring-rules ${className}`.trim()} {...rest}>
			{rules.map((r, i) => (
				<div
					key={i}
					className={[
						'component-scoring-rules__row',
						r.accent ? `component-scoring-rules__row--${r.accent}` : '',
					].filter(Boolean).join(' ')}
				>
					<div className="component-scoring-rules__icon" aria-hidden={true}>{r.icon}</div>
					<div className="component-scoring-rules__body">
						<div className="component-scoring-rules__title">{r.title}</div>
						<div className="component-scoring-rules__desc">{r.description}</div>
					</div>
					<div className="component-scoring-rules__pts">
						{r.points}
						{r.suffix && <em className="component-scoring-rules__suffix">{r.suffix}</em>}
					</div>
				</div>
			))}
		</div>
	)
}
