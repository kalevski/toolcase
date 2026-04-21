import React from 'react'
import { ProgressBar, Card, CodeSnippet } from '@toolcase/react-components'

const ProgressBarDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">ProgressBar</h1>
				<p className="text-muted mb-0">A horizontal progress bar with optional label, variant, and custom height.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<Card>
					<h2 className="h5 mb-3">Variants</h2>
					<div className="d-flex flex-column gap-3">
						<ProgressBar value={70} variant="primary" label="Primary" />
						<ProgressBar value={55} variant="secondary" label="Secondary" />
						<ProgressBar value={90} variant="success" label="Success" />
						<ProgressBar value={30} variant="danger" label="Danger" />
						<ProgressBar value={45} variant="warning" label="Warning" />
						<ProgressBar value={60} variant="info" label="Info" />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<Card>
					<h2 className="h5 mb-3">Different Values</h2>
					<div className="d-flex flex-column gap-3">
						<ProgressBar value={0} label="0%" />
						<ProgressBar value={25} label="25%" />
						<ProgressBar value={50} label="50%" />
						<ProgressBar value={75} label="75%" />
						<ProgressBar value={100} label="100%" variant="success" />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<Card>
					<h2 className="h5 mb-3">Custom Height</h2>
					<div className="d-flex flex-column gap-3">
						<ProgressBar value={60} variant="primary" label="Thin (4px)" height={4} />
						<ProgressBar value={60} variant="primary" label="Default" />
						<ProgressBar value={60} variant="primary" label="Thick (20px)" height={20} />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<Card>
					<h2 className="h5 mb-3">Indeterminate</h2>
					<div className="d-flex flex-column gap-3">
						<ProgressBar indeterminate variant="primary" label="Uploading..." />
						<ProgressBar indeterminate variant="info" label="Processing..." />
						<ProgressBar indeterminate variant="success" label="Saving..." />
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
						code={`import { ProgressBar } from '@toolcase/react-components'

<ProgressBar value={75} variant="success" />
<ProgressBar value={30} label="Loading..." />
<ProgressBar indeterminate variant="primary" label="Uploading..." />`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default ProgressBarDemo
