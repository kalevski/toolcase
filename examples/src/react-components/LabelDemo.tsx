import React from 'react'
import { Label } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const LabelDemo: React.FC = () => (
	<DemoPage
		eyebrow="Typography"
		title="Label"
		lede="A styled label with optional required indicator and tooltip icon. Used for form fields."
	>
		<DemoSection title="Basic">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<Label>Username</Label>
				<Label>Email Address</Label>
			</div>
		</DemoSection>

		<DemoSection title="Required">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<Label required>Full Name</Label>
				<Label required>Password</Label>
			</div>
		</DemoSection>

		<DemoSection title="With Tooltip">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<Label tooltip="Your public display name">Display Name</Label>
				<Label required tooltip="Must be at least 8 characters">Password</Label>
			</div>
		</DemoSection>

		<DemoSection title="Sizes">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<Label size="small">Small Label</Label>
				<Label size="default">Default Label</Label>
				<Label size="large">Large Label</Label>
			</div>
		</DemoSection>
	</DemoPage>
)

export default LabelDemo
