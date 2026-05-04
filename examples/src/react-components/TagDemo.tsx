import React, { useState } from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Tag
} from '@toolcase/react-components'

const TagDemo: React.FC = () => {
	const [tags, setTags] = useState(['React', 'TypeScript', 'SCSS', 'Bootstrap'])

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Buttons & Actions</RichPageHeaderChip>}
				title="Tag"
				description="Small label with optional variant color and removable support."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Variants">
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
					<Tag variant="primary">Primary</Tag>
					<Tag variant="secondary">Secondary</Tag>
					<Tag variant="info">Info</Tag>
					<Tag variant="success">Success</Tag>
					<Tag variant="warning">Warning</Tag>
					<Tag variant="danger">Danger</Tag>
				</div>
			</SectionCard>

			<SectionCard title="Removable">
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
					{tags.map((t) => (
						<Tag
							key={t}
							variant="primary"
							removable
							onRemove={() => setTags((prev) => prev.filter((x) => x !== t))}
						>
							{t}
						</Tag>
					))}
					{tags.length === 0 && <span style={{ color: '#64748b' }}>All tags removed</span>}
				</div>
			</SectionCard>

		</div>
		
			</div>
		</div>
	</div>
	)
}

export default TagDemo
