import React, { useState } from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Select
} from '@toolcase/react-components'

const SelectDemo: React.FC = () => {
	const [engine, setEngine] = useState('unity')

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="Select"
				description="A labeled dropdown select with options array."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Basic">
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
			</SectionCard>

			<SectionCard title="States">
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
			</SectionCard>

			<SectionCard title="Without Label">
				<Select
					options={[
						{ value: 'asc', label: 'Sort: A → Z' },
						{ value: 'desc', label: 'Sort: Z → A' },
						{ value: 'date', label: 'Sort: Newest' },
					]}
				/>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default SelectDemo
