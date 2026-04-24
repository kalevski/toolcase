import React, { useState } from 'react'
import { FileTags, FileTag } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const ALL_TAGS: FileTag[] = [
	{ id: 'player', name: 'Player' },
	{ id: 'enemy', name: 'Enemy' },
	{ id: 'ui', name: 'UI' },
	{ id: 'background', name: 'Background' },
	{ id: 'sfx', name: 'SFX' },
	{ id: 'music', name: 'Music' },
	{ id: 'tilemap', name: 'Tilemap' },
	{ id: 'animation', name: 'Animation' },
]

const FileTagsDemo: React.FC = () => {
	const [selected1, setSelected1] = useState<string[]>(['player', 'ui'])
	const [selected2, setSelected2] = useState<string[]>(['sfx', 'music', 'background'])

	return (
		<DemoPage
			eyebrow="Media & Files"
			title="FileTags"
			lede="A tag picker with search-as-you-type dropdown for adding and removing tags from files."
		>
			<DemoSection title="Editable" caption="Click the + button to add tags, click a tag to remove it.">
				<FileTags
					tags={ALL_TAGS}
					selectedIds={selected1}
					onChange={setSelected1}
				/>
				<p className="text-muted mt-3 mb-0" style={{ fontSize: '0.8rem' }}>
					Selected: {selected1.join(', ') || '(none)'}
				</p>
			</DemoSection>

			<DemoSection title="Read-only" caption="Tags are displayed without editing controls.">
				<FileTags
					tags={ALL_TAGS}
					selectedIds={selected2}
					readonly
				/>
			</DemoSection>

			<DemoSection title="No Tags Selected">
				<FileTags
					tags={ALL_TAGS}
					selectedIds={[]}
					onChange={() => {}}
				/>
			</DemoSection>

			<DemoSection title="All Tags Selected">
				<FileTags
					tags={ALL_TAGS}
					selectedIds={ALL_TAGS.map((t) => t.id)}
					onChange={() => {}}
				/>
			</DemoSection>
		</DemoPage>
	)
}

export default FileTagsDemo
