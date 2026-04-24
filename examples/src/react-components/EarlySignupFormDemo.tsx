import React from 'react'
import { EarlySignupForm } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const EarlySignupFormDemo: React.FC = () => (
	<DemoPage
		eyebrow="Marketing"
		title="EarlySignupForm"
		lede="An email signup form with benefits list, helper text, and custom CTA label."
	>
		<DemoSection title="Default">
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
		</DemoSection>

		<DemoSection title="Minimal">
			<EarlySignupForm
				title="Join the Waitlist"
				benefits={[
					'Free forever plan',
					'Early access to new features',
				]}
				ctaLabel="Sign Up"
				onSubmit={(email) => alert(`Joined: ${email}`)}
			/>
		</DemoSection>
	</DemoPage>
)

export default EarlySignupFormDemo
