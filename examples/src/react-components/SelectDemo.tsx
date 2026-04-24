import React, { useState } from 'react'
import { Select } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const SelectDemo: React.FC = () => {
	const [engine, setEngine] = useState('unity')

	return (
		<DemoPage
			eyebrow="Inputs"
			title="Select"
			lede="A labeled dropdown select with options array."
		>
			<DemoSection title="Basic">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<Select
						label="Game Engine"
						options={[
							{ value: 'unity', label: 'Unity' },
							{ value: 'godot', label: 'Godot' },
							{ value: 'unreal', label: 'Unreal Engine' },
							{ value: 'phaser', label: 'Phaser' },
						]}
						value={engine}
						onChange={(e) => setEngine(e.target.value)}
					/>
					<Select
						label="Category"
						options={[
							{ value: 'sprites', label: 'Sprites' },
							{ value: 'audio', label: 'Audio' },
							{ value: 'data', label: 'Data' },
						]}
					/>
				</div>
			</DemoSection>

			<DemoSection title="States">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<Select
						label="Enabled"
						options={[
							{ value: '1', label: 'Option 1' },
							{ value: '2', label: 'Option 2' },
						]}
					/>
					<Select
						label="Disabled"
						options={[
							{ value: '1', label: 'Option 1' },
						]}
						disabled
					/>
				</div>
			</DemoSection>

			<DemoSection title="Without Label">
				<Select
					options={[
						{ value: 'asc', label: 'Sort: A → Z' },
						{ value: 'desc', label: 'Sort: Z → A' },
						{ value: 'date', label: 'Sort: Newest' },
					]}
				/>
			</DemoSection>
		</DemoPage>
	)
}

export default SelectDemo
