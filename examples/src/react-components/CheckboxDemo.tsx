import React, { useState } from 'react'
import {
	Checkbox,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const CheckboxDemo: React.FC = () => {
	const [checked, setChecked] = useState(true)

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="Checkbox"
				description="A form-check checkbox input with optional label and inline layout."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Basic">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
					<Checkbox label="Accept terms and conditions" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
					<Checkbox label="Subscribe to newsletter" />
					<Checkbox label="Remember me" defaultChecked />
				</div>
			</SectionCard>

			<SectionCard title="Inline">
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
					<Checkbox label="Option A" inline />
					<Checkbox label="Option B" inline defaultChecked />
					<Checkbox label="Option C" inline />
				</div>
			</SectionCard>

			<SectionCard title="Disabled">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
					<Checkbox label="Disabled unchecked" disabled />
					<Checkbox label="Disabled checked" disabled checked />
				</div>
			</SectionCard>

			<SectionCard title="Without Label">
				<div style={{ display: 'flex', gap: 12 }}>
					<Checkbox defaultChecked />
					<Checkbox />
					<Checkbox disabled checked />
				</div>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default CheckboxDemo
