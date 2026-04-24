import React, { useState } from 'react'
import { CheckboxGroup } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const CheckboxGroupDemo: React.FC = () => {
	const [features, setFeatures] = useState<string[]>(['multiplayer', 'leaderboards'])
	const [inline, setInline] = useState<string[]>(['sm'])

	return (
		<DemoPage
			eyebrow="Inputs"
			title="CheckboxGroup"
			lede="A labeled group of checkboxes for multi-select from an options array."
		>
			<DemoSection title="Vertical">
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
			</DemoSection>

			<DemoSection title="Inline">
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
			</DemoSection>

			<DemoSection title="With Disabled Option">
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
			</DemoSection>
		</DemoPage>
	)
}

export default CheckboxGroupDemo
