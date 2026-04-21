import React, { useState } from 'react'
import { Stepper, StepItem, Card, CodeSnippet } from '@toolcase/react-components'

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

const usageCode = `import { Stepper } from '@toolcase/react-components'

const steps = [
  { key: 'step1', title: 'Step 1', description: 'First step' },
  { key: 'step2', title: 'Step 2', description: 'Second step' },
  { key: 'step3', title: 'Step 3', description: 'Third step' },
]

// Derive statuses automatically via activeStep
<Stepper steps={steps} activeStep="step2" />

// Clickable steps
<Stepper steps={steps} activeStep={active} clickable onStepClick={setActive} />

// Vertical
<Stepper steps={steps} activeStep="step1" orientation="vertical" />`

export const StepperDemo: React.FC = () => {
	const [horizontalActive, setHorizontalActive] = useState('profile')
	const [verticalActive,   setVerticalActive]   = useState('install')

	const hKeys = horizontalSteps.map(s => s.key)
	const vKeys = verticalSteps.map(s => s.key)

	const hIdx = hKeys.indexOf(horizontalActive)
	const vIdx = vKeys.indexOf(verticalActive)

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Stepper</h1>
					<p className="text-muted mb-0">Visual step-progress indicator for multi-step workflows.</p>
				</div>
			</div>

			{/* Horizontal — clickable */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Horizontal (clickable)</h2>
						<Stepper
							steps={horizontalSteps}
							activeStep={horizontalActive}
							clickable
							onStepClick={setHorizontalActive}
						/>
						<div className="d-flex gap-2 mt-4">
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
					</Card>
				</div>
			</div>

			{/* Vertical — clickable */}
			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Vertical (clickable)</h2>
						<Stepper
							steps={verticalSteps}
							activeStep={verticalActive}
							orientation="vertical"
							clickable
							onStepClick={setVerticalActive}
						/>
					</Card>
				</div>

				{/* With explicit statuses (error) */}
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Explicit Statuses (with error)</h2>
						<Stepper steps={errorSteps} orientation="vertical" />
					</Card>
				</div>
			</div>

			{/* Code */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet language="typescript" code={usageCode} />
					</Card>
				</div>
			</div>
		</div>
	)
}
