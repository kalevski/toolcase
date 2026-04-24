import React, { useState } from 'react'
import { RadioGroup } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const RadioGroupDemo: React.FC = () => {
	const [plan, setPlan] = useState('pro')
	const [region, setRegion] = useState('eu')

	return (
		<DemoPage
			eyebrow="Inputs"
			title="RadioGroup"
			lede="A labeled group of radio buttons for single-select from an options array."
		>
			<DemoSection title="Vertical">
				<RadioGroup
					label="Plan"
					options={[
						{ value: 'free', label: 'Free' },
						{ value: 'pro', label: 'Pro' },
						{ value: 'enterprise', label: 'Enterprise' },
					]}
					value={plan}
					onChange={setPlan}
				/>
				<p style={{ color: '#64748b', marginTop: 8, marginBottom: 0, fontSize: '0.8rem' }}>Selected: {plan}</p>
			</DemoSection>

			<DemoSection title="Inline">
				<RadioGroup
					label="Region"
					options={[
						{ value: 'us', label: 'US East' },
						{ value: 'eu', label: 'EU West' },
						{ value: 'ap', label: 'Asia Pacific' },
					]}
					value={region}
					onChange={setRegion}
					inline
				/>
				<p style={{ color: '#64748b', marginTop: 8, marginBottom: 0, fontSize: '0.8rem' }}>Selected: {region}</p>
			</DemoSection>

			<DemoSection title="With Disabled Option">
				<RadioGroup
					label="Environment"
					options={[
						{ value: 'dev', label: 'Development' },
						{ value: 'staging', label: 'Staging' },
						{ value: 'prod', label: 'Production', disabled: true },
					]}
					value="dev"
					onChange={() => {}}
				/>
			</DemoSection>
		</DemoPage>
	)
}

export default RadioGroupDemo
