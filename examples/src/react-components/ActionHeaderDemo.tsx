import React, { useState } from 'react'
import { ActionHeader, ActionHeaderAction, Card, CodeSnippet } from '@toolcase/react-components'

const ACTIONS: ActionHeaderAction[] = [
	{ key: 'edit', icon: 'pencil', label: 'Edit', alt: 'Edit the file', disabled: true },
	{ key: 'delete', icon: 'trash', label: 'Delete', alt: 'Delete the file' },
	{ key: 'move', icon: 'arrows-move', label: 'Move', alt: 'Move the file' },
	{ key: 'copy', icon: 'clipboard', label: 'Copy', alt: 'Copy the file' },
	{ key: 'rename', icon: 'input-cursor-text', label: 'Rename', alt: 'Rename the file' },
]

const ICON_ONLY_ACTIONS: ActionHeaderAction[] = [
	{ key: 'bold', icon: 'type-bold', label: '' },
	{ key: 'italic', icon: 'type-italic', label: '' },
	{ key: 'underline', icon: 'type-underline', label: '' },
	{ key: 'link', icon: 'link-45deg', label: '' },
]

const ActionHeaderDemo = () => {
	const [log, setLog] = useState<string[]>([])

	const handleExec = (key: string) => {
		setLog(prev => [`Executed: ${key}`, ...prev.slice(0, 9)])
	}

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">ActionHeader</h1>
					<p className="text-muted mb-0">A header bar with a title slot and a row of icon-based action buttons with tooltips and disabled states.</p>
				</div>
			</div>

			<div className="row g-3 mb-5">
				<div className="col-md-7">
				<Card>
					<div className="d-flex flex-column gap-3">
					<h5 className="mb-0">With title</h5>
					<ActionHeader actions={ACTIONS} onExec={handleExec}>
						document.txt
					</ActionHeader>

					<h5 className="mb-0 mt-3">Icon-only actions</h5>
					<ActionHeader actions={ICON_ONLY_ACTIONS} onExec={handleExec}>
						Formatting toolbar
					</ActionHeader>

					<h5 className="mb-0 mt-3">No children</h5>
					<ActionHeader actions={ACTIONS.slice(0, 3)} onExec={handleExec} />

					<h5 className="mb-0 mt-3">Disabled</h5>
					<ActionHeader actions={ACTIONS} onExec={handleExec} disabled>
						All disabled
					</ActionHeader>
					</div>
				</Card>
				</div>

				<div className="col-md-5">
				<Card>
					<h5 className="mb-3">Event Log</h5>
					<pre className="p-3 bg-light rounded" style={{ fontSize: '0.78rem', minHeight: 200 }}>
						{log.length ? log.join('\n') : '(click an action)'}
					</pre>
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
						code={`import { ActionHeader } from '@toolcase/react-components'

<ActionHeader
  actions={[
    { key: 'edit', icon: 'pencil', label: 'Edit' },
    { key: 'delete', icon: 'trash', label: 'Delete' },
  ]}
  onExec={(key) => console.log(key)}
>
  Project Settings
</ActionHeader>`}
					/>
				</Card>
			</div>
		</div>
		</div>
	)
}

export default ActionHeaderDemo
