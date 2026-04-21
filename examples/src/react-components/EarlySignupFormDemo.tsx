import React from 'react'
import { EarlySignupForm, Card, CodeSnippet } from '@toolcase/react-components'

const EarlySignupFormDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">EarlySignupForm</h1>
				<p className="text-muted mb-0">An email signup form with benefits list, helper text, and custom CTA label.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Default</h2>
					<EarlySignupForm
						title="Get Early Access"
						subtitle="Be among the first to try webgame.cloud and shape the future of browser game hosting."
						benefits={[
							'Free tier with 1 GB storage',
							'Priority support during beta',
							'Influence the product roadmap',
							'Lock in early-adopter pricing',
						]}
						helperText="No credit card required. Unsubscribe anytime."
						ctaLabel="Request Access"
						onSubmit={(email) => alert(`Signed up: ${email}`)}
					/>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Minimal</h2>
					<EarlySignupForm
						title="Join the Waitlist"
						benefits={[
							'Free forever plan',
							'Early access to new features',
						]}
						ctaLabel="Sign Up"
						onSubmit={(email) => alert(`Joined: ${email}`)}
					/>
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
						code={`import { EarlySignupForm } from '@toolcase/react-components'

<EarlySignupForm
  title="Get Early Access"
  benefits={['Free tier', 'Priority support', 'Early-adopter pricing']}
  ctaLabel="Request Access"
  onSubmit={(email) => console.log(email)}
/>`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default EarlySignupFormDemo
