import React from 'react'
import { Textarea, Card, CodeSnippet } from '../../src'

const TextareaDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">Textarea</h1>
				<p className="text-muted mb-0">A labeled textarea with form-control styling.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Basic</h2>
					<div className="d-flex flex-column gap-3">
						<Textarea label="Description" placeholder="Enter a description..." rows={3} />
						<Textarea label="Notes" placeholder="Additional notes..." rows={4} />
					</div>
				</Card>
			</div>
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">States</h2>
					<div className="d-flex flex-column gap-3">
						<Textarea label="Editable" placeholder="Type here..." rows={3} />
						<Textarea label="Disabled" placeholder="Cannot edit" rows={3} disabled />
						<Textarea label="Read-only" value="This content cannot be changed." rows={2} readOnly />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Without Label</h2>
					<Textarea placeholder="Write your message..." rows={4} />
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
						code={`import { Textarea } from '@webgame-cloud/react-components'

<Textarea label="Description" rows={4} placeholder="Enter description..." />`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default TextareaDemo
