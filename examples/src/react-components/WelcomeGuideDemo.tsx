import React, { useState } from 'react'
import {
	Button,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	WelcomeGuide,
	WelcomeGuideStep
} from '@toolcase/react-components'

const INITIAL_STEPS: WelcomeGuideStep[] = [
	{ key: 'create-project', label: 'Create your first project', completed: true },
	{ key: 'upload-asset', label: 'Upload an asset', completed: true },
	{ key: 'configure-settings', label: 'Configure game settings', completed: false },
	{ key: 'invite-member', label: 'Invite a team member', completed: false },
	{ key: 'publish-build', label: 'Publish a build', completed: false },
]

const MESSAGES = [
	'Welcome to Webgame Cloud! Follow the steps on the right to get up and running.',
	'Each step will guide you through a core feature of the platform.',
	'You can revisit this guide anytime from your dashboard.',
]

const DotPattern = () => (
	<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
		<defs>
			<pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
				<circle cx="2" cy="2" r="1.2" fill="#94a3b8" />
			</pattern>
		</defs>
		<rect width="100%" height="100%" fill="url(#dots)" />
	</svg>
)

const WelcomeGuideDemo = () => {
	const [steps, setSteps] = useState(INITIAL_STEPS)
	const [showPattern, setShowPattern] = useState(true)

	const toggleStep = (index: number) => {
		setSteps((prev) =>
			prev.map((s, i) => (i === index ? { ...s, completed: !s.completed } : s))
		)
	}

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Marketing</RichPageHeaderChip>}
				title="WelcomeGuide"
				description="An onboarding card with step progress, messages carousel, and optional background pattern."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="With background pattern">
				<WelcomeGuide
					title="Getting Started"
					messages={MESSAGES}
					steps={steps}
					backgroundPattern={showPattern ? <DotPattern /> : undefined}
				/>
			</SectionCard>

			<SectionCard title="Without background pattern">
				<WelcomeGuide
					title="Getting Started"
					messages={MESSAGES}
					steps={steps}
				/>
			</SectionCard>

			<SectionCard title="Toggle Steps">
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
					{steps.map((step, i) => (
						<Button
							key={i}
							variant={step.completed ? 'success' : 'secondary'}
							outline={!step.completed}
							size="small"
							onClick={() => toggleStep(i)}
						>
							{step.label}
						</Button>
					))}
					<Button
						variant="primary"
						outline={!showPattern}
						size="small"
						onClick={() => setShowPattern((v) => !v)}
					>
						{showPattern ? 'Hide' : 'Show'} Pattern
					</Button>
				</div>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default WelcomeGuideDemo
