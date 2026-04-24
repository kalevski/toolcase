import React, { useState, useCallback } from 'react'
import {
	BitmapFontBorder,
	BitmapFontDropShadow,
	BitmapFontFill,
	BitmapFontGenerator,
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

const BitmapFontGeneratorDemo = () => {
	const [fontFamily, setFontFamily] = useState('Arial')
	const [fontSize, setFontSize] = useState(32)
	const [text, setText] = useState('Hello World!')
	const [glyphs, setGlyphs] = useState(DEFAULT_GLYPHS)

	const [fillType, setFillType] = useState<'solid' | 'gradient'>('solid')
	const [fillColor, setFillColor] = useState('#ffffff')
	const [gradColor1, setGradColor1] = useState('#ff6b6b')
	const [gradColor2, setGradColor2] = useState('#ffd93d')
	const [gradAngle, setGradAngle] = useState(90)

	const [borderEnabled, setBorderEnabled] = useState(false)
	const [borderColor, setBorderColor] = useState('#000000')
	const [borderThickness, setBorderThickness] = useState(2)

	const [shadowEnabled, setShadowEnabled] = useState(false)
	const [shadowColor, setShadowColor] = useState('#000000')
	const [shadowSize, setShadowSize] = useState(4)

	const [lastOutput, setLastOutput] = useState<BitmapFontOutput | null>(null)

	const fill: BitmapFontFill =
		fillType === 'solid'
			? { type: 'solid', color: fillColor }
			: { type: 'gradient', gradientColors: [gradColor1, gradColor2], gradientAngle: gradAngle }

	const border: BitmapFontBorder | undefined = borderEnabled
		? { color: borderColor, thickness: borderThickness }
		: undefined

	const dropShadow: BitmapFontDropShadow | undefined = shadowEnabled
		? { color: shadowColor, size: shadowSize }
		: undefined

	const handleGenerate = useCallback((output: BitmapFontOutput) => {
		setLastOutput(output)
		console.log('Generated bitmap font:', output)
	}, [])

	const downloadOutput = useCallback(() => {
		if (!lastOutput) return

		const pngUrl = URL.createObjectURL(lastOutput.png)
		const a = document.createElement('a')
		a.href = pngUrl
		a.download = `${fontFamily.replace(/\s/g, '_')}_${fontSize}.png`
		a.click()
		URL.revokeObjectURL(pngUrl)

		const xmlBlob = new Blob([lastOutput.xml], { type: 'text/xml' })
		const xmlUrl = URL.createObjectURL(xmlBlob)
		const b = document.createElement('a')
		b.href = xmlUrl
		b.download = `${fontFamily.replace(/\s/g, '_')}_${fontSize}.xml`
		b.click()
		URL.revokeObjectURL(xmlUrl)
	}, [lastOutput, fontFamily, fontSize])

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Editors</RichPageHeaderChip>}
				title="BitmapFontGenerator"
				description="Generate bitmap font spritesheets with customizable fill, border, drop shadow, and glyph sets."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Settings">
				<div className="d-flex flex-column gap-3">
					{/* Font */}
					<Input
						label="Font Family"
						value={fontFamily}
						onChange={(e) => setFontFamily(e.target.value)}
					/>
					<div>
						<label className="form-label">Font Size: {fontSize}px</label>
						<input
							type="range"
							className="form-range"
							min={8}
							max={128}
							value={fontSize}
							onChange={(e) => setFontSize(Number(e.target.value))}
						/>
					</div>

					{/* Fill */}
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
						<div>
							<label className="form-label">Fill Color</label>
							<input
								type="color"
								className="form-control form-control-color form-control-sm"
								value={fillColor}
								onChange={(e) => setFillColor(e.target.value)}
							/>
						</div>
					) : (
						<>
							<div className="d-flex gap-2">
								<div className="flex-fill">
									<label className="form-label">Color 1</label>
									<input
										type="color"
										className="form-control form-control-color form-control-sm"
										value={gradColor1}
										onChange={(e) => setGradColor1(e.target.value)}
									/>
								</div>
								<div className="flex-fill">
									<label className="form-label">Color 2</label>
									<input
										type="color"
										className="form-control form-control-color form-control-sm"
										value={gradColor2}
										onChange={(e) => setGradColor2(e.target.value)}
									/>
								</div>
							</div>
							<div>
								<label className="form-label">Gradient Angle: {gradAngle}°</label>
								<input
									type="range"
									className="form-range"
									min={0}
									max={360}
									value={gradAngle}
									onChange={(e) => setGradAngle(Number(e.target.value))}
								/>
							</div>
						</>
					)}

					{/* Border */}
					<Checkbox
						label="Border"
						checked={borderEnabled}
						onChange={(e) => setBorderEnabled(e.target.checked)}
					/>
					{borderEnabled && (
						<div className="d-flex gap-2">
							<div>
								<label className="form-label">Color</label>
								<input
									type="color"
									className="form-control form-control-color form-control-sm"
									value={borderColor}
									onChange={(e) => setBorderColor(e.target.value)}
								/>
							</div>
							<div className="flex-fill">
								<label className="form-label">Thickness: {borderThickness}</label>
								<input
									type="range"
									className="form-range"
									min={1}
									max={10}
									value={borderThickness}
									onChange={(e) => setBorderThickness(Number(e.target.value))}
								/>
							</div>
						</div>
					)}

					{/* Drop Shadow */}
					<Checkbox
						label="Drop Shadow"
						checked={shadowEnabled}
						onChange={(e) => setShadowEnabled(e.target.checked)}
					/>
					{shadowEnabled && (
						<div className="d-flex gap-2">
							<div>
								<label className="form-label">Color</label>
								<input
									type="color"
									className="form-control form-control-color form-control-sm"
									value={shadowColor}
									onChange={(e) => setShadowColor(e.target.value)}
								/>
							</div>
							<div className="flex-fill">
								<label className="form-label">Size: {shadowSize}</label>
								<input
									type="range"
									className="form-range"
									min={1}
									max={20}
									value={shadowSize}
									onChange={(e) => setShadowSize(Number(e.target.value))}
								/>
							</div>
						</div>
					)}

					{/* Text / Glyphs */}
					<Input
						label="Preview Text"
						value={text}
						onChange={(e) => setText(e.target.value)}
					/>
					<Textarea
						label="Glyphs"
						rows={3}
						value={glyphs}
						onChange={(e) => setGlyphs(e.target.value)}
					/>
				</div>
			</SectionCard>

			<SectionCard title="Preview">
				<BitmapFontGenerator
					fontFamily={fontFamily}
					fontSize={fontSize}
					fill={fill}
					border={border}
					dropShadow={dropShadow}
					glyphs={glyphs}
					text={text}
					onGenerate={handleGenerate}
				/>

				{lastOutput && (
					<div className="mt-3">
						<div className="d-flex align-items-center gap-2 mb-2">
							<h5 className="mb-0">Generated Output</h5>
							<Button variant="primary" outline size="small" onClick={downloadOutput}>
								<Icon name="download" /> Download
							</Button>
						</div>
						<pre
							className="p-3 bg-light rounded"
							style={{ fontSize: '0.72rem', whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}
						>
							{lastOutput.xml}
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
