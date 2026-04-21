import React, { useState } from 'react'
import { RangeSlider, Card, CodeSnippet } from '@toolcase/react-components'

const usageCode = `import { RangeSlider } from '@toolcase/react-components'

const [range, setRange] = useState<[number, number]>([20, 80])

<RangeSlider
  label="Price range"
  value={range}
  onChange={setRange}
  min={0}
  max={100}
  step={1}
  formatValue={(v) => \`$\${v}\`}
/>`

export const RangeSliderDemo: React.FC = () => {
	const [price,    setPrice]    = useState<[number, number]>([20, 80])
	const [temp,     setTemp]     = useState<[number, number]>([15, 28])
	const [year,     setYear]     = useState<[number, number]>([2010, 2023])
	const [ticked,   setTicked]   = useState<[number, number]>([2, 7])

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">RangeSlider</h1>
					<p className="text-muted mb-0">Dual-handle range input with keyboard support and optional tick marks.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Price Range</h2>
						<RangeSlider
							label="Price range"
							value={price}
							onChange={setPrice}
							min={0}
							max={500}
							step={5}
							formatValue={(v) => `$${v}`}
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Temperature</h2>
						<RangeSlider
							label="Temperature (°C)"
							value={temp}
							onChange={setTemp}
							min={-20}
							max={50}
							step={1}
							formatValue={(v) => `${v}°`}
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">With Ticks</h2>
						<RangeSlider
							label="Rating range"
							value={ticked}
							onChange={setTicked}
							min={1}
							max={10}
							step={1}
							ticks
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Year Range</h2>
						<RangeSlider
							label="Year range"
							value={year}
							onChange={setYear}
							min={1990}
							max={2030}
							step={1}
							formatValue={(v) => `${v}`}
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet language="typescript" code={usageCode} />
					</Card>
				</div>
			</div>
		</div>
	)
}
