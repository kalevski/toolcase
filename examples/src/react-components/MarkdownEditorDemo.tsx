import React, { useState } from 'react'
import { MarkdownEditor } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

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
		<DemoPage
			eyebrow="Editors"
			title="MarkdownEditor"
			lede="Split-pane editor with write/preview tabs and a formatting toolbar."
		>
			<DemoSection title="With Toolbar">
				<MarkdownEditor
					label="Content"
					value={content}
					onChange={setContent}
					height={360}
					toolbar
				/>
			</DemoSection>

			<DemoSection title="No Toolbar">
				<MarkdownEditor
					label="Notes"
					value={minimal}
					onChange={setMinimal}
					height={200}
					toolbar={false}
					placeholder="Plain textarea with preview tab…"
				/>
			</DemoSection>
		</DemoPage>
	)
}
