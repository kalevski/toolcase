import React from 'react'
import { Card, CodeSnippet } from '../../src'

const CardDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">Card</h1>
				<p className="text-muted mb-0">A container card with optional header and color variant.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<h2 className="h5 mb-3">Default</h2>
				<Card>
					<p className="mb-0">This is a default card with body content.</p>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<h2 className="h5 mb-3">With Header</h2>
				<Card header="Project Settings">
					<p className="mb-0">Configure your project preferences and integrations here.</p>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<h2 className="h5 mb-3">Variants</h2>
				<div className="row g-3">
					<div className="col-md-4">
						<Card variant="primary" header="Primary">White text on primary background.</Card>
					</div>
					<div className="col-md-4">
						<Card variant="secondary" header="Secondary">White text on secondary background.</Card>
					</div>
					<div className="col-md-4">
						<Card variant="info" header="Info">White text on info background.</Card>
					</div>
					<div className="col-md-4">
						<Card variant="success" header="Success">White text on success background.</Card>
					</div>
					<div className="col-md-4">
						<Card variant="warning" header="Warning">White text on warning background.</Card>
					</div>
					<div className="col-md-4">
						<Card variant="danger" header="Danger">White text on danger background.</Card>
					</div>
				</div>
			</div>
		</div>

	{/* Usage */}
	<div className="row mb-5">
		<div className="col-12">
			<Card>
				<h2 className="h5 mb-3">Usage</h2>
				<CodeSnippet
					language="typescript"
					code={`import { Card } from '@webgame-cloud/react-components'

<Card header="Settings">
  Card content goes here.
</Card>

<Card variant="primary" header="Highlighted">
  Colored card content.
</Card>`}
				/>
			</Card>
		</div>
	</div>
	</div>
)

export default CardDemo
