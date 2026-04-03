import React, { useState } from 'react'
import { Alert, Card, CodeSnippet } from '@toolcase/react-components'

const AlertDemo: React.FC = () => {
	const [visible, setVisible] = useState(true)

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Alert</h1>
					<p className="text-muted mb-0">A dismissible alert banner with icon, title, message, and close button.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Variants</h2>
						<div className="d-flex flex-column gap-3">
							<Alert variant="primary">This is a primary alert.</Alert>
							<Alert variant="secondary">This is a secondary alert.</Alert>
							<Alert variant="info">This is an info alert.</Alert>
							<Alert variant="success">This is a success alert.</Alert>
							<Alert variant="warning">This is a warning alert.</Alert>
							<Alert variant="danger">This is a danger alert.</Alert>
						</div>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">With Title</h2>
						<div className="d-flex flex-column gap-3">
							<Alert variant="success" title="Success!">Your project has been published.</Alert>
							<Alert variant="danger" title="Error">Failed to upload file. Please try again.</Alert>
							<Alert variant="warning" title="Warning" message="Your storage is almost full." />
						</div>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Dismissible</h2>
						{visible ? (
							<Alert variant="info" title="Heads up!" dismissible onClose={() => setVisible(false)}>
								This alert can be closed. Click the X to dismiss it.
							</Alert>
						) : (
							<button className="btn btn-sm btn-outline-primary" onClick={() => setVisible(true)}>Show alert again</button>
						)}
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
							code={`import { Alert } from '@webgame-cloud/react-components'

<Alert variant="info" title="Heads up!">
  This is an informational alert.
</Alert>`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default AlertDemo
