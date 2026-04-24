import React, { useState } from 'react'
import { OTPInput } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

export const OTPInputDemo: React.FC = () => {
	const [otp,     setOtp]     = useState('')
	const [pin,     setPin]     = useState('')
	const [masked,  setMasked]  = useState('')
	const [alpha,   setAlpha]   = useState('')

	return (
		<DemoPage
			eyebrow="Inputs"
			title="OTPInput"
			lede="One-time password / PIN input with auto-focus, paste support, and masking."
		>
			<DemoSection title="6-digit OTP">
				<OTPInput
					label="Verification code"
					length={6}
					value={otp}
					onChange={setOtp}
				/>
				<p style={{ color: '#64748b', marginTop: 8, marginBottom: 0, fontSize: '0.85rem' }}>Value: {otp || '—'}</p>
			</DemoSection>

			<DemoSection title="4-digit PIN">
				<OTPInput
					label="PIN"
					length={4}
					value={pin}
					onChange={setPin}
				/>
			</DemoSection>

			<DemoSection title="Masked (password dots)">
				<OTPInput
					label="Secret code"
					length={6}
					value={masked}
					onChange={setMasked}
					masked
				/>
			</DemoSection>

			<DemoSection title="Alphanumeric">
				<OTPInput
					label="Invite code"
					length={8}
					value={alpha}
					onChange={setAlpha}
					mode="alphanumeric"
				/>
			</DemoSection>

			<DemoSection title="Error state">
				<OTPInput
					label="Code"
					length={6}
					value="12345X"
					onChange={() => {}}
					error="Invalid code. Please try again."
				/>
			</DemoSection>
		</DemoPage>
	)
}
