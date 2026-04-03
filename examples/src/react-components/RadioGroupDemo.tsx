import React, { useState } from 'react'
import { RadioGroup, Card, CodeSnippet } from '@toolcase/react-components'

const RadioGroupDemo: React.FC = () => {
	const [plan, setPlan] = useState('pro')
	const [region, setRegion] = useState('eu')

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">RadioGroup</h1>
					<p className="text-muted mb-0">A labeled group of radio buttons for single-select from an options array.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Vertical</h2>
						<RadioGroup
							label="Plan"
							options={[
								{ value: 'free', label: 'Free' },
								{ value: 'pro', label: 'Pro' },
								{ value: 'enterprise', label: 'Enterprise' },
							]}
							value={plan}
							onChange={setPlan}
						/>
						<p className="text-muted mt-2 mb-0" style={{ fontSize: '0.8rem' }}>Selected: {plan}</p>
					</Card>
				</div>
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Inline</h2>
						<RadioGroup
							label="Region"
							options={[
								{ value: 'us', label: 'US East' },
								{ value: 'eu', label: 'EU West' },
								{ value: 'ap', label: 'Asia Pacific' },
							]}
							value={region}
							onChange={setRegion}
							inline
						/>
						<p className="text-muted mt-2 mb-0" style={{ fontSize: '0.8rem' }}>Selected: {region}</p>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">With Disabled Option</h2>
						<RadioGroup
							label="Environment"
							options={[
								{ value: 'dev', label: 'Development' },
								{ value: 'staging', label: 'Staging' },
								{ value: 'prod', label: 'Production', disabled: true },
							]}
							value="dev"
							onChange={() => {}}
						/>
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
							code={`import { RadioGroup } from '@webgame-cloud/react-components'

const options = [
  { label: 'Small', value: 'sm' },
  { label: 'Medium', value: 'md' },
  { label: 'Large', value: 'lg' },
]

<RadioGroup label="Size" options={options} value={size} onChange={setSize} />`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default RadioGroupDemo
