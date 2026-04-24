import React, { useState } from 'react'
import {
	ColorPicker,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

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
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="ColorPicker"
				description="A dropdown color swatch picker with configurable palette and grid columns."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="String Colors (5 columns)">
				<ColorPicker
					label="Primary Color"
					colors={PALETTE}
					value={color1}
					onChange={setColor1}
					columns={5}
				/>
				<p className="text-muted mt-2 mb-0" style={{ fontSize: '0.8rem' }}>Selected: {color1}</p>
			</SectionCard>

			<SectionCard title="Labeled Colors (3 columns)">
				<ColorPicker
					label="Accent Color"
					colors={LABELED_COLORS}
					value={color2}
					onChange={setColor2}
					columns={3}
				/>
				<p className="text-muted mt-2 mb-0" style={{ fontSize: '0.8rem' }}>Selected: {color2}</p>
			</SectionCard>

			<SectionCard title="Loading State">
				<ColorPicker
					label="Fetching Palette..."
					colors={PALETTE}
					loading
				/>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default ColorPickerDemo
