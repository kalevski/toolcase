import React, { useState } from 'react'
import { NodeEditor, Card, CodeSnippet } from '../../src'

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
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">NodeEditor</h1>
					<p className="text-muted mb-4">A visual node-based editor for branching dialogues, conditions, and exec nodes with JSON output.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Controlled</h2>
						<div className="row g-3">
							<div className="col-md-6">
								<NodeEditor value={value} onChange={setValue} />
							</div>
							<div className="col-md-6">
								<h6 className="text-muted mb-2">Output</h6>
								<pre
									className="p-3 bg-light rounded"
									style={{ fontSize: '0.72rem', whiteSpace: 'pre-wrap', maxHeight: 600, overflow: 'auto' }}
								>
									{prettyJson}
								</pre>
							</div>
						</div>
					</Card>
				</div>
			</div>

			<div className="row mb-5 g-4">
				<div className="col-md-6">
					<Card>
						<h2 className="h5 mb-3">Empty (uncontrolled)</h2>
						<NodeEditor onChange={v => console.log('uncontrolled:', v)} />
					</Card>
				</div>
				<div className="col-md-6">
					<Card>
						<h2 className="h5 mb-3">Disabled</h2>
						<NodeEditor value={INITIAL_VALUE} disabled />
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
							code={`import { NodeEditor } from '@webgame-cloud/react-components'

const [value, setValue] = useState(initialJson)

<NodeEditor value={value} onChange={setValue} />`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default NodeEditorDemo
