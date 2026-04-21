import React from 'react'
import { IconButton, Card, CodeSnippet } from '@toolcase/react-components'

const IconButtonDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-4">IconButton</h1>
				<p className="text-muted mb-5">
					Square icon-only button with size, variant, and outline options.
				</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Variants</h2>
					<div className="d-flex gap-2 flex-wrap align-items-center">
						<IconButton icon="pencil" variant="primary" label="Edit" />
						<IconButton icon="trash" variant="danger" label="Delete" />
						<IconButton icon="gear" variant="secondary" label="Settings" />
						<IconButton icon="info-circle" variant="info" label="Info" />
						<IconButton icon="check-circle" variant="success" label="Confirm" />
						<IconButton icon="exclamation-triangle" variant="warning" label="Warning" />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Sizes</h2>
					<div className="d-flex gap-2 align-items-center">
						<IconButton icon="star" size="small" label="Small" />
						<IconButton icon="star" size="default" label="Default" />
						<IconButton icon="star" size="large" label="Large" />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Outline</h2>
					<div className="d-flex gap-2 flex-wrap align-items-center">
						<IconButton icon="pencil" variant="primary" outline label="Edit" />
						<IconButton icon="trash" variant="danger" outline label="Delete" />
						<IconButton icon="gear" variant="secondary" outline label="Settings" />
						<IconButton icon="info-circle" variant="info" outline label="Info" />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Disabled</h2>
					<div className="d-flex gap-2 align-items-center">
						<IconButton icon="pencil" variant="primary" disabled label="Disabled" />
						<IconButton icon="trash" variant="danger" outline disabled label="Disabled" />
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
						code={`import { IconButton } from '@toolcase/react-components'

<IconButton icon="pencil" label="Edit" onClick={handleEdit} />
<IconButton icon="trash" variant="danger" label="Delete" />`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default IconButtonDemo
