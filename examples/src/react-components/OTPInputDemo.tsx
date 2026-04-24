import React, { useState } from 'react'
import {
	OTPInput,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

export const OTPInputDemo: React.FC = () => {
	const [otp,     setOtp]     = useState('')
	const [pin,     setPin]     = useState('')
	const [masked,  setMasked]  = useState('')
	const [alpha,   setAlpha]   = useState('')

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="OTPInput"
				description="One-time password / PIN input with auto-focus, paste support, and masking."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="6-digit OTP">
				<OTPInput
					label="Verification code"
					length={6}
					value={otp}
					onChange={setOtp}
				/>
				<p style={{ color: '#64748b', marginTop: 8, marginBottom: 0, fontSize: '0.85rem' }}>Value: {otp || '—'}</p>
			</SectionCard>

			<SectionCard title="4-digit PIN">
				<OTPInput
					label="PIN"
					length={4}
					value={pin}
					onChange={setPin}
				/>
			</SectionCard>

			<SectionCard title="Masked (password dots)">
				<OTPInput
					label="Secret code"
					length={6}
					value={masked}
					onChange={setMasked}
					masked
				/>
			</SectionCard>

			<SectionCard title="Alphanumeric">
				<OTPInput
					label="Invite code"
					length={8}
					value={alpha}
					onChange={setAlpha}
					mode="alphanumeric"
				/>
			</SectionCard>

			<SectionCard title="Error state">
				<OTPInput
					label="Code"
					length={6}
					value="12345X"
					onChange={() => {}}
					error="Invalid code. Please try again."
				/>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}
