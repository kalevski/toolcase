import React from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Text
} from '@toolcase/react-components'

const TextDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Typography</RichPageHeaderChip>}
				title="Text"
				description="Semantic text component with variant, size, and polymorphic tag support."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Variants">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<Text variant="default">Default text — standard body copy.</Text>
				<Text variant="muted">Muted text — secondary / helper content.</Text>
				<Text variant="code">const x = 42; // inline code</Text>
				<Text variant="mono">Monospace text — for IDs and hashes.</Text>
				<Text variant="truncate" style={{ maxWidth: 200 }}>
					This is a very long text that should be truncated with an ellipsis when it overflows.
				</Text>
			</div>
		</SectionCard>

		<SectionCard title="Sizes">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<Text size="small">Small text</Text>
				<Text size="default">Default text</Text>
				<Text size="large">Large text</Text>
			</div>
		</SectionCard>

		<SectionCard title="Polymorphic Tag">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<Text as="p">Rendered as &lt;p&gt;</Text>
				<Text as="span">Rendered as &lt;span&gt;</Text>
				<Text as="small">Rendered as &lt;small&gt;</Text>
				<Text as="div">Rendered as &lt;div&gt;</Text>
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default TextDemo
