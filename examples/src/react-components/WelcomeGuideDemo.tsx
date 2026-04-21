import React, { useState } from 'react'
import { WelcomeGuide, WelcomeGuideStep, Button, Card, CodeSnippet } from '@toolcase/react-components'

const INITIAL_STEPS: WelcomeGuideStep[] = [
	{ label: 'Create your first project', completed: true },
	{ label: 'Upload an asset', completed: true },
	{ label: 'Configure game settings', completed: false },
	{ label: 'Invite a team member', completed: false },
	{ label: 'Publish a build', completed: false },
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
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">WelcomeGuide</h1>
					<p className="text-muted mb-0">An onboarding card with step progress, messages carousel, and optional background pattern.</p>
				</div>
			</div>

			<div className="row mb-5">
			<div className="col-12">
			<h5 className="text-muted mb-3">With background pattern</h5>
			<WelcomeGuide
				title="Getting Started"
				messages={MESSAGES}
				steps={steps}
				backgroundPattern={showPattern ? <DotPattern /> : undefined}
			/>

			<h5 className="text-muted mb-3 mt-5">Without background pattern</h5>
			<WelcomeGuide
				title="Getting Started"
				messages={MESSAGES}
				steps={steps}
			/>
			</div>
			</div>

			<div className="row mb-5">
			<div className="col-lg-8">
			<Card>
				<h5 className="mb-3">Toggle Steps</h5>
				<p className="text-muted mb-3">Click to toggle step completion and see the guide update.</p>
				<div className="d-flex flex-wrap gap-2">
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
			</Card>
			</div>
			</div>

		{/* Usage */}
		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Usage</h2>
					<CodeSnippet
						language="typescript"
						code={`import { WelcomeGuide } from '@toolcase/react-components'

<WelcomeGuide
  title="Getting Started"
  messages={['Welcome!', 'Follow the steps to get started.']}
  steps={[
    { label: 'Create a project', completed: true },
    { label: 'Upload an asset', completed: false },
  ]}
/>`}
					/>
				</Card>
			</div>
		</div>
		</div>
	)
}

export default WelcomeGuideDemo
