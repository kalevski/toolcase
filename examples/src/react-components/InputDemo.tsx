import React from 'react'
import { Input, Card, CodeSnippet } from '@toolcase/react-components'

const InputDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">Input</h1>
				<p className="text-muted mb-0">A labeled text input with form-control styling.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Basic</h2>
					<div className="d-flex flex-column gap-3">
						<Input label="Full Name" placeholder="Enter your name" />
						<Input label="Email" type="email" placeholder="you@example.com" />
						<Input label="Password" type="password" placeholder="••••••••" />
					</div>
				</Card>
			</div>
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">States</h2>
					<div className="d-flex flex-column gap-3">
						<Input label="Default" placeholder="Editable" />
						<Input label="Disabled" placeholder="Cannot edit" disabled />
						<Input label="Read-only" value="Fixed value" readOnly />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Without Label</h2>
					<div className="d-flex flex-column gap-3">
						<Input placeholder="Search..." type="search" />
						<Input placeholder="Enter a URL" type="url" />
					</div>
				</Card>
			</div>
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Input Types</h2>
					<div className="d-flex flex-column gap-3">
						<Input label="Number" type="number" placeholder="42" />
						<Input label="Date" type="date" />
						<Input label="Color" type="color" defaultValue="#6366f1" />
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
						code={`import { Input } from '@webgame-cloud/react-components'

<Input label="Email" type="email" placeholder="you@example.com" />
<Input label="Password" type="password" />`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default InputDemo
