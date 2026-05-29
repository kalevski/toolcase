import React, { useState, useCallback, useRef } from 'react'
import {
	BitmapFontBorder,
	BitmapFontDropShadow,
	BitmapFontExportFormat,
	BitmapFontFill,
	BitmapFontGenerator,
	BitmapFontGeneratorHandle,
	BitmapFontGlow,
	BitmapFontOutput,
	Button,
	Checkbox,
	Icon,
	Input,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Select,
	Textarea
} from '@toolcase/react-components'

const DEFAULT_GLYPHS =
	'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?-+:;\'\"()[]{}/@#$%^&*~`<>=_\\|'

const EXT: Record<BitmapFontExportFormat, string> = { xml: 'xml', json: 'json', fnt: 'fnt' }
const MIME: Record<BitmapFontExportFormat, string> = {
	xml: 'text/xml',
	json: 'application/json',
	fnt: 'text/plain',
}

const BitmapFontGeneratorDemo = () => {
	const [fontFamily, setFontFamily] = useState('Arial')
	const [fontSize, setFontSize] = useState(32)
	const [text, setText] = useState('Hello World!')
	const [glyphs, setGlyphs] = useState(DEFAULT_GLYPHS)

	// Fill
	const [fillType, setFillType] = useState<'solid' | 'gradient'>('solid')
	const [fillColor, setFillColor] = useState('#ffffff')
	const [gradType, setGradType] = useState<'linear' | 'radial'>('linear')
	const [gradColor1, setGradColor1] = useState('#ff6b6b')
	const [gradColor2, setGradColor2] = useState('#ffd93d')
	const [gradColor3, setGradColor3] = useState('#6bcBff')
	const [gradThirdStop, setGradThirdStop] = useState(false)
	const [gradAngle, setGradAngle] = useState(90)

	// Border 1
	const [borderEnabled, setBorderEnabled] = useState(false)
	const [borderColor, setBorderColor] = useState('#000000')
	const [borderThickness, setBorderThickness] = useState(2)
	const [borderAlign, setBorderAlign] = useState<'center' | 'inner' | 'outer'>('center')

	// Border 2 (double outline)
	const [border2Enabled, setBorder2Enabled] = useState(false)
	const [border2Color, setBorder2Color] = useState('#ffffff')
	const [border2Thickness, setBorder2Thickness] = useState(5)

	// Drop shadow
	const [shadowEnabled, setShadowEnabled] = useState(false)
	const [shadowColor, setShadowColor] = useState('#000000')
	const [shadowSize, setShadowSize] = useState(4)
	const [shadowOffsetX, setShadowOffsetX] = useState(2)
	const [shadowOffsetY, setShadowOffsetY] = useState(2)
	const [shadowBlur, setShadowBlur] = useState(4)

	// Glow
	const [glowEnabled, setGlowEnabled] = useState(false)
	const [glowColor, setGlowColor] = useState('#00e5ff')
	const [glowSize, setGlowSize] = useState(8)

	// Layout
	const [letterSpacing, setLetterSpacing] = useState(0)
	const [padding, setPadding] = useState(2)
	const [glyphsPerRow, setGlyphsPerRow] = useState(16)
	const [lineHeight, setLineHeight] = useState(0) // 0 = auto
	const [powerOfTwo, setPowerOfTwo] = useState(false)

	// Export
	const [scale, setScale] = useState(1)
	const [bgEnabled, setBgEnabled] = useState(false)
	const [bgColor, setBgColor] = useState('#1a1a2e')
	const [exportFormat, setExportFormat] = useState<BitmapFontExportFormat>('xml')

	const [lastOutput, setLastOutput] = useState<BitmapFontOutput | null>(null)
	const generatorRef = useRef<BitmapFontGeneratorHandle>(null)

	const fill: BitmapFontFill =
		fillType === 'solid'
			? { type: 'solid', color: fillColor }
			: {
					type: 'gradient',
					gradientType: gradType,
					gradientColors: gradThirdStop ? [gradColor1, gradColor2, gradColor3] : [gradColor1, gradColor2],
					gradientAngle: gradAngle,
				}

	const borders: BitmapFontBorder[] | undefined = borderEnabled
		? [
				{ color: borderColor, thickness: borderThickness, align: borderAlign },
				...(border2Enabled ? [{ color: border2Color, thickness: border2Thickness }] : []),
			]
		: undefined

	const dropShadow: BitmapFontDropShadow | undefined = shadowEnabled
		? { color: shadowColor, size: shadowSize, offsetX: shadowOffsetX, offsetY: shadowOffsetY, blur: shadowBlur }
		: undefined

	const glow: BitmapFontGlow | undefined = glowEnabled ? { color: glowColor, size: glowSize } : undefined

	const handleGenerate = useCallback((output: BitmapFontOutput) => {
		setLastOutput(output)
		console.log('Generated bitmap font:', output)
	}, [])

	const downloadOutput = useCallback(() => {
		if (!lastOutput) return
		const base = `${fontFamily.replace(/\s/g, '_')}_${fontSize}`

		const pngUrl = URL.createObjectURL(lastOutput.png)
		const a = document.createElement('a')
		a.href = pngUrl
		a.download = `${base}.png`
		a.click()
		URL.revokeObjectURL(pngUrl)

		const descBlob = new Blob([lastOutput.text], { type: MIME[lastOutput.format] })
		const descUrl = URL.createObjectURL(descBlob)
		const b = document.createElement('a')
		b.href = descUrl
		b.download = `${base}.${EXT[lastOutput.format]}`
		b.click()
		URL.revokeObjectURL(descUrl)
	}, [lastOutput, fontFamily, fontSize])

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
						title="BitmapFontGenerator"
						description="Generate bitmap font spritesheets — fill (solid/linear/radial gradient), stacked outlines, drop shadow, glow, layout/atlas controls, and XML/JSON/FNT export."
					/>
					<div className="d-flex flex-column gap-4 mt-4">
						{/* ── Font & Fill ── */}
						<SectionCard title="Font & Fill">
							<div className="d-flex flex-column gap-3">
								<Input label="Font Family" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} />
								<div className="d-flex gap-2">
									{rangeField('Font Size', fontSize, 8, 128, setFontSize, 'px')}
								</div>

								<Select
									label="Fill Type"
									value={fillType}
									options={[
										{ value: 'solid', label: 'Solid' },
										{ value: 'gradient', label: 'Gradient' },
									]}
									onChange={(e) => setFillType(e.target.value as 'solid' | 'gradient')}
								/>
								{fillType === 'solid' ? (
									colorField('Fill Color', fillColor, setFillColor)
								) : (
									<>
										<Select
											label="Gradient Type"
											value={gradType}
											options={[
												{ value: 'linear', label: 'Linear' },
												{ value: 'radial', label: 'Radial' },
											]}
											onChange={(e) => setGradType(e.target.value as 'linear' | 'radial')}
										/>
										<div className="d-flex gap-2">
											{colorField('Color 1', gradColor1, setGradColor1)}
											{colorField('Color 2', gradColor2, setGradColor2)}
											{gradThirdStop && colorField('Color 3', gradColor3, setGradColor3)}
										</div>
										<Checkbox
											label="Third gradient stop"
											checked={gradThirdStop}
											onChange={(e) => setGradThirdStop(e.target.checked)}
										/>
										{gradType === 'linear' && (
											<div className="d-flex gap-2">
												{rangeField('Gradient Angle', gradAngle, 0, 360, setGradAngle, '°')}
											</div>
										)}
									</>
								)}
							</div>
						</SectionCard>

						{/* ── Outline & Effects ── */}
						<SectionCard title="Outline & Effects">
							<div className="d-flex flex-column gap-3">
								<Checkbox
									label="Border"
									checked={borderEnabled}
									onChange={(e) => setBorderEnabled(e.target.checked)}
								/>
								{borderEnabled && (
									<>
										<div className="d-flex gap-2 align-items-end">
											{colorField('Color', borderColor, setBorderColor)}
											{rangeField('Thickness', borderThickness, 1, 12, setBorderThickness)}
										</div>
										<Select
											label="Stroke Align"
											value={borderAlign}
											options={[
												{ value: 'center', label: 'Center' },
												{ value: 'outer', label: 'Outer' },
												{ value: 'inner', label: 'Inner' },
											]}
											onChange={(e) => setBorderAlign(e.target.value as 'center' | 'inner' | 'outer')}
										/>
										<Checkbox
											label="Second outline (double border)"
											checked={border2Enabled}
											onChange={(e) => setBorder2Enabled(e.target.checked)}
										/>
										{border2Enabled && (
											<div className="d-flex gap-2 align-items-end">
												{colorField('Outer Color', border2Color, setBorder2Color)}
												{rangeField('Outer Thickness', border2Thickness, 2, 20, setBorder2Thickness)}
											</div>
										)}
									</>
								)}

								<Checkbox
									label="Drop Shadow"
									checked={shadowEnabled}
									onChange={(e) => setShadowEnabled(e.target.checked)}
								/>
								{shadowEnabled && (
									<>
										<div className="d-flex gap-2 align-items-end">
											{colorField('Color', shadowColor, setShadowColor)}
											{rangeField('Size', shadowSize, 0, 20, setShadowSize)}
										</div>
										<div className="d-flex gap-2">
											{rangeField('Offset X', shadowOffsetX, -20, 20, setShadowOffsetX)}
											{rangeField('Offset Y', shadowOffsetY, -20, 20, setShadowOffsetY)}
											{rangeField('Blur', shadowBlur, 0, 30, setShadowBlur)}
										</div>
									</>
								)}

								<Checkbox
									label="Glow"
									checked={glowEnabled}
									onChange={(e) => setGlowEnabled(e.target.checked)}
								/>
								{glowEnabled && (
									<div className="d-flex gap-2 align-items-end">
										{colorField('Color', glowColor, setGlowColor)}
										{rangeField('Size', glowSize, 1, 30, setGlowSize)}
									</div>
								)}
							</div>
						</SectionCard>

						{/* ── Layout & Export ── */}
						<SectionCard title="Layout & Export">
							<div className="d-flex flex-column gap-3">
								<div className="d-flex gap-2">
									{rangeField('Letter Spacing', letterSpacing, -5, 20, setLetterSpacing)}
									{rangeField('Padding', padding, 0, 16, setPadding)}
								</div>
								<div className="d-flex gap-2">
									{rangeField('Glyphs / Row', glyphsPerRow, 1, 32, setGlyphsPerRow)}
									{rangeField('Line Height (0=auto)', lineHeight, 0, 200, setLineHeight)}
								</div>
								<Checkbox
									label="Power-of-two atlas dimensions"
									checked={powerOfTwo}
									onChange={(e) => setPowerOfTwo(e.target.checked)}
								/>

								<div className="d-flex gap-2 align-items-end">
									<Select
										label="Export Scale"
										value={String(scale)}
										options={[
											{ value: '1', label: '1×' },
											{ value: '2', label: '2×' },
											{ value: '3', label: '3×' },
											{ value: '4', label: '4×' },
										]}
										onChange={(e) => setScale(Number(e.target.value))}
									/>
									<Select
										label="Export Format"
										value={exportFormat}
										options={[
											{ value: 'xml', label: 'BMFont XML' },
											{ value: 'json', label: 'JSON' },
											{ value: 'fnt', label: 'BMFont .fnt' },
										]}
										onChange={(e) => setExportFormat(e.target.value as BitmapFontExportFormat)}
									/>
								</div>
								<Checkbox
									label="Atlas background (else transparent)"
									checked={bgEnabled}
									onChange={(e) => setBgEnabled(e.target.checked)}
								/>
								{bgEnabled && colorField('Background', bgColor, setBgColor)}
							</div>
						</SectionCard>

						{/* ── Text / Glyphs ── */}
						<SectionCard title="Content">
							<div className="d-flex flex-column gap-3">
								<Input label="Preview Text" value={text} onChange={(e) => setText(e.target.value)} />
								<Textarea label="Glyphs" rows={3} value={glyphs} onChange={(e) => setGlyphs(e.target.value)} />
							</div>
						</SectionCard>

						{/* ── Preview / Output ── */}
						<SectionCard title="Preview">
							<div className="mb-3">
								<Button variant="primary" size="small" onClick={() => generatorRef.current?.generate()}>
									<Icon name="download" /> Generate
								</Button>
							</div>
							<BitmapFontGenerator
								ref={generatorRef}
								fontFamily={fontFamily}
								fontSize={fontSize}
								fill={fill}
								borders={borders}
								dropShadow={dropShadow}
								glow={glow}
								letterSpacing={letterSpacing}
								padding={padding}
								glyphsPerRow={glyphsPerRow}
								lineHeight={lineHeight || undefined}
								powerOfTwo={powerOfTwo}
								scale={scale}
								background={bgEnabled ? bgColor : undefined}
								exportFormat={exportFormat}
								glyphs={glyphs}
								text={text}
								onGenerate={handleGenerate}
							/>

							{lastOutput && (
								<div className="mt-3">
									<div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
										<h5 className="mb-0">Generated Output</h5>
										<span className="badge text-bg-secondary">
											{lastOutput.format.toUpperCase()} · {lastOutput.width}×{lastOutput.height}px ·{' '}
											{lastOutput.glyphs.length} glyphs
										</span>
										<Button variant="primary" outline size="small" onClick={downloadOutput}>
											<Icon name="download" /> Download PNG + {lastOutput.format.toUpperCase()}
										</Button>
									</div>
									<pre
										className="p-3 bg-light rounded"
										style={{ fontSize: '0.72rem', whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}
									>
										{lastOutput.text}
									</pre>
								</div>
							)}
						</SectionCard>
					</div>
				</div>
			</div>
		</div>
	)
}

export default BitmapFontGeneratorDemo
