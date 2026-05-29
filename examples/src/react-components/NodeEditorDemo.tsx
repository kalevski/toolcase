import React, { useState } from 'react'
import {
	NodeEditor,
	useNodeEditor,
	NODE_TYPES,
	NodeType,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Button,
	Icon,
} from '@toolcase/react-components'

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

/* Toolbar + inspector are now consumer-owned, built on the headless hook. */
const FullEditor: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
	const { graph, actions, selection, view } = useNodeEditor({ value, onChange })
	const node = selection.node

	const [contextRaw, setContextRaw] = useState(() => JSON.stringify(graph.context, null, 2))
	const [contextError, setContextError] = useState(false)
	const onContext = (text: string) => {
		setContextRaw(text)
		try {
			actions.setContext(JSON.parse(text))
			setContextError(false)
		} catch {
			setContextError(true)
		}
	}

	const label = (id: string) => {
		const n = graph.nodes.find(x => x.id === id)
		return n ? n.key || n.id : id
	}

	return (
		<div>
			{/* toolbar */}
			<div className="d-flex align-items-center gap-2 flex-wrap mb-2">
				<Button variant="primary" size="small" onClick={() => actions.addNode()}>
					<Icon name="plus-lg" /> Node
				</Button>
				<div className="d-flex align-items-center gap-1">
					<small className="text-muted text-uppercase">Initial</small>
					<select className="form-select form-select-sm" style={{ width: 'auto' }} value={graph.initialId}
						onChange={e => actions.setInitialId(e.target.value)}>
						<option value="">—</option>
						{graph.nodes.map(n => <option key={n.id} value={n.id}>{n.key || n.id}</option>)}
					</select>
				</div>
				<div className="d-flex align-items-center gap-1 flex-grow-1" style={{ minWidth: 180 }}>
					<small className="text-muted text-uppercase">Context</small>
					<input type="text" className={`form-control form-control-sm font-monospace${contextError ? ' is-invalid' : ''}`}
						value={contextRaw} onChange={e => onContext(e.target.value)} />
				</div>
			</div>

			<div className="d-flex flex-column flex-md-row gap-3">
				<div className="flex-grow-1">
					<NodeEditor {...view} />
				</div>

				{/* inspector */}
				<div style={{ width: 280, flexShrink: 0 }}>
					{!node ? (
						<div className="text-muted text-center p-4 border">Select a node to edit</div>
					) : (
						<div className="d-flex flex-column gap-2 p-3 border">
							<div className="d-flex align-items-center gap-2">
								<span className="badge text-bg-secondary text-uppercase">{node.type}</span>
								<span className="fw-semibold flex-grow-1 text-truncate">{node.key || node.id}</span>
								<Button variant="danger" outline size="small" onClick={() => actions.removeNode(node.id)}>
									<Icon name="trash" />
								</Button>
							</div>

							<label className="small text-muted text-uppercase">Key</label>
							<input className="form-control form-control-sm" value={node.key}
								onChange={e => actions.updateNode(node.id, { key: e.target.value })} />

							<label className="small text-muted text-uppercase">Type</label>
							<select className="form-select form-select-sm" value={node.type}
								onChange={e => actions.updateNode(node.id, { type: e.target.value as NodeType })}>
								{NODE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
							</select>

							<label className="small text-muted text-uppercase">Actor</label>
							<input className="form-control form-control-sm" value={node.actor}
								onChange={e => actions.updateNode(node.id, { actor: e.target.value })} />

							{(node.type === 'base' || node.type === 'branch' || node.type === 'condition') && (
								<>
									<label className="small text-muted text-uppercase">Value</label>
									<input className="form-control form-control-sm" value={node.value ?? ''}
										onChange={e => actions.updateNode(node.id, { value: e.target.value })} />
								</>
							)}
							{(node.type === 'exec' || node.type === 'condition') && (
								<>
									<label className="small text-muted text-uppercase">Eval</label>
									<input className="form-control form-control-sm font-monospace" value={node.eval ?? ''}
										onChange={e => actions.updateNode(node.id, { eval: e.target.value })} />
								</>
							)}
							{node.type === 'branch' && (
								<>
									<label className="small text-muted text-uppercase">Options</label>
									{(node.options ?? []).map((opt, oi) => (
										<div className="d-flex gap-1 align-items-center" key={oi}>
											<input className="form-control form-control-sm" placeholder="key" value={opt.key}
												onChange={e => actions.updateOption(node.id, oi, { key: e.target.value })} />
											<input className="form-control form-control-sm" placeholder="value" value={opt.value}
												onChange={e => actions.updateOption(node.id, oi, { value: e.target.value })} />
											<Button variant="danger" outline size="small" onClick={() => actions.removeOption(node.id, oi)}>
												<Icon name="x-lg" />
											</Button>
										</div>
									))}
									<Button variant="secondary" outline size="small" className="mt-1" onClick={() => actions.addOption(node.id)}>
										<Icon name="plus" /> Option
									</Button>
								</>
							)}

							{/* edges touching this node */}
							<label className="small text-muted text-uppercase border-top pt-2">Edges</label>
							{graph.edges.map((edge, idx) => {
								if (edge.from !== node.id && edge.to !== node.id) return null
								const triggers = actions.getTriggerOptions(edge.from)
								return (
									<div className="d-flex align-items-center gap-1" key={idx}>
										<select className="form-select form-select-sm" value={edge.from}
											onChange={e => actions.updateEdge(idx, { from: e.target.value })}>
											{graph.nodes.map(n => <option key={n.id} value={n.id}>{label(n.id)}</option>)}
										</select>
										<Icon name="arrow-right" className="text-muted" />
										<select className="form-select form-select-sm" value={edge.to}
											onChange={e => actions.updateEdge(idx, { to: e.target.value })}>
											{graph.nodes.map(n => <option key={n.id} value={n.id}>{label(n.id)}</option>)}
										</select>
										{triggers.length > 0 && (
											<select className="form-select form-select-sm" style={{ maxWidth: 100 }} value={edge.trigger ?? ''}
												onChange={e => actions.updateEdge(idx, { trigger: e.target.value })}>
												<option value="">—</option>
												{triggers.map(t => <option key={t} value={t}>{t}</option>)}
											</select>
										)}
										<Button variant="danger" outline size="small" onClick={() => actions.removeEdge(idx)}>
											<Icon name="x-lg" />
										</Button>
									</div>
								)
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

const NodeEditorDemo = () => {
	const [value, setValue] = useState(INITIAL_VALUE)

	let prettyJson: string
	try {
		prettyJson = JSON.stringify(JSON.parse(value), null, 2)
	} catch {
		prettyJson = value
	}

	return (
		<div className="container py-4">
			<div className="row">
				<div className="col-12">
					<RichPageHeader
						chips={<RichPageHeaderChip>Editors</RichPageHeaderChip>}
						title="NodeEditor"
						description="Headless node-graph editor: useNodeEditor() owns state + mutations, the NodeEditor canvas renders pan/zoom/touch. Toolbar and inspector are consumer-built."
					/>
					<div className="d-flex flex-column gap-4 mt-4">
						<SectionCard title="Headless (consumer toolbar + inspector)">
							<FullEditor value={value} onChange={setValue} />
						</SectionCard>

						<SectionCard title="JSON output">
							<pre style={{ padding: 12, background: '#f8fafc', fontSize: '0.72rem', whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>
								{prettyJson}
							</pre>
						</SectionCard>

						<SectionCard title="Canvas only (read-only view)">
							<ReadOnlyCanvas value={INITIAL_VALUE} />
						</SectionCard>
					</div>
				</div>
			</div>
		</div>
	)
}

const ReadOnlyCanvas: React.FC<{ value: string }> = ({ value }) => {
	const { view } = useNodeEditor({ value, disabled: true })
	return <NodeEditor {...view} disabled />
}

export default NodeEditorDemo
