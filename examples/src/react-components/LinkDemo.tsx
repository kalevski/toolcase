import React from 'react'
import {
	Link,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const LinkDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Buttons & Actions</RichPageHeaderChip>}
				title="Link"
				description="Styled anchor element with variant colors, underline control, and external link indicator."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Variants">
			<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
				<Link href="#" variant="primary">Primary</Link>
				<Link href="#" variant="secondary">Secondary</Link>
				<Link href="#" variant="info">Info</Link>
				<Link href="#" variant="success">Success</Link>
				<Link href="#" variant="warning">Warning</Link>
				<Link href="#" variant="danger">Danger</Link>
			</div>
		</SectionCard>

		<SectionCard title="Underline">
			<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
				<Link href="#" underline="always">Always underlined</Link>
				<Link href="#" underline="hover">Underline on hover</Link>
				<Link href="#" underline="none">No underline</Link>
			</div>
		</SectionCard>

		<SectionCard title="External">
			<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
				<Link href="https://example.com" external>External Link</Link>
				<Link href="https://example.com" external variant="info">External Info</Link>
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default LinkDemo
