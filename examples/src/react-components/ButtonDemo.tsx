import React from 'react'
import { Button, Card, CodeSnippet } from '@toolcase/react-components'

const ButtonDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">Button</h1>
				<p className="text-muted mb-0">A styled button with variant, size, and outline options.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<Card>
					<h2 className="h5 mb-3">Variants</h2>
					<div className="d-flex flex-wrap gap-2">
						<Button variant="primary">Primary</Button>
						<Button variant="secondary">Secondary</Button>
						<Button variant="info">Info</Button>
						<Button variant="success">Success</Button>
						<Button variant="warning">Warning</Button>
						<Button variant="danger">Danger</Button>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<Card>
					<h2 className="h5 mb-3">Outline</h2>
					<div className="d-flex flex-wrap gap-2">
						<Button variant="primary" outline>Primary</Button>
						<Button variant="secondary" outline>Secondary</Button>
						<Button variant="info" outline>Info</Button>
						<Button variant="success" outline>Success</Button>
						<Button variant="warning" outline>Warning</Button>
						<Button variant="danger" outline>Danger</Button>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<Card>
					<h2 className="h5 mb-3">Sizes</h2>
					<div className="d-flex flex-wrap align-items-center gap-2">
						<Button variant="primary" size="small">Small</Button>
						<Button variant="primary" size="default">Default</Button>
						<Button variant="primary" size="large">Large</Button>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<Card>
					<h2 className="h5 mb-3">Disabled</h2>
					<div className="d-flex flex-wrap gap-2">
						<Button variant="primary" disabled>Disabled</Button>
						<Button variant="danger" outline disabled>Disabled Outline</Button>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<Card>
					<h2 className="h5 mb-3">With Label Prop</h2>
					<div className="d-flex flex-wrap gap-2">
						<Button variant="primary" label="Save Changes" />
						<Button variant="danger" outline label="Delete" />
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
					code={`import { Button } from '@webgame-cloud/react-components'

<Button variant="primary" onClick={handleClick}>
  Save Changes
</Button>

<Button variant="danger" outline size="small">
  Delete
</Button>`}
				/>
			</Card>
		</div>
	</div>
	</div>
)

export default ButtonDemo
