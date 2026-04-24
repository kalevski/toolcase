import React from 'react'
import {
	Divider,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const DividerDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Layout & Surfaces</RichPageHeaderChip>}
				title="Divider"
				description="A horizontal or vertical divider line with optional label for separating content."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Default (horizontal)">
			<p>Content above</p>
			<Divider />
			<p>Content below</p>
		</SectionCard>

		<SectionCard title="Horizontal with label">
			<Divider label="or" />
		</SectionCard>

		<SectionCard title="Horizontal with longer label">
			<Divider label="section break" />
		</SectionCard>

		<SectionCard title="Vertical">
			<div style={{ display: 'flex', alignItems: 'center', gap: '1rem', height: 80 }}>
				<span>Left</span>
				<Divider vertical />
				<span>Right</span>
			</div>
		</SectionCard>

		<SectionCard title="Vertical with label">
			<div style={{ display: 'flex', alignItems: 'stretch', gap: '1rem', height: 120 }}>
				<span>Left</span>
				<Divider vertical label="or" />
				<span>Right</span>
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default DividerDemo
