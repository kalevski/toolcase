import React, { useState } from 'react'
import { MarkdownEditor, Card, CodeSnippet } from '@toolcase/react-components'

const usageCode = `import { MarkdownEditor } from '@toolcase/react-components'

const [content, setContent] = useState('')

<MarkdownEditor
  label="Description"
  value={content}
  onChange={setContent}
  height={360}
  toolbar
/>`

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
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">MarkdownEditor</h1>
					<p className="text-muted mb-0">Split-pane editor with write/preview tabs and a formatting toolbar.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">With Toolbar</h2>
						<MarkdownEditor
							label="Content"
							value={content}
							onChange={setContent}
							height={360}
							toolbar
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">No Toolbar</h2>
						<MarkdownEditor
							label="Notes"
							value={minimal}
							onChange={setMinimal}
							height={200}
							toolbar={false}
							placeholder="Plain textarea with preview tab…"
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet language="typescript" code={usageCode} />
					</Card>
				</div>
			</div>
		</div>
	)
}
