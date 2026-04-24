import React, { useState } from 'react'
import { ActionHeader, ActionHeaderAction } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

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
		<DemoPage
			eyebrow="Buttons & Actions"
			title="ActionHeader"
			lede="A header bar with a title slot and a row of icon-based action buttons with tooltips and disabled states."
		>
			<DemoSection title="With title">
				<ActionHeader actions={ACTIONS} onExec={handleExec}>
					document.txt
				</ActionHeader>
			</DemoSection>

			<DemoSection title="Icon-only actions">
				<ActionHeader actions={ICON_ONLY_ACTIONS} onExec={handleExec}>
					Formatting toolbar
				</ActionHeader>
			</DemoSection>

			<DemoSection title="No children">
				<ActionHeader actions={ACTIONS.slice(0, 3)} onExec={handleExec} />
			</DemoSection>

			<DemoSection title="Disabled">
				<ActionHeader actions={ACTIONS} onExec={handleExec} disabled>
					All disabled
				</ActionHeader>
			</DemoSection>

			<DemoSection title="Event Log">
				<pre className="p-3 bg-light rounded" style={{ fontSize: '0.78rem', minHeight: 200 }}>
					{log.length ? log.join('\n') : '(click an action)'}
				</pre>
			</DemoSection>
		</DemoPage>
	)
}

export default ActionHeaderDemo
