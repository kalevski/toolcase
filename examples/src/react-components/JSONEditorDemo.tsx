import React, { useState } from 'react'
import { JSONEditor } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

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
		<DemoPage
			eyebrow="Editors"
			title="JSONEditor"
			lede="A schema-driven JSON editor supporting arrays, objects, nested structures, and disabled states."
		>
			<DemoSection title="Arrays & Primitives">
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
					<JSONEditor
						schema={SCHEMA}
						value={values}
						onChange={(v) => setValues(v as typeof values)}
					/>
					<div>
						<h6 style={{ color: '#64748b', marginBottom: 8 }}>Output</h6>
						<pre style={{ padding: 12, background: '#f8fafc', fontSize: '0.78rem', whiteSpace: 'pre-wrap' }}>
							{JSON.stringify(values, null, 2)}
						</pre>
					</div>
				</div>
			</DemoSection>

			<DemoSection title="Deep Nesting (5 levels)">
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
					<JSONEditor
						schema={DEEP_SCHEMA}
						value={deepValues}
						onChange={(v) => setDeepValues(v as typeof deepValues)}
					/>
					<div>
						<h6 style={{ color: '#64748b', marginBottom: 8 }}>Output</h6>
						<pre style={{ padding: 12, background: '#f8fafc', fontSize: '0.78rem', whiteSpace: 'pre-wrap' }}>
							{JSON.stringify(deepValues, null, 2)}
						</pre>
					</div>
				</div>
			</DemoSection>

			<DemoSection title="Disabled">
				<JSONEditor
					schema={SCHEMA}
					value={INITIAL_VALUES}
					disabled
				/>
			</DemoSection>
		</DemoPage>
	)
}

export default JSONEditorDemo
