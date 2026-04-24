import React from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Textarea
} from '@toolcase/react-components'

const TextareaDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="Textarea"
				description="A labeled textarea with form-control styling."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Basic">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<Textarea label="Description" placeholder="Enter a description..." rows={3} />
				<Textarea label="Notes" placeholder="Additional notes..." rows={4} />
			</div>
		</SectionCard>

		<SectionCard title="States">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<Textarea label="Editable" placeholder="Type here..." rows={3} />
				<Textarea label="Disabled" placeholder="Cannot edit" rows={3} disabled />
				<Textarea label="Read-only" value="This content cannot be changed." rows={2} readOnly />
			</div>
		</SectionCard>

		<SectionCard title="Without Label">
			<Textarea placeholder="Write your message..." rows={4} />
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default TextareaDemo
