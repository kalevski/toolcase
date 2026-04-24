import React, { useState } from 'react'
import { Checkbox } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const CheckboxDemo: React.FC = () => {
	const [checked, setChecked] = useState(true)

	return (
		<DemoPage
			eyebrow="Inputs"
			title="Checkbox"
			lede="A form-check checkbox input with optional label and inline layout."
		>
			<DemoSection title="Basic">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
					<Checkbox label="Accept terms and conditions" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
					<Checkbox label="Subscribe to newsletter" />
					<Checkbox label="Remember me" defaultChecked />
				</div>
			</DemoSection>

			<DemoSection title="Inline">
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
					<Checkbox label="Option A" inline />
					<Checkbox label="Option B" inline defaultChecked />
					<Checkbox label="Option C" inline />
				</div>
			</DemoSection>

			<DemoSection title="Disabled">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
					<Checkbox label="Disabled unchecked" disabled />
					<Checkbox label="Disabled checked" disabled checked />
				</div>
			</DemoSection>

			<DemoSection title="Without Label">
				<div style={{ display: 'flex', gap: 12 }}>
					<Checkbox defaultChecked />
					<Checkbox />
					<Checkbox disabled checked />
				</div>
			</DemoSection>
		</DemoPage>
	)
}

export default CheckboxDemo
