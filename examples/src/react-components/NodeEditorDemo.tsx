import React, { useState } from 'react'
import { NodeEditor } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const INITIAL_VALUE = JSON.stringify({
	context: { points: 5 },
	initialId: '1',
	nodes: [
		{
			id: '1', actor: 'Player1', key: 'node_1', type: 'branch',
			value: 'Choose your path',
			options: [
				{ key: 'option_a', value: 'option a' },
				{ key: 'option_b', value: 'option b' },
				{ key: 'option_c', value: 'option c' },
			],
		},
		{ id: '2', actor: 'Player1', key: 'node_2', type: 'exec', eval: 'ctx.points = 15' },
		{ id: '3', actor: 'Player1', key: 'node_3', type: 'condition', value: 'Check points', eval: 'ctx.points > 10' },
		{ id: '4', actor: 'Player1', key: 'node_4', type: 'base', value: 'You win!' },
		{ id: '5', actor: 'Player1', key: 'node_5', type: 'base', value: 'Try again' },
		{ id: '6', actor: 'Player1', key: 'node_6', type: 'exec', eval: 'ctx.points += 5' },
	],
	edges: [
		{ from: '1', to: '2', trigger: 'option_a' },
		{ from: '1', to: '5', trigger: 'option_b' },
		{ from: '1', to: '5', trigger: 'option_c' },
		{ from: '2', to: '3' },
		{ from: '3', to: '4', trigger: 'true' },
		{ from: '3', to: '5', trigger: 'false' },
		{ from: '5', to: '1' },
	],
})

const NodeEditorDemo = () => {
	const [value, setValue] = useState(INITIAL_VALUE)

	let prettyJson = ''
	try {
		prettyJson = JSON.stringify(JSON.parse(value), null, 2)
	} catch {
		prettyJson = value
	}

	return (
		<DemoPage
			eyebrow="Editors"
			title="NodeEditor"
			lede="A visual node-based editor for branching dialogues, conditions, and exec nodes with JSON output."
		>
			<DemoSection title="Controlled">
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
					<NodeEditor value={value} onChange={setValue} />
					<div>
						<h6 style={{ color: '#64748b', marginBottom: 8 }}>Output</h6>
						<pre
							style={{ padding: 12, background: '#f8fafc', fontSize: '0.72rem', whiteSpace: 'pre-wrap', maxHeight: 600, overflow: 'auto' }}
						>
							{prettyJson}
						</pre>
					</div>
				</div>
			</DemoSection>

			<DemoSection title="Empty (uncontrolled)">
				<NodeEditor onChange={v => console.log('uncontrolled:', v)} />
			</DemoSection>

			<DemoSection title="Disabled">
				<NodeEditor value={INITIAL_VALUE} disabled />
			</DemoSection>
		</DemoPage>
	)
}

export default NodeEditorDemo
