import React from 'react'
import {
	EmptyState,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const EmptyStateDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Feedback</RichPageHeaderChip>}
				title="EmptyState"
				description="A placeholder shown when a list or section has no content yet."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Basic">
			<EmptyState icon="inbox">
				<p>No items found.</p>
			</EmptyState>
		</SectionCard>

		<SectionCard title="With Guidance Text">
			<EmptyState icon="file-earmark-code">
				<p>No schemas created yet.</p>
				<p>Click the <strong>Add</strong> button to create a new schema.</p>
			</EmptyState>
		</SectionCard>

		<SectionCard title="Without Icon">
			<EmptyState>
				<p>Nothing to display.</p>
			</EmptyState>
		</SectionCard>

		<SectionCard title="Custom Children">
			<EmptyState icon="cloud-upload">
				<p>No files uploaded.</p>
				<button className="btn btn-sm btn-primary mt-2">Upload File</button>
			</EmptyState>
		</SectionCard>

		<SectionCard title="Various Icons">
			<div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
				<EmptyState icon="people">
					<p>No members</p>
				</EmptyState>
				<EmptyState icon="folder2-open">
					<p>No projects</p>
				</EmptyState>
				<EmptyState icon="gear">
					<p>No configs</p>
				</EmptyState>
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default EmptyStateDemo
