import React, { useState } from 'react'
import { FileTags, FileTag, Card, CodeSnippet } from '@toolcase/react-components'

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
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">FileTags</h1>
					<p className="text-muted mb-0">A tag picker with search-as-you-type dropdown for adding and removing tags from files.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Editable</h2>
						<p className="text-muted mb-3">Click the + button to add tags, click a tag to remove it.</p>
						<FileTags
							tags={ALL_TAGS}
							selectedIds={selected1}
							onChange={setSelected1}
						/>
						<p className="text-muted mt-3 mb-0" style={{ fontSize: '0.8rem' }}>
							Selected: {selected1.join(', ') || '(none)'}
						</p>
					</Card>
				</div>
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Read-only</h2>
						<p className="text-muted mb-3">Tags are displayed without editing controls.</p>
						<FileTags
							tags={ALL_TAGS}
							selectedIds={selected2}
							readonly
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">No Tags Selected</h2>
						<FileTags
							tags={ALL_TAGS}
							selectedIds={[]}
							onChange={() => {}}
						/>
					</Card>
				</div>
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">All Tags Selected</h2>
						<FileTags
							tags={ALL_TAGS}
							selectedIds={ALL_TAGS.map((t) => t.id)}
							onChange={() => {}}
						/>
					</Card>
				</div>
			</div>

			{/* Usage */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet
							language="typescript"
							code={`import { FileTags } from '@toolcase/react-components'

<FileTags
  tags={[
    { name: 'document.pdf', type: 'file' },
    { name: 'images', type: 'folder' },
  ]}
  onRemove={handleRemove}
/>`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default FileTagsDemo
