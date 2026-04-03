import React, { useState } from 'react'
import { Checkbox, Card, CodeSnippet } from '../../src'

const CheckboxDemo: React.FC = () => {
	const [checked, setChecked] = useState(true)

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Checkbox</h1>
					<p className="text-muted mb-0">A form-check checkbox input with optional label and inline layout.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Basic</h2>
						<div className="d-flex flex-column gap-2">
							<Checkbox label="Accept terms and conditions" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
							<Checkbox label="Subscribe to newsletter" />
							<Checkbox label="Remember me" defaultChecked />
						</div>
					</Card>
				</div>
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Inline</h2>
						<div className="d-flex flex-wrap gap-2">
							<Checkbox label="Option A" inline />
							<Checkbox label="Option B" inline defaultChecked />
							<Checkbox label="Option C" inline />
						</div>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Disabled</h2>
						<div className="d-flex flex-column gap-2">
							<Checkbox label="Disabled unchecked" disabled />
							<Checkbox label="Disabled checked" disabled checked />
						</div>
					</Card>
				</div>
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Without Label</h2>
						<div className="d-flex gap-3">
							<Checkbox defaultChecked />
							<Checkbox />
							<Checkbox disabled checked />
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
							code={`import { Checkbox } from '@webgame-cloud/react-components'

<Checkbox label="Accept terms" checked={accepted} onChange={setAccepted} />`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default CheckboxDemo
