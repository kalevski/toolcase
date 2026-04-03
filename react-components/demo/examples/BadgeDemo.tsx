import React from 'react'
import { Badge, Card, CodeSnippet } from '../../src'

const BadgeDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">Badge</h1>
				<p className="text-muted mb-0">A small colored label for status indicators, counts, and tags.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<Card>
					<h2 className="h5 mb-3">Variants</h2>
					<div className="d-flex flex-wrap gap-2">
						<Badge variant="primary">Primary</Badge>
						<Badge variant="secondary">Secondary</Badge>
						<Badge variant="success">Success</Badge>
						<Badge variant="danger">Danger</Badge>
						<Badge variant="warning">Warning</Badge>
						<Badge variant="info">Info</Badge>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<Card>
					<h2 className="h5 mb-3">Pill</h2>
					<div className="d-flex flex-wrap gap-2">
						<Badge variant="primary" pill>Primary</Badge>
						<Badge variant="secondary" pill>Secondary</Badge>
						<Badge variant="success" pill>Success</Badge>
						<Badge variant="danger" pill>Danger</Badge>
						<Badge variant="warning" pill>Warning</Badge>
						<Badge variant="info" pill>Info</Badge>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<Card>
					<h2 className="h5 mb-3">With Label Prop</h2>
					<div className="d-flex flex-wrap gap-2">
						<Badge variant="primary" label="v2.4.0" />
						<Badge variant="info" label="New" pill />
						<Badge variant="success" label="Active" />
						<Badge variant="danger" label="3 errors" pill />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<Card>
					<h2 className="h5 mb-3">In Context</h2>
					<div className="d-flex flex-column gap-2">
						<p className="mb-0">Notifications <Badge variant="danger" pill>4</Badge></p>
						<p className="mb-0">Build Status: <Badge variant="success">Passing</Badge></p>
						<p className="mb-0">Environment: <Badge variant="warning">Staging</Badge></p>
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
						code={`import { Badge } from '@webgame-cloud/react-components'

<Badge variant="primary" pill>New</Badge>`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default BadgeDemo
