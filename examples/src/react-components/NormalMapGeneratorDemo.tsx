import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
	BevelDirection,
	BrushMode,
	Button,
	Checkbox,
	Icon,
	EditorTool,
	NormalBrush,
	NormalLight,
	NormalMapGenerator,
	NormalMapGeneratorHandle,
	NormalMapOutput,
	PreviewMode,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Select,
	StructurePattern
} from '@toolcase/react-components'

/** Hemisphere puck: click maps cursor → unit normal [x, y, z] (z up). */
const HemispherePuck: React.FC<{ value: [number, number, number]; onChange: (n: [number, number, number]) => void }> = ({
	value,
	onChange,
}) => {
	const R = 60
	const pick = (e: React.MouseEvent<HTMLDivElement>) => {
		const rect = e.currentTarget.getBoundingClientRect()
		let nx = (e.clientX - rect.left - R) / R
		let ny = -(e.clientY - rect.top - R) / R
		const len = Math.hypot(nx, ny)
		if (len > 1) {
			nx /= len
			ny /= len
		}
		const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
		onChange([nx, ny, nz])
	}
	const dotX = R + value[0] * R
	const dotY = R - value[1] * R
	return (
		<div
			onClick={pick}
			role="slider"
			aria-label="Normal direction"
			aria-valuetext={`x ${value[0].toFixed(2)}, y ${value[1].toFixed(2)}, z ${value[2].toFixed(2)}`}
			tabIndex={0}
			style={{
				position: 'relative',
				width: R * 2,
				height: R * 2,
				borderRadius: '50%',
				cursor: 'crosshair',
				background: 'radial-gradient(circle at 50% 50%, #8080ff, #1a1a2e)',
				border: '1px solid var(--tc-border)',
			}}
		>
			<div
				style={{
					position: 'absolute',
					left: dotX,
					top: dotY,
					width: 10,
					height: 10,
					marginLeft: -5,
					marginTop: -5,
					borderRadius: '50%',
					background: '#fff',
					boxShadow: '0 0 0 2px rgba(0,0,0,0.4)',
				}}
			/>
		</div>
	)
}

/** Draws a textured rounded sprite so the demo works without an upload. */
const buildSampleSprite = (): Promise<Blob> => {
	const size = 256
	const c = document.createElement('canvas')
	c.width = size
	c.height = size
	const ctx = c.getContext('2d')!
	ctx.clearRect(0, 0, size, size)

	// Body — a circle (gives the bevel an outline to round).
	ctx.fillStyle = '#6c8cff'
	ctx.beginPath()
	ctx.arc(size / 2, size / 2, size / 2 - 12, 0, Math.PI * 2)
	ctx.fill()

	// Texture — luminance detail for the emboss pass.
	ctx.globalCompositeOperation = 'source-atop'
	for (let i = 0; i < 240; i++) {
		const angle = (i / 240) * Math.PI * 2 * 7
		const rad = ((i % 60) / 60) * (size / 2)
		const x = size / 2 + Math.cos(angle) * rad
		const y = size / 2 + Math.sin(angle) * rad
		ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'
		ctx.fillRect(x, y, 6, 6)
	}
	ctx.globalCompositeOperation = 'source-over'

	return new Promise((resolve, reject) =>
		c.toBlob((b) => (b ? resolve(b) : reject(new Error('sample sprite failed'))), 'image/png'),
	)
}

const NormalMapGeneratorDemo = () => {
	const [source, setSource] = useState<Blob | undefined>(undefined)

	const [strength, setStrength] = useState(2)
	const [embossHeight, setEmbossHeight] = useState(2)
	const [bevelWidth, setBevelWidth] = useState(24)
	const [bevelHeight, setBevelHeight] = useState(1)
	const [bevelDirection, setBevelDirection] = useState<BevelDirection>('raised')
	const [tileMode, setTileMode] = useState(false)
	const [blur, setBlur] = useState(1)
	const [invertX, setInvertX] = useState(false)
	const [invertY, setInvertY] = useState(false)

	// ── Brush editor ──
	const [editable, setEditable] = useState(true)
	const [maskToAlpha, setMaskToAlpha] = useState(true)
	const [brushMode, setBrushMode] = useState<BrushMode>('height')
	const [brushSize, setBrushSize] = useState(24)
	const [hardness, setHardness] = useState(0.5)
	const [brushStrength, setBrushStrength] = useState(0.6)
	const [direction, setDirection] = useState<[number, number, number]>([0, 0, 1])
	const [heightSign, setHeightSign] = useState<1 | -1>(1)
	const [pattern, setPattern] = useState<StructurePattern>('reptile')
	const [eraseTarget, setEraseTarget] = useState<'neutral' | 'auto'>('neutral')

	const brush: NormalBrush = {
		mode: brushMode,
		size: brushSize,
		hardness,
		strength: brushStrength,
		direction,
		heightSign,
		pattern,
		eraseTarget,
	}

	// ── Selection tools ──
	const [tool, setTool] = useState<EditorTool>('brush')
	const [wandTolerance, setWandTolerance] = useState(0.1)
	const [feather, setFeather] = useState(0)

	// ── Light inspector ──
	const [previewMode, setPreviewMode] = useState<PreviewMode>('normal')
	const [light, setLight] = useState<NormalLight>({ x: 0.5, y: 0.35, z: 0.5, color: '#ffffff', intensity: 1.2 })
	const [ambient, setAmbient] = useState(0.2)
	const [ambientColor, setAmbientColor] = useState('#3040ff')
	const [specular, setSpecular] = useState(true)
	const [shininess, setShininess] = useState(32)
	const [followCursor, setFollowCursor] = useState(true)
	const [autoRotate, setAutoRotate] = useState(false)

	const [lastOutput, setLastOutput] = useState<NormalMapOutput | null>(null)
	const generatorRef = useRef<NormalMapGeneratorHandle>(null)

	useEffect(() => {
		let active = true
		void buildSampleSprite().then((b) => {
			if (active) setSource(b)
		})
		return () => {
			active = false
		}
	}, [])

	const handleGenerate = useCallback((output: NormalMapOutput) => {
		setLastOutput(output)
	}, [])

	const onUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (file) setSource(file)
	}, [])

	const downloadOutput = useCallback(() => {
		if (!lastOutput) return
		const url = URL.createObjectURL(lastOutput.png)
		const a = document.createElement('a')
		a.href = url
		a.download = 'normal-map.png'
		a.click()
		URL.revokeObjectURL(url)
	}, [lastOutput])

	const downloadLit = useCallback(async () => {
		const blob = await generatorRef.current?.exportLit()
		if (!blob) return
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = 'lit-sprite.png'
		a.click()
		URL.revokeObjectURL(url)
	}, [])

	const colorField = (label: string, value: string, onChange: (v: string) => void) => (
		<div>
			<label className="form-label">{label}</label>
			<input
				type="color"
				className="form-control form-control-color form-control-sm"
				value={value}
				onChange={(e) => onChange(e.target.value)}
			/>
		</div>
	)

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
						title="NormalMapGenerator"
						description="Turn a 2D sprite into a tangent-space normal map — alpha bevel (rounds the outline) + luminance emboss (texture relief), combined additively, with strength / handedness / tiling controls."
					/>
					<div className="d-flex flex-column gap-4 mt-4">
						<SectionCard title="Source">
							<label className="form-label">Upload a sprite (PNG with alpha) — or use the built-in sample</label>
							<input type="file" accept="image/*" className="form-control" onChange={onUpload} />
						</SectionCard>

						<SectionCard title="Bevel (alpha distance transform)">
							<div className="d-flex flex-column gap-3">
								<div className="d-flex gap-2">
									{rangeField('Bevel Width (0 = off)', bevelWidth, 0, 64, 1, setBevelWidth, 'px')}
									{rangeField('Bevel Height', bevelHeight, 0, 4, 0.1, setBevelHeight)}
								</div>
								<Select
									label="Bevel Direction"
									value={bevelDirection}
									options={[
										{ value: 'raised', label: 'Raised (pops out)' },
										{ value: 'recessed', label: 'Recessed (sinks in)' },
									]}
									onChange={(e) => setBevelDirection(e.target.value as BevelDirection)}
								/>
								<Checkbox
									label="Tile mode (seamless border, no edge)"
									checked={tileMode}
									onChange={(e) => setTileMode(e.target.checked)}
								/>
							</div>
						</SectionCard>

						<SectionCard title="Emboss & Combine">
							<div className="d-flex flex-column gap-3">
								<div className="d-flex gap-2">
									{rangeField('Emboss Height (0 = off)', embossHeight, 0, 8, 0.1, setEmbossHeight)}
									{rangeField('Smoothness / Blur', blur, 0, 8, 1, setBlur, 'px')}
								</div>
								<div className="d-flex gap-2">
									{rangeField('Strength', strength, 0.25, 8, 0.25, setStrength)}
								</div>
								<div className="d-flex gap-3">
									<Checkbox label="Invert X" checked={invertX} onChange={(e) => setInvertX(e.target.checked)} />
									<Checkbox
										label="Invert Y (DirectX green)"
										checked={invertY}
										onChange={(e) => setInvertY(e.target.checked)}
									/>
								</div>
							</div>
						</SectionCard>

						<SectionCard title="Brush Editor">
							<div className="d-flex flex-column gap-3">
								<Checkbox
									label="Editable (paint on the preview)"
									checked={editable}
									onChange={(e) => setEditable(e.target.checked)}
								/>
								<Select
									label="Brush Mode"
									value={brushMode}
									options={[
										{ value: 'direction', label: 'Direction / Angle' },
										{ value: 'height', label: 'Height (raise / lower)' },
										{ value: 'smooth', label: 'Smooth' },
										{ value: 'structure', label: 'Structure (pattern)' },
										{ value: 'erase', label: 'Erase' },
									]}
									onChange={(e) => setBrushMode(e.target.value as BrushMode)}
								/>
								<div className="d-flex gap-2">
									{rangeField('Size', brushSize, 2, 96, 1, setBrushSize, 'px')}
									{rangeField('Hardness', hardness, 0, 1, 0.05, setHardness)}
									{rangeField('Strength', brushStrength, 0, 1, 0.05, setBrushStrength)}
								</div>

								{brushMode === 'direction' && (
									<div className="d-flex align-items-center gap-3 flex-wrap">
										<HemispherePuck value={direction} onChange={setDirection} />
										<div className="text-muted small">
											Click the puck to aim the normal. <strong>Alt+click</strong> on the preview samples
											the normal under the cursor back into the puck.
										</div>
									</div>
								)}
								{brushMode === 'height' && (
									<Select
										label="Height Direction"
										value={String(heightSign)}
										options={[
											{ value: '1', label: 'Raise' },
											{ value: '-1', label: 'Lower' },
										]}
										onChange={(e) => setHeightSign(Number(e.target.value) as 1 | -1)}
									/>
								)}
								{brushMode === 'structure' && (
									<Select
										label="Pattern"
										value={pattern}
										options={[
											{ value: 'reptile', label: 'Reptile' },
											{ value: 'furry', label: 'Furry' },
											{ value: 'cracked', label: 'Cracked' },
										]}
										onChange={(e) => setPattern(e.target.value as StructurePattern)}
									/>
								)}
								{brushMode === 'erase' && (
									<Select
										label="Erase Target"
										value={eraseTarget}
										options={[
											{ value: 'neutral', label: 'Neutral (#8080ff)' },
											{ value: 'auto', label: 'Auto-generated' },
										]}
										onChange={(e) => setEraseTarget(e.target.value as 'neutral' | 'auto')}
									/>
								)}

								<Checkbox
									label="Clamp paint to opaque pixels (maskToAlpha)"
									checked={maskToAlpha}
									onChange={(e) => setMaskToAlpha(e.target.checked)}
								/>
								<div className="d-flex gap-2">
									<Button variant="secondary" outline size="small" onClick={() => generatorRef.current?.undo()}>
										<Icon name="undo" /> Undo
									</Button>
									<Button variant="secondary" outline size="small" onClick={() => generatorRef.current?.redo()}>
										<Icon name="redo" /> Redo
									</Button>
									<Button variant="danger" outline size="small" onClick={() => generatorRef.current?.reset()}>
										Reset edits
									</Button>
								</div>
							</div>
						</SectionCard>

						<SectionCard title="Selection Tools">
							<div className="d-flex flex-column gap-3">
								<div className="btn-group" role="group" aria-label="Editor tool">
									{(['brush', 'rect', 'lasso', 'wand'] as EditorTool[]).map((t) => (
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
								<div className="d-flex gap-2">
									{rangeField('Wand Tolerance', wandTolerance, 0, 1, 0.01, setWandTolerance)}
									{rangeField('Feather', feather, 0, 16, 1, setFeather, 'px')}
								</div>
								<div className="text-muted small">
									Pick a tool, then drag (rect/lasso) or click (wand) on the preview. <strong>Shift</strong> adds to
									the selection, <strong>Alt</strong> subtracts. Effects &amp; brush strokes are confined to the
									selection.
								</div>
								<div className="d-flex gap-2">
									<Button variant="secondary" outline size="small" onClick={() => generatorRef.current?.selectAll()}>
										Select all
									</Button>
									<Button
										variant="secondary"
										outline
										size="small"
										onClick={() => generatorRef.current?.clearSelection()}
									>
										Clear selection
									</Button>
								</div>
							</div>
						</SectionCard>

						<SectionCard title="Light Inspector">
							<div className="d-flex flex-column gap-3">
								<div className="btn-group" role="group" aria-label="Preview mode">
									{(['albedo', 'normal', 'lit', 'lit-surface'] as PreviewMode[]).map((m) => (
										<Button
											key={m}
											variant={previewMode === m ? 'primary' : 'secondary'}
											outline={previewMode !== m}
											size="small"
											onClick={() => setPreviewMode(m)}
										>
											{m}
										</Button>
									))}
								</div>

								<div className="d-flex gap-2 align-items-end">
									{colorField('Light Color', light.color ?? '#ffffff', (c) => setLight({ ...light, color: c }))}
									{colorField('Ambient Color', ambientColor, setAmbientColor)}
								</div>
								<div className="d-flex gap-2">
									{rangeField('Intensity', light.intensity ?? 1, 0, 3, 0.05, (v) => setLight({ ...light, intensity: v }))}
									{rangeField('Light Height (z)', light.z, 0.05, 2, 0.05, (v) => setLight({ ...light, z: v }))}
								</div>
								<div className="d-flex gap-2">
									{rangeField('Ambient', ambient, 0, 1, 0.05, setAmbient)}
									{rangeField('Shininess', shininess, 1, 128, 1, setShininess)}
								</div>
								<div className="d-flex gap-3 flex-wrap">
									<Checkbox label="Specular" checked={specular} onChange={(e) => setSpecular(e.target.checked)} />
									<Checkbox
										label="Follow cursor"
										checked={followCursor}
										onChange={(e) => setFollowCursor(e.target.checked)}
									/>
									<Checkbox
										label="Auto-rotate (R)"
										checked={autoRotate}
										onChange={(e) => setAutoRotate(e.target.checked)}
									/>
								</div>
								<div className="text-muted small">
									In <code>lit</code> / <code>lit-surface</code> modes the light follows the cursor.{' '}
									<strong>P</strong> places it under the cursor, <strong>R</strong> toggles auto-rotate, scroll
									changes height.
								</div>
								<div>
									<Button variant="primary" outline size="small" onClick={downloadLit}>
										<Icon name="download" /> Export lit sprite
									</Button>
								</div>
							</div>
						</SectionCard>

						<SectionCard title="Preview">
							<div className="mb-3">
								<Button variant="primary" size="small" onClick={() => generatorRef.current?.generate()}>
									<Icon name="download" /> Generate
								</Button>
							</div>
							<NormalMapGenerator
								ref={generatorRef}
								source={source}
								strength={strength}
								embossHeight={embossHeight}
								bevelWidth={bevelWidth}
								bevelHeight={bevelHeight}
								bevelDirection={bevelDirection}
								tileMode={tileMode}
								blur={blur}
								invertX={invertX}
								invertY={invertY}
								editable={editable}
								brush={brush}
								maskToAlpha={maskToAlpha}
								onSampleDirection={setDirection}
								previewMode={previewMode}
								light={light}
								ambient={ambient}
								ambientColor={ambientColor}
								specular={specular}
								shininess={shininess}
								followCursor={followCursor}
								autoRotate={autoRotate}
								onLightChange={setLight}
								tool={tool}
								wandTolerance={wandTolerance}
								feather={feather}
								onGenerate={handleGenerate}
							/>

							{lastOutput && (
								<div className="mt-3 d-flex align-items-center gap-2 flex-wrap">
									<h5 className="mb-0">Generated Output</h5>
									<span className="badge text-bg-secondary">
										{lastOutput.width}×{lastOutput.height}px
									</span>
									<Button variant="primary" outline size="small" onClick={downloadOutput}>
										<Icon name="download" /> Download PNG
									</Button>
								</div>
							)}
						</SectionCard>
					</div>
				</div>
			</div>
		</div>
	)
}

export default NormalMapGeneratorDemo
