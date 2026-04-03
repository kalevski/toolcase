import React from 'react'
import { EmptyState, Card, CodeSnippet } from '@toolcase/react-components'

const EmptyStateDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">EmptyState</h1>
				<p className="text-muted mb-0">A placeholder shown when a list or section has no content yet.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Basic</h2>
					<EmptyState icon="inbox">
						<p>No items found.</p>
					</EmptyState>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">With Guidance Text</h2>
					<EmptyState icon="file-earmark-code">
						<p>No schemas created yet.</p>
						<p>Click the <strong>Add</strong> button to create a new schema.</p>
					</EmptyState>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Without Icon</h2>
					<EmptyState>
						<p>Nothing to display.</p>
					</EmptyState>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Custom Children</h2>
					<EmptyState icon="cloud-upload">
						<p>No files uploaded.</p>
						<button className="btn btn-sm btn-primary mt-2">Upload File</button>
					</EmptyState>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Various Icons</h2>
					<div className="d-flex gap-4 flex-wrap">
						<EmptyState icon="people">
							<p>No members</p>
						</EmptyState>
						<EmptyState icon="folder2-open">
							<p>No projects</p>
						</EmptyState>
						<EmptyState icon="gear">
							<p>No configs</p>
						</EmptyState>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Usage</h2>
					<CodeSnippet
						language="typescript"
						code={`import { EmptyState } from '@webgame-cloud/react-components'

<EmptyState icon="file-earmark-code">
  <p>No schemas created yet.</p>
  <p>Click the <strong>Add</strong> button to create a new schema.</p>
</EmptyState>`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default EmptyStateDemo
