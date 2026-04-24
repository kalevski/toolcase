import React, { useState } from 'react'
import {
	RadioGroup,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const RadioGroupDemo: React.FC = () => {
	const [plan, setPlan] = useState('pro')
	const [region, setRegion] = useState('eu')

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="RadioGroup"
				description="A labeled group of radio buttons for single-select from an options array."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Vertical">
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
			</SectionCard>

			<SectionCard title="Inline">
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
			</SectionCard>

			<SectionCard title="With Disabled Option">
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
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default RadioGroupDemo
