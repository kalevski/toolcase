import React, { useState } from 'react'
import {
	MarkdownEditor,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const SAMPLE = `# Hello World

This is a **Markdown** editor with a live preview.

- Write on the **Write** tab
- Preview renders on the **Preview** tab

> Blockquote here

\`inline code\`

[Link to example](https://example.com)
`

export const MarkdownEditorDemo: React.FC = () => {
	const [content, setContent] = useState(SAMPLE)
	const [minimal, setMinimal] = useState('')

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Editors</RichPageHeaderChip>}
				title="MarkdownEditor"
				description="Split-pane editor with write/preview tabs and a formatting toolbar."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="With Toolbar">
				<MarkdownEditor
					label="Content"
					value={content}
					onChange={setContent}
					height={360}
					toolbar
				/>
			</SectionCard>

			<SectionCard title="No Toolbar">
				<MarkdownEditor
					label="Notes"
					value={minimal}
					onChange={setMinimal}
					height={200}
					toolbar={false}
					placeholder="Plain textarea with preview tab…"
				/>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}
