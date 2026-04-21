import React, { useState } from 'react'
import { Slider, Card, CodeSnippet } from '@toolcase/react-components'

const usageCode = `import { Slider } from '@toolcase/react-components'

const [volume, setVolume] = useState(60)

// Basic
<Slider label="Volume" value={volume} onChange={setVolume} />

// With tick marks and custom formatter
<Slider
  label="Rating"
  value={rating}
  onChange={setRating}
  min={1}
  max={5}
  step={1}
  ticks
  formatValue={(v) => String(v) + '★'}
/>

// Currency range
<Slider
  label="Budget"
  value={budget}
  onChange={setBudget}
  min={0}
  max={10000}
  step={100}
  formatValue={(v) => '$' + v.toLocaleString()}
/>`

export const SliderDemo: React.FC = () => {
	const [volume,    setVolume]    = useState(60)
	const [rating,    setRating]    = useState(3)
	const [budget,    setBudget]    = useState(2500)
	const [opacity,   setOpacity]   = useState(75)
	const [year,      setYear]      = useState(2020)

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Slider</h1>
					<p className="text-muted mb-0">Range input with keyboard support, tick marks, and drag tooltip.</p>
				</div>
			</div>

			{/* Basic */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Basic</h2>
						<div className="d-flex flex-column gap-4">
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
					</Card>
				</div>
			</div>

			{/* Tick marks */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Tick Marks</h2>
						<div className="d-flex flex-column gap-5 pb-3">
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
					</Card>
				</div>
			</div>

			{/* Custom formatter */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Custom Formatter</h2>
						<Slider
							label="Budget"
							value={budget}
							onChange={setBudget}
							min={0}
							max={10000}
							step={100}
							formatValue={(v) => `$${v.toLocaleString()}`}
						/>
					</Card>
				</div>
			</div>

			{/* Disabled */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Disabled</h2>
						<Slider
							label="Locked value"
							value={40}
							onChange={() => {}}
							disabled
						/>
					</Card>
				</div>
			</div>

			{/* Code */}
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
