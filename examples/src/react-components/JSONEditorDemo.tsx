import React, { useState } from 'react'
import { JSONEditor, Card, CodeSnippet } from '@toolcase/react-components'

const SCHEMA = JSON.stringify([
	{
		key: 'players',
		type: 'array',
		properties: [
			{ key: 'name', type: 'string', defaultValue: '' },
			{ key: 'score', type: 'number', defaultValue: 0 },
		],
	},
	{
		key: 'worlds',
		type: 'array',
		properties: [
			{ key: 'name', type: 'string', defaultValue: '' },
			{ key: 'size', type: 'number', defaultValue: 100 },
			{ key: 'isActive', type: 'boolean', defaultValue: true },
		],
	},
	{ key: 'version', type: 'string', defaultValue: '' },
])

const DEEP_SCHEMA = JSON.stringify([
	{ key: 'title', type: 'string', defaultValue: '' },
	{
		key: 'game',
		type: 'object',
		properties: [
			{ key: 'name', type: 'string', defaultValue: '' },
			{ key: 'maxPlayers', type: 'number', defaultValue: 4 },
			{
				key: 'settings',
				type: 'object',
				properties: [
					{ key: 'difficulty', type: 'string', defaultValue: 'normal' },
					{ key: 'pvpEnabled', type: 'boolean', defaultValue: false },
					{
						key: 'world',
						type: 'object',
						properties: [
							{ key: 'seed', type: 'number', defaultValue: 0 },
							{ key: 'biome', type: 'string', defaultValue: 'forest' },
							{
								key: 'weather',
								type: 'object',
								properties: [
									{ key: 'type', type: 'string', defaultValue: 'clear' },
									{ key: 'intensity', type: 'number', defaultValue: 1 },
									{
										key: 'effects',
										type: 'object',
										properties: [
											{ key: 'fog', type: 'boolean', defaultValue: false },
											{ key: 'wind', type: 'number', defaultValue: 5 },
											{ key: 'particleColor', type: 'string', defaultValue: '#ffffff' },
										],
									},
								],
							},
						],
					},
				],
			},
		],
	},
])

const DEEP_VALUES = {
	title: 'My Adventure',
	game: {
		name: 'Lost Kingdom',
		maxPlayers: 8,
		settings: {
			difficulty: 'hard',
			pvpEnabled: true,
			world: {
				seed: 42,
				biome: 'desert',
				weather: {
					type: 'storm',
					intensity: 3,
					effects: {
						fog: true,
						wind: 12,
						particleColor: '#aabbcc',
					},
				},
			},
		},
	},
}

const INITIAL_VALUES = {
	version: '1.0',
	players: [
		{ name: 'Alice', score: 1500 },
		{ name: 'Bob', score: 1200 },
	],
	worlds: [
		{ name: 'Earth', size: 12742, isActive: true },
		{ name: 'Mars', size: 6779, isActive: false },
	],
}

const JSONEditorDemo = () => {
	const [values, setValues] = useState(INITIAL_VALUES)
	const [deepValues, setDeepValues] = useState(DEEP_VALUES)

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">JSONEditor</h1>
					<p className="text-muted mb-4">A schema-driven JSON editor supporting arrays, objects, nested structures, and disabled states.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Arrays &amp; Primitives</h2>
						<div className="row g-3">
							<div className="col-md-6">
								<JSONEditor
									schema={SCHEMA}
									value={values}
									onChange={(v) => setValues(v as typeof values)}
								/>
							</div>
							<div className="col-md-6">
								<h6 className="text-muted mb-2">Output</h6>
								<pre className="p-3 bg-light rounded" style={{ fontSize: '0.78rem', whiteSpace: 'pre-wrap' }}>
									{JSON.stringify(values, null, 2)}
								</pre>
							</div>
						</div>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Deep Nesting (5 levels)</h2>
						<div className="row g-3">
							<div className="col-md-6">
								<JSONEditor
									schema={DEEP_SCHEMA}
									value={deepValues}
									onChange={(v) => setDeepValues(v as typeof deepValues)}
								/>
							</div>
							<div className="col-md-6">
								<h6 className="text-muted mb-2">Output</h6>
								<pre className="p-3 bg-light rounded" style={{ fontSize: '0.78rem', whiteSpace: 'pre-wrap' }}>
									{JSON.stringify(deepValues, null, 2)}
								</pre>
							</div>
						</div>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-md-6">
					<Card>
						<h2 className="h5 mb-3">Disabled</h2>
						<JSONEditor
							schema={SCHEMA}
							value={INITIAL_VALUES}
							disabled
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
							code={`import { JSONEditor } from '@webgame-cloud/react-components'

const schema = JSON.stringify([
  { key: 'name', type: 'string', defaultValue: '' },
  { key: 'score', type: 'number', defaultValue: 0 },
])

<JSONEditor schema={schema} value={values} onChange={setValues} />`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default JSONEditorDemo
