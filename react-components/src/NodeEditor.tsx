import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Icon } from './Icon'
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

export interface Pos {
	x: number
	y: number
}

export const NODE_TYPES: NodeType[] = ['base', 'branch', 'exec', 'condition']
export const NODE_W = 180
export const NODE_H = 60
export const TYPE_COLORS: Record<NodeType, string> = {
	base: '#00b5d8',
	branch: '#38a169',
	exec: '#e53e3e',
	condition: '#dd6b20',
}

const EMPTY_GRAPH_JSON = '{"context":{},"initialId":"","nodes":[],"edges":[]}'
const MIN_SCALE = 0.3
const MAX_SCALE = 2

export const parseGraph = (raw: string): GraphData => {
	try {
		const parsed = JSON.parse(raw)
		if (parsed && typeof parsed === 'object' && Array.isArray(parsed.nodes)) {
			return parsed as GraphData
		}
	} catch {
		/* ignore */
	}
	return { context: {}, initialId: '', nodes: [], edges: [] }
}

const autoLayout = (nodes: GraphNode[], existing: Record<string, Pos>): Record<string, Pos> => {
	const positions: Record<string, Pos> = {}
	const cols = 3
	let idx = 0
	// preserve placed nodes, drop stale ones
	for (const n of nodes) {
		if (existing[n.id]) {
			positions[n.id] = existing[n.id]
			idx++
		}
	}
	for (const n of nodes) {
		if (positions[n.id]) continue
		const col = idx % cols
		const row = Math.floor(idx / cols)
		positions[n.id] = { x: 40 + col * (NODE_W + 60), y: 40 + row * (NODE_H + 80) }
		idx++
	}
	return positions
}

export const nodeLabel = (n: GraphNode): string => n.key || n.id

/* ---------------------------------------------------------------- *
 * Headless hook — owns graph state, selection, layout, mutations.   *
 * Build any toolbar / inspector UI on top of `actions`/`selection`. *
 * ---------------------------------------------------------------- */

export interface UseNodeEditorOptions {
	value?: string
	defaultValue?: string
	onChange?: (value: string) => void
	disabled?: boolean
}

export interface NodeEditorActions {
	/** Append a node (optionally pre-filled). Returns the new node id. */
	addNode: (partial?: Partial<GraphNode>) => string
	removeNode: (id: string) => void
	updateNode: (id: string, patch: Partial<GraphNode>) => void
	addOption: (nodeId: string) => void
	removeOption: (nodeId: string, optIdx: number) => void
	updateOption: (nodeId: string, optIdx: number, patch: Partial<NodeOption>) => void
	addEdge: (from: string, to: string, trigger?: string) => void
	removeEdge: (idx: number) => void
	updateEdge: (idx: number, patch: Partial<GraphEdge>) => void
	setInitialId: (id: string) => void
	setContext: (context: Record<string, unknown>) => void
	/** Valid trigger keys for an edge leaving `fromId` (branch option keys / true|false). */
	getTriggerOptions: (fromId: string) => string[]
}

export interface NodeEditorSelection {
	id: string | null
	node: GraphNode | null
	select: (id: string | null) => void
}

export interface NodeEditorViewProps {
	graph: GraphData
	positions: Record<string, Pos>
	selectedId: string | null
	disabled?: boolean
	onSelect: (id: string | null) => void
	onMoveNode: (id: string, pos: Pos) => void
	onConnect: (from: string, to: string) => void
	onDeleteNode?: (id: string) => void
	className?: string
	loading?: boolean
}

export interface UseNodeEditorResult {
	graph: GraphData
	actions: NodeEditorActions
	selection: NodeEditorSelection
	positions: Record<string, Pos>
	setPositions: React.Dispatch<React.SetStateAction<Record<string, Pos>>>
	/** Spread onto `<NodeEditor {...view} />`. */
	view: NodeEditorViewProps
}

export const useNodeEditor = (opts: UseNodeEditorOptions = {}): UseNodeEditorResult => {
	const { value, defaultValue = EMPTY_GRAPH_JSON, onChange, disabled = false } = opts
	const isControlled = value !== undefined
	const [internal, setInternal] = useState(defaultValue)
	const raw = isControlled ? value : internal
	const graph = useMemo(() => parseGraph(raw), [raw])

	// per-instance id counter (no module-level shared state)
	const idRef = useRef(1)
	const genId = useCallback(() => {
		let max = idRef.current
		for (const n of graph.nodes) {
			const num = parseInt(n.id, 10)
			if (!isNaN(num) && num >= max) max = num + 1
		}
		idRef.current = max + 1
		return String(max)
	}, [graph.nodes])

	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [positions, setPositions] = useState<Record<string, Pos>>(() => autoLayout(graph.nodes, {}))

	// keep layout in sync as nodes are added/removed (by identity, not just length)
	useEffect(() => {
		setPositions(prev => autoLayout(graph.nodes, prev))
	}, [graph.nodes])

	const emit = useCallback(
		(next: GraphData) => {
			const serialized = JSON.stringify(next)
			if (!isControlled) setInternal(serialized)
			onChange?.(serialized)
		},
		[isControlled, onChange],
	)

	const getTriggerOptions = useCallback(
		(fromId: string): string[] => {
			const node = graph.nodes.find(n => n.id === fromId)
			if (!node) return []
			if (node.type === 'branch') return (node.options ?? []).map(o => o.key)
			if (node.type === 'condition') return ['true', 'false']
			return []
		},
		[graph.nodes],
	)

	const actions = useMemo<NodeEditorActions>(() => {
		const addNode: NodeEditorActions['addNode'] = partial => {
			const id = genId()
			const node: GraphNode = {
				id,
				actor: '',
				key: `node_${id}`,
				type: 'base',
				value: '',
				...partial,
			}
			const next = { ...graph, nodes: [...graph.nodes, node] }
			if (!next.initialId) next.initialId = id
			setSelectedId(id)
			emit(next)
			return id
		}

		const removeNode: NodeEditorActions['removeNode'] = id => {
			const nodes = graph.nodes.filter(n => n.id !== id)
			const edges = graph.edges.filter(e => e.from !== id && e.to !== id)
			const initialId = graph.initialId === id ? (nodes[0]?.id ?? '') : graph.initialId
			setSelectedId(prev => (prev === id ? null : prev))
			setPositions(prev => {
				const p = { ...prev }
				delete p[id]
				return p
			})
			emit({ ...graph, nodes, edges, initialId })
		}

		const updateNode: NodeEditorActions['updateNode'] = (id, patch) => {
			const nodes = graph.nodes.map(n => {
				if (n.id !== id) return n
				const updated = { ...n, ...patch }
				if (patch.type && patch.type !== n.type) {
					if (patch.type === 'base') {
						delete updated.eval
						delete updated.options
						updated.value = updated.value ?? ''
					} else if (patch.type === 'branch') {
						delete updated.eval
						updated.value = updated.value ?? ''
						updated.options = updated.options ?? []
					} else if (patch.type === 'exec') {
						delete updated.value
						delete updated.options
						updated.eval = updated.eval ?? ''
					} else if (patch.type === 'condition') {
						delete updated.options
						updated.value = updated.value ?? ''
						updated.eval = updated.eval ?? ''
					}
				}
				return updated
			})
			emit({ ...graph, nodes })
		}

		const addOption: NodeEditorActions['addOption'] = nodeId => {
			const nodes = graph.nodes.map(n => {
				if (n.id !== nodeId) return n
				return {
					...n,
					options: [...(n.options ?? []), { key: `opt_${(n.options?.length ?? 0) + 1}`, value: '' }],
				}
			})
			emit({ ...graph, nodes })
		}

		const removeOption: NodeEditorActions['removeOption'] = (nodeId, optIdx) => {
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

		const updateOption: NodeEditorActions['updateOption'] = (nodeId, optIdx, patch) => {
			const nodes = graph.nodes.map(n => {
				if (n.id !== nodeId) return n
				return { ...n, options: (n.options ?? []).map((o, i) => (i === optIdx ? { ...o, ...patch } : o)) }
			})
			emit({ ...graph, nodes })
		}

		const addEdge: NodeEditorActions['addEdge'] = (from, to, trigger) => {
			if (from === to) return
			const edge: GraphEdge = { from, to }
			if (trigger) edge.trigger = trigger
			emit({ ...graph, edges: [...graph.edges, edge] })
		}

		const removeEdge: NodeEditorActions['removeEdge'] = idx => {
			emit({ ...graph, edges: graph.edges.filter((_, i) => i !== idx) })
		}

		const updateEdge: NodeEditorActions['updateEdge'] = (idx, patch) => {
			const edges = graph.edges.map((e, i) => {
				if (i !== idx) return e
				const updated = { ...e, ...patch }
				if (updated.trigger === '') delete updated.trigger
				return updated
			})
			emit({ ...graph, edges })
		}

		const setInitialId: NodeEditorActions['setInitialId'] = id => emit({ ...graph, initialId: id })
		const setContext: NodeEditorActions['setContext'] = context => emit({ ...graph, context })

		return {
			addNode,
			removeNode,
			updateNode,
			addOption,
			removeOption,
			updateOption,
			addEdge,
			removeEdge,
			updateEdge,
			setInitialId,
			setContext,
			getTriggerOptions,
		}
	}, [graph, emit, genId, getTriggerOptions])

	const selectedNode = graph.nodes.find(n => n.id === selectedId) ?? null

	const onMoveNode = useCallback((id: string, pos: Pos) => {
		setPositions(prev => ({ ...prev, [id]: pos }))
	}, [])

	const view: NodeEditorViewProps = {
		graph,
		positions,
		selectedId,
		disabled,
		onSelect: setSelectedId,
		onMoveNode,
		onConnect: actions.addEdge,
		onDeleteNode: actions.removeNode,
	}

	return {
		graph,
		actions,
		selection: { id: selectedId, node: selectedNode, select: setSelectedId },
		positions,
		setPositions,
		view,
	}
}

/* ---------------------------------------------------------------- *
 * Smart edge path — picks nearest anchor sides, returns label mid.  *
 * ---------------------------------------------------------------- */

interface EdgeGeom {
	d: string
	mid: Pos
}

const edgeGeom = (fp: Pos, tp: Pos): EdgeGeom => {
	const sx = fp.x + NODE_W / 2
	const sy = fp.y + NODE_H / 2
	const tx = tp.x + NODE_W / 2
	const ty = tp.y + NODE_H / 2
	const dx = tx - sx
	const dy = ty - sy

	let x1: number, y1: number, x2: number, y2: number
	let c1x: number, c1y: number, c2x: number, c2y: number

	if (Math.abs(dx) >= Math.abs(dy)) {
		// horizontal dominant
		const right = dx >= 0
		x1 = right ? fp.x + NODE_W : fp.x
		x2 = right ? tp.x : tp.x + NODE_W
		y1 = fp.y + NODE_H / 2
		y2 = tp.y + NODE_H / 2
		const k = Math.max(40, Math.abs(x2 - x1) / 2)
		c1x = x1 + (right ? k : -k)
		c1y = y1
		c2x = x2 - (right ? k : -k)
		c2y = y2
	} else {
		// vertical dominant
		const down = dy >= 0
		y1 = down ? fp.y + NODE_H : fp.y
		y2 = down ? tp.y : tp.y + NODE_H
		x1 = fp.x + NODE_W / 2
		x2 = tp.x + NODE_W / 2
		const k = Math.max(40, Math.abs(y2 - y1) / 2)
		c1x = x1
		c1y = y1 + (down ? k : -k)
		c2x = x2
		c2y = y2 - (down ? k : -k)
	}

	return { d: `M${x1},${y1} C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`, mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 } }
}

/* ---------------------------------------------------------------- *
 * Canvas view — pointer/touch drag, pan, pinch + wheel zoom.        *
 * Stateless re: graph; all mutation flows through callbacks.        *
 * ---------------------------------------------------------------- */

interface Viewport {
	x: number
	y: number
	scale: number
}

export const NodeEditor: React.FC<NodeEditorViewProps> = ({
	graph,
	positions,
	selectedId,
	disabled = false,
	onSelect,
	onMoveNode,
	onConnect,
	onDeleteNode,
	className = '',
	loading = false,
}) => {
	const canvasRef = useRef<HTMLDivElement>(null)
	const [vp, setVp] = useState<Viewport>({ x: 0, y: 0, scale: 1 })
	const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number; moved: boolean } | null>(null)
	const [connecting, setConnecting] = useState<{ fromId: string; mouse: Pos } | null>(null)
	const panRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null)
	const pointersRef = useRef<Map<number, Pos>>(new Map())
	const pinchRef = useRef<{ dist: number; scale: number } | null>(null)

	// screen → world coords (undo viewport transform)
	const toWorld = useCallback(
		(clientX: number, clientY: number): Pos => {
			const rect = canvasRef.current!.getBoundingClientRect()
			return {
				x: (clientX - rect.left - vp.x) / vp.scale,
				y: (clientY - rect.top - vp.y) / vp.scale,
			}
		},
		[vp],
	)

	// ---- keyboard delete ----
	useEffect(() => {
		if (disabled || !selectedId || !onDeleteNode) return
		const handler = (e: KeyboardEvent) => {
			if (e.key !== 'Delete' && e.key !== 'Backspace') return
			const el = document.activeElement
			if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
			if ((el as HTMLElement | null)?.isContentEditable) return
			e.preventDefault()
			onDeleteNode(selectedId)
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [disabled, selectedId, onDeleteNode])

	// ---- node drag ----
	const onNodePointerDown = (e: React.PointerEvent, id: string) => {
		if (disabled || e.button !== 0) return
		e.stopPropagation()
		;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
		const w = toWorld(e.clientX, e.clientY)
		const pos = positions[id] ?? { x: 0, y: 0 }
		setDragging({ id, dx: w.x - pos.x, dy: w.y - pos.y, moved: false })
		onSelect(id)
	}

	const onNodePointerMove = (e: React.PointerEvent) => {
		if (!dragging) return
		const w = toWorld(e.clientX, e.clientY)
		onMoveNode(dragging.id, { x: Math.round(w.x - dragging.dx), y: Math.round(w.y - dragging.dy) })
		if (!dragging.moved) setDragging(d => (d ? { ...d, moved: true } : d))
	}

	const onNodePointerUp = (e: React.PointerEvent) => {
		;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
		setDragging(null)
	}

	// ---- connect handle ----
	const onConnectStart = (e: React.PointerEvent, fromId: string) => {
		if (disabled) return
		e.stopPropagation()
		e.preventDefault()
		setConnecting({ fromId, mouse: toWorld(e.clientX, e.clientY) })
	}

	// ---- canvas-level pointer (pan / pinch / connect tracking) ----
	const onCanvasPointerDown = (e: React.PointerEvent) => {
		pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
		if (pointersRef.current.size === 2) {
			const [a, b] = [...pointersRef.current.values()]
			pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: vp.scale }
			panRef.current = null
			return
		}
		if (connecting || dragging) return
		// begin pan on empty canvas
		panRef.current = { startX: e.clientX, startY: e.clientY, origX: vp.x, origY: vp.y, moved: false }
	}

	const onCanvasPointerMove = (e: React.PointerEvent) => {
		if (pointersRef.current.has(e.pointerId)) {
			pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
		}

		// pinch zoom
		if (pointersRef.current.size === 2 && pinchRef.current) {
			const [a, b] = [...pointersRef.current.values()]
			const dist = Math.hypot(a.x - b.x, a.y - b.y)
			const rect = canvasRef.current!.getBoundingClientRect()
			const cx = (a.x + b.x) / 2 - rect.left
			const cy = (a.y + b.y) / 2 - rect.top
			const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchRef.current.scale * (dist / pinchRef.current.dist)))
			setVp(prev => zoomAt(prev, next, cx, cy))
			return
		}

		if (connecting) {
			setConnecting(prev => (prev ? { ...prev, mouse: toWorld(e.clientX, e.clientY) } : null))
			return
		}

		if (panRef.current) {
			const p = panRef.current
			const nx = p.origX + (e.clientX - p.startX)
			const ny = p.origY + (e.clientY - p.startY)
			if (!p.moved && Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > 3) p.moved = true
			setVp(prev => ({ ...prev, x: nx, y: ny }))
		}
	}

	const onCanvasPointerUp = (e: React.PointerEvent) => {
		pointersRef.current.delete(e.pointerId)
		if (pointersRef.current.size < 2) pinchRef.current = null

		if (connecting) {
			const w = toWorld(e.clientX, e.clientY)
			for (const n of graph.nodes) {
				const p = positions[n.id]
				if (!p) continue
				if (w.x >= p.x && w.x <= p.x + NODE_W && w.y >= p.y && w.y <= p.y + NODE_H) {
					if (n.id !== connecting.fromId) onConnect(connecting.fromId, n.id)
					break
				}
			}
			setConnecting(null)
		}

		// click on empty canvas (no pan movement) clears selection
		if (panRef.current && !panRef.current.moved && !dragging) onSelect(null)
		panRef.current = null
	}

	const onWheel = (e: React.WheelEvent) => {
		if (disabled) return
		const rect = canvasRef.current!.getBoundingClientRect()
		const cx = e.clientX - rect.left
		const cy = e.clientY - rect.top
		const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
		setVp(prev => {
			const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor))
			return zoomAt(prev, next, cx, cy)
		})
	}

	const zoomBy = (factor: number) => {
		const rect = canvasRef.current?.getBoundingClientRect()
		const cx = rect ? rect.width / 2 : 0
		const cy = rect ? rect.height / 2 : 0
		setVp(prev => {
			const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor))
			return zoomAt(prev, next, cx, cy)
		})
	}

	const fitView = () => {
		const ids = graph.nodes.map(n => n.id).filter(id => positions[id])
		if (!ids.length) {
			setVp({ x: 0, y: 0, scale: 1 })
			return
		}
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
		for (const id of ids) {
			const p = positions[id]
			minX = Math.min(minX, p.x)
			minY = Math.min(minY, p.y)
			maxX = Math.max(maxX, p.x + NODE_W)
			maxY = Math.max(maxY, p.y + NODE_H)
		}
		const rect = canvasRef.current?.getBoundingClientRect()
		if (!rect) return
		const pad = 40
		const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min((rect.width - pad * 2) / (maxX - minX || 1), (rect.height - pad * 2) / (maxY - minY || 1))))
		setVp({
			scale,
			x: pad - minX * scale + (rect.width - pad * 2 - (maxX - minX) * scale) / 2,
			y: pad - minY * scale + (rect.height - pad * 2 - (maxY - minY) * scale) / 2,
		})
	}

	if (loading) {
		return (
			<div className={`component component-node-editor${className ? ` ${className}` : ''}`}>
				<div style={{ padding: '2rem' }}>
					<Skeleton variant="rect" width="100%" height="300px" />
				</div>
			</div>
		)
	}

	const contentStyle: React.CSSProperties = {
		transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.scale})`,
		transformOrigin: '0 0',
	}

	return (
		<div className={`component component-node-editor${className ? ` ${className}` : ''}`}>
			<div
				ref={canvasRef}
				className={`component-node-editor__canvas${panRef.current?.moved ? ' component-node-editor__canvas--panning' : ''}`}
				onPointerDown={onCanvasPointerDown}
				onPointerMove={e => {
					onCanvasPointerMove(e)
					onNodePointerMove(e)
				}}
				onPointerUp={onCanvasPointerUp}
				onPointerLeave={onCanvasPointerUp}
				onWheel={onWheel}
			>
				<div className="component-node-editor__content" style={contentStyle}>
					<svg className="component-node-editor__svg" style={{ overflow: 'visible' }}>
						<defs>
							<marker id="ne-arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
								<polygon points="0 0, 8 3, 0 6" fill="#6c757d" />
							</marker>
						</defs>
						{graph.edges.map((edge, idx) => {
							const fp = positions[edge.from]
							const tp = positions[edge.to]
							if (!fp || !tp) return null
							const g = edgeGeom(fp, tp)
							return (
								<g key={idx}>
									<path d={g.d} fill="none" stroke="#6c757d" strokeWidth={2} markerEnd="url(#ne-arrowhead)" />
									{edge.trigger && (
										<text x={g.mid.x} y={g.mid.y - 6} className="component-node-editor__edge-label">
											{edge.trigger}
										</text>
									)}
								</g>
							)
						})}
						{connecting &&
							(() => {
								const fp = positions[connecting.fromId]
								if (!fp) return null
								return (
									<line
										x1={fp.x + NODE_W}
										y1={fp.y + NODE_H / 2}
										x2={connecting.mouse.x}
										y2={connecting.mouse.y}
										stroke="#0d6efd"
										strokeWidth={2}
										strokeDasharray="6 3"
									/>
								)
							})()}
					</svg>

					{graph.nodes.map(node => {
						const pos = positions[node.id] ?? { x: 0, y: 0 }
						const isSelected = selectedId === node.id
						const isInitial = graph.initialId === node.id
						const color = TYPE_COLORS[node.type]
						return (
							<div
								key={node.id}
								className={`component-node-editor__rect${isSelected ? ' component-node-editor__rect--selected' : ''}`}
								style={{ left: pos.x, top: pos.y, width: NODE_W, minHeight: NODE_H, borderColor: color }}
								onPointerDown={e => onNodePointerDown(e, node.id)}
								onPointerUp={onNodePointerUp}
							>
								<div className="component-node-editor__rect-header" style={{ background: color }}>
									<span className="component-node-editor__rect-type">{node.type}</span>
									{isInitial && (
										<span className="component-node-editor__rect-initial" title="Initial node">
											&#9733;
										</span>
									)}
									<span
										className="component-node-editor__connect-handle"
										title="Drag to connect"
										onPointerDown={e => onConnectStart(e, node.id)}
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

				{/* zoom controls (floating, not part of removed toolbar) */}
				<div className="component-node-editor__zoom">
					<button type="button" className="component-node-editor__zoom-btn" title="Zoom in" onClick={() => zoomBy(1.2)}>
						<Icon name="plus-lg" />
					</button>
					<button type="button" className="component-node-editor__zoom-btn" title="Zoom out" onClick={() => zoomBy(1 / 1.2)}>
						<Icon name="dash-lg" />
					</button>
					<button type="button" className="component-node-editor__zoom-btn" title="Fit to view" onClick={fitView}>
						<Icon name="arrows-fullscreen" />
					</button>
				</div>
			</div>
		</div>
	)
}

const zoomAt = (vp: Viewport, nextScale: number, cx: number, cy: number): Viewport => {
	// keep the point under (cx,cy) fixed while scaling
	const wx = (cx - vp.x) / vp.scale
	const wy = (cy - vp.y) / vp.scale
	return { scale: nextScale, x: cx - wx * nextScale, y: cy - wy * nextScale }
}
