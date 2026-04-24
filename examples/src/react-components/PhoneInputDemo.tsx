import React, { useState } from 'react'
import {
	PhoneInput,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

export const PhoneInputDemo: React.FC = () => {
	const [phone, setPhone]     = useState('')
	const [mobile, setMobile]   = useState('')

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="PhoneInput"
				description="Phone number input with built-in country selector and dial code prefix."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Default (US)">
				<PhoneInput
					label="Phone number"
					value={phone}
					onChange={setPhone}
					defaultCountry="US"
				/>
				<p style={{ color: '#64748b', marginTop: 8, marginBottom: 0, fontSize: '0.85rem' }}>Value: {phone || '—'}</p>
			</SectionCard>

			<SectionCard title="Default country: UK">
				<PhoneInput
					label="Mobile number"
					value={mobile}
					onChange={setMobile}
					defaultCountry="GB"
				/>
			</SectionCard>

			<SectionCard title="Error state">
				<PhoneInput
					label="Contact number"
					value="+1555"
					onChange={() => {}}
					error="Please enter a valid phone number."
				/>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}
