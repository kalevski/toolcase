import React, { useState } from 'react'
import { NumberInput } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

export const NumberInputDemo: React.FC = () => {
	const [qty,     setQty]     = useState<number | ''>(1)
	const [price,   setPrice]   = useState<number | ''>(9.99)
	const [percent, setPercent] = useState<number | ''>(50)
	const [age,     setAge]     = useState<number | ''>('')
	const [temp,    setTemp]    = useState<number | ''>(21)

	return (
		<DemoPage
			eyebrow="Inputs"
			title="NumberInput"
			lede="Numeric input field with increment/decrement controls, keyboard support, and mouse wheel interaction."
		>
			<DemoSection title="Basic">
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
					<NumberInput
						label="Quantity"
						value={qty}
						onChange={setQty}
						min={0}
						max={99}
						step={1}
					/>
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
			</DemoSection>

			<DemoSection title="Prefix & Suffix">
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
					<NumberInput
						label="Price"
						value={price}
						onChange={setPrice}
						prefix="$"
						step={0.01}
						precision={2}
						min={0}
					/>
					<NumberInput
						label="Completion"
						value={percent}
						onChange={setPercent}
						suffix="%"
						min={0}
						max={100}
					/>
				</div>
			</DemoSection>

			<DemoSection title="Error state">
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
					<NumberInput
						label="Age"
						value={age}
						onChange={setAge}
						min={18}
						max={120}
						error={age !== '' && (age as number) < 18 ? 'Must be 18 or older' : undefined}
					/>
					<NumberInput
						label="Disabled"
						value={10}
						onChange={() => {}}
						disabled
					/>
				</div>
			</DemoSection>
		</DemoPage>
	)
}
