import React, { useState } from 'react'
import { ActionItems } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const ActionItemsDemo: React.FC = () => {
	const [log, setLog] = useState<string[]>([])

	const handleClick = (key: string) => {
		setLog((prev) => [`Clicked: ${key}`, ...prev.slice(0, 9)])
	}

	return (
		<DemoPage
			eyebrow="Buttons & Actions"
			title="ActionItems"
			lede="A kebab menu (three-dot) dropdown for contextual actions on rows or cards."
		>
			<DemoSection title="With Icons" caption="Typical file or row action menu.">
				<div className="d-flex align-items-center gap-3">
					<span className="text-muted">document.pdf</span>
					<ActionItems
						items={[
							{ key: 'edit', icon: 'pencil', label: 'Edit' },
							{ key: 'duplicate', icon: 'clipboard', label: 'Duplicate' },
							{ key: 'download', icon: 'download', label: 'Download' },
							{ key: 'delete', icon: 'trash', label: 'Delete' },
						]}
						onActionClick={handleClick}
					/>
				</div>
			</DemoSection>

			<DemoSection title="Without Icons" caption="Text-only menu items.">
				<div className="d-flex align-items-center gap-3">
					<span className="text-muted">settings.json</span>
					<ActionItems
						items={[
							{ key: 'rename', label: 'Rename' },
							{ key: 'move', label: 'Move to folder' },
							{ key: 'archive', label: 'Archive' },
						]}
						onActionClick={handleClick}
					/>
				</div>
			</DemoSection>

			<DemoSection title="In a List Context">
				<ul className="list-group list-group-flush">
					{['player.png', 'enemy.png', 'tilemap.json'].map((name) => (
						<li key={name} className="list-group-item d-flex align-items-center justify-content-between">
							<span>{name}</span>
							<ActionItems
								items={[
									{ key: 'preview', icon: 'eye', label: 'Preview' },
									{ key: 'download', icon: 'download', label: 'Download' },
									{ key: 'delete', icon: 'trash', label: 'Delete' },
								]}
								onActionClick={(key) => handleClick(`${key} → ${name}`)}
							/>
						</li>
					))}
				</ul>
			</DemoSection>

			<DemoSection title="Event Log">
				<pre className="p-3 bg-light rounded" style={{ fontSize: '0.78rem', minHeight: 150 }}>
					{log.length ? log.join('\n') : '(click any action)'}
				</pre>
			</DemoSection>
		</DemoPage>
	)
}

export default ActionItemsDemo
