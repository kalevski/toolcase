import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Icon } from './Icon'
import { Button } from './Button'
import { Skeleton } from './Skeleton'

export type NodeType = 'base' | 'branch' | 'exec' | 'condition'

export interface NodeOption {
	key: string
	value: string
}

export interface GraphNode {
	id: string
	actor: string
	key: string
	type: NodeType
	value?: string
	eval?: string
	options?: NodeOption[]
}

export interface GraphEdge {
	from: string
	to: string
	trigger?: string
}

export interface GraphData {
	context: Record<string, unknown>
	initialId: string
	nodes: GraphNode[]
	edges: GraphEdge[]
}

export interface NodeEditorProps {
	value?: string
	defaultValue?: string
	onChange?: (value: string) => void
	disabled?: boolean
	className?: string
	loading?: boolean
}

const NODE_TYPES: NodeType[] = ['base', 'branch', 'exec', 'condition']
const NODE_W = 180
const NODE_H = 60
const TYPE_COLORS: Record<NodeType, string> = {
	base: '#00b5d8',
	branch: '#38a169',
	exec: '#e53e3e',
	condition: '#dd6b20',
}

let _nextId = 1
const genId = () => String(_nextId++)

interface Pos { x: number; y: number }

const parseGraph = (raw: string): GraphData => {
	try {
		const parsed = JSON.parse(raw)
		if (parsed && typeof parsed === 'object' && Array.isArray(parsed.nodes)) {
			for (const n of parsed.nodes) {
				const num = parseInt(n.id, 10)
				if (!isNaN(num) && num >= _nextId) _nextId = num + 1
			}
			return parsed as GraphData
		}
	} catch { /* ignore */ }
	return { context: {}, initialId: '', nodes: [], edges: [] }
}

const autoLayout = (nodes: GraphNode[], existing: Record<string, Pos>): Record<string, Pos> => {
	const positions = { ...existing }
	const cols = 3
	let idx = Object.keys(existing).length
	for (const n of nodes) {
		if (positions[n.id]) continue
		const col = idx % cols
		const row = Math.floor(idx / cols)
		positions[n.id] = { x: 40 + col * (NODE_W + 60), y: 40 + row * (NODE_H + 80) }
		idx++
	}
	return positions
}

export const NodeEditor: React.FC<NodeEditorProps> = ({
	value,
	defaultValue = '{"context":{},"initialId":"","nodes":[],"edges":[]}',
	onChange,
	disabled = false,
	className = '',
	loading = false,
}) => {
	const isControlled = value !== undefined
	const [internal, setInternal] = useState(defaultValue)
	const raw = isControlled ? value : internal
	const graph = parseGraph(raw)

	const [positions, setPositions] = useState<Record<string, Pos>>(() => autoLayout(graph.nodes, {}))
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
	const [connecting, setConnecting] = useState<{ fromId: string; mouse: Pos } | null>(null)
	const canvasRef = useRef<HTMLDivElement>(null)

	// keep positions in sync when nodes change
	useEffect(() => {
		setPositions(prev => autoLayout(graph.nodes, prev))
	}, [graph.nodes.length])

	const emit = useCallback(
		(next: GraphData) => {
			const serialized = JSON.stringify(next)
			if (!isControlled) setInternal(serialized)
			onChange?.(serialized)
		},
		[isControlled, onChange],
	)

	// --- Node CRUD ---
	const addNode = () => {
		const id = genId()
		const node: GraphNode = { id, actor: '', key: `node_${id}`, type: 'base', value: '' }
		const next = { ...graph, nodes: [...graph.nodes, node] }
		if (!next.initialId) next.initialId = id
		setSelectedId(id)
		emit(next)
	}

	const removeNode = (id: string) => {
		const nodes = graph.nodes.filter(n => n.id !== id)
		const edges = graph.edges.filter(e => e.from !== id && e.to !== id)
		const initialId = graph.initialId === id ? (nodes[0]?.id ?? '') : graph.initialId
		if (selectedId === id) setSelectedId(null)
		setPositions(prev => { const p = { ...prev }; delete p[id]; return p })
		emit({ ...graph, nodes, edges, initialId })
	}

	const updateNode = (id: string, patch: Partial<GraphNode>) => {
		const nodes = graph.nodes.map(n => {
			if (n.id !== id) return n
			const updated = { ...n, ...patch }
			if (patch.type && patch.type !== n.type) {
				if (patch.type === 'base') { delete updated.eval; delete updated.options; updated.value = updated.value ?? '' }
				else if (patch.type === 'branch') { delete updated.eval; updated.value = updated.value ?? ''; updated.options = updated.options ?? [] }
				else if (patch.type === 'exec') { delete updated.value; delete updated.options; updated.eval = updated.eval ?? '' }
				else if (patch.type === 'condition') { delete updated.options; updated.value = updated.value ?? ''; updated.eval = updated.eval ?? '' }
			}
			return updated
		})
		emit({ ...graph, nodes })
	}

	// --- Options ---
	const addOption = (nodeId: string) => {
		const nodes = graph.nodes.map(n => {
			if (n.id !== nodeId) return n
			return { ...n, options: [...(n.options ?? []), { key: `opt_${(n.options?.length ?? 0) + 1}`, value: '' }] }
		})
		emit({ ...graph, nodes })
	}

	const removeOption = (nodeId: string, optIdx: number) => {
		const node = graph.nodes.find(n => n.id === nodeId)
		const removedKey = node?.options?.[optIdx]?.key
		const nodes = graph.nodes.map(n => {
			if (n.id !== nodeId) return n
			return { ...n, options: (n.options ?? []).filter((_, i) => i !== optIdx) }
		})
		const edges = removedKey
			? graph.edges.filter(e => !(e.from === nodeId && e.trigger === removedKey))
			: graph.edges
		emit({ ...graph, nodes, edges })
	}

	const updateOption = (nodeId: string, optIdx: number, patch: Partial<NodeOption>) => {
		const nodes = graph.nodes.map(n => {
			if (n.id !== nodeId) return n
			return { ...n, options: (n.options ?? []).map((o, i) => (i === optIdx ? { ...o, ...patch } : o)) }
		})
		emit({ ...graph, nodes })
	}

	// --- Edges ---
	const addEdge = (from: string, to: string) => {
		if (from === to) return
		emit({ ...graph, edges: [...graph.edges, { from, to }] })
	}

	const removeEdge = (idx: number) => {
		emit({ ...graph, edges: graph.edges.filter((_, i) => i !== idx) })
	}

	const updateEdge = (idx: number, patch: Partial<GraphEdge>) => {
		const edges = graph.edges.map((e, i) => {
			if (i !== idx) return e
			const updated = { ...e, ...patch }
			if (updated.trigger === '') delete updated.trigger
			return updated
		})
		emit({ ...graph, edges })
	}

	// --- Context ---
	const [contextRaw, setContextRaw] = useState(() => JSON.stringify(graph.context, null, 2))
	const [contextError, setContextError] = useState(false)
	const handleContextChange = (text: string) => {
		setContextRaw(text)
		try { const parsed = JSON.parse(text); setContextError(false); emit({ ...graph, context: parsed }) }
		catch { setContextError(true) }
	}

	const getTriggerOptions = (fromId: string): string[] => {
		const node = graph.nodes.find(n => n.id === fromId)
		if (!node) return []
		if (node.type === 'branch') return (node.options ?? []).map(o => o.key)
		if (node.type === 'condition') return ['true', 'false']
		return []
	}

	const nodeLabel = (n: GraphNode) => n.key || n.id

	// --- Drag handlers ---
	const onNodeMouseDown = (e: React.MouseEvent, id: string) => {
		if (disabled || e.button !== 0) return
		e.stopPropagation()
		const rect = canvasRef.current!.getBoundingClientRect()
		const pos = positions[id] ?? { x: 0, y: 0 }
		setDragging({ id, offsetX: e.clientX - rect.left - pos.x, offsetY: e.clientY - rect.top - pos.y })
		setSelectedId(id)
	}

	const onCanvasMouseMove = (e: React.MouseEvent) => {
		if (dragging) {
			const rect = canvasRef.current!.getBoundingClientRect()
			const x = Math.max(0, e.clientX - rect.left - dragging.offsetX)
			const y = Math.max(0, e.clientY - rect.top - dragging.offsetY)
			setPositions(prev => ({ ...prev, [dragging.id]: { x, y } }))
		}
		if (connecting) {
			const rect = canvasRef.current!.getBoundingClientRect()
			setConnecting(prev => prev ? { ...prev, mouse: { x: e.clientX - rect.left, y: e.clientY - rect.top } } : null)
		}
	}

	const onCanvasMouseUp = (e: React.MouseEvent) => {
		if (connecting) {
			// check if mouse is over a node
			const rect = canvasRef.current!.getBoundingClientRect()
			const mx = e.clientX - rect.left
			const my = e.clientY - rect.top
			for (const n of graph.nodes) {
				const p = positions[n.id]
				if (!p) continue
				if (mx >= p.x && mx <= p.x + NODE_W && my >= p.y && my <= p.y + NODE_H) {
					if (n.id !== connecting.fromId) {
						addEdge(connecting.fromId, n.id)
					}
					break
				}
			}
			setConnecting(null)
		}
		setDragging(null)
	}

	const onConnectStart = (e: React.MouseEvent, fromId: string) => {
		if (disabled) return
		e.stopPropagation()
		e.preventDefault()
		const rect = canvasRef.current!.getBoundingClientRect()
		setConnecting({ fromId, mouse: { x: e.clientX - rect.left, y: e.clientY - rect.top } })
	}

	// --- Edge path ---
	const edgePath = (fromPos: Pos, toPos: Pos) => {
		const x1 = fromPos.x + NODE_W
		const y1 = fromPos.y + NODE_H / 2
		const x2 = toPos.x
		const y2 = toPos.y + NODE_H / 2
		const cx = (x1 + x2) / 2
		return `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`
	}

	const selectedNode = graph.nodes.find(n => n.id === selectedId) ?? null

	// --- Render detail panel for selected node ---
	const renderDetailPanel = () => {
		if (!selectedNode) return (
			<div className="component-node-editor__panel-empty">Select a node to edit</div>
		)
		const node = selectedNode
		return (
			<div className="component-node-editor__panel-content">
				<div className="component-node-editor__panel-header">
					<span className="component-node-editor__node-type-badge component-node-editor__node-type-badge--panel" data-type={node.type}>{node.type}</span>
					<span className="component-node-editor__panel-title">{nodeLabel(node)}</span>
					<Button variant="danger" outline size="small" className="component-node-editor__icon-btn ms-auto" disabled={disabled}
						onClick={() => removeNode(node.id)}><Icon name="trash" /></Button>
				</div>

				<div className="component-node-editor__panel-fields">
					<div className="component-node-editor__field">
						<label className="component-node-editor__field-label">Key</label>
						<input type="text" className="form-control form-control-sm" value={node.key} disabled={disabled}
							onChange={e => updateNode(node.id, { key: e.target.value })} />
					</div>
					<div className="component-node-editor__field">
						<label className="component-node-editor__field-label">Type</label>
						<select className="form-select form-select-sm" value={node.type} disabled={disabled}
							onChange={e => updateNode(node.id, { type: e.target.value as NodeType })}>
							{NODE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
						</select>
					</div>
					<div className="component-node-editor__field">
						<label className="component-node-editor__field-label">Actor</label>
						<input type="text" className="form-control form-control-sm" value={node.actor} disabled={disabled}
							onChange={e => updateNode(node.id, { actor: e.target.value })} />
					</div>

					{/* type-specific */}
					{(node.type === 'base' || node.type === 'branch' || node.type === 'condition') && (
						<div className="component-node-editor__field">
							<label className="component-node-editor__field-label">Value</label>
							<input type="text" className="form-control form-control-sm" value={node.value ?? ''} disabled={disabled}
								onChange={e => updateNode(node.id, { value: e.target.value })} />
						</div>
					)}
					{(node.type === 'exec' || node.type === 'condition') && (
						<div className="component-node-editor__field">
							<label className="component-node-editor__field-label">Eval</label>
							<input type="text" className="form-control form-control-sm font-monospace" value={node.eval ?? ''} disabled={disabled}
								onChange={e => updateNode(node.id, { eval: e.target.value })} />
						</div>
					)}
					{node.type === 'branch' && (
						<div className="component-node-editor__options">
							<label className="component-node-editor__field-label">Options</label>
							{(node.options ?? []).map((opt, oi) => (
								<div className="component-node-editor__option-row" key={oi}>
									<input type="text" className="form-control form-control-sm" placeholder="key" value={opt.key} disabled={disabled}
										onChange={e => updateOption(node.id, oi, { key: e.target.value })} />
									<input type="text" className="form-control form-control-sm" placeholder="value" value={opt.value} disabled={disabled}
										onChange={e => updateOption(node.id, oi, { value: e.target.value })} />
									<Button variant="danger" outline size="small" className="component-node-editor__icon-btn" disabled={disabled}
										onClick={() => removeOption(node.id, oi)}><Icon name="x-lg" /></Button>
								</div>
							))}
							<Button variant="secondary" outline size="small" className="mt-1" disabled={disabled}
								onClick={() => addOption(node.id)}><Icon name="plus" /> Option</Button>
						</div>
					)}
				</div>

				{/* Edges from/to this node */}
				<div className="component-node-editor__panel-edges">
					<label className="component-node-editor__field-label">Edges</label>
					{graph.edges.map((edge, idx) => {
						if (edge.from !== node.id && edge.to !== node.id) return null
						const triggers = getTriggerOptions(edge.from)
						return (
							<div className="component-node-editor__edge-row" key={idx}>
								<select className="form-select form-select-sm" value={edge.from} disabled={disabled}
									onChange={e => updateEdge(idx, { from: e.target.value })}>
									{graph.nodes.map(n => <option key={n.id} value={n.id}>{nodeLabel(n)}</option>)}
								</select>
								<Icon name="arrow-right" className="component-node-editor__edge-arrow" />
								<select className="form-select form-select-sm" value={edge.to} disabled={disabled}
									onChange={e => updateEdge(idx, { to: e.target.value })}>
									{graph.nodes.map(n => <option key={n.id} value={n.id}>{nodeLabel(n)}</option>)}
								</select>
								{triggers.length > 0 && (
									<select className="form-select form-select-sm component-node-editor__edge-trigger" value={edge.trigger ?? ''} disabled={disabled}
										onChange={e => updateEdge(idx, { trigger: e.target.value })}>
										<option value="">—</option>
										{triggers.map(t => <option key={t} value={t}>{t}</option>)}
									</select>
								)}
								<Button variant="danger" outline size="small" className="component-node-editor__icon-btn" disabled={disabled}
									onClick={() => removeEdge(idx)}><Icon name="x-lg" /></Button>
							</div>
						)
					})}
				</div>
			</div>
		)
	}

	if (loading) {
		return (
			<div className={`component component-node-editor${className ? ` ${className}` : ''}`}>
				<div className="component-node-editor__toolbar">
					<Skeleton width="5rem" height="2rem" />
				</div>
				<div style={{ padding: '2rem' }}>
					<Skeleton shape="rect" width="100%" height="300px" />
				</div>
			</div>
		)
	}

	return (
		<div className={`component component-node-editor${className ? ` ${className}` : ''}`}>
			{/* Toolbar */}
			<div className="component-node-editor__toolbar">
				<Button variant="primary" size="small" disabled={disabled} onClick={addNode}>
					<Icon name="plus-lg" /> Node
				</Button>
				<div className="component-node-editor__toolbar-sep"></div>
				<div className="component-node-editor__field component-node-editor__field--inline">
					<label className="component-node-editor__field-label">Initial</label>
					<select className="form-select form-select-sm" value={graph.initialId} disabled={disabled}
						onChange={e => emit({ ...graph, initialId: e.target.value })}>
						<option value="">—</option>
						{graph.nodes.map(n => <option key={n.id} value={n.id}>{nodeLabel(n)}</option>)}
					</select>
				</div>
				<div className="component-node-editor__toolbar-sep"></div>
				<div className="component-node-editor__field component-node-editor__field--inline component-node-editor__field--ctx">
					<label className="component-node-editor__field-label">Context</label>
					<input type="text" className={`form-control form-control-sm font-monospace${contextError ? ' is-invalid' : ''}`}
						value={contextRaw} disabled={disabled} onChange={e => handleContextChange(e.target.value)} />
				</div>
			</div>

			<div className="component-node-editor__body">
				{/* Canvas */}
				<div
					ref={canvasRef}
					className="component-node-editor__canvas"
					onMouseMove={onCanvasMouseMove}
					onMouseUp={onCanvasMouseUp}
					onMouseLeave={onCanvasMouseUp}
					onClick={() => { if (!dragging) setSelectedId(null) }}
				>
					{/* SVG edges */}
					<svg className="component-node-editor__svg">
						<defs>
							<marker id="ne-arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
								<polygon points="0 0, 8 3, 0 6" fill="#6c757d" />
							</marker>
						</defs>
						{graph.edges.map((edge, idx) => {
							const fp = positions[edge.from]
							const tp = positions[edge.to]
							if (!fp || !tp) return null
							return (
								<g key={idx}>
									<path d={edgePath(fp, tp)} fill="none" stroke="#6c757d" strokeWidth={2} markerEnd="url(#ne-arrowhead)" />
									{edge.trigger && (
										<text
											x={(fp.x + NODE_W + tp.x) / 2}
											y={(fp.y + NODE_H / 2 + tp.y + NODE_H / 2) / 2 - 6}
											className="component-node-editor__edge-label"
										>
											{edge.trigger}
										</text>
									)}
								</g>
							)
						})}
						{/* Connection drag line */}
						{connecting && (() => {
							const fp = positions[connecting.fromId]
							if (!fp) return null
							return (
								<line
									x1={fp.x + NODE_W} y1={fp.y + NODE_H / 2}
									x2={connecting.mouse.x} y2={connecting.mouse.y}
									stroke="#0d6efd" strokeWidth={2} strokeDasharray="6 3"
								/>
							)
						})()}
					</svg>

					{/* Node rectangles */}
					{graph.nodes.map(node => {
						const pos = positions[node.id] ?? { x: 0, y: 0 }
						const isSelected = selectedId === node.id
						const isInitial = graph.initialId === node.id
						const color = TYPE_COLORS[node.type]
						return (
							<div
								key={node.id}
								className={`component-node-editor__rect${isSelected ? ' component-node-editor__rect--selected' : ''}`}
								style={{
									left: pos.x,
									top: pos.y,
									width: NODE_W,
									minHeight: NODE_H,
									borderColor: color,
								}}
								onMouseDown={e => onNodeMouseDown(e, node.id)}
								onClick={e => { e.stopPropagation(); setSelectedId(node.id) }}
							>
								<div className="component-node-editor__rect-header" style={{ background: color }}>
									<span className="component-node-editor__rect-type">{node.type}</span>
									{isInitial && <span className="component-node-editor__rect-initial" title="Initial node">&#9733;</span>}
									{/* connect handle */}
									<span
										className="component-node-editor__connect-handle"
										title="Drag to connect"
										onMouseDown={e => onConnectStart(e, node.id)}
									>
										<Icon name="circle-fill" />
									</span>
								</div>
								<div className="component-node-editor__rect-body">
									<div className="component-node-editor__rect-key">{node.key || node.id}</div>
									{node.value && <div className="component-node-editor__rect-value">{node.value}</div>}
									{node.eval && <div className="component-node-editor__rect-eval">{node.eval}</div>}
								</div>
							</div>
						)
					})}
				</div>

				{/* Detail panel */}
				<div className="component-node-editor__panel">
					{renderDetailPanel()}
				</div>
			</div>
		</div>
	)
}
