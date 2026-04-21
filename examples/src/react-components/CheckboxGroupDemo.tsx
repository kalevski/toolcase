import React, { useState } from 'react'
import { CheckboxGroup, Card, CodeSnippet } from '@toolcase/react-components'

const CheckboxGroupDemo: React.FC = () => {
	const [features, setFeatures] = useState<string[]>(['multiplayer', 'leaderboards'])
	const [inline, setInline] = useState<string[]>(['sm'])

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">CheckboxGroup</h1>
					<p className="text-muted mb-0">A labeled group of checkboxes for multi-select from an options array.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Vertical</h2>
						<CheckboxGroup
							label="Game Features"
							options={[
								{ value: 'multiplayer', label: 'Multiplayer' },
								{ value: 'leaderboards', label: 'Leaderboards' },
								{ value: 'achievements', label: 'Achievements' },
								{ value: 'cloud-save', label: 'Cloud Saves' },
							]}
							value={features}
							onChange={setFeatures}
						/>
						<p className="text-muted mt-2 mb-0" style={{ fontSize: '0.8rem' }}>Selected: {features.join(', ') || 'none'}</p>
					</Card>
				</div>
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Inline</h2>
						<CheckboxGroup
							label="Screen Sizes"
							options={[
								{ value: 'sm', label: 'Small' },
								{ value: 'md', label: 'Medium' },
								{ value: 'lg', label: 'Large' },
								{ value: 'xl', label: 'Extra Large' },
							]}
							value={inline}
							onChange={setInline}
							inline
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">With Disabled Option</h2>
						<CheckboxGroup
							label="Platforms"
							options={[
								{ value: 'web', label: 'Web' },
								{ value: 'mobile', label: 'Mobile' },
								{ value: 'desktop', label: 'Desktop', disabled: true },
								{ value: 'console', label: 'Console', disabled: true },
							]}
							value={['web']}
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
							code={`import { CheckboxGroup } from '@toolcase/react-components'

const options = [
  { label: 'React', value: 'react' },
  { label: 'Vue', value: 'vue' },
  { label: 'Angular', value: 'angular' },
]

<CheckboxGroup
  label="Frameworks"
  options={options}
  value={selected}
  onChange={setSelected}
/>`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default CheckboxGroupDemo
