import React from 'react'
import { Radio, Card, CodeSnippet } from '../../src'

const RadioDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">Radio</h1>
				<p className="text-muted mb-0">A form-check radio input with optional label and inline layout.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Basic</h2>
					<div className="d-flex flex-column gap-2">
						<Radio label="Option A" name="basic" defaultChecked />
						<Radio label="Option B" name="basic" />
						<Radio label="Option C" name="basic" />
					</div>
				</Card>
			</div>
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Inline</h2>
					<div className="d-flex flex-wrap gap-2">
						<Radio label="Small" name="size" inline defaultChecked />
						<Radio label="Medium" name="size" inline />
						<Radio label="Large" name="size" inline />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Disabled</h2>
					<div className="d-flex flex-column gap-2">
						<Radio label="Disabled unchecked" name="dis" disabled />
						<Radio label="Disabled checked" name="dis" disabled checked />
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
						code={`import { Radio } from '@webgame-cloud/react-components'

<Radio name="plan" label="Free" value="free" checked={plan === 'free'} onChange={() => setPlan('free')} />
<Radio name="plan" label="Pro" value="pro" checked={plan === 'pro'} onChange={() => setPlan('pro')} />`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default RadioDemo
