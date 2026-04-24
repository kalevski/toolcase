import React, { useState } from 'react'
import { PhoneInput } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

export const PhoneInputDemo: React.FC = () => {
	const [phone, setPhone]     = useState('')
	const [mobile, setMobile]   = useState('')

	return (
		<DemoPage
			eyebrow="Inputs"
			title="PhoneInput"
			lede="Phone number input with built-in country selector and dial code prefix."
		>
			<DemoSection title="Default (US)">
				<PhoneInput
					label="Phone number"
					value={phone}
					onChange={setPhone}
					defaultCountry="US"
				/>
				<p style={{ color: '#64748b', marginTop: 8, marginBottom: 0, fontSize: '0.85rem' }}>Value: {phone || '—'}</p>
			</DemoSection>

			<DemoSection title="Default country: UK">
				<PhoneInput
					label="Mobile number"
					value={mobile}
					onChange={setMobile}
					defaultCountry="GB"
				/>
			</DemoSection>

			<DemoSection title="Error state">
				<PhoneInput
					label="Contact number"
					value="+1555"
					onChange={() => {}}
					error="Please enter a valid phone number."
				/>
			</DemoSection>
		</DemoPage>
	)
}
