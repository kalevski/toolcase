import React, { useState } from 'react'
import { PhoneInput, Card, CodeSnippet } from '@toolcase/react-components'

const usageCode = `import { PhoneInput } from '@toolcase/react-components'

const [phone, setPhone] = useState('')

<PhoneInput
  label="Phone number"
  value={phone}
  onChange={setPhone}
  defaultCountry="US"
/>`

export const PhoneInputDemo: React.FC = () => {
	const [phone, setPhone]     = useState('')
	const [mobile, setMobile]   = useState('')

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">PhoneInput</h1>
					<p className="text-muted mb-0">Phone number input with built-in country selector and dial code prefix.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Default (US)</h2>
						<PhoneInput
							label="Phone number"
							value={phone}
							onChange={setPhone}
							defaultCountry="US"
						/>
						<p className="text-muted mt-2 mb-0" style={{ fontSize: '0.85rem' }}>Value: {phone || '—'}</p>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Default country: UK</h2>
						<PhoneInput
							label="Mobile number"
							value={mobile}
							onChange={setMobile}
							defaultCountry="GB"
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Error state</h2>
						<PhoneInput
							label="Contact number"
							value="+1555"
							onChange={() => {}}
							error="Please enter a valid phone number."
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
