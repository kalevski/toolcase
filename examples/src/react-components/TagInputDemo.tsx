import React, { useState } from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	TagInput
} from '@toolcase/react-components'

const TagInputDemo: React.FC = () => {
	const [tags, setTags] = useState<string[]>(['pixel-art', 'retro'])
	const [controlled, setControlled] = useState<string[]>(['unity', 'godot'])

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="TagInput"
				description="A tag input with autocomplete recommendations, controlled/uncontrolled modes, and tag limits."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Basic with Recommendations">
				<TagInput
					label="Tags"
					recommendations={['pixel-art', 'retro', '2d', '3d', 'platformer', 'puzzle', 'rpg', 'action']}
					value={tags}
					onChange={setTags}
					placeholder="Add a tag…"
				/>
				<p style={{ color: '#64748b', marginTop: 8, marginBottom: 0, fontSize: '0.8rem' }}>Tags: {tags.join(', ')}</p>
			</SectionCard>

			<SectionCard title="Controlled">
				<TagInput
					label="Engines"
					recommendations={['unity', 'godot', 'unreal', 'phaser', 'pixi', 'three.js']}
					value={controlled}
					onChange={setControlled}
				/>
			</SectionCard>

			<SectionCard title="Allow Create">
				<TagInput
					label="Custom Tags"
					recommendations={['alpha', 'beta', 'release']}
					defaultValue={['alpha']}
					allowCreate
					placeholder="Type and press Enter…"
				/>
			</SectionCard>

			<SectionCard title="Max Tags (3)">
				<TagInput
					label="Limited"
					recommendations={['red', 'green', 'blue', 'yellow', 'purple']}
					defaultValue={['red', 'green']}
					maxTags={3}
					allowCreate
				/>
			</SectionCard>

			<SectionCard title="Disabled">
				<TagInput
					label="Read-only Tags"
					defaultValue={['locked', 'readonly']}
					disabled
				/>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default TagInputDemo
