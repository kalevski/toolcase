import React, { useState } from 'react'
import {
	CheckboxGroup,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const CheckboxGroupDemo: React.FC = () => {
	const [features, setFeatures] = useState<string[]>(['multiplayer', 'leaderboards'])
	const [inline, setInline] = useState<string[]>(['sm'])

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="CheckboxGroup"
				description="A labeled group of checkboxes for multi-select from an options array."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Vertical">
				<CheckboxGroup
					label="Game Features"
					options={[
						{ value: 'multiplayer', label: 'Multiplayer' },
						{ value: 'leaderboards', label: 'Leaderboards' },
						{ value: 'achievements', label: 'Achievements' },
						{ value: 'cloud-save', label: 'Cloud Saves' },
					]}
					value={features}
					onChange={setFeatures}
				/>
				<p className="text-muted mt-2 mb-0" style={{ fontSize: '0.8rem' }}>Selected: {features.join(', ') || 'none'}</p>
			</SectionCard>

			<SectionCard title="Inline">
				<CheckboxGroup
					label="Screen Sizes"
					options={[
						{ value: 'sm', label: 'Small' },
						{ value: 'md', label: 'Medium' },
						{ value: 'lg', label: 'Large' },
						{ value: 'xl', label: 'Extra Large' },
					]}
					value={inline}
					onChange={setInline}
					inline
				/>
			</SectionCard>

			<SectionCard title="With Disabled Option">
				<CheckboxGroup
					label="Platforms"
					options={[
						{ value: 'web', label: 'Web' },
						{ value: 'mobile', label: 'Mobile' },
						{ value: 'desktop', label: 'Desktop', disabled: true },
						{ value: 'console', label: 'Console', disabled: true },
					]}
					value={['web']}
					onChange={() => {}}
				/>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default CheckboxGroupDemo
