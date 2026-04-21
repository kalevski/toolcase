import React, { useState } from 'react'
import { Select, Card, CodeSnippet } from '@toolcase/react-components'

const SelectDemo: React.FC = () => {
	const [engine, setEngine] = useState('unity')

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Select</h1>
					<p className="text-muted mb-0">A labeled dropdown select with options array.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Basic</h2>
						<div className="d-flex flex-column gap-3">
							<Select
								label="Game Engine"
								options={[
									{ value: 'unity', label: 'Unity' },
									{ value: 'godot', label: 'Godot' },
									{ value: 'unreal', label: 'Unreal Engine' },
									{ value: 'phaser', label: 'Phaser' },
								]}
								value={engine}
								onChange={(e) => setEngine(e.target.value)}
							/>
							<Select
								label="Category"
								options={[
									{ value: 'sprites', label: 'Sprites' },
									{ value: 'audio', label: 'Audio' },
									{ value: 'data', label: 'Data' },
								]}
							/>
						</div>
					</Card>
				</div>
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">States</h2>
						<div className="d-flex flex-column gap-3">
							<Select
								label="Enabled"
								options={[
									{ value: '1', label: 'Option 1' },
									{ value: '2', label: 'Option 2' },
								]}
							/>
							<Select
								label="Disabled"
								options={[
									{ value: '1', label: 'Option 1' },
								]}
								disabled
							/>
						</div>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Without Label</h2>
						<Select
							options={[
								{ value: 'asc', label: 'Sort: A → Z' },
								{ value: 'desc', label: 'Sort: Z → A' },
								{ value: 'date', label: 'Sort: Newest' },
							]}
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
							code={`import { Select } from '@toolcase/react-components'

<Select
  label="Country"
  options={[
    { value: 'us', label: 'United States' },
    { value: 'uk', label: 'United Kingdom' },
  ]}
/>`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default SelectDemo
