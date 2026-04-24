import React, { useState } from 'react'
import {
	FileTag,
	FileTags,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

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
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Media & Files</RichPageHeaderChip>}
				title="FileTags"
				description="A tag picker with search-as-you-type dropdown for adding and removing tags from files."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Editable">
				<FileTags
					tags={ALL_TAGS}
					selectedIds={selected1}
					onChange={setSelected1}
				/>
				<p className="text-muted mt-3 mb-0" style={{ fontSize: '0.8rem' }}>
					Selected: {selected1.join(', ') || '(none)'}
				</p>
			</SectionCard>

			<SectionCard title="Read-only">
				<FileTags
					tags={ALL_TAGS}
					selectedIds={selected2}
					readonly
				/>
			</SectionCard>

			<SectionCard title="No Tags Selected">
				<FileTags
					tags={ALL_TAGS}
					selectedIds={[]}
					onChange={() => {}}
				/>
			</SectionCard>

			<SectionCard title="All Tags Selected">
				<FileTags
					tags={ALL_TAGS}
					selectedIds={ALL_TAGS.map((t) => t.id)}
					onChange={() => {}}
				/>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default FileTagsDemo
