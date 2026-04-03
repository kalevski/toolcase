import React from 'react'
import { Spinner, Card, CodeSnippet } from '@toolcase/react-components'

const SpinnerDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-4">Spinner</h1>
				<p className="text-muted mb-5">
					A loading indicator with variant colors, sizes, and optional label.
				</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Variants</h2>
					<div className="d-flex align-items-center gap-4 flex-wrap">
						<Spinner variant="primary" />
						<Spinner variant="secondary" />
						<Spinner variant="info" />
						<Spinner variant="success" />
						<Spinner variant="warning" />
						<Spinner variant="danger" />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Sizes</h2>
					<div className="d-flex align-items-center gap-4">
						<Spinner size="small" />
						<Spinner size="default" />
						<Spinner size="large" />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">With Label</h2>
					<div className="d-flex flex-column gap-4">
						<Spinner label="Loading data…" />
						<Spinner variant="success" label="Saving changes…" size="large" />
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
					code={`import { Spinner } from '@webgame-cloud/react-components'

<Spinner />
<Spinner size="sm" variant="primary" />`}
				/>
			</Card>
		</div>
	</div>
	</div>
)

export default SpinnerDemo
