import React, { useId } from 'react'
import { Icon } from './Icon'

// ── Types ──────────────────────────────────────────────────────────────────────

export type StepStatus = 'pending' | 'active' | 'completed' | 'error'

export interface StepItem {
	key: string
	title: string
	description?: string
	status?: StepStatus
	/** Prevents clicking this step (useful for future steps in a linear flow). */
	disabled?: boolean
}

export interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
	steps: StepItem[]
	/**
	 * The key of the currently active step. Used when `status` is not set
	 * per-step — the component will auto-derive statuses from this value.
	 */
	activeStep?: string
	/** Layout direction. Default: 'horizontal'. */
	orientation?: 'horizontal' | 'vertical'
	/** Make all completed + active steps clickable for non-linear flows. */
	clickable?: boolean
	onStepClick?: (key: string) => void
	className?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function deriveStatus(steps: StepItem[], activeStep: string | undefined, key: string): StepStatus {
	if (!activeStep) return 'pending'
	const activeIdx = steps.findIndex((s) => s.key === activeStep)
	const thisIdx   = steps.findIndex((s) => s.key === key)
	if (thisIdx < activeIdx)  return 'completed'
	if (thisIdx === activeIdx) return 'active'
	return 'pending'
}

// ── Component ──────────────────────────────────────────────────────────────────

export const Stepper: React.FC<StepperProps> = ({
	steps,
	activeStep,
	orientation = 'horizontal',
	clickable = false,
	onStepClick,
	className = '',
	...rest
}) => {
	const baseId = useId()

	const rootClass = [
		'component component-stepper',
		`component-stepper--${orientation}`,
		className,
	].filter(Boolean).join(' ')

	return (
		<div className={rootClass} role="list" {...rest}>
			{steps.map((step, idx) => {
				const status: StepStatus = step.status ?? deriveStatus(steps, activeStep, step.key)
				const isActive      = status === 'active'
				const isCompleted   = status === 'completed'
				const isError       = status === 'error'
				const isLast        = idx === steps.length - 1
				const isClickable   = clickable && !step.disabled && (isCompleted || isActive)
				const stepId        = `${baseId}-step-${step.key}`
				const descId        = step.description ? `${stepId}-desc` : undefined

				const itemClass = [
					'component-stepper__step',
					`component-stepper__step--${status}`,
					isClickable  ? 'component-stepper__step--clickable' : '',
					step.disabled ? 'component-stepper__step--disabled' : '',
				].filter(Boolean).join(' ')

				const indicator = isCompleted ? (
					<Icon name="check" aria-hidden="true" />
				) : isError ? (
					<Icon name="exclamation" aria-hidden="true" />
				) : (
					<span aria-hidden="true">{idx + 1}</span>
				)

				const content = (
					<>
						<span
							className="component-stepper__indicator"
							aria-hidden="true"
						>
							{indicator}
						</span>
						<span className="component-stepper__body">
							<span className="component-stepper__title" id={stepId}>
								{step.title}
							</span>
							{step.description && (
								<span className="component-stepper__desc" id={descId}>
									{step.description}
								</span>
							)}
						</span>
					</>
				)

				return (
					<React.Fragment key={step.key}>
						<div
							className={itemClass}
							role="listitem"
							aria-current={isActive ? 'step' : undefined}
							aria-labelledby={stepId}
							aria-describedby={descId}
						>
							{isClickable ? (
								<button
									type="button"
									className="component-stepper__step-btn"
									onClick={() => onStepClick?.(step.key)}
									aria-label={`${step.title}${isCompleted ? ' (completed)' : ''}`}
								>
									{content}
								</button>
							) : (
								<div className="component-stepper__step-inner">{content}</div>
							)}
						</div>
						{!isLast && (
							<div
								className={[
									'component-stepper__connector',
									isCompleted ? 'component-stepper__connector--completed' : '',
								].filter(Boolean).join(' ')}
								aria-hidden="true"
							/>
						)}
					</React.Fragment>
				)
			})}
		</div>
	)
}
