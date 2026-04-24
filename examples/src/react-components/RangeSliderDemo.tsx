import React, { useState } from 'react'
import { RangeSlider } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

export const RangeSliderDemo: React.FC = () => {
	const [price,    setPrice]    = useState<[number, number]>([20, 80])
	const [temp,     setTemp]     = useState<[number, number]>([15, 28])
	const [year,     setYear]     = useState<[number, number]>([2010, 2023])
	const [ticked,   setTicked]   = useState<[number, number]>([2, 7])

	return (
		<DemoPage
			eyebrow="Inputs"
			title="RangeSlider"
			lede="Dual-handle range input with keyboard support and optional tick marks."
		>
			<DemoSection title="Price Range">
				<RangeSlider
					label="Price range"
					value={price}
					onChange={setPrice}
					min={0}
					max={500}
					step={5}
					formatValue={(v) => `$${v}`}
				/>
			</DemoSection>

			<DemoSection title="Temperature">
				<RangeSlider
					label="Temperature (°C)"
					value={temp}
					onChange={setTemp}
					min={-20}
					max={50}
					step={1}
					formatValue={(v) => `${v}°`}
				/>
			</DemoSection>

			<DemoSection title="With Ticks">
				<RangeSlider
					label="Rating range"
					value={ticked}
					onChange={setTicked}
					min={1}
					max={10}
					step={1}
					ticks
				/>
			</DemoSection>

			<DemoSection title="Year Range">
				<RangeSlider
					label="Year range"
					value={year}
					onChange={setYear}
					min={1990}
					max={2030}
					step={1}
					formatValue={(v) => `${v}`}
				/>
			</DemoSection>
		</DemoPage>
	)
}
