import React from 'react'
import {
	Banner,
	Button,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

export const BannerDemo: React.FC = () => {
	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Feedback</RichPageHeaderChip>}
				title="Banner"
				description="Top-of-page informational banners with variants, dismiss support, and persistence."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="All variants (dismissible)">
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
			</SectionCard>

			<SectionCard title="With action button">
				<Banner
					variant="info"
					action={<Button variant="secondary" size="small">Update now</Button>}
				>
					A new version of the application is available.
				</Banner>
			</SectionCard>

			<SectionCard title="Not dismissible">
				<Banner variant="warning">
					Scheduled maintenance on Saturday 02:00–04:00 UTC.
				</Banner>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}
