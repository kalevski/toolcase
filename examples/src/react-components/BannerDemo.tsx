import React from 'react'
import { Banner, Button, Card, CodeSnippet } from '@toolcase/react-components'

const usageCode = `import { Banner } from '@toolcase/react-components'

<Banner variant="info" dismissible>
  New version available — <a href="#">Update now</a>
</Banner>`

export const BannerDemo: React.FC = () => {
	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Banner</h1>
					<p className="text-muted mb-0">Top-of-page informational banners with variants, dismiss support, and persistence.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">All variants (dismissible)</h2>
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
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">With action button</h2>
						<Banner
							variant="info"
							action={<Button variant="secondary" size="small">Update now</Button>}
						>
							A new version of the application is available.
						</Banner>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Not dismissible</h2>
						<Banner variant="warning">
							Scheduled maintenance on Saturday 02:00–04:00 UTC.
						</Banner>
					</Card>
				</div>
			</div>

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
