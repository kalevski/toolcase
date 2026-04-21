import React, { useState } from 'react'
import { NumberInput, Card, CodeSnippet } from '@toolcase/react-components'

const usageCode = `import { NumberInput } from '@toolcase/react-components'

const [qty, setQty] = useState<number | ''>(1)

<NumberInput
  label="Quantity"
  value={qty}
  onChange={setQty}
  min={0}
  max={100}
  step={1}
/>

// With prefix/suffix
<NumberInput
  label="Price"
  value={price}
  onChange={setPrice}
  prefix="$"
  precision={2}
  min={0}
/>

// Error state
<NumberInput
  label="Age"
  value={age}
  onChange={setAge}
  min={18}
  max={120}
  error="Must be 18 or older"
/>`

export const NumberInputDemo: React.FC = () => {
	const [qty,     setQty]     = useState<number | ''>(1)
	const [price,   setPrice]   = useState<number | ''>(9.99)
	const [percent, setPercent] = useState<number | ''>(50)
	const [age,     setAge]     = useState<number | ''>('')
	const [temp,    setTemp]    = useState<number | ''>(21)

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">NumberInput</h1>
					<p className="text-muted mb-0">Numeric input field with increment/decrement controls, keyboard support, and mouse wheel interaction.</p>
				</div>
			</div>

			{/* Basic */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Basic</h2>
						<div className="row g-3">
							<div className="col-sm-6">
								<NumberInput
									label="Quantity"
									value={qty}
									onChange={setQty}
									min={0}
									max={99}
									step={1}
								/>
							</div>
							<div className="col-sm-6">
								<NumberInput
									label="Temperature (°C)"
									value={temp}
									onChange={setTemp}
									min={-50}
									max={60}
									step={0.5}
									precision={1}
									suffix="°C"
								/>
							</div>
						</div>
					</Card>
				</div>
			</div>

			{/* Prefix / Suffix */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Prefix &amp; Suffix</h2>
						<div className="row g-3">
							<div className="col-sm-6">
								<NumberInput
									label="Price"
									value={price}
									onChange={setPrice}
									prefix="$"
									step={0.01}
									precision={2}
									min={0}
								/>
							</div>
							<div className="col-sm-6">
								<NumberInput
									label="Completion"
									value={percent}
									onChange={setPercent}
									suffix="%"
									min={0}
									max={100}
								/>
							</div>
						</div>
					</Card>
				</div>
			</div>

			{/* Error state */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Error state</h2>
						<div className="row g-3">
							<div className="col-sm-6">
								<NumberInput
									label="Age"
									value={age}
									onChange={setAge}
									min={18}
									max={120}
									error={age !== '' && (age as number) < 18 ? 'Must be 18 or older' : undefined}
								/>
							</div>
							<div className="col-sm-6">
								<NumberInput
									label="Disabled"
									value={10}
									onChange={() => {}}
									disabled
								/>
							</div>
						</div>
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
