import React, { useState } from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	StepItem,
	Stepper
} from '@toolcase/react-components'

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
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Navigation</RichPageHeaderChip>}
				title="Stepper"
				description="Visual step-progress indicator for multi-step workflows."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Horizontal (clickable)">
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
			</SectionCard>

			<SectionCard title="Vertical (clickable)">
				<Stepper
					steps={verticalSteps}
					activeStep={verticalActive}
					orientation="vertical"
					clickable
					onStepClick={setVerticalActive}
				/>
			</SectionCard>

			<SectionCard title="Explicit Statuses (with error)">
				<Stepper steps={errorSteps} orientation="vertical" />
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}
