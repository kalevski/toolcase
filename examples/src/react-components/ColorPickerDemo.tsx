import React, { useState } from 'react'
import { ColorPicker, Card, CodeSnippet } from '@toolcase/react-components'

const PALETTE = [
	'#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
	'#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1',
	'#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
]

const LABELED_COLORS = [
	{ hex: '#ef4444', label: 'Red' },
	{ hex: '#f59e0b', label: 'Amber' },
	{ hex: '#22c55e', label: 'Green' },
	{ hex: '#3b82f6', label: 'Blue' },
	{ hex: '#6366f1', label: 'Indigo' },
	{ hex: '#8b5cf6', label: 'Violet' },
]

const ColorPickerDemo: React.FC = () => {
	const [color1, setColor1] = useState('#6366f1')
	const [color2, setColor2] = useState('#ef4444')

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">ColorPicker</h1>
					<p className="text-muted mb-0">A dropdown color swatch picker with configurable palette and grid columns.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">String Colors (5 columns)</h2>
						<ColorPicker
							label="Primary Color"
							colors={PALETTE}
							value={color1}
							onChange={setColor1}
							columns={5}
						/>
						<p className="text-muted mt-2 mb-0" style={{ fontSize: '0.8rem' }}>Selected: {color1}</p>
					</Card>
				</div>
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Labeled Colors (3 columns)</h2>
						<ColorPicker
							label="Accent Color"
							colors={LABELED_COLORS}
							value={color2}
							onChange={setColor2}
							columns={3}
						/>
						<p className="text-muted mt-2 mb-0" style={{ fontSize: '0.8rem' }}>Selected: {color2}</p>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Loading State</h2>
						<ColorPicker
							label="Fetching Palette..."
							colors={PALETTE}
							loading
						/>
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
							code={`import { ColorPicker } from '@toolcase/react-components'

<ColorPicker label="Brand Color" value={color} onChange={setColor} />`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default ColorPickerDemo
