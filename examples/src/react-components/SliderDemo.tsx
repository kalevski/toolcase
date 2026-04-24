import React, { useState } from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Slider
} from '@toolcase/react-components'

export const SliderDemo: React.FC = () => {
	const [volume,    setVolume]    = useState(60)
	const [rating,    setRating]    = useState(3)
	const [budget,    setBudget]    = useState(2500)
	const [opacity,   setOpacity]   = useState(75)
	const [year,      setYear]      = useState(2020)

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="Slider"
				description="Range input with keyboard support, tick marks, and drag tooltip."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Basic">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
					<Slider
						label="Volume"
						value={volume}
						onChange={setVolume}
					/>
					<Slider
						label="Opacity"
						value={opacity}
						onChange={setOpacity}
						formatValue={(v) => `${v}%`}
					/>
				</div>
			</SectionCard>

			<SectionCard title="Tick Marks">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 40, paddingBottom: 12 }}>
					<Slider
						label="Rating"
						value={rating}
						onChange={setRating}
						min={1}
						max={5}
						step={1}
						ticks
						formatValue={(v) => `${v}★`}
					/>
					<Slider
						label="Year"
						value={year}
						onChange={setYear}
						min={2015}
						max={2025}
						step={1}
						ticks
						formatValue={(v) => String(v)}
					/>
				</div>
			</SectionCard>

			<SectionCard title="Custom Formatter">
				<Slider
					label="Budget"
					value={budget}
					onChange={setBudget}
					min={0}
					max={10000}
					step={100}
					formatValue={(v) => `$${v.toLocaleString()}`}
				/>
			</SectionCard>

			<SectionCard title="Disabled">
				<Slider
					label="Locked value"
					value={40}
					onChange={() => {}}
					disabled
				/>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}
