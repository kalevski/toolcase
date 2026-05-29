import React from 'react'
import { ProgressBar } from './ProgressBar'
import { Skeleton } from './Skeleton'

export interface WelcomeGuideStep {
	key: string
	label: string
	completed: boolean
}

type WelcomeGuideStepState = 'completed' | 'active' | 'locked'

interface WelcomeGuideCheckProps {
	state: WelcomeGuideStepState
}

// Custom step indicator — square box with an animated SVG tick (completed),
// a hover ring (active/clickable) or a muted dash (locked). Replaces the
// Bootstrap form-check so the checklist can carry its own visual language.
const WelcomeGuideCheck: React.FC<WelcomeGuideCheckProps> = ({ state }) => (
	<span className={`component-welcome-guide__check component-welcome-guide__check--${state}`} aria-hidden="true">
		<svg className="component-welcome-guide__check-icon" viewBox="0 0 16 16" fill="none">
			{state === 'completed' ? (
				<path
					className="component-welcome-guide__check-tick"
					d="M3.5 8.5 L6.5 11.5 L12.5 4.5"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="square"
					strokeLinejoin="miter"
				/>
			) : (
				<line
					className="component-welcome-guide__check-dash"
					x1="4.5"
					y1="8"
					x2="11.5"
					y2="8"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="square"
				/>
			)}
		</svg>
	</span>
)

export interface WelcomeGuideProps {
	title: string
	messages: string[]
	steps: WelcomeGuideStep[]
	onStepClick?: (e: React.MouseEvent<HTMLLIElement>, stepKey: string) => void
	backgroundPatternSrc?: string
	backgroundPatternAlt?: string
	backgroundPattern?: React.ReactNode
	className?: string
	loading?: boolean
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
	loading = false,
}) => {
	const completedCount = steps.filter((s) => s.completed).length
	const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0
	const firstIncompleteIndex = steps.findIndex((s) => !s.completed)

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
				{loading ? (
					<>
						<Skeleton height="0.5rem" />
						<div className="component-welcome-guide__steps">
							<Skeleton count={4} />
						</div>
					</>
				) : (
					<>
						<ProgressBar value={progress} label={`${completedCount} of ${steps.length} complete`} variant="primary" />
						<ul className="component-welcome-guide__steps">
							{steps.map((step, i) => {
								// Sequential gating: only the first incomplete step is actionable;
								// completed steps and everything after it are disabled.
								const isActive = i === firstIncompleteIndex
								const state: WelcomeGuideStepState = step.completed
									? 'completed'
									: isActive
										? 'active'
										: 'locked'
								const stepClass = [
									'component-welcome-guide__step',
									step.completed ? 'component-welcome-guide__step--completed' : '',
									isActive ? 'component-welcome-guide__step--active' : '',
								].filter(Boolean).join(' ')
								return (
									<li
										key={step.key}
										className={stepClass}
										role="checkbox"
										aria-checked={step.completed}
										aria-disabled={!isActive}
										onClick={isActive ? (e) => onStepClick?.(e, step.key) : undefined}
									>
										<WelcomeGuideCheck state={state} />
										<span className="component-welcome-guide__step-label">{step.label}</span>
									</li>
								)
							})}
						</ul>
					</>
				)}
			</div>
		</div>
	)
}

