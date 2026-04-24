import React, { useState } from 'react'
import { Tag } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const TagDemo: React.FC = () => {
	const [tags, setTags] = useState(['React', 'TypeScript', 'SCSS', 'Bootstrap'])

	return (
		<DemoPage
			eyebrow="Buttons & Actions"
			title="Tag"
			lede="Small label with optional variant color and removable support."
		>
			<DemoSection title="Variants">
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
					<Tag variant="primary">Primary</Tag>
					<Tag variant="secondary">Secondary</Tag>
					<Tag variant="info">Info</Tag>
					<Tag variant="success">Success</Tag>
					<Tag variant="warning">Warning</Tag>
					<Tag variant="danger">Danger</Tag>
				</div>
			</DemoSection>

			<DemoSection title="Removable">
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
			</DemoSection>

			<DemoSection title="Using label prop">
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
					<Tag label="v1.0.0" variant="info" />
					<Tag label="stable" variant="success" />
					<Tag label="deprecated" variant="danger" />
				</div>
			</DemoSection>
		</DemoPage>
	)
}

export default TagDemo
