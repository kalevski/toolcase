import React, { useState } from 'react'
import { Stepper, StepItem } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const horizontalSteps: StepItem[] = [
	{ key: 'account',  title: 'Account',   description: 'Create your account' },
	{ key: 'profile',  title: 'Profile',   description: 'Set up your profile' },
	{ key: 'billing',  title: 'Billing',   description: 'Add payment method' },
	{ key: 'confirm',  title: 'Confirm',   description: 'Review & submit' },
]

const verticalSteps: StepItem[] = [
	{ key: 'clone',    title: 'Clone repository',   description: 'git clone https://...' },
	{ key: 'install',  title: 'Install dependencies', description: 'npm install' },
	{ key: 'config',   title: 'Configure env',       description: 'Copy .env.example' },
	{ key: 'start',    title: 'Start dev server',    description: 'npm run dev' },
]

const errorSteps: StepItem[] = [
	{ key: 's1', title: 'Validate',  status: 'completed' },
	{ key: 's2', title: 'Upload',    status: 'error',     description: 'Upload failed' },
	{ key: 's3', title: 'Process',   status: 'pending' },
	{ key: 's4', title: 'Complete',  status: 'pending' },
]

export const StepperDemo: React.FC = () => {
	const [horizontalActive, setHorizontalActive] = useState('profile')
	const [verticalActive,   setVerticalActive]   = useState('install')

	const hKeys = horizontalSteps.map(s => s.key)
	const hIdx = hKeys.indexOf(horizontalActive)

	return (
		<DemoPage
			eyebrow="Navigation"
			title="Stepper"
			lede="Visual step-progress indicator for multi-step workflows."
		>
			<DemoSection title="Horizontal (clickable)">
				<Stepper
					steps={horizontalSteps}
					activeStep={horizontalActive}
					clickable
					onStepClick={setHorizontalActive}
				/>
				<div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
					<button
						className="btn btn-outline-secondary btn-sm"
						disabled={hIdx === 0}
						onClick={() => setHorizontalActive(hKeys[hIdx - 1])}
					>
						← Previous
					</button>
					<button
						className="btn btn-primary btn-sm"
						disabled={hIdx === hKeys.length - 1}
						onClick={() => setHorizontalActive(hKeys[hIdx + 1])}
					>
						Next →
					</button>
				</div>
			</DemoSection>

			<DemoSection title="Vertical (clickable)">
				<Stepper
					steps={verticalSteps}
					activeStep={verticalActive}
					orientation="vertical"
					clickable
					onStepClick={setVerticalActive}
				/>
			</DemoSection>

			<DemoSection title="Explicit Statuses (with error)">
				<Stepper steps={errorSteps} orientation="vertical" />
			</DemoSection>
		</DemoPage>
	)
}
