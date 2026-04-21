import React, { useState } from 'react'
import { OTPInput, Card, CodeSnippet } from '@toolcase/react-components'

const usageCode = `import { OTPInput } from '@toolcase/react-components'

const [otp, setOtp] = useState('')

<OTPInput
  label="Verification code"
  length={6}
  value={otp}
  onChange={setOtp}
/>`

export const OTPInputDemo: React.FC = () => {
	const [otp,     setOtp]     = useState('')
	const [pin,     setPin]     = useState('')
	const [masked,  setMasked]  = useState('')
	const [alpha,   setAlpha]   = useState('')

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">OTPInput</h1>
					<p className="text-muted mb-0">One-time password / PIN input with auto-focus, paste support, and masking.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">6-digit OTP</h2>
						<OTPInput
							label="Verification code"
							length={6}
							value={otp}
							onChange={setOtp}
						/>
						<p className="text-muted mt-2 mb-0" style={{ fontSize: '0.85rem' }}>Value: {otp || '—'}</p>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">4-digit PIN</h2>
						<OTPInput
							label="PIN"
							length={4}
							value={pin}
							onChange={setPin}
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Masked (password dots)</h2>
						<OTPInput
							label="Secret code"
							length={6}
							value={masked}
							onChange={setMasked}
							masked
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Alphanumeric</h2>
						<OTPInput
							label="Invite code"
							length={8}
							value={alpha}
							onChange={setAlpha}
							mode="alphanumeric"
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Error state</h2>
						<OTPInput
							label="Code"
							length={6}
							value="12345X"
							onChange={() => {}}
							error="Invalid code. Please try again."
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet language="typescript" code={usageCode} />
					</Card>
				</div>
			</div>
		</div>
	)
}
