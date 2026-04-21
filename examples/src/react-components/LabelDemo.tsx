import React from 'react'
import { Label, Card, CodeSnippet } from '@toolcase/react-components'

const LabelDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-4">Label</h1>
				<p className="text-muted mb-5">
					A styled label with optional required indicator and tooltip icon. Used for form fields.
				</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Basic</h2>
					<div className="d-flex flex-column gap-3">
						<Label>Username</Label>
						<Label>Email Address</Label>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Required</h2>
					<div className="d-flex flex-column gap-3">
						<Label required>Full Name</Label>
						<Label required>Password</Label>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">With Tooltip</h2>
					<div className="d-flex flex-column gap-3">
						<Label tooltip="Your public display name">Display Name</Label>
						<Label required tooltip="Must be at least 8 characters">Password</Label>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Sizes</h2>
					<div className="d-flex flex-column gap-3">
						<Label size="small">Small Label</Label>
						<Label size="default">Default Label</Label>
						<Label size="large">Large Label</Label>
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
					code={`import { Label } from '@toolcase/react-components'

<Label>Email address</Label>
<Label htmlFor="name">Full Name</Label>`}
				/>
			</Card>
		</div>
	</div>
	</div>
)

export default LabelDemo
