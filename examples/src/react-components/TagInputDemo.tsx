import React, { useState } from 'react'
import { TagInput } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const TagInputDemo: React.FC = () => {
	const [tags, setTags] = useState<string[]>(['pixel-art', 'retro'])
	const [controlled, setControlled] = useState<string[]>(['unity', 'godot'])

	return (
		<DemoPage
			eyebrow="Inputs"
			title="TagInput"
			lede="A tag input with autocomplete recommendations, controlled/uncontrolled modes, and tag limits."
		>
			<DemoSection title="Basic with Recommendations">
				<TagInput
					label="Tags"
					recommendations={['pixel-art', 'retro', '2d', '3d', 'platformer', 'puzzle', 'rpg', 'action']}
					value={tags}
					onChange={setTags}
					placeholder="Add a tag…"
				/>
				<p style={{ color: '#64748b', marginTop: 8, marginBottom: 0, fontSize: '0.8rem' }}>Tags: {tags.join(', ')}</p>
			</DemoSection>

			<DemoSection title="Controlled">
				<TagInput
					label="Engines"
					recommendations={['unity', 'godot', 'unreal', 'phaser', 'pixi', 'three.js']}
					value={controlled}
					onChange={setControlled}
				/>
			</DemoSection>

			<DemoSection title="Allow Create">
				<TagInput
					label="Custom Tags"
					recommendations={['alpha', 'beta', 'release']}
					defaultValue={['alpha']}
					allowCreate
					placeholder="Type and press Enter…"
				/>
			</DemoSection>

			<DemoSection title="Max Tags (3)">
				<TagInput
					label="Limited"
					recommendations={['red', 'green', 'blue', 'yellow', 'purple']}
					defaultValue={['red', 'green']}
					maxTags={3}
					allowCreate
				/>
			</DemoSection>

			<DemoSection title="Disabled">
				<TagInput
					label="Read-only Tags"
					defaultValue={['locked', 'readonly']}
					disabled
				/>
			</DemoSection>
		</DemoPage>
	)
}

export default TagInputDemo
