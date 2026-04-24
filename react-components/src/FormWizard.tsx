import React, { useState, useCallback } from 'react'
import { TabSections } from './TabSections'
import { Button } from './Button'
import { Icon } from './Icon'
import { Skeleton } from './Skeleton'
import { Spacer } from './Spacer'

export interface FormWizardStep {
	key: string
	label: string
	content: React.ReactNode
	canNext?: boolean
}

export interface FormWizardProps {
	steps: FormWizardStep[]
	onComplete?: () => void
	completeLabel?: React.ReactNode
	completeIcon?: string
	className?: string
	loading?: boolean
}

export const FormWizard: React.FC<FormWizardProps> = ({
	steps,
	onComplete,
	completeLabel = 'Complete',
	completeIcon,
	className = '',
	loading = false,
}) => {
	const [step, setStep] = useState(0)

	const keys = steps.map((s) => s.key)
	const current = steps[step]
	const isLast = step === steps.length - 1
	const canNext = current?.canNext ?? true

	const handleNext = useCallback(() => {
		if (!isLast) setStep((s) => s + 1)
	}, [isLast])

	const handleBack = useCallback(() => {
		if (step > 0) setStep((s) => s - 1)
	}, [step])

	const tabItems = steps.map((s, i) => ({
		key: s.key,
		label: s.label,
		content: s.content,
		disabled: i > step,
	}))

	if (loading) {
		return (
			<div className={`component component-form-wizard${className ? ` ${className}` : ''}`}>
				<div className="component-form-wizard__tabs">
					<Skeleton width="60%" />
				</div>
				<div style={{ padding: '1.5rem' }}>
					<Skeleton count={4} />
				</div>
				<div className="component-form-wizard__footer">
					<Skeleton width="5rem" height="2.5rem" />
				</div>
			</div>
		)
	}

	return (
		<div className={`component component-form-wizard${className ? ` ${className}` : ''}`}>
			<TabSections
				items={tabItems}
				activeKey={keys[step]}
				onChange={(key) => {
					const idx = keys.indexOf(key)
					if (idx >= 0 && idx < step) setStep(idx)
				}}
				className="component-form-wizard__tabs"
			/>

			<div className="component-form-wizard__footer">
				{step > 0 && (
					<Button variant="secondary" outline onClick={handleBack}>
						<Icon name="arrow-left" />
						Back
					</Button>
				)}
				<Spacer />
				{!isLast && (
					<Button
						variant="primary"
						onClick={handleNext}
						disabled={!canNext}
					>
						Next
						<Icon name="arrow-right" />
					</Button>
				)}
				{isLast && (
					<Button
						variant="primary"
						size="large"
						onClick={onComplete}
					>
						{completeIcon && <Icon name={completeIcon} />}
						{completeLabel}
					</Button>
				)}
			</div>
		</div>
	)
}
