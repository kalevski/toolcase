import React from 'react'
import {
	Label,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const LabelDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Typography</RichPageHeaderChip>}
				title="Label"
				description="A styled label with optional required indicator and tooltip icon. Used for form fields."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Basic">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<Label>Username</Label>
				<Label>Email Address</Label>
			</div>
		</SectionCard>

		<SectionCard title="Required">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<Label required>Full Name</Label>
				<Label required>Password</Label>
			</div>
		</SectionCard>

		<SectionCard title="With Tooltip">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<Label tooltip="Your public display name">Display Name</Label>
				<Label required tooltip="Must be at least 8 characters">Password</Label>
			</div>
		</SectionCard>

		<SectionCard title="Sizes">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<Label size="small">Small Label</Label>
				<Label size="default">Default Label</Label>
				<Label size="large">Large Label</Label>
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default LabelDemo
