import React from 'react'
import {
	Radio,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const RadioDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="Radio"
				description="A form-check radio input with optional label and inline layout."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Basic">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
				<Radio label="Option A" name="basic" defaultChecked />
				<Radio label="Option B" name="basic" />
				<Radio label="Option C" name="basic" />
			</div>
		</SectionCard>

		<SectionCard title="Inline">
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
				<Radio label="Small" name="size" inline defaultChecked />
				<Radio label="Medium" name="size" inline />
				<Radio label="Large" name="size" inline />
			</div>
		</SectionCard>

		<SectionCard title="Disabled">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
				<Radio label="Disabled unchecked" name="dis" disabled />
				<Radio label="Disabled checked" name="dis" disabled checked />
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default RadioDemo
