import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
	Button,
	Checkbox,
	ExportEngine,
	Icon,
	PhysicsEditor,
	PhysicsEditorHandle,
	PhysicsShape,
	PhysicsTool,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Select,
} from '@toolcase/react-components'

/** Draws a transparent-background star sprite so auto-trace has a concave silhouette to work with. */
const buildSampleSprite = (): Promise<Blob> => {
	const size = 256
	const c = document.createElement('canvas')
	c.width = size
	c.height = size
	const ctx = c.getContext('2d')!
	ctx.clearRect(0, 0, size, size)

	const cx = size / 2
	const cy = size / 2
	const outer = size / 2 - 12
	const inner = outer * 0.45
	ctx.beginPath()
	for (let i = 0; i < 10; i++) {
		const r = i % 2 === 0 ? outer : inner
		const a = (i / 10) * Math.PI * 2 - Math.PI / 2
		const x = cx + Math.cos(a) * r
		const y = cy + Math.sin(a) * r
		i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
	}
	ctx.closePath()
	ctx.fillStyle = '#6c8cff'
	ctx.fill()

	return new Promise((resolve, reject) =>
		c.toBlob((b) => (b ? resolve(b) : reject(new Error('sample sprite failed'))), 'image/png'),
	)
}

const PhysicsEditorDemo = () => {
	const [source, setSource] = useState<Blob | undefined>(undefined)
	const editorRef = useRef<PhysicsEditorHandle>(null)

	const [tool, setTool] = useState<PhysicsTool>('select')

	// Trace controls.
	const [alphaThreshold, setAlphaThreshold] = useState(1)
	const [simplifyTolerance, setSimplifyTolerance] = useState(2)
	const [targetVertexCount, setTargetVertexCount] = useState(0)
	const [decomposeConcave, setDecomposeConcave] = useState(false)

	// Snap controls.
	const [snapPixel, setSnapPixel] = useState(true)
	const [snapGrid, setSnapGrid] = useState(false)
	const [gridSize, setGridSize] = useState(16)
	const [showGrid, setShowGrid] = useState(true)

	// Document mirror.
	const [shapes, setShapes] = useState<PhysicsShape[]>([])
	const [selected, setSelected] = useState<number | null>(null)

	// Export.
	const [engine, setEngine] = useState<ExportEngine>('matter')
	const [pixelsPerMeter, setPixelsPerMeter] = useState(32)
	const [exportText, setExportText] = useState('')
	const [dropped, setDropped] = useState<string[]>([])
	const [issues, setIssues] = useState<string[]>([])

	useEffect(() => {
		let active = true
		void buildSampleSprite().then((b) => {
			if (active) setSource(b)
		})
		return () => {
			active = false
		}
	}, [])

	const onUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (file) setSource(file)
	}, [])

	const patchProps = useCallback(
		(index: number, key: 'density' | 'friction' | 'restitution' | 'isSensor', value: number | boolean) => {
			const next = shapes.map((s, i) => (i === index ? { ...s, props: { ...s.props, [key]: value } } : s))
			editorRef.current?.setShapes(next)
		},
		[shapes],
	)

	const doExport = useCallback(() => {
		const res = editorRef.current?.export(engine, pixelsPerMeter)
		if (!res) return
		setExportText(JSON.stringify(res.body, null, 2))
		setDropped(res.droppedProperties)
		const v = editorRef.current?.validate(engine)
		setIssues(v ? v.issues.map((i) => i.message) : [])
	}, [engine, pixelsPerMeter])

	const copyExport = useCallback(() => {
		const res = editorRef.current?.export(engine, pixelsPerMeter)
		if (res) void navigator.clipboard?.writeText(JSON.stringify(res.body, null, 2))
	}, [engine, pixelsPerMeter])

	const rangeField = (
		label: string,
		value: number,
		min: number,
		max: number,
		step: number,
		onChange: (v: number) => void,
		suffix = '',
	) => (
		<div className="flex-fill">
			<label className="form-label">
				{label}: {value}
				{suffix}
			</label>
			<input
				type="range"
				className="form-range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => onChange(Number(e.target.value))}
			/>
		</div>
	)

	return (
		<div className="container py-4">
			<div className="row">
				<div className="col-12">
					<RichPageHeader
						chips={<RichPageHeaderChip>Editors</RichPageHeaderChip>}
						title="PhysicsEditor"
						description="Derive a collision shape from a sprite — auto-trace the alpha silhouette into a polygon, or draw polygons / circles / boxes by hand. Set per-fixture physical props, decompose concave shapes into convex pieces, and export to Box2D, Matter.js, Planck.js, or raw JSON."
					/>
					<div className="d-flex flex-column gap-4 mt-4">
						<SectionCard title="Source">
							<label className="form-label">Upload a sprite (PNG with alpha) — or use the built-in star</label>
							<input type="file" accept="image/*" className="form-control" onChange={onUpload} />
						</SectionCard>

						<SectionCard title="Tool">
							<div className="btn-group" role="group" aria-label="Editor tool">
								{(['select', 'polygon', 'circle', 'box'] as PhysicsTool[]).map((t) => (
									<Button
										key={t}
										variant={tool === t ? 'primary' : 'secondary'}
										outline={tool !== t}
										size="small"
										onClick={() => setTool(t)}
									>
										{t}
									</Button>
								))}
							</div>
							<div className="text-muted small mt-2">
								<strong>select</strong>: drag shapes / vertices, double-click an edge to add a vertex,{' '}
								<strong>Alt+click</strong> a vertex to delete it, <strong>Delete</strong> removes the shape.{' '}
								<strong>polygon</strong>: click to add points, double-click / Enter / click the first point to
								close, <strong>Esc</strong> cancels. <strong>circle</strong> / <strong>box</strong>: drag.
							</div>
						</SectionCard>

						<SectionCard title="Auto-trace">
							<div className="d-flex flex-column gap-3">
								<div className="d-flex gap-2">
									{rangeField('Alpha threshold', alphaThreshold, 0, 255, 1, setAlphaThreshold)}
									{rangeField('Simplify tolerance', simplifyTolerance, 0, 10, 0.5, setSimplifyTolerance, 'px')}
								</div>
								<div className="d-flex gap-2">
									{rangeField('Target vertices (0 = off)', targetVertexCount, 0, 32, 1, setTargetVertexCount)}
								</div>
								<Checkbox
									label="Decompose concave → convex pieces"
									checked={decomposeConcave}
									onChange={(e) => setDecomposeConcave(e.target.checked)}
								/>
								<div className="d-flex gap-2">
									<Button variant="primary" size="small" onClick={() => editorRef.current?.autoTrace()}>
										<Icon name="activity" /> Auto-trace
									</Button>
									<Button variant="secondary" outline size="small" onClick={() => editorRef.current?.decompose()}>
										Decompose
									</Button>
								</div>
							</div>
						</SectionCard>

						<SectionCard title="Snap">
							<div className="d-flex flex-column gap-3">
								<div className="d-flex gap-3 flex-wrap">
									<Checkbox label="Snap to pixel" checked={snapPixel} onChange={(e) => setSnapPixel(e.target.checked)} />
									<Checkbox label="Snap to grid" checked={snapGrid} onChange={(e) => setSnapGrid(e.target.checked)} />
									<Checkbox label="Show grid" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
								</div>
								{rangeField('Grid size', gridSize, 4, 64, 1, setGridSize, 'px')}
							</div>
						</SectionCard>

						<SectionCard title="Preview">
							<div className="mb-3 d-flex gap-2 flex-wrap">
								<Button variant="secondary" outline size="small" onClick={() => editorRef.current?.undo()}>
									<Icon name="undo" /> Undo
								</Button>
								<Button variant="secondary" outline size="small" onClick={() => editorRef.current?.redo()}>
									<Icon name="redo" /> Redo
								</Button>
								<Button variant="danger" outline size="small" onClick={() => editorRef.current?.reset()}>
									Reset
								</Button>
								<Button variant="danger" outline size="small" onClick={() => editorRef.current?.clearShapes()}>
									Clear
								</Button>
							</div>
							<PhysicsEditor
								ref={editorRef}
								source={source}
								tool={tool}
								alphaThreshold={alphaThreshold}
								simplifyTolerance={simplifyTolerance}
								targetVertexCount={targetVertexCount}
								decomposeConcave={decomposeConcave}
								snapPixel={snapPixel}
								snapGrid={snapGrid}
								gridSize={gridSize}
								showGrid={showGrid}
								pixelsPerMeter={pixelsPerMeter}
								selectedIndex={selected}
								onSelectShape={setSelected}
								onChange={setShapes}
							/>
						</SectionCard>

						<SectionCard title={`Shapes (${shapes.length})`}>
							{shapes.length === 0 && <div className="text-muted small">No shapes yet — auto-trace or draw one.</div>}
							<div className="d-flex flex-column gap-2">
								{shapes.map((s, i) => (
									<div
										key={i}
										className={`p-2 border rounded ${i === selected ? 'border-primary' : ''}`}
										onClick={() => setSelected(i)}
										style={{ cursor: 'pointer' }}
									>
										<div className="d-flex align-items-center gap-2 mb-2">
											<strong className="text-capitalize">{s.type}</strong>
											<span className="text-muted small">#{i}</span>
											<Button
												variant="danger"
												outline
												size="small"
												className="ms-auto"
												onClick={(e) => {
													e.stopPropagation()
													editorRef.current?.removeShape(i)
												}}
											>
												Delete
											</Button>
										</div>
										<div className="d-flex gap-2 flex-wrap">
											{(['density', 'friction', 'restitution'] as const).map((k) => (
												<div key={k}>
													<label className="form-label small mb-0 text-capitalize">{k}</label>
													<input
														type="number"
														step={0.1}
														className="form-control form-control-sm"
														style={{ width: 90 }}
														value={s.props[k]}
														onClick={(e) => e.stopPropagation()}
														onChange={(e) => patchProps(i, k, Number(e.target.value))}
													/>
												</div>
											))}
											<div className="align-self-end">
												<Checkbox
													label="Sensor"
													checked={s.props.isSensor}
													onChange={(e) => patchProps(i, 'isSensor', e.target.checked)}
												/>
											</div>
										</div>
									</div>
								))}
							</div>
						</SectionCard>

						<SectionCard title="Export">
							<div className="d-flex gap-2 align-items-end flex-wrap mb-3">
								<Select
									label="Engine"
									value={engine}
									options={[
										{ value: 'box2d', label: 'Box2D (meters, convex)' },
										{ value: 'planck', label: 'Planck.js (meters, convex)' },
										{ value: 'matter', label: 'Matter.js (pixels)' },
										{ value: 'json', label: 'Raw JSON (engine-neutral)' },
									]}
									onChange={(e) => setEngine(e.target.value as ExportEngine)}
								/>
								<div style={{ width: 160 }}>{rangeField('Pixels / meter', pixelsPerMeter, 1, 128, 1, setPixelsPerMeter)}</div>
								<Button variant="primary" size="small" onClick={doExport}>
									Export
								</Button>
								<Button variant="secondary" outline size="small" onClick={copyExport}>
									<Icon name="copy" /> Copy
								</Button>
							</div>
							{dropped.length > 0 && (
								<div className="alert alert-warning py-2 small">
									Dropped properties (unsupported by {engine}): {dropped.join(', ')}
								</div>
							)}
							{issues.length > 0 && (
								<div className="alert alert-danger py-2 small">
									{issues.map((m, i) => (
										<div key={i}>{m}</div>
									))}
								</div>
							)}
							{exportText && (
								<pre
									className="p-3 rounded"
									style={{ background: 'var(--tc-surface-dark)', maxHeight: 320, overflow: 'auto' }}
								>
									{exportText}
								</pre>
							)}
						</SectionCard>
					</div>
				</div>
			</div>
		</div>
	)
}

export default PhysicsEditorDemo
