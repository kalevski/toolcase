import React from 'react'
import { CoolButton, Card, CodeSnippet } from '@toolcase/react-components'

const CoolButtonDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">CoolButton</h1>
				<p className="text-muted mb-0">An enhanced button with addon element, separator, and position control.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">With Addon (Right)</h2>
					<div className="d-flex flex-column gap-3 align-items-start">
						<CoolButton variant="primary" addon={<i className="bi bi-arrow-right" />}>
							Get Started
						</CoolButton>
						<CoolButton variant="success" addon={<i className="bi bi-download" />}>
							Download
						</CoolButton>
						<CoolButton variant="danger" addon={<i className="bi bi-trash" />}>
							Delete
						</CoolButton>
					</div>
				</Card>
			</div>
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">With Addon (Left)</h2>
					<div className="d-flex flex-column gap-3 align-items-start">
						<CoolButton variant="primary" addon={<i className="bi bi-rocket-takeoff" />} addonPosition="left">
							Launch
						</CoolButton>
						<CoolButton variant="info" addon={<i className="bi bi-search" />} addonPosition="left">
							Search
						</CoolButton>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Without Separator</h2>
					<div className="d-flex flex-column gap-3 align-items-start">
						<CoolButton variant="primary" addon={<i className="bi bi-arrow-right" />} showSeparator={false}>
							Continue
						</CoolButton>
						<CoolButton variant="secondary" addon={<i className="bi bi-gear" />} showSeparator={false}>
							Settings
						</CoolButton>
					</div>
				</Card>
			</div>
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Sizes</h2>
					<div className="d-flex flex-column gap-3 align-items-start">
						<CoolButton variant="primary" size="small" addon={<i className="bi bi-plus" />}>Small</CoolButton>
						<CoolButton variant="primary" addon={<i className="bi bi-plus" />}>Default</CoolButton>
						<CoolButton variant="primary" size="large" addon={<i className="bi bi-plus" />}>Large</CoolButton>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">No Addon (plain)</h2>
					<div className="d-flex gap-2 flex-wrap">
						<CoolButton variant="primary">Primary</CoolButton>
						<CoolButton variant="secondary">Secondary</CoolButton>
						<CoolButton variant="warning" outline>Warning Outline</CoolButton>
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
						code={`import { CoolButton } from '@webgame-cloud/react-components'

<CoolButton variant="primary" addon={<i className="bi bi-arrow-right" />}>
  Get Started
</CoolButton>
<CoolButton variant="primary" addon={<i className="bi bi-rocket-takeoff" />} addonPosition="left">
  Launch
</CoolButton>`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default CoolButtonDemo
