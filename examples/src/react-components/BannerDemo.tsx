import React from 'react'
import { Banner, Button } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

export const BannerDemo: React.FC = () => {
	return (
		<DemoPage
			eyebrow="Feedback"
			title="Banner"
			lede="Top-of-page informational banners with variants, dismiss support, and persistence."
		>
			<DemoSection title="All variants (dismissible)">
				<div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
					<Banner variant="info" dismissible>
						<strong>Info:</strong> New features are available in v3.1.
					</Banner>
					<Banner variant="success" dismissible>
						<strong>Success:</strong> Your changes have been saved.
					</Banner>
					<Banner variant="warning" dismissible>
						<strong>Warning:</strong> Your plan expires in 3 days.
					</Banner>
					<Banner variant="error" dismissible>
						<strong>Error:</strong> Deployment failed. Check your configuration.
					</Banner>
				</div>
			</DemoSection>

			<DemoSection title="With action button">
				<Banner
					variant="info"
					action={<Button variant="secondary" size="small">Update now</Button>}
				>
					A new version of the application is available.
				</Banner>
			</DemoSection>

			<DemoSection title="Not dismissible">
				<Banner variant="warning">
					Scheduled maintenance on Saturday 02:00–04:00 UTC.
				</Banner>
			</DemoSection>
		</DemoPage>
	)
}
