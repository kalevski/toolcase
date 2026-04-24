import React from 'react'
import {
	EarlySignupForm,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const EarlySignupFormDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Marketing</RichPageHeaderChip>}
				title="EarlySignupForm"
				description="An email signup form with benefits list, helper text, and custom CTA label."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Default">
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
		</SectionCard>

		<SectionCard title="Minimal">
			<EarlySignupForm
				title="Join the Waitlist"
				benefits={[
					'Free forever plan',
					'Early access to new features',
				]}
				ctaLabel="Sign Up"
				onSubmit={(email) => alert(`Joined: ${email}`)}
			/>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default EarlySignupFormDemo
