import React from 'react'
import { EmptyState } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const EmptyStateDemo: React.FC = () => (
	<DemoPage
		eyebrow="Feedback"
		title="EmptyState"
		lede="A placeholder shown when a list or section has no content yet."
	>
		<DemoSection title="Basic">
			<EmptyState icon="inbox">
				<p>No items found.</p>
			</EmptyState>
		</DemoSection>

		<DemoSection title="With Guidance Text">
			<EmptyState icon="file-earmark-code">
				<p>No schemas created yet.</p>
				<p>Click the <strong>Add</strong> button to create a new schema.</p>
			</EmptyState>
		</DemoSection>

		<DemoSection title="Without Icon">
			<EmptyState>
				<p>Nothing to display.</p>
			</EmptyState>
		</DemoSection>

		<DemoSection title="Custom Children">
			<EmptyState icon="cloud-upload">
				<p>No files uploaded.</p>
				<button className="btn btn-sm btn-primary mt-2">Upload File</button>
			</EmptyState>
		</DemoSection>

		<DemoSection title="Various Icons">
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
		</DemoSection>
	</DemoPage>
)

export default EmptyStateDemo
