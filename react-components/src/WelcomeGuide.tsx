import React from 'react'
import { Icon } from './Icon'
import { ProgressBar } from './ProgressBar'

export interface WelcomeGuideStep {
	key: string
	label: string
	completed: boolean
}

export interface WelcomeGuideProps {
	title: string
	messages: string[]
	steps: WelcomeGuideStep[]
	onStepClick?: (e: React.MouseEvent<HTMLLIElement>, stepKey: string) => void
	backgroundPatternSrc?: string
	backgroundPatternAlt?: string
	backgroundPattern?: React.ReactNode
	className?: string
}

export const WelcomeGuide: React.FC<WelcomeGuideProps> = ({
	title,
	messages,
	steps,
	onStepClick,
	backgroundPatternSrc,
	backgroundPatternAlt,
	backgroundPattern,
	className = '',
}) => {
	const completedCount = steps.filter((s) => s.completed).length
	const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0

	const patternAlt = backgroundPatternAlt ?? ''
	const shouldHidePattern = !backgroundPattern && (!patternAlt || patternAlt.length === 0)

	const patternElement =
		backgroundPattern ??
		(backgroundPatternSrc ? (
			<img
				src={backgroundPatternSrc}
				alt={patternAlt}
				className="component-welcome-guide__background-pattern"
				loading="lazy"
				aria-hidden={shouldHidePattern ? true : undefined}
			/>
		) : null)

	return (
		<div className={`component component-welcome-guide${className ? ` ${className}` : ''}`}>
			<div className="component-welcome-guide__left">
				{patternElement && (
					<div className="component-welcome-guide__background" aria-hidden={shouldHidePattern ? true : undefined}>
						{patternElement}
					</div>
				)}
				<div className="component-welcome-guide__left-content">
					<h3 className="component-welcome-guide__title">{title}</h3>
					<ul className="component-welcome-guide__messages">
						{messages.map((msg, i) => (
							<li key={i} className="component-welcome-guide__message">{msg}</li>
						))}
					</ul>
				</div>
			</div>
			<div className="component-welcome-guide__right">
				<ProgressBar value={progress} label={`${completedCount} of ${steps.length} complete`} variant="primary" />
				<ul className="component-welcome-guide__steps">
					{steps.map((step, i) => (
						<li onClick={(e) => onStepClick?.(e, step.key)} key={step.key} className={`component-welcome-guide__step${step.completed ? ' component-welcome-guide__step--completed' : ''}`}>
							<span className="component-welcome-guide__step-check">
							{step.completed && <Icon name="check-lg" />}
							</span>
							<span className="component-welcome-guide__step-label">{step.label}</span>
						</li>
					))}
				</ul>
			</div>
		</div>
	)
}

