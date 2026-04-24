import React, { useState } from 'react'
import { Slider } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

export const SliderDemo: React.FC = () => {
	const [volume,    setVolume]    = useState(60)
	const [rating,    setRating]    = useState(3)
	const [budget,    setBudget]    = useState(2500)
	const [opacity,   setOpacity]   = useState(75)
	const [year,      setYear]      = useState(2020)

	return (
		<DemoPage
			eyebrow="Inputs"
			title="Slider"
			lede="Range input with keyboard support, tick marks, and drag tooltip."
		>
			<DemoSection title="Basic">
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
			</DemoSection>

			<DemoSection title="Tick Marks">
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
			</DemoSection>

			<DemoSection title="Custom Formatter">
				<Slider
					label="Budget"
					value={budget}
					onChange={setBudget}
					min={0}
					max={10000}
					step={100}
					formatValue={(v) => `$${v.toLocaleString()}`}
				/>
			</DemoSection>

			<DemoSection title="Disabled">
				<Slider
					label="Locked value"
					value={40}
					onChange={() => {}}
					disabled
				/>
			</DemoSection>
		</DemoPage>
	)
}
