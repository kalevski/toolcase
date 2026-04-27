import React from 'react'
import { NewsletterSignup, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const NewsletterSignupDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Footer & Misc</RichPageHeaderChip>}
					title="NewsletterSignup"
					description="Single-email subscription form with success/error states."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Subscribe">
						<NewsletterSignup
							title="Get release notes in your inbox"
							description="One email per major release. No spam, ever."
							onSubmit={async (email) => {
								await new Promise((r) => setTimeout(r, 600))
								// eslint-disable-next-line no-console
								console.log('subscribed:', email)
							}}
							privacyHref="#"
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default NewsletterSignupDemo
