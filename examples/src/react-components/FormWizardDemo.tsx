import React, { useState } from 'react'
import {
	Alert,
	Button,
	Checkbox,
	FormWizard,
	FormWizardStep,
	Input,
	RadioGroup,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const FormWizardDemo: React.FC = () => {
	const [submitted, setSubmitted] = useState<Record<string, string> | null>(null)

	const [name, setName] = useState('')
	const [email, setEmail] = useState('')
	const [plan, setPlan] = useState<string>('')
	const [agree, setAgree] = useState(false)

	const steps: FormWizardStep[] = [
		{
			key: 'account',
			label: 'Account',
			canNext: name.trim().length > 0 && email.trim().length > 0,
			content: (
				<div className="d-flex flex-column gap-3">
					<h5>Account Details</h5>
					<Input
						label="Name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Your name"
					/>
					<Input
						label="Email"
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="you@example.com"
					/>
				</div>
			),
		},
		{
			key: 'plan',
			label: 'Plan',
			canNext: plan !== '',
			content: (
				<div className="d-flex flex-column gap-3">
					<h5>Choose a Plan</h5>
					<RadioGroup
						name="plan"
						options={[
							{ value: 'Free', label: 'Free' },
							{ value: 'Pro', label: 'Pro' },
							{ value: 'Enterprise', label: 'Enterprise' },
						]}
						value={plan}
						onChange={setPlan}
					/>
				</div>
			),
		},
		{
			key: 'confirm',
			label: 'Confirm',
			content: (
				<div className="d-flex flex-column gap-3">
					<h5>Review &amp; Confirm</h5>
					<div className="p-3 rounded" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
						<div><strong>Name:</strong> {name}</div>
						<div><strong>Email:</strong> {email}</div>
						<div><strong>Plan:</strong> {plan}</div>
					</div>
					<Checkbox
						label="I agree to the terms and conditions"
						checked={agree}
						onChange={(e) => setAgree(e.target.checked)}
					/>
				</div>
			),
		},
	]

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Navigation</RichPageHeaderChip>}
				title="FormWizard"
				description="A multi-step wizard with progress navigation, step validation, and a customizable completion action."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Interactive Wizard">
				{submitted ? (
					<div>
						<Alert variant="success">
							<strong>Submitted!</strong>
						</Alert>
						<pre className="p-3 bg-light rounded mt-2" style={{ fontSize: '0.8rem' }}>
							{JSON.stringify(submitted, null, 2)}
						</pre>
						<Button
							variant="secondary"
							outline
							size="small"
							className="mt-2"
							onClick={() => { setSubmitted(null); setName(''); setEmail(''); setPlan(''); setAgree(false) }}
						>
							Reset
						</Button>
					</div>
				) : (
					<FormWizard
						steps={steps}
						onComplete={() => setSubmitted({ name, email, plan })}
						completeLabel="Submit"
						completeIcon="bi-check-lg"
					/>
				)}
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default FormWizardDemo
